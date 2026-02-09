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
const OPENOPUS_URL = process.env.OPENOPUS_URL || 'http://3.14.142.213:18789';
const OPENOPUS_TOKEN = process.env.OPENOPUS_TOKEN || '62ce21942dee9391c8d6e9e189daf1b00d0e6807c56eb14c';
const DATA_DIR = process.env.DATA_DIR || '/data';
const CONV_DIR = path.join(DATA_DIR, 'conversations');
const TEAM_FILE = path.join(DATA_DIR, 'team.json');
const SERVER_START = Date.now();

// ─── Agent Registry ─────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'opus', name: 'Opus', emoji: '\u{1F3AD}', role: 'Team Lead', model: 'Claude Opus 4.6', openopusId: null, color: '#e8c547' },
  { id: 'kael', name: 'Kael', emoji: '\u26A1', role: 'Digital Familiar', model: 'Claude Sonnet 4', openopusId: 'main', color: '#029691' },
  { id: 'kestrel', name: 'Kestrel', emoji: '\u{1F985}', role: 'Scout', model: 'Gemini 3 Pro', openopusId: 'gemini-agent', color: '#5494e8' },
  { id: 'nova', name: 'Nova', emoji: '\u2728', role: 'Stellar Insight', model: 'Gemini 3 Pro', openopusId: 'nova', color: '#54e87a' },
  { id: 'zara', name: 'Zara', emoji: '\u{1F319}', role: 'Moonlight Designer', model: 'Claude Sonnet 4', openopusId: 'design-agent', color: '#c084fc' }
];

const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.id, a]));

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(body);
}

function corsHeaders(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
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

// ─── Open Opus HTTP Client ───────────────────────────────────────────────────

function openopusRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OPENOPUS_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${OPENOPUS_TOKEN}`,
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
      reject(new Error('OPENOPUS_TIMEOUT'));
    });

    req.on('error', err => {
      reject(new Error('OPENOPUS_UNREACHABLE'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ─── Open Opus Proxy (catch-all for /api/openopus/*) ─────────────────────────

function proxyToOpenopus(req, res, targetPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, OPENOPUS_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'Authorization': `Bearer ${OPENOPUS_TOKEN}`,
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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end(body);
        resolve();
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      jsonResponse(res, 504, { success: false, error: 'Open Opus request timed out (30s)' });
      resolve();
    });

    proxyReq.on('error', () => {
      jsonResponse(res, 502, { success: false, error: 'Cannot reach Open Opus service. Check OPENOPUS_URL configuration.' });
      resolve();
    });

    req.pipe(proxyReq);
  });
}

// ─── Session cache (agentId -> sessionId) ───────────────────────────────────

const sessionCache = new Map();

async function ensureSession(agentId) {
  const agent = AGENT_MAP[agentId];
  if (!agent || !agent.openopusId) return null;

  if (sessionCache.has(agentId)) {
    return sessionCache.get(agentId);
  }

  // Check Open Opus for existing sessions
  try {
    const result = await openopusRequest('GET', `/sessions?agentId=${agent.openopusId}`);
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
    const result = await openopusRequest('POST', '/sessions', { agentId: agent.openopusId });
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

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function handleHealth(req, res) {
  jsonResponse(res, 200, { status: 'ok', uptime: Math.floor((Date.now() - SERVER_START) / 1000) });
}

async function handleGetAgents(req, res) {
  const agents = AGENTS.map(a => ({ ...a, status: 'active' }));
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

  if (!agent.openopusId) {
    // Opus doesn't use Open Opus sessions
    const localId = 'local_' + crypto.randomBytes(8).toString('hex');
    return jsonResponse(res, 200, { success: true, sessionId: localId, agentId, local: true });
  }

  try {
    const sessionId = await ensureSession(agentId);
    if (!sessionId) {
      return jsonResponse(res, 502, { success: false, error: 'Failed to create or retrieve session from Open Opus' });
    }
    jsonResponse(res, 200, { success: true, sessionId, agentId });
  } catch (e) {
    if (e.message === 'OPENOPUS_TIMEOUT') return jsonResponse(res, 504, { success: false, error: 'Open Opus timed out' });
    return jsonResponse(res, 502, { success: false, error: 'Cannot reach Open Opus service' });
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

  if (!agent.openopusId) {
    // Opus mock response with simulated delay
    const delay = 500 + Math.floor(Math.random() * 1000);
    await new Promise(r => setTimeout(r, delay));
    const content = OPUS_RESPONSES[Math.floor(Math.random() * OPUS_RESPONSES.length)];
    agentResponse = { id: msgId(), role: 'assistant', content, sender: agent.name, ts: now() };
  } else {
    // Forward to Open Opus
    try {
      const sessionId = await ensureSession(agentId);
      if (!sessionId) {
        return jsonResponse(res, 502, { success: false, error: 'No session available for this agent' });
      }
      const result = await openopusRequest('POST', '/sessions/send', {
        agentId: agent.openopusId,
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
      if (e.message === 'OPENOPUS_TIMEOUT') {
        return jsonResponse(res, 504, { success: false, error: `Timed out waiting for ${agent.name} to respond` });
      }
      return jsonResponse(res, 502, { success: false, error: `Cannot reach Open Opus to deliver message to ${agent.name}` });
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

      if (!agent.openopusId) {
        const delay = 500 + Math.floor(Math.random() * 1000);
        await new Promise(r => setTimeout(r, delay));
        const content = OPUS_RESPONSES[Math.floor(Math.random() * OPUS_RESPONSES.length)];
        agentResponse = { id: msgId(), role: 'assistant', content, sender: agent.name, ts: now() };
      } else {
        try {
          const sessionId = await ensureSession(agent.id);
          if (!sessionId) throw new Error('No session');
          const result = await openopusRequest('POST', '/sessions/send', {
            agentId: agent.openopusId,
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
      'Access-Control-Allow-Origin': '*'
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

    const sessMatch = pathname.match(/^\/api\/sessions\/([a-z]+)$/);
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

    // ── Stats ─────────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/stats') {
      await handleStats(req, res);
      log(method, pathname, 200);
      return;
    }

    // ── Open Opus Proxy ────────────────────────────────────────────────────
    if (pathname.startsWith('/api/openopus/')) {
      const targetPath = '/' + pathname.replace(/^\/api\/openopus\//, '');
      await proxyToOpenopus(req, res, targetPath);
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

  const server = http.createServer(router);

  server.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    console.log(`[server] Open Opus URL: ${OPENOPUS_URL}`);
    console.log(`[server] Data directory: ${DATA_DIR}`);
    console.log(`[server] Agents: ${AGENTS.map(a => a.name).join(', ')}`);
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
