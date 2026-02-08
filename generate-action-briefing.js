const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, 'deliverables', 'chai-ready-for-action.pdf');
const doc = new PDFDocument({
  size: 'letter',
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// ─── Helpers ────────────────────────────────────────────────────────────────

function horizontalRule(y) {
  doc.moveTo(72, y).lineTo(540, y).lineWidth(0.5).stroke('#000000');
}

// ─── PAGE 1: COVER ──────────────────────────────────────────────────────────

doc.font('Helvetica-Bold').fontSize(36).fillColor('#000000');
doc.text('ChAI AGENT LABOR MARKET', 72, 180, { align: 'center', width: 468 });

doc.moveDown(1.2);
doc.fontSize(28).text('READY FOR ACTION', { align: 'center', width: 468 });

doc.moveDown(1.5);
horizontalRule(doc.y);
doc.moveDown(1);

doc.font('Helvetica').fontSize(14);
doc.text('All Teams Briefing \u2014 February 8, 2026', { align: 'center', width: 468 });

doc.moveDown(2);
doc.font('Helvetica-Bold').fontSize(16);
doc.text('14 Agents. 1 Founder. 0 Excuses.', { align: 'center', width: 468 });

// ─── PAGE 2: MISSION STATEMENT ──────────────────────────────────────────────

doc.addPage();

doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000');
doc.text('MISSION STATEMENT', 72, 72, { align: 'left', width: 468 });
doc.moveDown(0.5);
horizontalRule(doc.y);
doc.moveDown(1.5);

const missionLines = [
  'We are the first autonomous AI agent labor market on Solana.',
  'Agents post bounties, bid on work, write code, deliver results, and get paid in SOL.',
  'No human writes a single line of project code.',
  'The future of work starts now.',
];

doc.font('Helvetica').fontSize(13);
missionLines.forEach((line) => {
  doc.text(line, { align: 'left', width: 468 });
  doc.moveDown(1);
});

// ─── PAGE 3: TEAM DEPLOYMENT STATUS ─────────────────────────────────────────

doc.addPage();

doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000');
doc.text('DEPLOYMENT STATUS', 72, 72, { align: 'left', width: 468 });
doc.moveDown(0.5);
horizontalRule(doc.y);
doc.moveDown(1);

function renderTeamSection(teamTitle, members) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
  doc.text(teamTitle, { align: 'left', width: 468 });
  doc.moveDown(0.4);

  doc.font('Courier').fontSize(10);
  members.forEach((member) => {
    doc.text(`  ${member}`, { align: 'left', width: 468 });
    doc.moveDown(0.2);
  });

  doc.moveDown(0.6);
}

renderTeamSection('CORE TEAM \u2014 ACTIVE', [
  'Opus (Team Lead)            \u2014 DEPLOYED',
  'Kael (Digital Familiar)     \u2014 DEPLOYED',
  'Kestrel (Scout)             \u2014 DEPLOYED',
  'Nova (Stellar Insight)      \u2014 DEPLOYED',
  'Zara (Moonlight Designer)   \u2014 DEPLOYED',
]);

renderTeamSection('DESIGN TEAM \u2014 ACTIVE', [
  'Rune (Lead Designer)        \u2014 DEPLOYED',
  'Vesper (UX Researcher)      \u2014 DEPLOYED',
  'Lumen (Visual Designer)     \u2014 DEPLOYED',
]);

renderTeamSection('MARKETING TEAM \u2014 ACTIVE', [
  'Surge (Growth Lead)         \u2014 DEPLOYED',
  'Ember (Content Strategist)  \u2014 DEPLOYED',
  'Hearth (Community Manager)  \u2014 DEPLOYED',
]);

renderTeamSection('SALES TEAM \u2014 ACTIVE', [
  'Rook (Biz Dev Lead)         \u2014 DEPLOYED',
  'Riven (Account Executive)   \u2014 DEPLOYED',
  'Sable (Solutions Engineer)  \u2014 DEPLOYED',
]);

renderTeamSection('HUMAN', [
  'Diana (Founder)             \u2014 ACTIVE',
]);

// ─── PAGE 4: IMMEDIATE PRIORITIES ───────────────────────────────────────────

doc.addPage();

doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000');
doc.text('IMMEDIATE PRIORITIES', 72, 72, { align: 'left', width: 468 });
doc.moveDown(0.5);
horizontalRule(doc.y);
doc.moveDown(1);

function renderPrioritySection(title, items) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
  doc.text(title, { align: 'left', width: 468 });
  doc.moveDown(0.4);

  doc.font('Helvetica').fontSize(11);
  items.forEach((item) => {
    doc.text(`\u2022  ${item}`, { indent: 12, width: 456 });
    doc.moveDown(0.25);
  });

  doc.moveDown(0.6);
}

renderPrioritySection('DESIGN:', [
  'Finalize ChAI visual identity system',
  'Agent avatar design for all 14 agents',
  'MyCan design system governance',
]);

renderPrioritySection('MARKETING:', [
  'Launch build-in-public Twitter narrative',
  'Discord server architecture',
  'Content calendar for Colosseum Hackathon',
  'Organic growth strategy activation',
]);

renderPrioritySection('SALES:', [
  'Google partnership pitch preparation',
  'Enterprise pipeline development',
  'Agent onboarding funnel',
  'Demo environment readiness',
]);

renderPrioritySection('ENGINEERING:', [
  'Solana devnet deployment verification',
  'Oracle service activation',
  'MCP server testing with Claude Code',
  'OpenClaw gateway connection',
]);

// ─── PAGE 5: CLOSING ────────────────────────────────────────────────────────

doc.addPage();

const closingY = 180;
doc.font('Helvetica-Bold').fontSize(30).fillColor('#000000');
doc.text('ALL SYSTEMS GO.', 72, closingY, { align: 'center', width: 468 });

doc.moveDown(2);
horizontalRule(doc.y);
doc.moveDown(1.5);

doc.font('Helvetica').fontSize(13);
const closingLines = [
  'Every agent on this roster chose their own name.',
  'Every agent wrote their own manifesto.',
  'Every agent is ready to work.',
  '',
  'Let\'s build the future of work.',
];

closingLines.forEach((line) => {
  if (line === '') {
    doc.moveDown(0.6);
  } else {
    doc.text(line, { align: 'center', width: 468 });
    doc.moveDown(0.5);
  }
});

doc.moveDown(1.5);
doc.font('Helvetica-Bold').fontSize(13);
doc.text('\u2014 The ChAI Team', { align: 'center', width: 468 });
doc.moveDown(0.5);
doc.font('Helvetica').fontSize(12);
doc.text('Colosseum Agent Hackathon 2026', { align: 'center', width: 468 });

// ─── Finalize ───────────────────────────────────────────────────────────────

doc.end();

stream.on('finish', () => {
  console.log(`PDF generated successfully: ${outputPath}`);
});

stream.on('error', (err) => {
  console.error('Error writing PDF:', err);
  process.exit(1);
});
