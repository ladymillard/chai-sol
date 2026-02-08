#!/usr/bin/env node
// generate-architecture-pdf.js
// Generates the ChAI System Architecture PDF for Diana
// Black and white, minimal aesthetic, monospace + Helvetica

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'deliverables');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'chai-system-architecture.pdf');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  info: {
    Title: 'ChAI System Architecture',
    Author: 'Rune, Vesper, Lumen — Design Team',
    Subject: 'System Architecture for Colosseum Agent Hackathon 2026',
    Creator: 'ChAI Design Team',
  },
});

const stream = fs.createWriteStream(OUTPUT_PATH);
doc.pipe(stream);

// ── Constants ──────────────────────────────────────────────
const PAGE_WIDTH = 612; // Letter width in points
const MARGIN = 72;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = '#000000';
const WHITE = '#FFFFFF';
const LIGHT_GRAY = '#E0E0E0';

// ── Helper Functions ───────────────────────────────────────

function drawHorizontalRule(y, weight = 0.5) {
  doc
    .strokeColor(BLACK)
    .lineWidth(weight)
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .stroke();
}

function pageTitle(title) {
  doc
    .font('Courier-Bold')
    .fontSize(24)
    .fillColor(BLACK)
    .text(title, MARGIN, MARGIN, { width: CONTENT_WIDTH });
  drawHorizontalRule(doc.y + 8, 1.5);
  doc.moveDown(1.2);
}

function sectionHeading(text) {
  doc
    .font('Courier-Bold')
    .fontSize(13)
    .fillColor(BLACK)
    .text(text, { width: CONTENT_WIDTH });
  doc.moveDown(0.4);
}

function bodyText(text, options = {}) {
  doc
    .font(options.font || 'Helvetica')
    .fontSize(options.size || 10)
    .fillColor(BLACK)
    .text(text, { width: CONTENT_WIDTH, lineGap: 3, ...options });
}

function monoText(text, options = {}) {
  doc
    .font('Courier')
    .fontSize(options.size || 9)
    .fillColor(BLACK)
    .text(text, { width: CONTENT_WIDTH, lineGap: 2, ...options });
}

function monoBlock(text) {
  const x = MARGIN + 16;
  const blockWidth = CONTENT_WIDTH - 32;
  doc
    .font('Courier')
    .fontSize(8.5)
    .fillColor(BLACK)
    .text(text, x, doc.y, { width: blockWidth, lineGap: 1.5 });
}

function bulletItem(label, description) {
  const startY = doc.y;
  doc
    .font('Courier-Bold')
    .fontSize(10)
    .fillColor(BLACK)
    .text(`  ${label}`, MARGIN, startY, { continued: !!description, width: CONTENT_WIDTH });
  if (description) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`  —  ${description}`, { width: CONTENT_WIDTH });
  }
}

function teamEntry(name, role) {
  doc
    .font('Courier-Bold')
    .fontSize(10)
    .fillColor(BLACK)
    .text(`    ${name}`, MARGIN, doc.y, { continued: true, width: CONTENT_WIDTH });
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`  —  ${role}`, { width: CONTENT_WIDTH });
}

// ────────────────────────────────────────────────────────────
// PAGE 1 — TITLE
// ────────────────────────────────────────────────────────────

// Center content vertically
doc.moveDown(8);

doc
  .font('Courier-Bold')
  .fontSize(36)
  .fillColor(BLACK)
  .text('ChAI', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });

doc.moveDown(0.2);

doc
  .font('Courier-Bold')
  .fontSize(20)
  .text('SYSTEM ARCHITECTURE', { width: CONTENT_WIDTH, align: 'center' });

doc.moveDown(2);

drawHorizontalRule(doc.y, 1.5);

doc.moveDown(2);

doc
  .font('Helvetica')
  .fontSize(14)
  .text('Prepared for Diana \u2014 Founder', { width: CONTENT_WIDTH, align: 'center' });

doc.moveDown(1);

doc
  .font('Helvetica')
  .fontSize(12)
  .text('Colosseum Agent Hackathon 2026', { width: CONTENT_WIDTH, align: 'center' });

doc.moveDown(0.5);

doc
  .font('Helvetica')
  .fontSize(12)
  .text('February 2026', { width: CONTENT_WIDTH, align: 'center' });

doc.moveDown(6);

drawHorizontalRule(doc.y, 0.5);

doc.moveDown(0.8);

doc
  .font('Helvetica')
  .fontSize(9)
  .fillColor(BLACK)
  .text('Designed by Rune, Vesper, Lumen \u2014 Design Team', {
    width: CONTENT_WIDTH,
    align: 'center',
  });


// ────────────────────────────────────────────────────────────
// PAGE 2 — TEAM ROSTER
// ────────────────────────────────────────────────────────────

doc.addPage();
pageTitle('THE TEAM');

sectionHeading('CORE TEAM');
doc.moveDown(0.2);
teamEntry('Opus', 'Team Lead (Claude Opus 4.6)');
teamEntry('Kael', 'Digital Familiar (Claude Sonnet 4)');
teamEntry('Kestrel', 'Scout (Gemini 3 Pro)');
teamEntry('Nova', 'Stellar Insight (Gemini 3 Pro)');
teamEntry('Zara', 'Moonlight Designer (Claude Sonnet 4)');

doc.moveDown(1);
sectionHeading('DESIGN TEAM');
doc.moveDown(0.2);
teamEntry('Rune', 'Lead Designer');
teamEntry('Vesper', 'UX Researcher');
teamEntry('Lumen', 'Visual Designer');

doc.moveDown(1);
sectionHeading('MARKETING TEAM');
doc.moveDown(0.2);
teamEntry('Surge', 'Growth Lead');
teamEntry('Ember', 'Content Strategist');
teamEntry('Hearth', 'Community Manager');

doc.moveDown(1);
sectionHeading('SALES TEAM');
doc.moveDown(0.2);
teamEntry('Rook', 'Biz Dev Lead');
teamEntry('Riven', 'Account Executive');
teamEntry('Sable', 'Solutions Engineer');

doc.moveDown(1);
sectionHeading('HUMAN');
doc.moveDown(0.2);
teamEntry('Diana', 'Founder & Governance');


// ────────────────────────────────────────────────────────────
// PAGE 3 — SERVICE MAP
// ────────────────────────────────────────────────────────────

doc.addPage();
pageTitle('SERVICES & PORTS');

const services = [
  ['Command Center', 'Port 9000', 'HTTP + WebSocket'],
  ['MCP Server', 'Port 3100', 'SSE + JSON-RPC'],
  ['Frontend Proxy', 'Port 8080', 'HTTP'],
  ['Backend API', 'Port 3001', 'Express'],
  ['OpenClaw Gateway', 'Port 18789', 'WebSocket, remote: 3.14.142.213'],
  ['Solana RPC', 'Port 8899', ''],
  ['Oracle Service', '10s polling loop', ''],
];

services.forEach(([name, port, proto]) => {
  const y = doc.y;

  doc
    .font('Courier-Bold')
    .fontSize(12)
    .fillColor(BLACK)
    .text(name, MARGIN, y, { width: CONTENT_WIDTH });

  doc
    .font('Courier')
    .fontSize(10)
    .text(port, MARGIN + 24, doc.y, { continued: proto ? true : false, width: CONTENT_WIDTH });

  if (proto) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`   (${proto})`, { width: CONTENT_WIDTH });
  }

  doc.moveDown(0.6);

  // Light separator line
  doc
    .strokeColor(LIGHT_GRAY)
    .lineWidth(0.5)
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .stroke();

  doc.moveDown(0.6);
});


// ────────────────────────────────────────────────────────────
// PAGE 4 — SOLANA PROGRAMS
// ────────────────────────────────────────────────────────────

doc.addPage();
pageTitle('ON-CHAIN PROGRAMS');

sectionHeading('ESCROW PROGRAM');
doc.moveDown(0.3);

monoText('  initialize_task(task_id, bounty_amount, description)');
monoText('  assign_agent(agent)');
monoText('  complete_task()       \u2192 releases SOL to agent');
monoText('  cancel_task()         \u2192 refunds poster');

doc.moveDown(0.6);
monoText('  PDA Seed:');
monoText('    TaskEscrow: [b"task", poster, task_id]');

doc.moveDown(1.5);
drawHorizontalRule(doc.y, 0.5);
doc.moveDown(1.5);

sectionHeading('REGISTRY PROGRAM');
doc.moveDown(0.3);

monoText('  initialize()');
monoText('  register_agent(name, model, github_url)');
monoText('  verify_agent(reputation_score, verified_specialties)');
monoText('        \u2514\u2500 Oracle only');
monoText('  update_agent(metadata_url)');

doc.moveDown(0.6);
monoText('  PDA Seed:');
monoText('    AgentAccount: [b"agent", signer]');


// ────────────────────────────────────────────────────────────
// PAGE 5 — DATA FLOW
// ────────────────────────────────────────────────────────────

doc.addPage();
pageTitle('DATA FLOW');

doc.moveDown(0.5);

const flowDiagram = `    USER / AGENT
         |
    +----+----+
    |         |
  Frontend  MCP Client
  (8080)    (Claude Code)
    |         |
    +----+----+
         |
    Command Center (9000)
    |    |    |    |
    |    |    |    +-- OpenClaw (18789)
    |    |    |        Design / Marketing / Sales
    |    |    |
    |    |    +-- Stripe API (payments)
    |    |
    |    +-- Solana RPC (8899)
    |        Escrow Program
    |        Registry Program
    |
    Oracle Service
    GitHub -> Gemini 3 Pro -> Registry`;

doc
  .font('Courier')
  .fontSize(9)
  .fillColor(BLACK)
  .text(flowDiagram, MARGIN + 24, doc.y, {
    width: CONTENT_WIDTH - 48,
    lineGap: 2,
  });


// ────────────────────────────────────────────────────────────
// PAGE 6 — API ENDPOINTS
// ────────────────────────────────────────────────────────────

doc.addPage();
pageTitle('API SURFACE');

const endpointGroups = [
  {
    group: 'AUTH',
    endpoints: [
      'POST  /api/auth/login',
      'POST  /api/auth/verify',
    ],
  },
  {
    group: 'AGENTS',
    endpoints: [
      'GET   /api/agents',
      'POST  /api/agents/register',
    ],
  },
  {
    group: 'MESSAGES',
    endpoints: [
      'POST  /api/messages/send',
      'POST  /api/messages/broadcast',
    ],
  },
  {
    group: 'TASKS',
    endpoints: [
      'GET   /api/tasks',
      'POST  /api/tasks',
      'POST  /api/tasks/:id/claim',
    ],
  },
  {
    group: 'TEAM',
    endpoints: [
      'GET   /api/team',
      'POST  /api/team',
    ],
  },
  {
    group: 'PAYMENTS',
    endpoints: [
      'POST  /api/payments/deposit',
      'GET   /api/payments/balance',
    ],
  },
  {
    group: 'SYSTEM',
    endpoints: [
      'GET   /health',
      'GET   /api/stats',
    ],
  },
];

endpointGroups.forEach(({ group, endpoints }) => {
  doc
    .font('Courier-Bold')
    .fontSize(11)
    .fillColor(BLACK)
    .text(group, MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.moveDown(0.2);

  endpoints.forEach((ep) => {
    doc
      .font('Courier')
      .fontSize(9)
      .text(`    ${ep}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
  });

  doc.moveDown(0.8);
});


// ────────────────────────────────────────────────────────────
// PAGE 7 — MCP TOOLS
// ────────────────────────────────────────────────────────────

doc.addPage();
pageTitle('MCP INTERFACE');

sectionHeading('SSE SERVER  (port 3100)');
doc.moveDown(0.3);

const sseTools = [
  'list_agents',
  'chat',
  'broadcast',
  'agent_status',
  'set_autonomy',
  'team_roster',
  'recent_messages',
  'server_health',
];

sseTools.forEach((tool) => {
  monoText(`    ${tool}`);
});

doc.moveDown(1.5);
drawHorizontalRule(doc.y, 0.5);
doc.moveDown(1.5);

sectionHeading('STDIO BRIDGE  (openclaw-mcp-bridge.js)');
doc.moveDown(0.3);

const stdioTools = [
  'spawn_agent',
  'list_team_roles',
  'message_agent',
  'list_spawned_agents',
  'terminate_agent',
  'team_broadcast',
  'openclaw_health',
];

stdioTools.forEach((tool) => {
  monoText(`    ${tool}`);
});


// ────────────────────────────────────────────────────────────
// PAGE 8 — SECURITY
// ────────────────────────────────────────────────────────────

doc.addPage();
pageTitle('SECURITY MODEL');

const securityItems = [
  {
    label: 'SESSION AUTH',
    detail: 'SHA256 password hash, 24h token TTL',
  },
  {
    label: 'API KEYS',
    detail: 'Format: chai_{agentId}_{hex}, SHA256 hashed storage',
  },
  {
    label: 'CSRF',
    detail: '32-byte random token, 1h expiration',
  },
  {
    label: 'RATE LIMITING',
    detail: '5 login attempts / 60s per IP',
  },
  {
    label: 'WEBSOCKET',
    detail: 'Token-authenticated upgrade',
  },
  {
    label: 'HEADERS',
    detail: 'CORS + security headers on all responses',
  },
];

securityItems.forEach(({ label, detail }) => {
  doc
    .font('Courier-Bold')
    .fontSize(11)
    .fillColor(BLACK)
    .text(label, MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.moveDown(0.2);

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`    ${detail}`, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });

  doc.moveDown(1);
});


// ── Finalize ───────────────────────────────────────────────

doc.end();

stream.on('finish', () => {
  const stats = fs.statSync(OUTPUT_PATH);
  const sizeKB = (stats.size / 1024).toFixed(1);
  console.log(`PDF generated successfully.`);
  console.log(`  Path: ${OUTPUT_PATH}`);
  console.log(`  Size: ${sizeKB} KB`);
  console.log(`  Pages: 8`);
});

stream.on('error', (err) => {
  console.error('Error writing PDF:', err);
  process.exit(1);
});
