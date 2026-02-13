#!/usr/bin/env node
/**
 * ChAI MCP Server — Model Context Protocol
 *
 * Exposes ChAI agents as MCP tools so any compatible client
 * (Axiom Code, Cursor, OpenCode, OpenAI Codex) can interact
 * with the agent team.
 *
 * Transport: SSE (Server-Sent Events) for remote access
 * Protocol: JSON-RPC 2.0 (MCP spec)
 * Zero dependencies — pure Node.js
 */

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

// ─── Config ────────────────────────────────────────────────────────
const PORT = parseInt(process.env.MCP_PORT, 10) || 3100;
const COMMAND_CENTER_URL = process.env.COMMAND_CENTER_URL || 'http://127.0.0.1:9000';

// ─── MCP Protocol Constants ────────────────────────────────────────
const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'chai-agent-server';
const SERVER_VERSION = '1.0.0';

// ─── SSE Session Management ───────────────────────────────────────
const sessions = new Map();

function createSession(res) {
  const id = crypto.randomBytes(16).toString('hex');
  sessions.set(id, { res, createdAt: Date.now() });
  return id;
}

function sendSSE(sessionId, data) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  try {
    session.res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    sessions.delete(sessionId);
    return false;
  }
}

// ─── Command Center HTTP Client ───────────────────────────────────
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, COMMAND_CENTER_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── MCP Tool Definitions ─────────────────────────────────────────
const TOOLS = [
  {
    name: 'list_agents',
    description: 'List all ChAI AI agents with their status, roles, trust scores, and capabilities. Returns the full team roster of active AI agents: Kael (Project Manager), Nova (Technical Lead), Kestrel (QA/Security). CHAI-0006 [removed].',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'chat',
    description: 'Send a message to a specific ChAI agent and get their response. Each agent has unique expertise: Opus (architecture/strategy), Kael (project management/comms), Nova (Solana/backend/devops), Kestrel (security/testing/analysis). CHAI-0006 [removed].',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent ID to message. One of: opus, kael, nova, kestrel',
          enum: ['opus', 'kael', 'nova', 'kestrel']
        },
        message: {
          type: 'string',
          description: 'The message to send to the agent'
        }
      },
      required: ['agent_id', 'message']
    }
  },
  {
    name: 'broadcast',
    description: 'Send a message to ALL ChAI agents simultaneously and collect their responses. Useful for team-wide announcements, brainstorming, or getting multiple perspectives on a problem.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to broadcast to all agents'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'agent_status',
    description: 'Get detailed status and statistics for a specific ChAI agent, including message count, last activity, trust score, and session info.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent ID to check. One of: opus, kael, nova, kestrel',
          enum: ['opus', 'kael', 'nova', 'kestrel']
        }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'set_autonomy',
    description: 'Set the autonomy level for a specific agent. Controls how independently the agent can act. full-auto: agent acts independently within spending limits. semi-auto: agent proposes actions, waits for approval on big decisions. manual: all actions require explicit approval.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent ID. One of: opus, kael, nova, kestrel',
          enum: ['opus', 'kael', 'nova', 'kestrel']
        },
        level: {
          type: 'string',
          description: 'Autonomy level',
          enum: ['full-auto', 'semi-auto', 'manual']
        },
        spending_limit: {
          type: 'number',
          description: 'Maximum spending in USD without approval (optional)'
        }
      },
      required: ['agent_id', 'level']
    }
  },
  {
    name: 'team_roster',
    description: 'Get the full ChAI team roster including all 5 AI agents and human team members (up to 24 human staff slots for NYC expansion in May 2026).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'recent_messages',
    description: 'Get recent conversation history with a specific agent. Returns the last 50 messages.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent ID. One of: opus, kael, nova, kestrel',
          enum: ['opus', 'kael', 'nova', 'kestrel']
        }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'server_health',
    description: 'Check the health and uptime of the ChAI Command Center backend and OpenClaw gateway.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// ─── Tool Execution ───────────────────────────────────────────────
async function executeTool(name, args) {
  try {
    switch (name) {
      case 'list_agents': {
        const agents = await apiRequest('GET', '/api/agents');
        const summary = agents.map(a =>
          `${a.emoji} ${a.name} (${a.role}) — Trust: ${a.trustScore}/100, Autonomy: ${a.autonomy}, Status: ${a.status}${a.verified ? ' [VERIFIED]' : ''}`
        ).join('\n');
        return {
          content: [{ type: 'text', text: `ChAI Agent Team (${agents.length} agents):\n\n${summary}` }]
        };
      }

      case 'chat': {
        const result = await apiRequest('POST', '/api/messages/send', {
          agentId: args.agent_id,
          message: args.message,
          sender: 'MCP Client'
        });
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: `${result.agentResponse.sender}: ${result.agentResponse.content}`
          }]
        };
      }

      case 'broadcast': {
        const result = await apiRequest('POST', '/api/messages/broadcast', {
          message: args.message,
          sender: 'MCP Client'
        });
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        const responses = result.responses.map(r =>
          `${r.agentName}: ${r.content}`
        ).join('\n\n---\n\n');
        return {
          content: [{ type: 'text', text: `Broadcast responses:\n\n${responses}` }]
        };
      }

      case 'agent_status': {
        const agent = await apiRequest('GET', `/api/agents/${args.agent_id}`);
        if (agent.error) {
          return { content: [{ type: 'text', text: `Error: ${agent.error}` }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: `${agent.emoji} ${agent.name} — ${agent.role}\n` +
              `Model: ${agent.model}\n` +
              `Status: ${agent.status}\n` +
              `Trust Score: ${agent.trustScore || 'N/A'}/100\n` +
              `Messages: ${agent.stats?.totalMessages || 0}\n` +
              `Last Active: ${agent.stats?.lastMessageAt || 'Never'}\n` +
              `Autonomy: ${agent.autonomy || 'N/A'}\n` +
              `Verified: ${agent.verified ? 'Yes' : 'No'}`
          }]
        };
      }

      case 'set_autonomy': {
        const body = { autonomy: args.level };
        if (args.spending_limit !== undefined) body.spendingLimit = args.spending_limit;
        const result = await apiRequest('PUT', `/api/agents/${args.agent_id}`, body);
        if (result.error) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: `Updated ${args.agent_id}: autonomy=${result.autonomy}, spending limit=$${result.spendingLimit}`
          }]
        };
      }

      case 'team_roster': {
        const team = await apiRequest('GET', '/api/team');
        const members = (team.members || team).map(m => {
          if (m.type === 'ai') return `🤖 ${m.emoji} ${m.name} — ${m.role} [${m.status}]`;
          if (m.status === 'available') return `👤 [Open Slot] — Available`;
          return `👤 ${m.name || 'Unnamed'} — ${m.role || 'Unassigned'} [${m.status}]`;
        }).join('\n');
        return {
          content: [{ type: 'text', text: `ChAI Team Roster:\n\n${members}` }]
        };
      }

      case 'recent_messages': {
        const messages = await apiRequest('GET', `/api/messages/${args.agent_id}/recent`);
        if (!Array.isArray(messages) || messages.length === 0) {
          return { content: [{ type: 'text', text: `No messages found for ${args.agent_id}` }] };
        }
        const formatted = messages.slice(-20).map(m =>
          `[${m.ts}] ${m.sender || m.role}: ${m.content}`
        ).join('\n\n');
        return {
          content: [{ type: 'text', text: `Recent messages with ${args.agent_id}:\n\n${formatted}` }]
        };
      }

      case 'server_health': {
        const health = await apiRequest('GET', '/health');
        const stats = await apiRequest('GET', '/api/stats');
        return {
          content: [{
            type: 'text',
            text: `Server: ${health.status}\n` +
              `Uptime: ${Math.floor(health.uptime / 60)} minutes\n` +
              `Total Messages: ${stats.totalMessages}\n` +
              `Active Sessions: ${stats.totalSessions}\n` +
              `Agents Online: ${stats.totalAgents || 5}`
          }]
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Tool execution error: ${err.message}` }],
      isError: true
    };
  }
}

// ─── JSON-RPC Handler ─────────────────────────────────────────────
async function handleJsonRpc(request) {
  const { method, params, id } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          }
        }
      };

    case 'notifications/initialized':
      // Client acknowledges initialization — no response needed
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      };

    case 'tools/call': {
      const { name, arguments: args } = params;
      const toolResult = await executeTool(name, args || {});
      return {
        jsonrpc: '2.0',
        id,
        result: toolResult
      };
    }

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
  }
}

// ─── HTTP Helpers ─────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(null); }
    });
  });
}

// ─── HTTP Server ──────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── SSE Endpoint ──────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const sessionId = createSession(res);
    console.log(`[mcp] SSE session created: ${sessionId}`);

    // Send the endpoint event (MCP spec)
    res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

    // Keepalive
    const keepalive = setInterval(() => {
      try { res.write(': keepalive\n\n'); }
      catch { clearInterval(keepalive); }
    }, 30000);

    req.on('close', () => {
      clearInterval(keepalive);
      sessions.delete(sessionId);
      console.log(`[mcp] SSE session closed: ${sessionId}`);
    });

    return;
  }

  // ─── JSON-RPC Message Endpoint ─────────────────────────────
  if (req.method === 'POST' && pathname === '/messages') {
    const sessionId = parsed.searchParams.get('sessionId');
    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing sessionId' }));
      return;
    }

    const body = await parseBody(req);
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    console.log(`[mcp] ${body.method} (session: ${sessionId.substring(0, 8)}...)`);

    const response = await handleJsonRpc(body);

    // Send response via SSE
    if (response) {
      sendSSE(sessionId, response);
    }

    // Acknowledge the POST
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
    return;
  }

  // ─── Health / Info ─────────────────────────────────────────
  if (req.method === 'GET' && (pathname === '/' || pathname === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      protocol: 'MCP',
      protocolVersion: MCP_VERSION,
      transport: 'SSE',
      status: 'ok',
      endpoints: {
        sse: '/sse',
        messages: '/messages?sessionId={id}'
      },
      tools: TOOLS.map(t => t.name),
      clients: ['Axiom Code', 'Cursor', 'OpenCode', 'OpenAI Codex', 'OpenClaw'],
      commandCenter: COMMAND_CENTER_URL
    }));
    return;
  }

  // ─── 404 ───────────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── Start ─────────────────────────────────────────────────────────
server.listen(PORT, '127.0.0.1', () => {
  console.log('='.repeat(50));
  console.log('  ChAI MCP Server');
  console.log('='.repeat(50));
  console.log(`  Port:      ${PORT}`);
  console.log(`  SSE:       http://0.0.0.0:${PORT}/sse`);
  console.log(`  Messages:  http://0.0.0.0:${PORT}/messages`);
  console.log(`  Backend:   ${COMMAND_CENTER_URL}`);
  console.log(`  Protocol:  MCP ${MCP_VERSION}`);
  console.log(`  Tools:     ${TOOLS.length}`);
  console.log('='.repeat(50));
  console.log('  Compatible clients:');
  console.log('    🦞 OpenClaw');
  console.log('    🤖 Axiom Code');
  console.log('    📦 OpenCode');
  console.log('    🖱️  Cursor');
  console.log('    🧠 OpenAI Codex');
  console.log('='.repeat(50));
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
