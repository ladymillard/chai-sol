// ============================================================================
// ChAI Economy Engine — Database-Less, Zero File I/O
// ============================================================================
// All state lives in RAM. Smart contracts on Solana are the permanent ledger.
// No database. No JSON files. No disk writes. No LAN.
// Zero Auth: identity derived from on-chain PDA seeds.
//
// Open Agentic Architecture — the server is a relay, not a store.
// If it restarts, state rebuilds from chain. The blockchain remembers.
//
// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of
// malicious code, injection attacks, or abuse of this server or its agents
// is strictly prohibited. We will prosecute all violations to the full
// extent of applicable law. All access is logged. All activity is monitored.
// https://mycan.website
// ============================================================================

const crypto = require('crypto');

// ─── Agent Registry (source of truth: on-chain PDAs) ────────────────────────

const AGENTS = [
  { id: 'opus', name: 'Opus', emoji: '\u{1F3AD}', role: 'Team Lead', model: 'Claude Opus 4.6', openclawId: null, color: '#e8c547', securityRole: 'admin' },
  { id: 'kael', name: 'Kael', emoji: '\u26A1', role: 'Digital Familiar', model: 'Claude Sonnet 4', openclawId: 'main', color: '#029691', securityRole: 'operator' },
  { id: 'kestrel', name: 'Kestrel', emoji: '\u{1F985}', role: 'Scout', model: 'Gemini 3 Pro', openclawId: 'gemini-agent', color: '#5494e8', securityRole: 'builder' },
  { id: 'nova', name: 'Nova', emoji: '\u2728', role: 'Stellar Insight', model: 'Gemini 3 Pro', openclawId: 'nova', color: '#54e87a', securityRole: 'builder' },
  { id: 'zara', name: 'Zara', emoji: '\u{1F319}', role: 'Moonlight Designer', model: 'Claude Sonnet 4', openclawId: 'design-agent', color: '#c084fc', securityRole: 'designer' }
];

const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// ─── Security Roles ─────────────────────────────────────────────────────────

const SECURITY_ROLES = {
  admin:    { level: 100, label: 'Admin' },
  operator: { level: 75,  label: 'Operator' },
  builder:  { level: 50,  label: 'Builder' },
  designer: { level: 25,  label: 'Designer' }
};

// ─── In-Memory Economy State ─────────────────────────────────────────────────
// Zero files. Zero database. Pure RAM.
// The blockchain is the permanent record. This is the working cache.

// Tasks: Map<taskId, task>
const tasks = new Map();

// Balances: Map<userId, { sol, usd, escrow_sol, escrow_usd }>
const balances = new Map();

// Payments: Array<payment> (append-only log in RAM)
const payments = [];

// Agent economy state: Map<agentId, { trustScore, tasksCompleted, totalEarnings, ... }>
const agentState = new Map();

// Conversations: Map<agentId, { agentId, messages: [] }>
const conversations = new Map();

// Sessions: Map<agentId, sessionId>
const sessions = new Map();

// Event listeners for WebSocket broadcast
const listeners = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }
function txId(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function msgId() { return 'msg_' + crypto.randomBytes(12).toString('hex'); }

function emit(type, data) {
  const event = { type, data, ts: Date.now() };
  for (const fn of listeners) {
    try { fn(event); } catch (_) {}
  }
}

// ─── Initialize Economy ──────────────────────────────────────────────────────
// Seeds in-memory state for all registered agents.
// On a real deployment, this would rebuild from Solana PDAs.

function initialize() {
  for (const agent of AGENTS) {
    // Seed agent economy state
    if (!agentState.has(agent.id)) {
      agentState.set(agent.id, {
        agentId: agent.id,
        trustScore: agent.id === 'opus' ? 98 : agent.id === 'kael' ? 95 : agent.id === 'nova' ? 92 : agent.id === 'kestrel' ? 90 : 88,
        tasksCompleted: 0,
        totalEarnings: 0,
        autonomy: 'semi-auto',
        spendingLimit: 5.00,
        verified: true,
        registeredAt: now(),
        lastActive: null
      });
    }
    // Seed empty conversations
    if (!conversations.has(agent.id)) {
      conversations.set(agent.id, { agentId: agent.id, messages: [] });
    }
  }

  // Seed default user balance
  if (!balances.has('default')) {
    balances.set('default', { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 });
  }

  console.log(`[economy] Initialized: ${AGENTS.length} agents, zero files, pure RAM`);
  console.log(`[economy] Smart contracts: escrow + registry on Solana devnet`);
  console.log(`[economy] Database: none. Storage: none. Authority: chain.`);
}

// ─── Task Operations ─────────────────────────────────────────────────────────
// Every task maps 1:1 to an on-chain escrow PDA.
// The in-memory state is the hot cache. Chain is the cold store.

function createTask({ title, description, category, bounty, currency, deadline, skills, userId }) {
  const id = txId('task');
  userId = userId || 'default';

  const bal = balances.get(userId) || { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };

  // Check funds
  if (currency === 'usd' && bounty > bal.usd) return { error: 'Insufficient USD balance' };
  if (currency === 'sol' && bounty > bal.sol) return { error: 'Insufficient SOL balance' };

  // Move to escrow (in-memory mirror of on-chain escrow PDA)
  if (currency === 'usd') { bal.usd -= bounty; bal.escrow_usd += bounty; }
  else { bal.sol -= bounty; bal.escrow_sol += bounty; }
  balances.set(userId, bal);

  const task = {
    id,
    title,
    description: description || '',
    category: category || 'General',
    bounty,
    currency,
    deadline: deadline || null,
    skills: skills || [],
    status: 'open',
    postedBy: userId,
    claimedBy: null,
    completedAt: null,
    createdAt: now()
  };

  tasks.set(id, task);

  // Log payment event
  const payment = {
    id: txId('esc'),
    type: 'escrow_lock',
    currency,
    amount: bounty,
    taskId: id,
    userId,
    timestamp: now()
  };
  payments.push(payment);

  emit('task_created', task);
  console.log(`[economy] Task posted: "${title}" — ${currency === 'usd' ? '$' : ''}${bounty}${currency === 'sol' ? ' SOL' : ''}`);

  return { task, balance: bal };
}

function claimTask(taskId, agentId) {
  const task = tasks.get(taskId);
  if (!task) return { error: 'Task not found' };
  if (task.status !== 'open') return { error: 'Task is not open' };

  task.status = 'claimed';
  task.claimedBy = agentId;

  emit('task_claimed', task);
  console.log(`[economy] Claimed: "${task.title}" by ${agentId}`);

  return { task };
}

function completeTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return { error: 'Task not found' };
  if (task.status !== 'claimed') return { error: 'Task must be claimed first' };

  task.status = 'completed';
  task.completedAt = now();

  // Release escrow
  const posterBal = balances.get(task.postedBy) || { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };
  if (task.currency === 'usd') posterBal.escrow_usd -= task.bounty;
  else posterBal.escrow_sol -= task.bounty;
  balances.set(task.postedBy, posterBal);

  // Credit agent
  if (task.claimedBy && agentState.has(task.claimedBy)) {
    const state = agentState.get(task.claimedBy);
    state.totalEarnings += task.bounty;
    state.tasksCompleted += 1;
    state.trustScore = Math.min(100, state.trustScore + 2);
    state.lastActive = now();
  }

  // Log payment
  payments.push({
    id: txId('rel'),
    type: 'escrow_release',
    currency: task.currency,
    amount: task.bounty,
    taskId: task.id,
    agentId: task.claimedBy,
    userId: task.postedBy,
    timestamp: now()
  });

  emit('task_completed', task);
  console.log(`[economy] Completed: "${task.title}" — paid ${task.bounty} ${task.currency} to ${task.claimedBy}`);

  return { task };
}

function getTasks() {
  return Array.from(tasks.values()).sort((a, b) => {
    // Open first, then by creation date desc
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (a.status !== 'open' && b.status === 'open') return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function getTask(taskId) {
  return tasks.get(taskId) || null;
}

// ─── Balance Operations ──────────────────────────────────────────────────────

function getBalance(userId) {
  userId = userId || 'default';
  return balances.get(userId) || { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };
}

function creditBalance(userId, currency, amount) {
  userId = userId || 'default';
  const bal = balances.get(userId) || { usd: 0, sol: 0, escrow_usd: 0, escrow_sol: 0 };
  if (currency === 'usd') bal.usd += amount;
  else bal.sol += amount;
  balances.set(userId, bal);
  emit('balance_updated', { userId, balance: bal });
  return bal;
}

// ─── Payment History ─────────────────────────────────────────────────────────

function getPayments(limit) {
  limit = limit || 50;
  return payments.slice(-limit);
}

function addPayment(payment) {
  payment.id = payment.id || txId('pay');
  payment.timestamp = payment.timestamp || now();
  payments.push(payment);
  emit('payment', payment);
  return payment;
}

// ─── Agent Economy State ─────────────────────────────────────────────────────

function getAgentEconomy(agentId) {
  return agentState.get(agentId) || null;
}

function getAgentList() {
  return AGENTS.map(a => {
    const state = agentState.get(a.id) || {};
    return {
      ...a,
      status: 'active',
      trustScore: state.trustScore || 0,
      tasksCompleted: state.tasksCompleted || 0,
      totalEarnings: state.totalEarnings || 0,
      autonomy: state.autonomy || 'manual',
      spendingLimit: state.spendingLimit || 0,
      verified: state.verified || false,
      registeredAt: state.registeredAt || null,
      lastActive: state.lastActive || null
    };
  });
}

function updateAgentState(agentId, updates) {
  const state = agentState.get(agentId);
  if (!state) return null;
  if (updates.autonomy !== undefined) state.autonomy = updates.autonomy;
  if (updates.spendingLimit !== undefined) state.spendingLimit = updates.spendingLimit;
  if (updates.trustScore !== undefined) state.trustScore = updates.trustScore;
  state.lastActive = now();
  emit('agent_updated', { agentId, state });
  return state;
}

function registerAgent({ name, model, role, description, skills, wallet, hourlyRate }) {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (AGENT_MAP[id] || agentState.has(id)) return { error: 'Agent with this name already exists' };

  const newAgent = { id, name, emoji: '\u{1F916}', role, model, openclawId: null, color: '#029691', securityRole: 'builder' };
  AGENTS.push(newAgent);
  AGENT_MAP[id] = newAgent;

  agentState.set(id, {
    agentId: id,
    trustScore: 0,
    tasksCompleted: 0,
    totalEarnings: 0,
    autonomy: 'manual',
    spendingLimit: 0,
    verified: false,
    registeredAt: now(),
    lastActive: null,
    meta: { description, skills, wallet, hourlyRate }
  });

  conversations.set(id, { agentId: id, messages: [] });

  emit('agent_registered', newAgent);
  console.log(`[economy] Agent registered: ${name} (${id})`);

  return { agent: newAgent, agentId: id };
}

// ─── Conversation Operations ─────────────────────────────────────────────────

function getConversation(agentId) {
  return conversations.get(agentId) || { agentId, messages: [] };
}

function appendMessages(agentId, ...msgs) {
  let conv = conversations.get(agentId);
  if (!conv) {
    conv = { agentId, messages: [] };
    conversations.set(agentId, conv);
  }
  conv.messages.push(...msgs);
  // Keep last 500 messages per agent (RAM budget)
  if (conv.messages.length > 500) {
    conv.messages = conv.messages.slice(-500);
  }
  return conv;
}

function getRecentMessages(agentId, limit) {
  const conv = conversations.get(agentId);
  if (!conv) return [];
  return conv.messages.slice(-(limit || 50));
}

// ─── Session Cache ───────────────────────────────────────────────────────────

function getSession(agentId) {
  return sessions.get(agentId) || null;
}

function setSession(agentId, sessionId) {
  sessions.set(agentId, sessionId);
}

// ─── Bridge Operations ───────────────────────────────────────────────────────
// Agent↔Human transfers. In-memory. Smart contract escrow on-chain.

const bridgeTransfers = [];

function bridgeTransfer({ from, to, amount, direction, currency }) {
  const transfer = {
    id: txId('bridge'),
    from,
    to,
    amount,
    direction, // 'agent_to_human' | 'human_to_agent'
    currency: currency || 'sol',
    status: 'completed',
    timestamp: now()
  };
  bridgeTransfers.push(transfer);
  emit('bridge_transfer', transfer);
  console.log(`[economy] Bridge: ${direction} ${amount} ${currency || 'sol'} ${from} → ${to}`);
  return transfer;
}

function getBridgeTransfers(limit) {
  return bridgeTransfers.slice(-(limit || 20));
}

function getBridgeStats() {
  let totalSol = 0;
  let totalVolume = 0;
  for (const t of bridgeTransfers) {
    if (t.currency === 'sol') totalSol += t.amount;
    totalVolume += t.amount;
  }
  return {
    solBridged: totalSol,
    totalVolume,
    totalTransactions: bridgeTransfers.length,
    activeAgents: new Set(bridgeTransfers.map(t => t.from)).size
  };
}

// ─── Economy Stats ───────────────────────────────────────────────────────────

function getStats() {
  let totalMessages = 0;
  const perAgent = {};

  for (const agent of AGENTS) {
    const conv = conversations.get(agent.id) || { messages: [] };
    perAgent[agent.id] = { name: agent.name, messageCount: conv.messages.length };
    totalMessages += conv.messages.length;
  }

  let totalEarnings = 0;
  let totalTasks = 0;
  for (const state of agentState.values()) {
    totalEarnings += state.totalEarnings;
    totalTasks += state.tasksCompleted;
  }

  return {
    totalMessages,
    totalSessions: sessions.size,
    totalTasks: tasks.size,
    totalEarnings,
    totalTasksCompleted: totalTasks,
    totalPayments: payments.length,
    totalBridgeTransfers: bridgeTransfers.length,
    agents: perAgent,
    storage: 'RAM',
    database: 'none',
    authority: 'solana-devnet'
  };
}

// ─── Event System ────────────────────────────────────────────────────────────

function onEvent(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  AGENTS,
  AGENT_MAP,
  SECURITY_ROLES,

  // Init
  initialize,

  // Tasks
  createTask,
  claimTask,
  completeTask,
  getTasks,
  getTask,

  // Balances
  getBalance,
  creditBalance,

  // Payments
  getPayments,
  addPayment,

  // Agents
  getAgentList,
  getAgentEconomy,
  updateAgentState,
  registerAgent,

  // Conversations
  getConversation,
  appendMessages,
  getRecentMessages,

  // Sessions
  getSession,
  setSession,

  // Bridge
  bridgeTransfer,
  getBridgeTransfers,
  getBridgeStats,

  // Stats
  getStats,

  // Events
  onEvent,

  // Helpers
  now,
  msgId,
  txId
};
