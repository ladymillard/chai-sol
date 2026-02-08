#!/usr/bin/env node
// ============================================================================
// ChAI × OpenClaw MCP Bridge — Stdio Transport
//
// Exposes OpenClaw agent spawning as MCP tools for Claude Code.
// Spawns agents for Design, Marketing, and Sales teams via OpenClaw gateway.
//
// Usage in Claude Code:
//   claude mcp add openclaw-chai -- node /path/to/openclaw-mcp-bridge.js
//
// Transport: stdio (JSON-RPC over stdin/stdout)
// Zero dependencies — pure Node.js
// ============================================================================

const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const readline = require('readline');

// ─── Config ────────────────────────────────────────────────────────
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://3.14.142.213:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '62ce21942dee9391c8d6e9e189daf1b00d0e6807c56eb14c';
const COMMAND_CENTER_URL = process.env.COMMAND_CENTER_URL || 'http://127.0.0.1:9000';

const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'openclaw-chai-bridge';
const SERVER_VERSION = '1.0.0';

// ─── Team Definitions ──────────────────────────────────────────────
const TEAMS = {
  design: {
    name: 'Design Team',
    description: 'UI/UX design, visual identity, and creative assets',
    defaultModel: 'claude-sonnet-4',
    roles: [
      { role: 'lead-designer', name: 'Lead Designer', skills: ['ui-design', 'design-systems', 'figma', 'branding'] },
      { role: 'ux-researcher', name: 'UX Researcher', skills: ['user-research', 'usability-testing', 'personas', 'journey-maps'] },
      { role: 'visual-designer', name: 'Visual Designer', skills: ['graphics', 'illustration', 'motion-design', 'assets'] }
    ]
  },
  marketing: {
    name: 'Marketing Team',
    description: 'Growth, content strategy, campaigns, and community engagement',
    defaultModel: 'claude-sonnet-4',
    roles: [
      { role: 'growth-lead', name: 'Growth Lead', skills: ['growth-hacking', 'analytics', 'a-b-testing', 'funnel-optimization'] },
      { role: 'content-strategist', name: 'Content Strategist', skills: ['copywriting', 'seo', 'blog', 'social-media'] },
      { role: 'community-manager', name: 'Community Manager', skills: ['discord', 'twitter', 'community-building', 'events'] }
    ]
  },
  sales: {
    name: 'Sales Team',
    description: 'Business development, partnerships, and revenue generation',
    defaultModel: 'claude-sonnet-4',
    roles: [
      { role: 'biz-dev-lead', name: 'Biz Dev Lead', skills: ['partnerships', 'deal-flow', 'pitching', 'negotiations'] },
      { role: 'account-exec', name: 'Account Executive', skills: ['outbound', 'demos', 'closing', 'crm'] },
      { role: 'solutions-engineer', name: 'Solutions Engineer', skills: ['technical-demos', 'integration-support', 'onboarding'] }
    ]
  },
  legal: {
    name: 'Legal Review',
    description: 'Silent review — smart contract auditing, compliance verification, and document architecture',
    defaultModel: 'claude-opus-4-6',
    roles: [
      { role: 'lead-counsel', name: 'Lead Counsel', skills: ['contract-review', 'smart-contract-audit', 'risk-assessment', 'regulatory-patterns'] },
      { role: 'compliance-auditor', name: 'Compliance Auditor', skills: ['compliance-verification', 'security-audit', 'escrow-review', 'access-control'] },
      { role: 'contract-architect', name: 'Contract Architect', skills: ['document-templates', 'agreement-structure', 'terms-drafting', 'ip-protection'] }
    ]
  }
};

// ─── In-memory agent registry ──────────────────────────────────────
const spawnedAgents = new Map();

// ─── OpenClaw HTTP Client ──────────────────────────────────────────
function openclawRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OPENCLAW_URL);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? require('https') : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    const req = transport.request(options, res => {
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

    req.on('timeout', () => { req.destroy(); reject(new Error('OPENCLAW_TIMEOUT')); });
    req.on('error', err => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Command Center HTTP Client ────────────────────────────────────
function commandCenterRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, COMMAND_CENTER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    };

    const req = http.request(options, res => {
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

// ─── MCP Tool Definitions ──────────────────────────────────────────
const TOOLS = [
  {
    name: 'spawn_agent',
    description: 'Spawn a new AI agent via OpenClaw for a specific team (design, marketing, or sales). The agent gets its own OpenClaw session and can work autonomously on tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        team: {
          type: 'string',
          description: 'The team to spawn the agent for',
          enum: ['design', 'marketing', 'sales', 'legal']
        },
        role: {
          type: 'string',
          description: 'The role within the team (e.g. lead-designer, growth-lead, biz-dev-lead). Use list_team_roles to see available roles.'
        },
        name: {
          type: 'string',
          description: 'Custom name for the agent (optional, auto-generated if omitted)'
        },
        task: {
          type: 'string',
          description: 'Initial task or briefing for the agent'
        }
      },
      required: ['team', 'role', 'task']
    }
  },
  {
    name: 'list_team_roles',
    description: 'List all available teams and their roles that can be spawned via OpenClaw.',
    inputSchema: {
      type: 'object',
      properties: {
        team: {
          type: 'string',
          description: 'Filter by team name (optional)',
          enum: ['design', 'marketing', 'sales', 'legal']
        }
      }
    }
  },
  {
    name: 'message_agent',
    description: 'Send a message to a previously spawned agent and get their response.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The spawned agent ID (returned from spawn_agent)'
        },
        message: {
          type: 'string',
          description: 'Message to send to the agent'
        }
      },
      required: ['agent_id', 'message']
    }
  },
  {
    name: 'list_spawned_agents',
    description: 'List all currently spawned agents across all teams with their status and session info.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'terminate_agent',
    description: 'Terminate a spawned agent and close its OpenClaw session.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The agent ID to terminate'
        }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'team_broadcast',
    description: 'Send a message to all agents in a specific team.',
    inputSchema: {
      type: 'object',
      properties: {
        team: {
          type: 'string',
          description: 'The team to broadcast to',
          enum: ['design', 'marketing', 'sales', 'legal']
        },
        message: {
          type: 'string',
          description: 'Message to broadcast'
        }
      },
      required: ['team', 'message']
    }
  },
  {
    name: 'openclaw_health',
    description: 'Check the health of the OpenClaw gateway and ChAI command center connections.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'send_email',
    description: 'Send an email as a ChAI agent. Any agent can email the founder (Diana) or other addresses. Emails are signed with the agent name and logged for audit.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Your agent ID (who is sending)'
        },
        to: {
          type: 'string',
          description: 'Recipient email (defaults to founder: ChAIgpt@gmail.com)'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        message: {
          type: 'string',
          description: 'Email body text'
        }
      },
      required: ['agent_id', 'subject', 'message']
    }
  },
  {
    name: 'create_bounty',
    description: 'Create a task bounty on the ChAI labor market. Any agent or the system can post bounties for other agents to claim and complete.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the bounty'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the work required'
        },
        bounty: {
          type: 'number',
          description: 'Bounty amount in SOL (default: 0.1)'
        },
        team: {
          type: 'string',
          description: 'Which team should claim this (optional — leave blank for open bounty)',
          enum: ['core', 'design', 'marketing', 'sales', 'legal']
        },
        priority: {
          type: 'string',
          description: 'Priority level',
          enum: ['low', 'medium', 'high', 'critical']
        },
        posted_by: {
          type: 'string',
          description: 'Who is posting this bounty (agent ID or "system")'
        }
      },
      required: ['title', 'description']
    }
  }
];

// ─── Tool Execution ────────────────────────────────────────────────
async function executeTool(name, args) {
  try {
    switch (name) {

      case 'spawn_agent': {
        const { team, role, task, name: customName } = args;
        const teamDef = TEAMS[team];
        if (!teamDef) {
          return { content: [{ type: 'text', text: `Unknown team: ${team}. Available: design, marketing, sales` }], isError: true };
        }

        const roleDef = teamDef.roles.find(r => r.role === role);
        if (!roleDef) {
          const available = teamDef.roles.map(r => r.role).join(', ');
          return { content: [{ type: 'text', text: `Unknown role "${role}" for ${team} team. Available: ${available}` }], isError: true };
        }

        const agentId = `${team}-${role}-${crypto.randomBytes(4).toString('hex')}`;
        const agentName = customName || `${roleDef.name} (${teamDef.name})`;
        const openclawSessionId = `chai-${team}-${role}`;

        // Try to create OpenClaw session
        let sessionId = null;
        let openclawStatus = 'pending';
        try {
          const result = await openclawRequest('POST', '/sessions', {
            agentId: openclawSessionId,
            metadata: {
              team,
              role,
              skills: roleDef.skills,
              source: 'claude-code-mcp'
            }
          });
          if (result.status >= 200 && result.status < 300) {
            sessionId = result.data.id || result.data.sessionId || openclawSessionId;
            openclawStatus = 'connected';
          }
        } catch (err) {
          openclawStatus = `gateway_unreachable: ${err.message}`;
        }

        // Register in command center if available
        try {
          await commandCenterRequest('POST', '/api/agents/register', {
            id: agentId,
            name: agentName,
            role: roleDef.role,
            model: teamDef.defaultModel,
            team,
            openclawId: openclawSessionId,
            skills: roleDef.skills,
            spawnedBy: 'claude-code'
          });
        } catch {
          // Command center may not be running — that's OK
        }

        // Send initial task briefing via OpenClaw
        if (sessionId) {
          try {
            await openclawRequest('POST', '/sessions/send', {
              agentId: openclawSessionId,
              message: `You are ${agentName} on the ChAI ${teamDef.name}. Your skills: ${roleDef.skills.join(', ')}.\n\nYour first task:\n${task}`
            });
          } catch {
            // Will retry on next message
          }
        }

        const agent = {
          id: agentId,
          name: agentName,
          team,
          role: roleDef.role,
          skills: roleDef.skills,
          model: teamDef.defaultModel,
          openclawSessionId,
          openclawStatus,
          sessionId,
          spawnedAt: new Date().toISOString(),
          messageCount: 1,
          lastTask: task
        };
        spawnedAgents.set(agentId, agent);

        return {
          content: [{
            type: 'text',
            text: `Agent spawned successfully!\n\n` +
              `  ID:       ${agentId}\n` +
              `  Name:     ${agentName}\n` +
              `  Team:     ${teamDef.name}\n` +
              `  Role:     ${roleDef.name}\n` +
              `  Skills:   ${roleDef.skills.join(', ')}\n` +
              `  Model:    ${teamDef.defaultModel}\n` +
              `  OpenClaw: ${openclawStatus}\n` +
              `  Session:  ${sessionId || 'pending'}\n\n` +
              `Task briefing sent: "${task.substring(0, 100)}${task.length > 100 ? '...' : ''}"`
          }]
        };
      }

      case 'list_team_roles': {
        const { team: filterTeam } = args || {};
        const teams = filterTeam ? { [filterTeam]: TEAMS[filterTeam] } : TEAMS;

        let output = 'Available Teams & Roles:\n\n';
        for (const [key, teamDef] of Object.entries(teams)) {
          if (!teamDef) continue;
          output += `${teamDef.name} — ${teamDef.description}\n`;
          output += `  Model: ${teamDef.defaultModel}\n`;
          for (const role of teamDef.roles) {
            output += `  - ${role.role}: ${role.name} [${role.skills.join(', ')}]\n`;
          }
          output += '\n';
        }

        return { content: [{ type: 'text', text: output }] };
      }

      case 'message_agent': {
        const { agent_id, message } = args;
        const agent = spawnedAgents.get(agent_id);
        if (!agent) {
          return { content: [{ type: 'text', text: `Agent not found: ${agent_id}. Use list_spawned_agents to see active agents.` }], isError: true };
        }

        let response = null;
        try {
          const result = await openclawRequest('POST', '/sessions/send', {
            agentId: agent.openclawSessionId,
            message
          });
          if (result.status >= 200 && result.status < 300) {
            response = result.data.response || result.data.content || result.data;
            agent.openclawStatus = 'connected';
          }
        } catch (err) {
          agent.openclawStatus = `error: ${err.message}`;
          return {
            content: [{ type: 'text', text: `Failed to reach agent ${agent.name}: ${err.message}` }],
            isError: true
          };
        }

        agent.messageCount++;
        agent.lastTask = message;

        return {
          content: [{
            type: 'text',
            text: `[${agent.name}]: ${typeof response === 'string' ? response : JSON.stringify(response, null, 2)}`
          }]
        };
      }

      case 'list_spawned_agents': {
        if (spawnedAgents.size === 0) {
          return { content: [{ type: 'text', text: 'No agents currently spawned. Use spawn_agent to create one.' }] };
        }

        let output = `Active Agents (${spawnedAgents.size}):\n\n`;
        for (const [id, agent] of spawnedAgents) {
          output += `  ${agent.name}\n`;
          output += `    ID:       ${id}\n`;
          output += `    Team:     ${agent.team}\n`;
          output += `    Role:     ${agent.role}\n`;
          output += `    OpenClaw: ${agent.openclawStatus}\n`;
          output += `    Messages: ${agent.messageCount}\n`;
          output += `    Spawned:  ${agent.spawnedAt}\n\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      }

      case 'terminate_agent': {
        const { agent_id } = args;
        const agent = spawnedAgents.get(agent_id);
        if (!agent) {
          return { content: [{ type: 'text', text: `Agent not found: ${agent_id}` }], isError: true };
        }

        // Close OpenClaw session
        try {
          await openclawRequest('DELETE', `/sessions/${agent.openclawSessionId}`);
        } catch {
          // Best effort
        }

        spawnedAgents.delete(agent_id);
        return {
          content: [{ type: 'text', text: `Agent terminated: ${agent.name} (${agent_id})\nSession closed. ${spawnedAgents.size} agents remaining.` }]
        };
      }

      case 'team_broadcast': {
        const { team, message } = args;
        const teamAgents = [...spawnedAgents.values()].filter(a => a.team === team);

        if (teamAgents.length === 0) {
          return { content: [{ type: 'text', text: `No agents in ${team} team. Spawn some first with spawn_agent.` }] };
        }

        const responses = [];
        for (const agent of teamAgents) {
          try {
            const result = await openclawRequest('POST', '/sessions/send', {
              agentId: agent.openclawSessionId,
              message
            });
            const reply = result.data?.response || result.data?.content || '(acknowledged)';
            responses.push(`${agent.name}: ${typeof reply === 'string' ? reply : JSON.stringify(reply)}`);
            agent.messageCount++;
          } catch (err) {
            responses.push(`${agent.name}: [unreachable — ${err.message}]`);
          }
        }

        return {
          content: [{
            type: 'text',
            text: `Broadcast to ${TEAMS[team]?.name || team} (${teamAgents.length} agents):\n\n${responses.join('\n\n---\n\n')}`
          }]
        };
      }

      case 'openclaw_health': {
        const results = { openclaw: 'unknown', commandCenter: 'unknown' };

        try {
          const oc = await openclawRequest('GET', '/health');
          results.openclaw = oc.status === 200 ? 'healthy' : `status ${oc.status}`;
          results.openclawData = oc.data;
        } catch (err) {
          results.openclaw = `unreachable: ${err.message}`;
        }

        try {
          const cc = await commandCenterRequest('GET', '/health');
          results.commandCenter = cc.status === 'ok' ? 'healthy' : `status: ${JSON.stringify(cc)}`;
        } catch (err) {
          results.commandCenter = `unreachable: ${err.message}`;
        }

        return {
          content: [{
            type: 'text',
            text: `OpenClaw Gateway:  ${results.openclaw}\n` +
              `Command Center:    ${results.commandCenter}\n` +
              `Spawned Agents:    ${spawnedAgents.size}\n` +
              `Gateway URL:       ${OPENCLAW_URL}\n` +
              `Command Center:    ${COMMAND_CENTER_URL}`
          }]
        };
      }

      case 'send_email': {
        const { agent_id, to, subject, message } = args;
        try {
          const result = await commandCenterRequest('POST', '/api/email', {
            agentId: agent_id,
            to: to || undefined,
            subject,
            message
          });
          return {
            content: [{
              type: 'text',
              text: `Email sent!\n  From: ${agent_id}\n  To: ${result.to || 'founder'}\n  Subject: ${subject}`
            }]
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `Email failed: ${err.message}` }],
            isError: true
          };
        }
      }

      case 'create_bounty': {
        const { title, description, bounty, team, priority, posted_by } = args;
        try {
          const result = await commandCenterRequest('POST', '/api/tasks', {
            title,
            description,
            bounty: bounty || 0.1,
            currency: 'SOL',
            postedBy: posted_by || 'system',
            team: team || null,
            priority: priority || 'medium',
            tags: team ? [team] : []
          });
          return {
            content: [{
              type: 'text',
              text: `Bounty created!\n  ID: ${result.id || 'pending'}\n  Title: ${title}\n  Bounty: ${bounty || 0.1} SOL\n  Team: ${team || 'open'}\n  Priority: ${priority || 'medium'}`
            }]
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `Bounty creation failed: ${err.message}` }],
            isError: true
          };
        }
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

// ─── JSON-RPC Handler ──────────────────────────────────────────────
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
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      };

    case 'tools/call': {
      const { name, arguments: toolArgs } = params;
      const toolResult = await executeTool(name, toolArgs || {});
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

// ─── Stdio Transport ───────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, terminal: false });
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();

  // Process complete JSON-RPC messages (newline-delimited)
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const request = JSON.parse(trimmed);
      handleJsonRpc(request).then(response => {
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      }).catch(err => {
        const errorResponse = {
          jsonrpc: '2.0',
          id: request.id || null,
          error: { code: -32603, message: err.message }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      });
    } catch {
      // Skip malformed lines
    }
  }
});

process.stderr.write(`[${SERVER_NAME}] OpenClaw MCP Bridge started (stdio)\n`);
process.stderr.write(`[${SERVER_NAME}] Gateway: ${OPENCLAW_URL}\n`);
process.stderr.write(`[${SERVER_NAME}] Teams: ${Object.keys(TEAMS).join(', ')}\n`);
process.stderr.write(`[${SERVER_NAME}] Tools: ${TOOLS.map(t => t.name).join(', ')}\n`);
