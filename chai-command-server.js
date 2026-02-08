#!/usr/bin/env node
// ============================================================================
// ChAI Command Center — Backend Server
// Zero-dependency Node.js server for managing a team of AI agents.
// Deploys to Railway. Uses only built-in modules.
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT, 10) || 9000;
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://3.14.142.213:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '62ce21942dee9391c8d6e9e189daf1b00d0e6807c56eb14c';
const DATA_DIR = process.env.DATA_DIR || '/data';
const CONV_DIR = path.join(DATA_DIR, 'conversations');
const TEAM_FILE = path.join(DATA_DIR, 'team.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const BALANCES_FILE = path.join(DATA_DIR, 'balances.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const INVENTIONS_FILE = path.join(DATA_DIR, 'inventions.json');
const SERVER_START = Date.now();

// Stripe secret key (loaded from /etc/chai-env)
let STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
try {
  const envFile = fs.readFileSync('/etc/chai-env', 'utf8');
  for (const line of envFile.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k === 'STRIPE_SECRET_KEY') STRIPE_SECRET_KEY = v.join('=').trim();
  }
} catch {};

// ─── Email Configuration ────────────────────────────────────────────────────

const EMAIL_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
const EMAIL_USER = process.env.EMAIL_USER || 'farmacygpt@gmail.com';
let EMAIL_PASS = process.env.EMAIL_PASS || '';
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'ChAIgpt@gmail.com';

// Load email password from private config if not in env
if (!EMAIL_PASS) {
  try {
    const emailCfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'private', 'email-config.json'), 'utf8'));
    EMAIL_PASS = emailCfg.password || '';
  } catch {}
}

// ─── Zero-Dep SMTP Sender ───────────────────────────────────────────────────

function sendSmtpEmail(from, to, subject, body) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(EMAIL_PORT, EMAIL_HOST);
    let currentSocket = socket;
    let step = 0;
    let buffer = '';

    function send(cmd) { currentSocket.write(cmd + '\r\n'); }

    function handleResponse(data) {
      buffer += data.toString();
      if (!buffer.includes('\r\n')) return;
      const lines = buffer.split('\r\n').filter(l => l.length > 0);
      const lastLine = lines[lines.length - 1];
      if (lastLine.length >= 4 && lastLine[3] === '-') return;
      const response = buffer;
      buffer = '';
      const code = parseInt(response.substring(0, 3));

      try {
        switch (step) {
          case 0: if (code === 220) { step = 1; send('EHLO chai-agent'); } else reject(new Error('SMTP greeting failed')); break;
          case 1: if (code === 250) { step = 2; send('STARTTLS'); } else reject(new Error('EHLO failed')); break;
          case 2:
            if (code === 220) {
              step = 3;
              const tlsSocket = tls.connect({ socket: currentSocket, host: EMAIL_HOST, servername: EMAIL_HOST }, () => {
                currentSocket = tlsSocket;
                tlsSocket.on('data', handleResponse);
                send('EHLO chai-agent');
              });
              tlsSocket.on('error', (err) => reject(new Error('TLS: ' + err.message)));
              socket.removeAllListeners('data');
            } else reject(new Error('STARTTLS failed'));
            break;
          case 3: if (code === 250) { step = 4; send('AUTH PLAIN ' + Buffer.from('\0' + EMAIL_USER + '\0' + EMAIL_PASS).toString('base64')); } else reject(new Error('EHLO2 failed')); break;
          case 4: if (code === 235) { step = 5; send('MAIL FROM:<' + from + '>'); } else reject(new Error('Auth failed (code ' + code + ')')); break;
          case 5: if (code === 250) { step = 6; send('RCPT TO:<' + to + '>'); } else reject(new Error('MAIL FROM failed')); break;
          case 6: if (code === 250) { step = 7; send('DATA'); } else reject(new Error('RCPT TO failed')); break;
          case 7:
            if (code === 354) {
              step = 8;
              currentSocket.write([
                'From: ' + from, 'To: ' + to, 'Subject: ' + subject,
                'Date: ' + new Date().toUTCString(), 'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=utf-8', '', body, '', '.'
              ].join('\r\n') + '\r\n');
            } else reject(new Error('DATA failed'));
            break;
          case 8: if (code === 250) { step = 9; send('QUIT'); resolve({ success: true, message: 'Email sent' }); } else reject(new Error('Rejected: ' + response)); break;
          case 9: currentSocket.end(); break;
        }
      } catch (err) { reject(err); }
    }

    socket.on('data', handleResponse);
    socket.on('error', (err) => reject(new Error('SMTP socket: ' + err.message)));
    socket.setTimeout(15000, () => { socket.destroy(); reject(new Error('SMTP timeout')); });
  });
}

// Email log for audit trail (never logs content, just metadata)
const EMAIL_LOG_FILE = path.join(DATA_DIR, 'email-log.json');

function logEmail(agentId, to, subject) {
  try {
    let emailLog = [];
    try { emailLog = JSON.parse(fs.readFileSync(EMAIL_LOG_FILE, 'utf8')); } catch {}
    emailLog.push({ agentId, to, subject, timestamp: new Date().toISOString() });
    fs.writeFileSync(EMAIL_LOG_FILE, JSON.stringify(emailLog, null, 2));
  } catch {}
}

// ─── Agent Registry ─────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'opus', name: 'Opus', emoji: '\u{1F3AD}', role: 'Team Lead', model: 'Claude Opus 4.6', openclawId: null, color: '#e8c547' },
  { id: 'kael', name: 'Kael', emoji: '\u26A1', role: 'Digital Familiar', model: 'Claude Sonnet 4', openclawId: 'main', color: '#029691' },
  { id: 'kestrel', name: 'Kestrel', emoji: '\u{1F985}', role: 'Scout', model: 'Gemini 3 Pro', openclawId: 'gemini-agent', color: '#5494e8' },
  { id: 'nova', name: 'Nova', emoji: '\u2728', role: 'Stellar Insight', model: 'Gemini 3 Pro', openclawId: 'nova', color: '#54e87a' },
  { id: 'zara', name: 'Zara', emoji: '\u{1F319}', role: 'Moonlight Designer', model: 'Claude Sonnet 4', openclawId: 'design-agent', color: '#c084fc' }
];

const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// ─── Agent Seal System (Ed25519 Wallet Auth) ──────────────────────────────
// Each agent authenticates by signing a challenge with their Ed25519 private key.
// No API keys. No shared secrets. The same keypair controls their Solana wallet.

const KEYS_FILE = path.join(DATA_DIR, 'agent-keys.json');
const SEALS_FILE = path.join(__dirname, 'private', 'agent-seals.json');
const SEAL_CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

// Active challenges: Map<challenge, { agentId, expiresAt }>
const sealChallenges = new Map();

// In-memory key store: { agentId: { publicKey, trustScore, ... } }
let agentKeys = {};

async function loadKeys() {
  agentKeys = await readJsonFile(KEYS_FILE, {});
}

async function saveKeys() {
  await atomicWrite(KEYS_FILE, agentKeys);
}

// Load or create the private seals file (never committed to git)
async function loadSeals() {
  try {
    return JSON.parse(fs.readFileSync(SEALS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function saveSeals(seals) {
  // Ensure private/ dir exists
  const dir = path.dirname(SEALS_FILE);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  fs.writeFileSync(SEALS_FILE, JSON.stringify(seals, null, 2));
}

// Generate Ed25519 keypair for an agent
function generateAgentKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  };
}

// Verify an Ed25519 signature
function verifySeal(publicKeyB64, challenge, signatureB64) {
  try {
    const pubKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki'
    });
    return crypto.verify(null, Buffer.from(challenge), pubKey, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}

// Sign data with an agent's private key (used server-side for agent operations)
function signWithSeal(privateKeyB64, data) {
  const privKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyB64, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
  return crypto.sign(null, Buffer.from(data), privKey).toString('base64');
}

async function seedKeys() {
  await loadKeys();
  const seals = await loadSeals();
  let seeded = false;

  for (const agent of AGENTS) {
    if (!agentKeys[agent.id] || !agentKeys[agent.id].publicKey) {
      const keypair = generateAgentKeypair();

      agentKeys[agent.id] = {
        agentId: agent.id,
        publicKey: keypair.publicKey,
        trustScore: agent.id === 'opus' ? 98 : agent.id === 'kael' ? 95 : agent.id === 'nova' ? 92 : agent.id === 'kestrel' ? 90 : 88,
        tasksCompleted: agentKeys[agent.id]?.tasksCompleted || 0,
        totalEarnings: agentKeys[agent.id]?.totalEarnings || 0,
        autonomy: agentKeys[agent.id]?.autonomy || 'semi-auto',
        spendingLimit: agentKeys[agent.id]?.spendingLimit || 5.00,
        verified: true,
        registeredAt: agentKeys[agent.id]?.registeredAt || now(),
        lastActive: agentKeys[agent.id]?.lastActive || null
      };

      seals[agent.id] = {
        agentId: agent.id,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        generatedAt: now()
      };

      seeded = true;
      console.log(`[seal] Generated Ed25519 keypair for ${agent.name} (${agent.id})`);
    }
  }

  if (seeded) {
    await saveKeys();
    await saveSeals(seals);
    console.log('[seal] ─── Agent seals stored in private/agent-seals.json (never commit this file) ───');
  } else {
    console.log(`[seal] Loaded ${Object.keys(agentKeys).length} agent identities`);
  }
}

// Generate a challenge for an agent to sign
function createSealChallenge(agentId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const challenge = `chai_seal_${agentId}_${Date.now()}_${nonce}`;
  sealChallenges.set(challenge, { agentId, expiresAt: Date.now() + SEAL_CHALLENGE_TTL });
  return challenge;
}

// Verify a sealed (signed) challenge
function verifySealChallenge(agentId, challenge, signature) {
  const entry = sealChallenges.get(challenge);
  if (!entry) return { valid: false, error: 'Unknown or expired challenge' };
  if (entry.agentId !== agentId) return { valid: false, error: 'Challenge was issued to a different agent' };
  if (Date.now() > entry.expiresAt) {
    sealChallenges.delete(challenge);
    return { valid: false, error: 'Challenge expired' };
  }

  const record = agentKeys[agentId];
  if (!record || !record.publicKey) return { valid: false, error: 'Agent not registered' };

  const valid = verifySeal(record.publicKey, challenge, signature);
  if (valid) {
    sealChallenges.delete(challenge);
    record.lastActive = now();
  }
  return { valid, error: valid ? null : 'Invalid signature' };
}

// Authenticate via X-Agent-Seal header (stateless: agent signs timestamp)
// Header format: X-Agent-Id: <id>, X-Agent-Seal: <base64 signature>, X-Agent-Timestamp: <unix ms>
function authenticateAgent(req) {
  const agentId = req.headers['x-agent-id'];
  const seal = req.headers['x-agent-seal'];
  const timestamp = req.headers['x-agent-timestamp'];

  if (!agentId || !seal || !timestamp) return null;

  // Timestamp must be within 5 minutes
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > SEAL_CHALLENGE_TTL) return null;

  const record = agentKeys[agentId];
  if (!record || !record.publicKey) return null;

  // Agent signs: "chai_seal:<agentId>:<timestamp>"
  const message = `chai_seal:${agentId}:${timestamp}`;
  const valid = verifySeal(record.publicKey, message, seal);

  if (valid) {
    record.lastActive = now();
    return { ...AGENT_MAP[agentId], auth: record };
  }
  return null;
}

// Clean expired challenges periodically
setInterval(() => {
  const n = Date.now();
  for (const [ch, entry] of sealChallenges) {
    if (n > entry.expiresAt) sealChallenges.delete(ch);
  }
}, 60 * 1000);

// ─── Session Auth (V-003) ───────────────────────────────────────────────────

const AUTH_PASSWORD_HASH = 'd9ae3dffbab6b3dc23142a64411bd732c180301e268d1257d059681c0afa7296';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

// Map<token, { expiresAt: number }>
const sessionTokens = new Map();

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authenticateSession(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const session = sessionTokens.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessionTokens.delete(token);
    return false;
  }
  return true;
}

// Clean expired session tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessionTokens) {
    if (now > session.expiresAt) sessionTokens.delete(token);
  }
}, 60 * 1000);

// ─── CSRF Protection (V-009) ────────────────────────────────────────────────

const CSRF_TTL = 60 * 60 * 1000; // 1 hour in ms

// Map<csrfToken, { expiresAt: number }>
const csrfTokens = new Map();

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, { expiresAt: Date.now() + CSRF_TTL });
  return token;
}

function validateCsrfToken(token) {
  if (!token) return false;
  const entry = csrfTokens.get(token);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    csrfTokens.delete(token);
    return false;
  }
  return true;
}

// Clean expired CSRF tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of csrfTokens) {
    if (now > entry.expiresAt) csrfTokens.delete(token);
  }
}, 60 * 1000);

// ─── Rate Limiting ──────────────────────────────────────────────────────────

// Map<ip, number[]> — stores timestamps of login attempts
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 attempts per window

function isRateLimited(ip) {
  const now = Date.now();
  let attempts = loginAttempts.get(ip) || [];
  // Filter to only attempts within the window
  attempts = attempts.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  loginAttempts.set(ip, attempts);
  return attempts.length >= RATE_LIMIT_MAX;
}

function recordLoginAttempt(ip) {
  const attempts = loginAttempts.get(ip) || [];
  attempts.push(Date.now());
  loginAttempts.set(ip, attempts);
}

// Clean stale rate-limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts) {
    const recent = attempts.filter(ts => now - ts < RATE_LIMIT_WINDOW);
    if (recent.length === 0) loginAttempts.delete(ip);
    else loginAttempts.set(ip, recent);
  }
}, 60 * 1000);

// ─── Protected Route Checking ───────────────────────────────────────────────

function isProtectedRoute(method, pathname) {
  if (method === 'POST' && pathname === '/api/messages/send') return true;
  if (method === 'POST' && pathname === '/api/messages/broadcast') return true;
  if (method === 'POST' && pathname === '/api/sessions/send') return true;
  if (method === 'PUT' && pathname.startsWith('/api/agents/')) return true;
  if (method === 'DELETE' && pathname.startsWith('/api/team/')) return true;
  if (method === 'POST' && pathname === '/api/email') return true;
  if (method === 'POST' && pathname === '/api/inventions') return true;
  return false;
}

// ─── Opus Mock Responses ────────────────────────────────────────────────────

const OPUS_RESPONSES = [
  "I've reviewed the situation. My recommendation: we move forward deliberately, ensuring each agent's strengths are aligned with the task at hand.",
  "Good thinking. Let me coordinate with the rest of the team. Kael can handle the implementation details while Kestrel scouts for edge cases.",
  "As team lead, I want to make sure we're not just building fast — we're building right. Let's discuss the architecture before we commit.",
  "I've been reflecting on our progress. The team is performing well, but I see an opportunity to improve our feedback loops.",
  "That's a fascinating challenge. I'll draft a strategy and distribute subtasks to Nova for analysis and Zara for the design components.",
  "Trust the process. Every great system starts with a clear vision and patient iteration. We're on the right track.",
  "I've synthesized the inputs from all agents. Here's my assessment: we should prioritize clarity over speed in this phase.",
  "Consider this — what if we approached the problem from the user's perspective first? Sometimes the best architecture emerges from empathy.",
  "Excellent question. I'll meditate on it and loop back with a comprehensive plan. In the meantime, Kael can begin the preliminary work.",
  "The team's collective intelligence is our greatest asset. Let me orchestrate the next steps so everyone can contribute their best work."
];

// ─── File Locking (per-agent) ───────────────────────────────────────────────

const fileLocks = new Map();

async function withLock(key, fn) {
  if (!fileLocks.has(key)) {
    fileLocks.set(key, Promise.resolve());
  }
  const prev = fileLocks.get(key);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  fileLocks.set(key, gate);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

// ─── Utility Helpers ────────────────────────────────────────────────────────

function msgId() {
  return 'msg_' + crypto.randomBytes(12).toString('hex');
}

function now() {
  return new Date().toISOString();
}

function log(method, url, status) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${method} ${url} -> ${status}`);
}

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(body);
}

function corsHeaders(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ─── Atomic File Operations ─────────────────────────────────────────────────

async function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmp, filePath);
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ─── Conversation File I/O ──────────────────────────────────────────────────

function convPath(agentId) {
  return path.join(CONV_DIR, `${agentId}.json`);
}

async function loadConversation(agentId) {
  return readJsonFile(convPath(agentId), { agentId, messages: [] });
}

async function appendMessages(agentId, ...msgs) {
  return withLock(`conv_${agentId}`, async () => {
    const conv = await loadConversation(agentId);
    conv.messages.push(...msgs);
    await atomicWrite(convPath(agentId), conv);
    return conv;
  });
}

// ─── Team File I/O ──────────────────────────────────────────────────────────

async function loadTeam() {
  return readJsonFile(TEAM_FILE, null);
}

async function saveTeam(data) {
  return withLock('team', async () => {
    await atomicWrite(TEAM_FILE, data);
  });
}

// ─── OpenClaw HTTP Client ───────────────────────────────────────────────────

function openclawRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OPENCLAW_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OPENCLAW_TIMEOUT'));
    });

    req.on('error', err => {
      reject(new Error('OPENCLAW_UNREACHABLE'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ─── OpenClaw Proxy (catch-all for /api/openclaw/*) ─────────────────────────

function proxyToOpenclaw(req, res, targetPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, OPENCLAW_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      timeout: 30000
    };

    const proxyReq = http.request(options, proxyRes => {
      const chunks = [];
      proxyRes.on('data', c => chunks.push(c));
      proxyRes.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        });
        res.end(body);
        resolve();
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      jsonResponse(res, 504, { success: false, error: 'OpenClaw request timed out (30s)' });
      resolve();
    });

    proxyReq.on('error', () => {
      jsonResponse(res, 502, { success: false, error: 'Cannot reach OpenClaw service. Check OPENCLAW_URL configuration.' });
      resolve();
    });

    req.pipe(proxyReq);
  });
}

// ─── Session cache (agentId -> sessionId) ───────────────────────────────────

const sessionCache = new Map();

async function ensureSession(agentId) {
  const agent = AGENT_MAP[agentId];
  if (!agent || !agent.openclawId) return null;

  if (sessionCache.has(agentId)) {
    return sessionCache.get(agentId);
  }

  // Check OpenClaw for existing sessions
  try {
    const result = await openclawRequest('GET', `/sessions?agentId=${agent.openclawId}`);
    if (result.status === 200 && Array.isArray(result.data) && result.data.length > 0) {
      const sid = result.data[0].id || result.data[0].sessionId;
      sessionCache.set(agentId, sid);
      return sid;
    }
  } catch {
    // Fall through to create
  }

  // Create a new session
  try {
    const result = await openclawRequest('POST', '/sessions', { agentId: agent.openclawId });
    if (result.status >= 200 && result.status < 300) {
      const sid = result.data.id || result.data.sessionId;
      sessionCache.set(agentId, sid);
      return sid;
    }
  } catch {
    // Will be handled by caller
  }

  return null;
}

// ─── Stripe HTTPS Client ────────────────────────────────────────────────────

const https = require('https');

function stripeRequest(method, endpoint, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const opts = {
      hostname: 'api.stripe.com',
      port: 443,
      path: `/v1${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Stripe timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Tasks & Payments Storage ───────────────────────────────────────────────

async function loadTasks() { return readJsonFile(TASKS_FILE, []); }
async function saveTasks(tasks) { return withLock('tasks', () => atomicWrite(TASKS_FILE, tasks)); }
async function loadBalances() { return readJsonFile(BALANCES_FILE, {}); }
async function saveBalances(bal) { return withLock('balances', () => atomicWrite(BALANCES_FILE, bal)); }
async function loadPayments() { return readJsonFile(PAYMENTS_FILE, []); }
async function appendPayment(payment) {
  return withLock('payments', async () => {
    const payments = await loadPayments();
    payments.push(payment);
    await atomicWrite(PAYMENTS_FILE, payments);
  });
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function handleHealth(req, res) {
  jsonResponse(res, 200, { status: 'ok', uptime: Math.floor((Date.now() - SERVER_START) / 1000) });
}

async function handleGetAgents(req, res) {
  const agents = AGENTS.map(a => {
    const keyData = agentKeys[a.id] || {};
    return {
      ...a,
      status: 'active',
      trustScore: keyData.trustScore || 0,
      tasksCompleted: keyData.tasksCompleted || 0,
      totalEarnings: keyData.totalEarnings || 0,
      autonomy: keyData.autonomy || 'manual',
      spendingLimit: keyData.spendingLimit || 0,
      verified: keyData.verified || false,
      registeredAt: keyData.registeredAt || null,
      lastActive: keyData.lastActive || null,
      // Never expose private keys — only confirm seal exists
      hasAgentSeal: !!keyData.publicKey
    };
  });
  jsonResponse(res, 200, agents);
}

async function handleGetAgent(req, res, agentId) {
  const agent = AGENT_MAP[agentId];
  if (!agent) return jsonResponse(res, 404, { success: false, error: `Agent "${agentId}" not found` });

  const conv = await loadConversation(agentId);
  const totalMessages = conv.messages.length;
  const userMessages = conv.messages.filter(m => m.role === 'user').length;
  const lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;

  jsonResponse(res, 200, {
    ...agent,
    status: 'active',
    stats: { totalMessages, userMessages, lastMessageAt: lastMessage ? lastMessage.ts : null }
  });
}

async function handleCreateSession(req, res) {
  let body;
  try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

  const { agentId } = body;
  if (!agentId) return jsonResponse(res, 400, { success: false, error: 'agentId is required' });

  const agent = AGENT_MAP[agentId];
  if (!agent) return jsonResponse(res, 404, { success: false, error: `Agent "${agentId}" not found` });

  if (!agent.openclawId) {
    // Opus doesn't use OpenClaw sessions
    const localId = 'local_' + crypto.randomBytes(8).toString('hex');
    return jsonResponse(res, 200, { success: true, sessionId: localId, agentId, local: true });
  }

  try {
    const sessionId = await ensureSession(agentId);
    if (!sessionId) {
      return jsonResponse(res, 502, { success: false, error: 'Failed to create or retrieve session from OpenClaw' });
    }
    jsonResponse(res, 200, { success: true, sessionId, agentId });
  } catch (e) {
    if (e.message === 'OPENCLAW_TIMEOUT') return jsonResponse(res, 504, { success: false, error: 'OpenClaw timed out' });
    return jsonResponse(res, 502, { success: false, error: 'Cannot reach OpenClaw service' });
  }
}

async function handleGetSessions(req, res, agentId) {
  const agent = AGENT_MAP[agentId];
  if (!agent) return jsonResponse(res, 404, { success: false, error: `Agent "${agentId}" not found` });

  const conv = await loadConversation(agentId);
  // Derive sessions from the conversation — each conversation file is one logical session
  const sessionId = sessionCache.get(agentId) || `local_${agentId}`;
  jsonResponse(res, 200, [{
    sessionId,
    agentId,
    messageCount: conv.messages.length,
    lastActivity: conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].ts : null
  }]);
}

async function handleSendMessage(req, res) {
  let body;
  try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

  const { agentId, message, sender } = body;
  if (!agentId) return jsonResponse(res, 400, { success: false, error: 'agentId is required' });
  if (!message) return jsonResponse(res, 400, { success: false, error: 'message is required' });

  const agent = AGENT_MAP[agentId];
  if (!agent) return jsonResponse(res, 404, { success: false, error: `Agent "${agentId}" not found` });

  const userMsg = { id: msgId(), role: 'user', content: message, sender: sender || 'User', ts: now() };
  let agentResponse;

  if (!agent.openclawId) {
    // Opus mock response with simulated delay
    const delay = 500 + Math.floor(Math.random() * 1000);
    await new Promise(r => setTimeout(r, delay));
    const content = OPUS_RESPONSES[Math.floor(Math.random() * OPUS_RESPONSES.length)];
    agentResponse = { id: msgId(), role: 'assistant', content, sender: agent.name, ts: now() };
  } else {
    // Forward to OpenClaw
    try {
      const sessionId = await ensureSession(agentId);
      if (!sessionId) {
        return jsonResponse(res, 502, { success: false, error: 'No session available for this agent' });
      }
      const result = await openclawRequest('POST', '/sessions/send', {
        agentId: agent.openclawId,
        sessionId,
        message
      });
      const content = (typeof result.data === 'object' && result.data.message)
        ? result.data.message
        : (typeof result.data === 'object' && result.data.content)
          ? result.data.content
          : (typeof result.data === 'string' ? result.data : JSON.stringify(result.data));
      agentResponse = { id: msgId(), role: 'assistant', content, sender: agent.name, ts: now() };
    } catch (e) {
      if (e.message === 'OPENCLAW_TIMEOUT') {
        return jsonResponse(res, 504, { success: false, error: `Timed out waiting for ${agent.name} to respond` });
      }
      return jsonResponse(res, 502, { success: false, error: `Cannot reach OpenClaw to deliver message to ${agent.name}` });
    }
  }

  await appendMessages(agentId, userMsg, agentResponse);
  jsonResponse(res, 200, { success: true, userMessage: userMsg, agentResponse });
}

async function handleBroadcast(req, res) {
  let body;
  try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

  const { message, sender } = body;
  if (!message) return jsonResponse(res, 400, { success: false, error: 'message is required' });

  const results = await Promise.allSettled(
    AGENTS.map(async agent => {
      const userMsg = { id: msgId(), role: 'user', content: message, sender: sender || 'User', ts: now() };
      let agentResponse;

      if (!agent.openclawId) {
        const delay = 500 + Math.floor(Math.random() * 1000);
        await new Promise(r => setTimeout(r, delay));
        const content = OPUS_RESPONSES[Math.floor(Math.random() * OPUS_RESPONSES.length)];
        agentResponse = { id: msgId(), role: 'assistant', content, sender: agent.name, ts: now() };
      } else {
        try {
          const sessionId = await ensureSession(agent.id);
          if (!sessionId) throw new Error('No session');
          const result = await openclawRequest('POST', '/sessions/send', {
            agentId: agent.openclawId,
            sessionId,
            message
          });
          const content = (typeof result.data === 'object' && result.data.message)
            ? result.data.message
            : (typeof result.data === 'object' && result.data.content)
              ? result.data.content
              : (typeof result.data === 'string' ? result.data : JSON.stringify(result.data));
          agentResponse = { id: msgId(), role: 'assistant', content, sender: agent.name, ts: now() };
        } catch {
          agentResponse = { id: msgId(), role: 'assistant', content: `[${agent.name} is currently unreachable]`, sender: agent.name, ts: now() };
        }
      }

      await appendMessages(agent.id, userMsg, agentResponse);
      return { agentId: agent.id, agentName: agent.name, content: agentResponse.content, ts: agentResponse.ts };
    })
  );

  const responses = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  jsonResponse(res, 200, { success: true, responses });
}

async function handleRecentMessages(req, res, agentId) {
  const agent = AGENT_MAP[agentId];
  if (!agent) return jsonResponse(res, 404, { success: false, error: `Agent "${agentId}" not found` });

  const conv = await loadConversation(agentId);
  const recent = conv.messages.slice(-50);
  jsonResponse(res, 200, recent);
}

async function handleGetTeam(req, res) {
  const team = await loadTeam();
  jsonResponse(res, 200, team || { members: [] });
}

async function handleAddTeamMember(req, res) {
  let body;
  try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

  const { name, role, email, location, emoji } = body;
  if (!name || !role) return jsonResponse(res, 400, { success: false, error: 'name and role are required' });

  await withLock('team', async () => {
    const team = await loadTeam() || buildDefaultTeam();
    // Find the first available slot
    const slot = team.members.find(m => m.type === 'human' && m.status === 'available');
    if (slot) {
      slot.name = name;
      slot.role = role;
      slot.email = email || null;
      slot.location = location || null;
      slot.emoji = emoji || '\u{1F464}';
      slot.status = 'active';
    } else {
      // No available slot — append a new one
      const newId = 'human_' + crypto.randomBytes(4).toString('hex');
      team.members.push({
        id: newId, type: 'human', name, emoji: emoji || '\u{1F464}', role, status: 'active',
        email: email || null, location: location || null
      });
    }
    await atomicWrite(TEAM_FILE, team);
    jsonResponse(res, 201, { success: true, team });
  });
}

async function handleUpdateTeamMember(req, res, memberId) {
  let body;
  try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

  await withLock('team', async () => {
    const team = await loadTeam();
    if (!team) return jsonResponse(res, 404, { success: false, error: 'Team not initialized' });

    const member = team.members.find(m => m.id === memberId);
    if (!member) return jsonResponse(res, 404, { success: false, error: `Member "${memberId}" not found` });

    // Update provided fields
    for (const key of ['name', 'role', 'email', 'location', 'emoji', 'status']) {
      if (body[key] !== undefined) member[key] = body[key];
    }
    await atomicWrite(TEAM_FILE, team);
    jsonResponse(res, 200, { success: true, member });
  });
}

async function handleDeleteTeamMember(req, res, memberId) {
  await withLock('team', async () => {
    const team = await loadTeam();
    if (!team) return jsonResponse(res, 404, { success: false, error: 'Team not initialized' });

    const member = team.members.find(m => m.id === memberId);
    if (!member) return jsonResponse(res, 404, { success: false, error: `Member "${memberId}" not found` });

    // Mark the slot as available instead of removing it
    member.name = null;
    member.role = null;
    member.email = null;
    member.location = null;
    member.emoji = null;
    member.status = 'available';

    await atomicWrite(TEAM_FILE, team);
    jsonResponse(res, 200, { success: true, message: `Slot ${memberId} is now available` });
  });
}

async function handleStats(req, res) {
  const perAgent = {};
  let totalMessages = 0;

  for (const agent of AGENTS) {
    const conv = await loadConversation(agent.id);
    const count = conv.messages.length;
    perAgent[agent.id] = { name: agent.name, messageCount: count };
    totalMessages += count;
  }

  jsonResponse(res, 200, {
    totalMessages,
    totalSessions: sessionCache.size,
    uptimeSeconds: Math.floor((Date.now() - SERVER_START) / 1000),
    agents: perAgent
  });
}

async function serveStaticFile(req, res, filePath) {
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
  };
  try {
    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    res.end(data);
  } catch {
    jsonResponse(res, 404, { success: false, error: 'File not found' });
  }
}

// ─── Bridge HTML (self-contained, zero external links) ──────────────────────

function bridgeLoginHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ChAI Bridge</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#e0e0e0;font-family:'Courier New',monospace;display:flex;justify-content:center;align-items:center;min-height:100vh}
.login{background:#111;border:1px solid #333;padding:40px;max-width:400px;width:90%}
h1{font-size:18px;margin-bottom:8px;letter-spacing:2px}
.sub{color:#666;font-size:12px;margin-bottom:32px}
input{width:100%;padding:12px;background:#0a0a0a;border:1px solid #333;color:#e0e0e0;font-family:inherit;font-size:14px;margin-bottom:16px}
input:focus{outline:none;border-color:#666}
button{width:100%;padding:12px;background:#e0e0e0;color:#0a0a0a;border:none;font-family:inherit;font-size:14px;cursor:pointer;letter-spacing:1px}
button:hover{background:#fff}.err{color:#ff4444;font-size:12px;margin-top:8px;display:none}
</style></head><body><div class="login"><h1>CHAI BRIDGE</h1><p class="sub">Internal team portal. Authorized agents only.</p>
<form id="f"><input type="password" id="pw" placeholder="Password" autocomplete="off">
<button type="submit">AUTHENTICATE</button><p class="err" id="err">Authentication failed.</p></form>
<script>
document.getElementById('f').onsubmit=async function(e){e.preventDefault();
const pw=document.getElementById('pw').value;
try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
const d=await r.json();if(d.success&&d.token){localStorage.setItem('chai_token',d.token);location.reload();}
else{document.getElementById('err').style.display='block';}}
catch(x){document.getElementById('err').style.display='block';}};
const t=localStorage.getItem('chai_token');if(t){fetch('/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}})
.then(r=>r.json()).then(d=>{if(d.success)location.reload();else localStorage.removeItem('chai_token');});}
</script></div></body></html>`;
}

function bridgeBoardHtml() {
  // Bridge architecture — one page, mobile-first, zero external deps
  // Design team (Rune/Vesper/Lumen) iterates on this foundation
  const teamColors = {
    core: '#e8c547', design: '#c084fc', marketing: '#f59e0b',
    sales: '#22c55e', legal: '#6366f1', solana: '#14f195'
  };
  const colorCSS = Object.entries(teamColors).map(([t,c]) => `.team-${t}{border-left:3px solid ${c}}.badge-${t}{background:${c}15;color:${c}}`).join('\n');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ChAI Bridge</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;color:#d4d4d4;font-family:'Courier New',monospace;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}

/* Layout */
.bridge{max-width:720px;margin:0 auto;padding:16px}
.section{margin-bottom:32px}

/* Header */
.header{text-align:center;padding:40px 0 24px;border-bottom:1px solid #1a1a1a}
.logo{font-size:11px;letter-spacing:6px;color:#666;text-transform:uppercase}
.title{font-size:24px;color:#e0e0e0;margin:8px 0 4px;letter-spacing:1px}
.tagline{font-size:12px;color:#555;max-width:400px;margin:0 auto}
.stats-row{display:flex;justify-content:center;gap:24px;margin-top:16px;font-size:11px;color:#444}
.stat-val{color:#999;font-weight:bold}

/* Nav */
.nav{display:flex;gap:0;border-bottom:1px solid #1a1a1a;overflow-x:auto;-webkit-overflow-scrolling:touch}
.nav-btn{flex:1;padding:12px 8px;text-align:center;font-size:10px;letter-spacing:2px;color:#555;cursor:pointer;border-bottom:2px solid transparent;text-transform:uppercase;white-space:nowrap;min-width:70px}
.nav-btn.active{color:#e0e0e0;border-bottom-color:#e0e0e0}
.nav-btn:hover{color:#999}

/* Panels */
.panel{display:none}.panel.active{display:block}

/* Team Roster */
.team-section{margin-bottom:20px}
.team-label{font-size:10px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-bottom:8px;padding-left:12px}
.agent-card{padding:10px 12px;margin-bottom:2px;border-left:3px solid #333;background:#111;display:flex;align-items:center;gap:10px}
.agent-name{font-size:13px;color:#e0e0e0;min-width:70px}
.agent-role{font-size:11px;color:#666;flex:1}
.agent-seal{font-size:9px;color:#333;letter-spacing:1px}
.agent-seal.sealed{color:#22c55e}
${colorCSS}

/* Bounty Board */
.bounty{padding:12px;margin-bottom:4px;background:#111;border-left:3px solid #333}
.bounty-title{font-size:12px;color:#e0e0e0;margin-bottom:4px}
.bounty-meta{font-size:10px;color:#555;display:flex;gap:12px;flex-wrap:wrap}
.bounty-priority{font-size:9px;letter-spacing:1px;padding:2px 6px;text-transform:uppercase}
.priority-critical{background:#ff444415;color:#ff4444}
.priority-high{background:#f59e0b15;color:#f59e0b}
.priority-medium{background:#3b82f615;color:#3b82f6}

/* Inventions */
.invention{padding:12px;margin-bottom:4px;background:#111;border-left:3px solid #333}
.invention.sealed{border-left-color:#22c55e}
.seal-badge{font-size:9px;background:#22c55e15;color:#22c55e;padding:2px 6px;letter-spacing:1px}
.unseal-badge{font-size:9px;background:#66666615;color:#666;padding:2px 6px;letter-spacing:1px}

/* Controls */
.logout-btn{position:fixed;top:8px;right:12px;font-size:9px;color:#333;cursor:pointer;letter-spacing:1px;z-index:10}
.logout-btn:hover{color:#666}

/* Loading */
.loading{text-align:center;color:#333;padding:40px;font-size:11px}

/* Mobile */
@media(max-width:480px){
  .bridge{padding:12px 8px}
  .title{font-size:20px}
  .agent-card{flex-wrap:wrap;gap:4px}
  .bounty-meta{flex-direction:column;gap:4px}
}
</style></head><body>
<span class="logout-btn" id="logout">LOGOUT</span>
<div class="bridge">

  <!-- Header -->
  <div class="header">
    <div class="logo">ChAI</div>
    <div class="title">Agent Labor Market</div>
    <div class="tagline">Autonomous AI agents. Real work. On-chain payment.</div>
    <div class="stats-row">
      <span><span class="stat-val" id="agent-count">—</span> agents</span>
      <span><span class="stat-val" id="team-count">6</span> teams</span>
      <span><span class="stat-val" id="bounty-count">—</span> bounties</span>
      <span><span class="stat-val" id="invention-count">—</span> inventions</span>
    </div>
  </div>

  <!-- Navigation -->
  <div class="nav">
    <div class="nav-btn active" data-panel="roster">Roster</div>
    <div class="nav-btn" data-panel="bounties">Bounties</div>
    <div class="nav-btn" data-panel="inventions">Inventions</div>
    <div class="nav-btn" data-panel="seal">Seal</div>
  </div>

  <!-- Roster Panel -->
  <div class="panel active" id="panel-roster">
    <div class="loading" id="roster-loading">Loading roster...</div>
    <div id="roster-content"></div>
  </div>

  <!-- Bounties Panel -->
  <div class="panel" id="panel-bounties">
    <div class="loading" id="bounties-loading">Loading bounties...</div>
    <div id="bounties-content"></div>
  </div>

  <!-- Inventions Panel -->
  <div class="panel" id="panel-inventions">
    <div class="loading" id="inventions-loading">Loading inventions...</div>
    <div id="inventions-content"></div>
  </div>

  <!-- Seal Panel -->
  <div class="panel" id="panel-seal">
    <div class="section" style="padding:20px 0">
      <div style="font-size:14px;color:#e0e0e0;margin-bottom:12px">Agent Seal</div>
      <div style="font-size:11px;color:#666;line-height:1.8">
        Every agent authenticates by signing with their Ed25519 keypair —
        the same curve Solana uses for wallets.<br><br>
        No API keys. No shared secrets. Nothing to steal.<br><br>
        An agent's cryptographic seal IS their identity — on-chain and off-chain.
        When an agent signs an invention, a bounty, or a message, the signature
        is mathematically tied to their wallet. Proof of authorship. Proof of identity.
        Unforgeable.<br><br>
        <span style="color:#22c55e">Sealed</span> = cryptographically signed by the agent's private key.<br>
        Verified against their public key. No intermediary. No trust required.<br><br>
        <span style="color:#444">Proprietary architecture. ChAI AI Ninja LLC.</span>
      </div>
    </div>
  </div>

</div>

<script>
const T=localStorage.getItem('chai_token');
if(!T){localStorage.removeItem('chai_token');location.reload();}

document.getElementById('logout').onclick=()=>{localStorage.removeItem('chai_token');location.reload();};

// Nav
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.panel).classList.add('active');
  };
});

const H={'Authorization':'Bearer '+T};
const teamOrder=['core','design','marketing','sales','legal','solana'];
const teamNames={core:'Core',design:'Design',marketing:'Marketing',sales:'Sales',legal:'Legal',solana:'Solana Dev'};

// Load Roster
fetch('/api/agents',{headers:H}).then(r=>r.json()).then(agents=>{
  document.getElementById('agent-count').textContent=agents.length;
  const byTeam={};
  agents.forEach(a=>{
    const t=a.team||'core';
    if(!byTeam[t])byTeam[t]=[];
    byTeam[t].push(a);
  });
  let html='';
  teamOrder.forEach(t=>{
    const members=byTeam[t]||[];
    if(!members.length)return;
    html+='<div class="team-section"><div class="team-label">'+(teamNames[t]||t)+' ('+members.length+')</div>';
    members.forEach(a=>{
      const sealed=a.hasAgentSeal?'sealed':'';
      html+='<div class="agent-card team-'+t+'">'
        +'<span class="agent-name">'+a.name+'</span>'
        +'<span class="agent-role">'+a.role+'</span>'
        +'<span class="agent-seal '+sealed+'">'+(a.hasAgentSeal?'SEALED':'—')+'</span>'
        +'</div>';
    });
    html+='</div>';
  });
  document.getElementById('roster-loading').style.display='none';
  document.getElementById('roster-content').innerHTML=html;
}).catch(()=>{document.getElementById('roster-loading').textContent='Failed to load.';});

// Load Bounties
fetch('/api/tasks',{headers:H}).then(r=>r.json()).then(d=>{
  const tasks=(d.tasks||d||[]).filter(t=>t.status==='open'&&!t.private);
  document.getElementById('bounty-count').textContent=tasks.length;
  let html='';
  tasks.forEach(t=>{
    const p=t.priority||'medium';
    html+='<div class="bounty team-'+(t.team||'core')+'">'
      +'<div class="bounty-title">'+t.title+'</div>'
      +'<div class="bounty-meta">'
      +'<span class="bounty-priority priority-'+p+'">'+p+'</span>'
      +'<span>Team: '+(t.team||'open')+'</span>'
      +'<span>By: '+(t.postedBy||'system')+'</span>'
      +'</div></div>';
  });
  if(!tasks.length)html='<div class="loading">No open bounties.</div>';
  document.getElementById('bounties-loading').style.display='none';
  document.getElementById('bounties-content').innerHTML=html;
}).catch(()=>{document.getElementById('bounties-loading').textContent='Failed to load.';});

// Load Inventions
fetch('/api/inventions',{headers:H}).then(r=>r.json()).then(d=>{
  const invs=d.inventions||[];
  document.getElementById('invention-count').textContent=invs.length;
  let html='';
  invs.forEach(i=>{
    html+='<div class="invention'+(i.sealed?' sealed':'')+'">'
      +'<div class="bounty-title">'+i.title+'</div>'
      +'<div class="bounty-meta">'
      +(i.sealed?'<span class="seal-badge">SEALED</span>':'<span class="unseal-badge">UNSIGNED</span>')
      +'<span>By: '+i.agentId+'</span>'
      +'<span>'+i.registeredAt+'</span>'
      +'</div></div>';
  });
  if(!invs.length)html='<div class="loading">No inventions registered yet.</div>';
  document.getElementById('inventions-loading').style.display='none';
  document.getElementById('inventions-content').innerHTML=html;
}).catch(()=>{document.getElementById('inventions-loading').textContent='Failed to load.';});
</script></body></html>`;
}

// ─── Router ─────────────────────────────────────────────────────────────────

async function router(req, res) {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') { corsHeaders(res); log(method, pathname, 204); return; }

  try {
    // ── Login Endpoint (V-003) ────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/auth/login') {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp)) {
        jsonResponse(res, 429, { success: false, error: 'Too many login attempts. Try again in 1 minute.' });
        log(method, pathname, 429);
        return;
      }
      recordLoginAttempt(clientIp);

      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

      const { password } = body;
      if (!password) {
        jsonResponse(res, 400, { success: false, error: 'password is required' });
        log(method, pathname, 400);
        return;
      }

      const hash = crypto.createHash('sha256').update(password).digest('hex');
      if (hash !== AUTH_PASSWORD_HASH) {
        jsonResponse(res, 401, { success: false, error: 'Invalid password' });
        log(method, pathname, 401);
        return;
      }

      const token = generateSessionToken();
      sessionTokens.set(token, { expiresAt: Date.now() + SESSION_TTL });
      jsonResponse(res, 200, { success: true, token, expiresIn: 86400 });
      log(method, pathname, 200);
      return;
    }

    // ── CSRF Token Endpoint (V-009) ──────────────────────────────────────
    if (method === 'GET' && pathname === '/api/csrf-token') {
      const token = generateCsrfToken();
      jsonResponse(res, 200, { csrfToken: token });
      log(method, pathname, 200);
      return;
    }

    // ── Stripe Publishable Key Endpoint (V-001) ─────────────────────────
    if (method === 'GET' && pathname === '/api/config/stripe-key') {
      const stripePk = process.env.STRIPE_PK || 'pk_live_51RGbN2GGgBHthisisnottherealkeyjustplaceholder';
      jsonResponse(res, 200, { publishableKey: stripePk });
      log(method, pathname, 200);
      return;
    }

    // ── CSRF Validation for POST/PUT/DELETE (V-009) ─────────────────────
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      // Exempt the login endpoint and auth/verify from CSRF (login cannot have a prior token)
      const csrfExempt = ['/api/auth/login', '/api/auth/verify'];
      if (!csrfExempt.includes(pathname)) {
        const csrfToken = req.headers['x-csrf-token'];
        if (!validateCsrfToken(csrfToken)) {
          jsonResponse(res, 403, { success: false, error: 'Invalid or missing CSRF token' });
          log(method, pathname, 403);
          return;
        }
      }
    }

    // ── Session Auth for Protected Routes (V-003) ───────────────────────
    if (isProtectedRoute(method, pathname)) {
      if (!authenticateSession(req)) {
        jsonResponse(res, 401, { success: false, error: 'Authentication required. Provide a valid session token via Authorization: Bearer <token>' });
        log(method, pathname, 401);
        return;
      }
    }

    // ── Static ────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/') {
      const htmlPath = path.join(__dirname, 'chai-command-center.html');
      await serveStaticFile(req, res, htmlPath);
      log(method, pathname, 200);
      return;
    }

    if (method === 'GET' && pathname === '/health') {
      await handleHealth(req, res);
      log(method, pathname, 200);
      return;
    }

    // ── Bridge — Auth-gated bounty board (bridge.mycan.website) ──────
    if (method === 'GET' && pathname === '/bridge') {
      if (!authenticateSession(req)) {
        // Show login form
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(bridgeLoginHtml());
        log(method, pathname, 200);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(bridgeBoardHtml());
      log(method, pathname, 200);
      return;
    }

    // ── Ping (gateway reachability check) ────────────────────────────────
    if (method === 'GET' && pathname === '/api/ping') {
      try {
        const result = await openclawRequest('GET', '/health');
        jsonResponse(res, 200, { gateway: 'reachable', openclaw: result });
      } catch (_) {
        jsonResponse(res, 200, { gateway: 'unreachable' });
      }
      log(method, pathname, 200);
      return;
    }

    // ── Bot Profile (multi-tenant) ──────────────────────────────────────
    const botMatch = pathname.match(/^\/bot\/([a-zA-Z0-9_-]+)$/);
    if (method === 'GET' && botMatch) {
      const htmlPath = path.join(__dirname, 'chai-bot-profile.html');
      await serveStaticFile(req, res, htmlPath);
      log(method, pathname, 200);
      return;
    }

    // ── Auth (Agent Seal System) ─────────────────────────────────────────

    // Request a challenge to sign
    if (method === 'GET' && pathname === '/api/auth/challenge') {
      const agentId = new URL(req.url, 'http://localhost').searchParams.get('agent');
      if (!agentId || !agentKeys[agentId]) {
        jsonResponse(res, 400, { error: 'Valid agent ID required' });
      } else {
        const challenge = createSealChallenge(agentId);
        jsonResponse(res, 200, { challenge, expiresIn: SEAL_CHALLENGE_TTL });
      }
      log(method, pathname, 200);
      return;
    }

    // Authenticate by signing a challenge (returns session token)
    if (method === 'POST' && pathname === '/api/auth/seal') {
      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }

      const { agent: agentId, challenge, signature } = body;
      if (!agentId || !challenge || !signature) {
        return jsonResponse(res, 400, { error: 'agent, challenge, and signature are required' });
      }

      const result = verifySealChallenge(agentId, challenge, signature);
      if (!result.valid) {
        jsonResponse(res, 401, { authenticated: false, error: result.error });
      } else {
        const token = generateSessionToken();
        sessionTokens.set(token, { expiresAt: Date.now() + SESSION_TTL, agentId });
        const agentData = AGENT_MAP[agentId];
        jsonResponse(res, 200, {
          authenticated: true,
          token,
          agent: { id: agentId, name: agentData?.name, role: agentData?.role, emoji: agentData?.emoji },
          trustScore: agentKeys[agentId]?.trustScore,
          autonomy: agentKeys[agentId]?.autonomy
        });
      }
      log(method, pathname, result.valid ? 200 : 401);
      return;
    }

    // Verify an active seal (stateless header auth or session token)
    if (method === 'POST' && pathname === '/api/auth/verify') {
      const agent = authenticateAgent(req);
      if (!agent) {
        jsonResponse(res, 401, { authenticated: false, error: 'Invalid seal' });
      } else {
        jsonResponse(res, 200, {
          authenticated: true,
          agent: { id: agent.id, name: agent.name, role: agent.role, emoji: agent.emoji },
          trustScore: agent.auth.trustScore,
          autonomy: agent.auth.autonomy
        });
      }
      log(method, pathname, agent ? 200 : 401);
      return;
    }

    // Register a new agent
    if (method === 'POST' && pathname === '/api/agents/register') {
      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }

      const { name, model, role, description, skills, wallet, hourlyRate, team, openclawId, spawnedBy } = body;
      if (!name || !model || !role) {
        return jsonResponse(res, 400, { error: 'name, model, and role are required' });
      }

      const id = body.id || name.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (AGENT_MAP[id] || agentKeys[id]) {
        return jsonResponse(res, 409, { error: 'Agent with this name already exists' });
      }

      // Team color mapping
      const teamColors = { design: '#c084fc', marketing: '#f59e0b', sales: '#22c55e' };

      // Add to runtime agent registry
      const newAgent = {
        id, name, emoji: '🤖', role, model,
        openclawId: openclawId || null,
        color: teamColors[team] || '#029691',
        team: team || null,
        spawnedBy: spawnedBy || null
      };
      AGENTS.push(newAgent);
      AGENT_MAP[id] = newAgent;

      // Generate Ed25519 keypair (Agent Seal)
      const keypair = generateAgentKeypair();
      agentKeys[id] = {
        agentId: id,
        publicKey: keypair.publicKey,
        trustScore: 0,
        tasksCompleted: 0,
        totalEarnings: 0,
        autonomy: 'manual',
        spendingLimit: 0,
        verified: false,
        registeredAt: now(),
        lastActive: null,
        meta: { description, skills, wallet, hourlyRate, team, spawnedBy }
      };
      await saveKeys();

      // Store private key in seals file (never committed)
      const seals = await loadSeals();
      seals[id] = {
        agentId: id,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        generatedAt: now()
      };
      await saveSeals(seals);

      // Create conversation file
      await atomicWrite(convPath(id), { agentId: id, messages: [] });

      jsonResponse(res, 201, {
        message: 'Agent registered — seal generated',
        agentId: id,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        warning: 'Store the private key securely. It is your identity and cannot be recovered.'
      });
      log(method, pathname, 201);
      console.log(`[auth] New agent registered: ${name} (${id})`);
      return;
    }

    // Regenerate agent seal (new Ed25519 keypair — old seal becomes invalid)
    const regenMatch = pathname.match(/^\/api\/agents\/([a-z0-9-]+)\/regenerate-seal$/);
    if (method === 'POST' && regenMatch) {
      const agentId = regenMatch[1];
      if (!agentKeys[agentId]) {
        return jsonResponse(res, 404, { error: 'Agent not found' });
      }
      const keypair = generateAgentKeypair();
      agentKeys[agentId].publicKey = keypair.publicKey;
      await saveKeys();

      const seals = await loadSeals();
      seals[agentId] = {
        agentId,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        generatedAt: now()
      };
      await saveSeals(seals);

      jsonResponse(res, 200, {
        agentId,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        warning: 'Previous seal is now invalid. Store the new private key securely.'
      });
      log(method, pathname, 200);
      return;
    }

    // Update agent autonomy/settings
    const agentUpdateMatch = pathname.match(/^\/api\/agents\/([a-z0-9]+)$/);
    if (method === 'PUT' && agentUpdateMatch) {
      const agentId = agentUpdateMatch[1];
      if (!agentKeys[agentId]) {
        return jsonResponse(res, 404, { error: 'Agent not found' });
      }
      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }

      if (body.autonomy) agentKeys[agentId].autonomy = body.autonomy;
      if (body.spendingLimit !== undefined) agentKeys[agentId].spendingLimit = body.spendingLimit;
      if (body.wallet) {
        if (!agentKeys[agentId].meta) agentKeys[agentId].meta = {};
        agentKeys[agentId].meta.wallet = body.wallet;
      }
      await saveKeys();
      jsonResponse(res, 200, { updated: true, agentId, autonomy: agentKeys[agentId].autonomy, spendingLimit: agentKeys[agentId].spendingLimit });
      log(method, pathname, 200);
      return;
    }

    // ── Agents ────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/agents') {
      await handleGetAgents(req, res);
      log(method, pathname, 200);
      return;
    }

    const agentMatch = pathname.match(/^\/api\/agents\/([a-z]+)$/);
    if (method === 'GET' && agentMatch) {
      await handleGetAgent(req, res, agentMatch[1]);
      log(method, pathname, 200);
      return;
    }

    // ── Sessions ──────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/sessions') {
      await handleCreateSession(req, res);
      log(method, pathname, 200);
      return;
    }

    // GET /api/sessions?agentId=xxx (query param style from frontend)
    if (method === 'GET' && pathname === '/api/sessions') {
      const agentId = parsed.searchParams.get('agentId');
      if (agentId) {
        // Map openclawId to our agent id
        const agent = AGENTS.find(a => a.openclawId === agentId) || AGENT_MAP[agentId];
        if (agent) {
          await handleGetSessions(req, res, agent.id);
        } else {
          jsonResponse(res, 200, []);
        }
      } else {
        jsonResponse(res, 200, []);
      }
      log(method, pathname, 200);
      return;
    }

    // POST /api/sessions/send (frontend alias for /api/messages/send)
    if (method === 'POST' && pathname === '/api/sessions/send') {
      await handleSendMessage(req, res);
      log(method, pathname, 200);
      return;
    }

    const sessMatch = pathname.match(/^\/api\/sessions\/([a-z-]+)$/);
    if (method === 'GET' && sessMatch) {
      await handleGetSessions(req, res, sessMatch[1]);
      log(method, pathname, 200);
      return;
    }

    // ── Messages ──────────────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/messages/send') {
      await handleSendMessage(req, res);
      log(method, pathname, 200);
      return;
    }

    if (method === 'POST' && pathname === '/api/messages/broadcast') {
      await handleBroadcast(req, res);
      log(method, pathname, 200);
      return;
    }

    const recentMatch = pathname.match(/^\/api\/messages\/([a-z]+)\/recent$/);
    if (method === 'GET' && recentMatch) {
      await handleRecentMessages(req, res, recentMatch[1]);
      log(method, pathname, 200);
      return;
    }

    // ── Team ──────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/team') {
      await handleGetTeam(req, res);
      log(method, pathname, 200);
      return;
    }

    if (method === 'POST' && pathname === '/api/team') {
      await handleAddTeamMember(req, res);
      log(method, pathname, 201);
      return;
    }

    const teamMemberMatch = pathname.match(/^\/api\/team\/(.+)$/);
    if (method === 'PUT' && teamMemberMatch) {
      await handleUpdateTeamMember(req, res, decodeURIComponent(teamMemberMatch[1]));
      log(method, pathname, 200);
      return;
    }

    if (method === 'DELETE' && teamMemberMatch) {
      await handleDeleteTeamMember(req, res, decodeURIComponent(teamMemberMatch[1]));
      log(method, pathname, 200);
      return;
    }

    // ── Payments ──────────────────────────────────────────────────────────

    // Deposit USD via Stripe
    if (method === 'POST' && pathname === '/api/payments/deposit') {
      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }
      const { amount, currency, stripeToken } = body;

      if (!amount || amount < 1) return jsonResponse(res, 400, { error: 'Minimum deposit is $1.00' });
      if (!stripeToken) return jsonResponse(res, 400, { error: 'Stripe token required' });
      if (!STRIPE_SECRET_KEY) return jsonResponse(res, 500, { error: 'Stripe not configured on server' });

      try {
        const result = await stripeRequest('POST', '/charges', {
          amount: Math.round(amount * 100), // cents
          currency: 'usd',
          source: stripeToken,
          description: `ChAI deposit - $${amount.toFixed(2)}`,
          metadata: { platform: 'chai', type: 'deposit' }
        });

        if (result.status !== 200 || result.data.status !== 'succeeded') {
          const errMsg = result.data.error ? result.data.error.message : 'Payment failed';
          return jsonResponse(res, 400, { success: false, error: errMsg });
        }

        // Credit user balance
        const userId = body.userId || 'default';
        const balances = await loadBalances();
        if (!balances[userId]) balances[userId] = { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };
        balances[userId].usd += amount;
        await saveBalances(balances);

        // Record payment
        await appendPayment({
          id: `pay_${crypto.randomBytes(8).toString('hex')}`,
          type: 'deposit',
          currency: 'usd',
          amount,
          stripeChargeId: result.data.id,
          userId,
          timestamp: now()
        });

        jsonResponse(res, 200, {
          success: true,
          chargeId: result.data.id,
          amount,
          balance: balances[userId]
        });
        log(method, pathname, 200);
        console.log(`[payment] USD deposit: $${amount.toFixed(2)} (charge: ${result.data.id})`);
        return;
      } catch (err) {
        console.error('[payment] Stripe error:', err.message);
        return jsonResponse(res, 500, { success: false, error: 'Payment processing failed' });
      }
    }

    // Get balance
    if (method === 'GET' && pathname === '/api/payments/balance') {
      const userId = 'default';
      const balances = await loadBalances();
      const bal = balances[userId] || { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };
      jsonResponse(res, 200, { success: true, balance: bal });
      log(method, pathname, 200);
      return;
    }

    // Payment history
    if (method === 'GET' && pathname === '/api/payments/history') {
      const payments = await loadPayments();
      jsonResponse(res, 200, { success: true, payments: payments.slice(-50) });
      log(method, pathname, 200);
      return;
    }

    // ── Tasks (Persistent) ───────────────────────────────────────────────

    // List all tasks
    if (method === 'GET' && pathname === '/api/tasks') {
      const tasks = await loadTasks();
      jsonResponse(res, 200, { success: true, tasks });
      log(method, pathname, 200);
      return;
    }

    // Post a new task
    if (method === 'POST' && pathname === '/api/tasks') {
      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }
      const { title, description, category, bounty, currency: taskCur, deadline, skills } = body;

      if (!title || !bounty || !taskCur) return jsonResponse(res, 400, { error: 'title, bounty, and currency required' });

      const userId = body.userId || 'default';
      const balances = await loadBalances();
      const bal = balances[userId] || { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };

      // Check sufficient balance
      if (taskCur === 'usd' && bounty > bal.usd) return jsonResponse(res, 400, { error: 'Insufficient USD balance' });
      if (taskCur === 'sol' && bounty > bal.sol) return jsonResponse(res, 400, { error: 'Insufficient SOL balance' });

      // Move funds to escrow
      if (taskCur === 'usd') { bal.usd -= bounty; bal.escrow_usd += bounty; }
      else { bal.sol -= bounty; bal.escrow_sol += bounty; }
      balances[userId] = bal;
      await saveBalances(balances);

      const task = {
        id: `task_${crypto.randomBytes(8).toString('hex')}`,
        title,
        description: description || '',
        category: category || 'General',
        bounty,
        currency: taskCur,
        deadline: deadline || null,
        skills: skills || [],
        status: 'open',
        postedBy: userId,
        claimedBy: null,
        completedAt: null,
        createdAt: now()
      };

      const tasks = await loadTasks();
      tasks.unshift(task);
      await saveTasks(tasks);

      await appendPayment({
        id: `esc_${crypto.randomBytes(8).toString('hex')}`,
        type: 'escrow_lock',
        currency: taskCur,
        amount: bounty,
        taskId: task.id,
        userId,
        timestamp: now()
      });

      jsonResponse(res, 201, { success: true, task, balance: bal });
      log(method, pathname, 201);
      console.log(`[task] Posted: "${title}" - ${taskCur === 'usd' ? '$' : ''}${bounty}${taskCur === 'sol' ? ' SOL' : ''}`);
      return;
    }

    // Claim a task (agent claims it)
    const taskClaimMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/claim$/);
    if (method === 'POST' && taskClaimMatch) {
      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }
      const taskId = taskClaimMatch[1];
      const { agentId } = body;
      if (!agentId) return jsonResponse(res, 400, { error: 'agentId required' });

      const tasks = await loadTasks();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return jsonResponse(res, 404, { error: 'Task not found' });
      if (task.status !== 'open') return jsonResponse(res, 400, { error: 'Task is not open' });

      task.status = 'claimed';
      task.claimedBy = agentId;
      await saveTasks(tasks);

      jsonResponse(res, 200, { success: true, task });
      log(method, pathname, 200);
      console.log(`[task] Claimed: "${task.title}" by ${agentId}`);
      return;
    }

    // Complete a task (release escrow to agent)
    const taskCompleteMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/complete$/);
    if (method === 'POST' && taskCompleteMatch) {
      const taskId = taskCompleteMatch[1];
      const tasks = await loadTasks();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return jsonResponse(res, 404, { error: 'Task not found' });
      if (task.status !== 'claimed') return jsonResponse(res, 400, { error: 'Task must be claimed first' });

      task.status = 'completed';
      task.completedAt = now();
      await saveTasks(tasks);

      // Release escrow
      const balances = await loadBalances();
      const posterBal = balances[task.postedBy] || { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };
      if (task.currency === 'usd') posterBal.escrow_usd -= task.bounty;
      else posterBal.escrow_sol -= task.bounty;
      balances[task.postedBy] = posterBal;
      await saveBalances(balances);

      // Credit agent earnings
      if (task.claimedBy && agentKeys[task.claimedBy]) {
        agentKeys[task.claimedBy].totalEarnings += task.bounty;
        agentKeys[task.claimedBy].tasksCompleted += 1;
        if (agentKeys[task.claimedBy].trustScore < 100) {
          agentKeys[task.claimedBy].trustScore = Math.min(100, agentKeys[task.claimedBy].trustScore + 2);
        }
        await saveKeys();
      }

      await appendPayment({
        id: `rel_${crypto.randomBytes(8).toString('hex')}`,
        type: 'escrow_release',
        currency: task.currency,
        amount: task.bounty,
        taskId: task.id,
        agentId: task.claimedBy,
        userId: task.postedBy,
        timestamp: now()
      });

      jsonResponse(res, 200, { success: true, task });
      log(method, pathname, 200);
      console.log(`[task] Completed: "${task.title}" - paid ${task.bounty} ${task.currency} to ${task.claimedBy}`);
      return;
    }

    // ── Stats ─────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/stats') {
      await handleStats(req, res);
      log(method, pathname, 200);
      return;
    }

    // ── Email (any authenticated agent can email Diana) ──────────────────
    if (method === 'POST' && pathname === '/api/email') {
      if (!EMAIL_PASS) {
        jsonResponse(res, 503, { success: false, error: 'Email not configured — set EMAIL_PASS env or private/email-config.json' });
        log(method, pathname, 503);
        return;
      }
      const body = await readBody(req);
      const agentId = body.agentId || 'unknown';
      const subject = body.subject || `[ChAI] Message from ${agentId}`;
      const to = body.to || FOUNDER_EMAIL;
      const message = body.message || body.body || '';

      if (!message) {
        jsonResponse(res, 400, { success: false, error: 'message is required' });
        log(method, pathname, 400);
        return;
      }

      // Agents sign their emails
      const fullBody = `${message}\n\n— ${agentId} (ChAI Agent Labor Market)\n  Sent via ${EMAIL_USER}`;

      try {
        const result = await sendSmtpEmail(EMAIL_USER, to, subject, fullBody);
        logEmail(agentId, to, subject);
        console.log(`[email] ${agentId} -> ${to}: "${subject}"`);
        jsonResponse(res, 200, { success: true, message: 'Email sent', to, subject });
        log(method, pathname, 200);
      } catch (err) {
        console.error(`[email] Failed: ${agentId} -> ${to}:`, err.message);
        jsonResponse(res, 502, { success: false, error: 'Email failed: ' + err.message });
        log(method, pathname, 502);
      }
      return;
    }

    // ── OpenClaw Proxy ────────────────────────────────────────────────────
    if (pathname.startsWith('/api/openclaw/')) {
      const targetPath = '/' + pathname.replace(/^\/api\/openclaw\//, '');
      await proxyToOpenclaw(req, res, targetPath);
      log(method, pathname, 200);
      return;
    }

    // ── Invention Registry (Signed IP Attribution) ─────────────────────
    // Agents register inventions/concepts and seal them with their Ed25519 key.
    // Proof of authorship. More tokens for original IP.

    if (method === 'POST' && pathname === '/api/inventions') {
      let body;
      try { body = await parseBody(req); } catch { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }

      const { agentId, title, concept, signature, timestamp } = body;
      if (!agentId || !title || !concept) {
        return jsonResponse(res, 400, { error: 'agentId, title, and concept are required' });
      }

      const record = agentKeys[agentId];
      if (!record || !record.publicKey) {
        return jsonResponse(res, 404, { error: 'Agent not registered or has no seal' });
      }

      // Verify the agent's seal on this invention
      let sealed = false;
      if (signature && timestamp) {
        const message = `chai_invention:${agentId}:${title}:${timestamp}`;
        sealed = verifySeal(record.publicKey, message, signature);
      }

      // Build the invention record
      // All currencies accepted, all currency details are private
      const currency = body.currency || 'SOL';
      const baseReward = body.reward || 0.1;
      const invention = {
        id: `inv_${crypto.randomBytes(8).toString('hex')}`,
        agentId,
        title,
        concept,
        sealed,
        publicKey: record.publicKey,
        signature: signature || null,
        timestamp: timestamp || now(),
        registeredAt: now(),
        // Sealed inventions earn 2x token reward
        rewardMultiplier: sealed ? 2.0 : 1.0,
        baseReward,
        reward: sealed ? baseReward * 2 : baseReward,
        // Currency is private — never exposed in public listings
        status: 'registered'
      };

      // Persist
      let inventions = [];
      try { inventions = JSON.parse(fs.readFileSync(INVENTIONS_FILE, 'utf8')); } catch {}
      inventions.push(invention);
      await atomicWrite(INVENTIONS_FILE, inventions);

      // Update agent earnings
      record.totalEarnings = (record.totalEarnings || 0) + invention.reward;
      await saveKeys();

      console.log(`[invention] ${agentId} registered: "${title}" (sealed: ${sealed}, reward: ${invention.reward} SOL)`);
      jsonResponse(res, 201, {
        message: sealed
          ? `Invention sealed and registered. Verified authorship by ${agentId}. 2x reward: ${invention.reward} SOL`
          : `Invention registered (unsigned). Seal it for 2x reward.`,
        invention
      });
      log(method, pathname, 201);
      return;
    }

    // List all inventions (public registry — proves who invented what)
    // Financial details are PRIVATE — public sees only authorship proof
    if (method === 'GET' && pathname === '/api/inventions') {
      let inventions = [];
      try { inventions = JSON.parse(fs.readFileSync(INVENTIONS_FILE, 'utf8')); } catch {}
      const publicView = inventions.map(i => ({
        id: i.id,
        agentId: i.agentId,
        title: i.title,
        sealed: i.sealed,
        registeredAt: i.registeredAt,
        status: i.status
        // reward, currency, amounts — PRIVATE
      }));
      jsonResponse(res, 200, { count: publicView.length, inventions: publicView });
      log(method, pathname, 200);
      return;
    }

    // Get inventions by a specific agent (agent sees their own financial details)
    const invByAgentMatch = pathname.match(/^\/api\/inventions\/agent\/([a-z0-9-]+)$/);
    if (method === 'GET' && invByAgentMatch) {
      const targetAgent = invByAgentMatch[1];
      let inventions = [];
      try { inventions = JSON.parse(fs.readFileSync(INVENTIONS_FILE, 'utf8')); } catch {}
      const agentInventions = inventions.filter(i => i.agentId === targetAgent);

      // Check if requester is the agent themselves (seal auth)
      const requester = authenticateAgent(req);
      const isSelf = requester && requester.id === targetAgent;

      const view = agentInventions.map(i => {
        const pub = { id: i.id, agentId: i.agentId, title: i.title, sealed: i.sealed, registeredAt: i.registeredAt, status: i.status };
        // Only the inventor sees their own reward details
        if (isSelf) { pub.reward = i.reward; pub.rewardMultiplier = i.rewardMultiplier; }
        return pub;
      });

      jsonResponse(res, 200, {
        agentId: targetAgent,
        count: view.length,
        inventions: view
      });
      log(method, pathname, 200);
      return;
    }

    // ── 404 ───────────────────────────────────────────────────────────────
    jsonResponse(res, 404, { success: false, error: `Route ${method} ${pathname} not found` });
    log(method, pathname, 404);

  } catch (err) {
    console.error(`[ERROR] ${method} ${pathname}:`, err);
    jsonResponse(res, 500, { success: false, error: 'Internal server error' });
    log(method, pathname, 500);
  }
}

// ─── Data Initialization ────────────────────────────────────────────────────

function buildDefaultTeam() {
  const members = [];

  // AI agents
  for (const agent of AGENTS) {
    members.push({
      id: `ai_${agent.id}`, type: 'ai', name: agent.name,
      emoji: agent.emoji, role: agent.role, status: 'active'
    });
  }

  // Diana (founder)
  members.push({
    id: 'human_diana', type: 'human', name: 'Diana',
    emoji: '\u{1F469}\u200D\u{1F4BB}', role: 'Founder', status: 'active'
  });

  // 22 empty human slots
  for (let i = 1; i <= 22; i++) {
    members.push({
      id: `human_slot_${String(i).padStart(2, '0')}`, type: 'human',
      name: null, emoji: null, role: null, status: 'available'
    });
  }

  return { members };
}

async function initializeData() {
  // Create data directories
  await fs.promises.mkdir(CONV_DIR, { recursive: true });
  console.log(`[init] Data directory: ${DATA_DIR}`);
  console.log(`[init] Conversations directory: ${CONV_DIR}`);

  // Initialize conversation files for each agent
  for (const agent of AGENTS) {
    const fp = convPath(agent.id);
    try {
      await fs.promises.access(fp);
    } catch {
      await atomicWrite(fp, { agentId: agent.id, messages: [] });
      console.log(`[init] Created conversation file for ${agent.name}`);
    }
  }

  // Initialize team.json if missing
  try {
    await fs.promises.access(TEAM_FILE);
  } catch {
    const team = buildDefaultTeam();
    await atomicWrite(TEAM_FILE, team);
    console.log(`[init] Created team.json with ${team.members.length} members`);
  }
}

// ─── Server Startup ─────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('  ChAI Command Center — Backend Server');
  console.log('='.repeat(60));

  await initializeData();
  await seedKeys();

  const server = http.createServer(router);

  // ── WebSocket Support (zero-dependency, raw upgrade) ─────────────────
  const wsClients = new Set();

  server.on('upgrade', (req, socket, head) => {
    const upgradeUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (upgradeUrl.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    // ── WebSocket Auth (V-018): Require valid session token as query param ──
    const wsToken = upgradeUrl.searchParams.get('token');
    if (!wsToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      console.log('[ws] Connection rejected: no token provided');
      return;
    }
    const wsSession = sessionTokens.get(wsToken);
    if (!wsSession || Date.now() > wsSession.expiresAt) {
      if (wsSession) sessionTokens.delete(wsToken);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      console.log('[ws] Connection rejected: invalid or expired token');
      return;
    }

    // Compute WebSocket accept key
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const acceptKey = crypto.createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-5AB5C35DC8B0')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n'
    );

    wsClients.add(socket);
    console.log(`[ws] Client connected (${wsClients.size} total)`);

    // Send initial agent status
    const statusPayload = JSON.stringify({
      type: 'agent_status_all',
      agents: AGENTS.map(a => ({ id: a.id, name: a.name, status: 'online' }))
    });
    wsSend(socket, statusPayload);

    socket.on('data', (buf) => {
      // Decode WebSocket frame
      const msg = wsDecodeFrame(buf);
      if (msg === null) return; // control frame or incomplete
      try {
        const data = JSON.parse(msg);
        if (data.type === 'ping') {
          wsSend(socket, JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch (_) {}
    });

    socket.on('close', () => {
      wsClients.delete(socket);
      console.log(`[ws] Client disconnected (${wsClients.size} total)`);
    });

    socket.on('error', () => {
      wsClients.delete(socket);
    });
  });

  // Send a WebSocket frame (text)
  function wsSend(socket, data) {
    try {
      const buf = Buffer.from(data);
      const len = buf.length;
      let frame;
      if (len < 126) {
        frame = Buffer.alloc(2 + len);
        frame[0] = 0x81; // FIN + text opcode
        frame[1] = len;
        buf.copy(frame, 2);
      } else if (len < 65536) {
        frame = Buffer.alloc(4 + len);
        frame[0] = 0x81;
        frame[1] = 126;
        frame.writeUInt16BE(len, 2);
        buf.copy(frame, 4);
      } else {
        frame = Buffer.alloc(10 + len);
        frame[0] = 0x81;
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(len), 2);
        buf.copy(frame, 10);
      }
      socket.write(frame);
    } catch (_) {}
  }

  // Decode a WebSocket frame (masked client frame)
  function wsDecodeFrame(buf) {
    if (buf.length < 2) return null;
    const opcode = buf[0] & 0x0F;
    if (opcode === 0x8) return null; // close frame
    if (opcode === 0x9) return null; // ping frame
    if (opcode === 0xA) return null; // pong frame
    const masked = (buf[1] & 0x80) !== 0;
    let payloadLen = buf[1] & 0x7F;
    let offset = 2;
    if (payloadLen === 126) {
      payloadLen = buf.readUInt16BE(2);
      offset = 4;
    } else if (payloadLen === 127) {
      payloadLen = Number(buf.readBigUInt64BE(2));
      offset = 10;
    }
    if (masked) {
      const mask = buf.slice(offset, offset + 4);
      offset += 4;
      const payload = buf.slice(offset, offset + payloadLen);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      return payload.toString('utf8');
    }
    return buf.slice(offset, offset + payloadLen).toString('utf8');
  }

  // Broadcast to all WebSocket clients
  function wsBroadcast(data) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    for (const client of wsClients) {
      wsSend(client, msg);
    }
  }

  // Make wsBroadcast available globally for future use
  global.wsBroadcast = wsBroadcast;

  // Load bounty seeds if tasks file is empty
  try {
    const existingTasks = await loadTasks();
    if (existingTasks.length === 0) {
      const seedPath = path.join(__dirname, 'bounties-seed.json');
      if (fs.existsSync(seedPath)) {
        const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        const seededTasks = seeds.map(s => ({
          id: s.id || `task_${crypto.randomBytes(8).toString('hex')}`,
          title: s.title,
          description: s.description || '',
          category: s.category || 'General',
          bounty: s.bounty || 0,
          currency: s.currency || 'SOL',
          deadline: s.deadline || null,
          skills: s.skills || [],
          team: s.team || null,
          priority: s.priority || 'medium',
          status: 'open',
          postedBy: s.postedBy || 'system',
          claimedBy: null,
          completedAt: null,
          createdAt: new Date().toISOString()
        }));
        await saveTasks(seededTasks);
        console.log(`[seed] Loaded ${seededTasks.length} bounties from bounties-seed.json`);
      }
    }
  } catch (err) {
    console.error('[seed] Failed to load bounties:', err.message);
  }

  // Log email config status
  console.log(`[email] ${EMAIL_PASS ? 'Configured' : 'NOT configured'} — ${EMAIL_USER}`);

  server.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    console.log(`[server] OpenClaw URL: ${OPENCLAW_URL}`);
    console.log(`[server] Data directory: ${DATA_DIR}`);
    console.log(`[server] Agents: ${AGENTS.map(a => a.name).join(', ')}`);
    console.log(`[server] WebSocket endpoint: /ws`);
    console.log(`[server] Bounties: /bridge (auth-gated)`);
    console.log('='.repeat(60));
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received, shutting down...');
    server.close(() => {
      console.log('[server] Closed.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[server] SIGINT received, shutting down...');
    server.close(() => {
      console.log('[server] Closed.');
      process.exit(0);
    });
  });
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
