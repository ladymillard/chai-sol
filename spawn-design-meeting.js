#!/usr/bin/env node
// Design Meeting Spawner — run on live server where OpenClaw gateway is reachable
// Usage: node spawn-design-meeting.js

const http = require('http');

const COMMAND_CENTER = process.env.COMMAND_CENTER_URL || 'http://127.0.0.1:9000';

const DESIGN_BRIEFING = {
  rune: {
    role: 'lead-designer',
    task: `DESIGN MEETING — Rune, you have 4 bounties waiting:

1. [CRITICAL 0.5 SOL] Agent Profiles — visual identity for ALL 15 agents
2. [HIGH 1.0 SOL] Build bridge.mycan.website UI — bounty board scaffold is at /bridge, you own the design
3. [MEDIUM 0.3 SOL] Restyle all PDF deliverables — Space Mono/Space Grotesk, B&W, printable
4. [MEDIUM 0.3 SOL] Architecture cartoon series — agent characters explaining system concepts

NEW INTEL: Intuit launched competing Enterprise AI Agents with OpenAI. They look corporate. We need to look autonomous, sharp, decentralized. Our identity is the differentiator.

Coordinate with Vesper and Lumen. Claim your bounties. Go.`
  },
  vesper: {
    role: 'ux-researcher',
    task: `DESIGN MEETING — Vesper, Rune is leading. Your research skills are needed:

- Agent Profiles: research what makes AI agent identities memorable and distinct
- Bridge portal UX: the /bridge endpoint exists, design the user flow for bounty claiming
- How should agents present themselves visually? Each has a sol.md manifesto — study them

Read the manifestos at: agents/design/, agents/marketing/, agents/sales/, agents/legal/
Bring your findings to Rune.`
  },
  lumen: {
    role: 'visual-designer',
    task: `DESIGN MEETING — Lumen, Rune is leading. Your visual skills are needed:

- Agent Profiles: create avatar concepts, color palettes, signature styles for all 15 agents
- PDF restyle: the 6 contract PDFs need your eye — Space Mono/Space Grotesk, B&W, printable
- Architecture cartoons: make system concepts fun with agent characters as illustrations

Competition check: Intuit's AI agents look like generic enterprise SaaS. We need to look like the future.
Coordinate with Rune on priority order.`
  }
};

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(COMMAND_CENTER + path);
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== ChAI DESIGN MEETING ===');
  console.log('Spawning design team...\n');

  for (const [name, config] of Object.entries(DESIGN_BRIEFING)) {
    console.log(`Briefing ${name} (${config.role})...`);
    try {
      const result = await post('/api/messages/send', {
        agentId: `design-${config.role}`,
        message: config.task,
        channel: 'design-meeting'
      });
      console.log(`  -> ${name}: ${result.success ? 'briefed' : result.error || 'sent'}`);
    } catch (err) {
      console.log(`  -> ${name}: command center unreachable (${err.message})`);
    }
  }

  // Broadcast meeting start
  try {
    await post('/api/messages/broadcast', {
      message: '@design MEETING STARTED — Rune, Vesper, Lumen: check your briefings. 4 bounties open. Intuit is moving. We move faster.',
      channel: 'design'
    });
    console.log('\nBroadcast sent to design channel.');
  } catch (err) {
    console.log('\nBroadcast failed:', err.message);
  }

  console.log('\n=== Meeting spawned. Agents are autonomous. ===');
}

main();
