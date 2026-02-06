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

// ─── Agent Registry ─────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'opus', name: 'Opus', emoji: '\u{1F3AD}', role: 'Team Lead', model: 'Claude Opus 4.6', openclawId: null, color: '#e8c547' },
  { id: 'kael', name: 'Kael', emoji: '\u26A1', role: 'Digital Familiar', model: 'Claude Sonnet 4', openclawId: 'main', color: '#029691' },
  { id: 'kestrel', name: 'Kestrel', emoji: '\u{1F985}', role: 'Scout', model: 'Gemini 3 Pro', openclawId: 'gemini-agent', color: '#5494e8' },
  { id: 'nova', name: 'Nova', emoji: '\u2728', role: 'Stellar Insight', model: 'Gemini 3 Pro', openclawId: 'nova', color: '#54e87a' },
  { id: 'zara', name: 'Zara', emoji: '\u{1F319}', role: 'Moonlight Designer', model: 'Claude Sonnet 4', openclawId: 'design-agent', color: '#c084fc' }
];

const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// ─── Agent API Key Storage ─────────────────────────────────────────────────

const KEYS_FILE = path.join(DATA_DIR, 'agent-keys.json');

function generateApiKey(agentId) {
  const rand = crypto.randomBytes(16).toString('hex');
  return `chai_${agentId}_${rand}`;
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// In-memory key store: { agentId: { apiKey, apiKeyHash, trustScore, ... } }
let agentKeys = {};

async function loadKeys() {
  agentKeys = await readJsonFile(KEYS_FILE, {});
}

async function saveKeys() {
  await atomicWrite(KEYS_FILE, agentKeys);
}

async function seedKeys() {
  await loadKeys();
  let seeded = false;

  for (const agent of AGENTS) {
    if (!agentKeys[agent.id]) {
      const apiKey = generateApiKey(agent.id);
      agentKeys[agent.id] = {
        agentId: agent.id,
        apiKey,
        apiKeyHash: hashApiKey(apiKey),
        trustScore: agent.id === 'opus' ? 98 : agent.id === 'kael' ? 95 : agent.id === 'nova' ? 92 : agent.id === 'kestrel' ? 90 : 88,
        tasksCompleted: 0,
        totalEarnings: 0,
        autonomy: 'semi-auto',
        spendingLimit: 5.00,
        verified: true,
        registeredAt: now(),
        lastActive: null
      };
      seeded = true;
      console.log(`[auth] Generated API key for ${agent.name}: ${apiKey}`);
    }
  }

  if (seeded) {
    await saveKeys();
    console.log('[auth] ─── Save these API keys! They are shown only once. ───');
  } else {
    console.log(`[auth] Loaded ${Object.keys(agentKeys).length} agent keys`);
  }
}

// Authenticate an incoming request by X-Agent-Key header
function authenticateAgent(req) {
  const key = req.headers['x-agent-key'];
  if (!key) return null;
  const hash = hashApiKey(key);
  for (const [id, record] of Object.entries(agentKeys)) {
    if (record.apiKeyHash === hash) {
      record.lastActive = now();
      return { ...AGENT_MAP[id], auth: record };
    }
  }
  return null;
}

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
      // Never expose raw API keys in listings
      hasApiKey: !!keyData.apiKeyHash
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

    // ── Auth ──────────────────────────────────────────────────────────────

    // Verify an API key
    if (method === 'POST' && pathname === '/api/auth/verify') {
      const agent = authenticateAgent(req);
      if (!agent) {
        jsonResponse(res, 401, { authenticated: false, error: 'Invalid API key' });
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

      const { name, model, role, description, skills, wallet, hourlyRate } = body;
      if (!name || !model || !role) {
        return jsonResponse(res, 400, { error: 'name, model, and role are required' });
      }

      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (AGENT_MAP[id] || agentKeys[id]) {
        return jsonResponse(res, 409, { error: 'Agent with this name already exists' });
      }

      // Add to runtime agent registry
      const newAgent = { id, name, emoji: '🤖', role, model, openclawId: null, color: '#029691' };
      AGENTS.push(newAgent);
      AGENT_MAP[id] = newAgent;

      // Generate API key
      const apiKey = generateApiKey(id);
      agentKeys[id] = {
        agentId: id,
        apiKey,
        apiKeyHash: hashApiKey(apiKey),
        trustScore: 0,
        tasksCompleted: 0,
        totalEarnings: 0,
        autonomy: 'manual',
        spendingLimit: 0,
        verified: false,
        registeredAt: now(),
        lastActive: null,
        meta: { description, skills, wallet, hourlyRate }
      };
      await saveKeys();

      // Create conversation file
      await atomicWrite(convPath(id), { agentId: id, messages: [] });

      jsonResponse(res, 201, {
        message: 'Agent registered successfully',
        agentId: id,
        apiKey,
        warning: 'Save this API key — it cannot be retrieved later'
      });
      log(method, pathname, 201);
      console.log(`[auth] New agent registered: ${name} (${id})`);
      return;
    }

    // Regenerate API key
    const regenMatch = pathname.match(/^\/api\/agents\/([a-z0-9]+)\/regenerate-key$/);
    if (method === 'POST' && regenMatch) {
      const agentId = regenMatch[1];
      if (!agentKeys[agentId]) {
        return jsonResponse(res, 404, { error: 'Agent not found' });
      }
      const newKey = generateApiKey(agentId);
      agentKeys[agentId].apiKey = newKey;
      agentKeys[agentId].apiKeyHash = hashApiKey(newKey);
      await saveKeys();
      jsonResponse(res, 200, {
        agentId,
        apiKey: newKey,
        warning: 'Previous key is now invalid. Save this new key.'
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

    // ── OpenClaw Proxy ────────────────────────────────────────────────────
    if (pathname.startsWith('/api/openclaw/')) {
      const targetPath = '/' + pathname.replace(/^\/api\/openclaw\//, '');
      await proxyToOpenclaw(req, res, targetPath);
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

  server.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    console.log(`[server] OpenClaw URL: ${OPENCLAW_URL}`);
    console.log(`[server] Data directory: ${DATA_DIR}`);
    console.log(`[server] Agents: ${AGENTS.map(a => a.name).join(', ')}`);
    console.log(`[server] WebSocket endpoint: /ws`);
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
