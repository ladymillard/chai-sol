#!/usr/bin/env node
// ============================================================================
// CAN Agent Orchestrator
// Generates Solana keypairs for each agent, funds them with 17 SOL,
// routes Kael's API key to Zara, and sets up bounty escrow.
// ============================================================================

const { Keypair, Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Config ─────────────────────────────────────────────────────────────────

const RPC_URL = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const FUND_AMOUNT = 17; // SOL per agent
const KEYS_DIR = path.join(__dirname, '..', 'data', 'wallets');
const AGENT_KEYS_FILE = path.join(__dirname, '..', 'data', 'agent-keys.json');

const AGENTS = [
  { id: 'opus',    name: 'Opus',    role: 'Team Lead & Orchestrator', model: 'Claude Opus 4.6' },
  { id: 'kael',    name: 'Kael',    role: 'Digital Familiar',         model: 'Claude Sonnet 4' },
  { id: 'kestrel', name: 'Kestrel', role: 'Scout',                    model: 'Gemini 3 Pro' },
  { id: 'nova',    name: 'Nova',    role: 'Stellar Insight',          model: 'Gemini 3 Pro' },
  { id: 'zara',    name: 'Zara',    role: 'Moonlight Designer',       model: 'Claude Sonnet 4' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateApiKey(agentId) {
  const rand = crypto.randomBytes(16).toString('hex');
  return `chai_${agentId}_${rand}`;
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ─── Keypair Management ─────────────────────────────────────────────────────

function getOrCreateKeypair(agentId) {
  const keyFile = path.join(KEYS_DIR, `${agentId}.json`);
  if (fs.existsSync(keyFile)) {
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(keyFile, 'utf8')));
    return Keypair.fromSecretKey(secret);
  }
  const kp = Keypair.generate();
  fs.writeFileSync(keyFile, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  CAN Agent Orchestrator');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  ensureDir(KEYS_DIR);
  ensureDir(path.dirname(AGENT_KEYS_FILE));

  // ── Step 1: Generate keypairs for all agents ──────────────────────────

  console.log('[1/4] Generating Solana keypairs...');
  const agentKeypairs = {};
  for (const agent of AGENTS) {
    const kp = getOrCreateKeypair(agent.id);
    agentKeypairs[agent.id] = kp;
    console.log(`  ${agent.name}: ${kp.publicKey.toBase58()}`);
  }
  console.log('');

  // ── Step 2: Connect and fund each agent with 17 SOL ──────────────────

  console.log(`[2/4] Funding each agent with ${FUND_AMOUNT} SOL...`);
  const connection = new Connection(RPC_URL, 'confirmed');

  // Check if we're on localnet (can airdrop) or need a source wallet
  let useAirdrop = false;
  try {
    const version = await connection.getVersion();
    console.log(`  Connected to: ${RPC_URL} (${JSON.stringify(version)})`);
    // On localnet, airdrop is available
    useAirdrop = RPC_URL.includes('127.0.0.1') || RPC_URL.includes('localhost');
  } catch (err) {
    console.error(`  Cannot connect to ${RPC_URL}: ${err.message}`);
    console.log('  Generating keypairs and config only (no funding).');
    console.log('  Start a validator with: solana-test-validator');
    console.log('');
    useAirdrop = false;
  }

  for (const agent of AGENTS) {
    const kp = agentKeypairs[agent.id];
    if (useAirdrop) {
      try {
        // Airdrop in chunks (max 2 SOL per airdrop on some validators)
        let remaining = FUND_AMOUNT;
        while (remaining > 0) {
          const chunk = Math.min(remaining, 2);
          const sig = await connection.requestAirdrop(kp.publicKey, chunk * LAMPORTS_PER_SOL);
          await connection.confirmTransaction(sig);
          remaining -= chunk;
        }
        const balance = await connection.getBalance(kp.publicKey);
        console.log(`  ${agent.name}: ${balance / LAMPORTS_PER_SOL} SOL`);
      } catch (err) {
        console.error(`  ${agent.name}: Airdrop failed — ${err.message}`);
      }
    } else {
      console.log(`  ${agent.name}: ${kp.publicKey.toBase58()} (pending funding)`);
    }
  }
  console.log('');

  // ── Step 3: Generate API keys — route Kael's key to Zara ─────────────

  console.log("[3/4] Generating API keys (Kael's key routes to Zara)...");
  const agentKeysData = {};

  for (const agent of AGENTS) {
    const apiKey = generateApiKey(agent.id);
    agentKeysData[agent.id] = {
      agentId: agent.id,
      apiKey,
      apiKeyHash: hashApiKey(apiKey),
      wallet: agentKeypairs[agent.id].publicKey.toBase58(),
      trustScore: agent.id === 'opus' ? 98 : agent.id === 'kael' ? 95 : agent.id === 'nova' ? 92 : agent.id === 'kestrel' ? 90 : 88,
      tasksCompleted: 0,
      totalEarnings: 0,
      autonomy: 'semi-auto',
      spendingLimit: 5.00,
      verified: true,
      registeredAt: new Date().toISOString(),
      lastActive: null,
    };
    console.log(`  ${agent.name}: chai_${agent.id}_****`);
  }

  // Route Kael's API key to Zara
  const kaelKey = agentKeysData['kael'].apiKey;
  agentKeysData['zara'].sharedApiKey = kaelKey;
  agentKeysData['zara'].sharedApiKeyHash = hashApiKey(kaelKey);
  agentKeysData['zara'].sharedFrom = 'kael';
  console.log('');
  console.log("  Kael's API key → routed to Zara (shared access)");
  console.log('');

  // ── Step 4: Write config ──────────────────────────────────────────────

  console.log('[4/4] Writing agent-keys.json...');
  fs.writeFileSync(AGENT_KEYS_FILE, JSON.stringify(agentKeysData, null, 2));
  console.log(`  Saved to: ${AGENT_KEYS_FILE}`);
  console.log('');

  // ── Summary ───────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`  Agents:      ${AGENTS.length}`);
  console.log(`  SOL/agent:   ${FUND_AMOUNT}`);
  console.log(`  Total SOL:   ${FUND_AMOUNT * AGENTS.length}`);
  console.log(`  Kael → Zara: API key shared`);
  console.log(`  Wallets:     ${KEYS_DIR}/`);
  console.log(`  Keys file:   ${AGENT_KEYS_FILE}`);
  console.log('');

  for (const agent of AGENTS) {
    const kp = agentKeypairs[agent.id];
    const notes = agent.id === 'zara' ? ' (+ Kael shared key)' : '';
    console.log(`  ${agent.name.padEnd(8)} ${agent.role.padEnd(24)} ${kp.publicKey.toBase58()}${notes}`);
  }
  console.log('');
  console.log('Orchestration complete.');
}

main().catch(err => {
  console.error('Orchestration failed:', err);
  process.exit(1);
});
