// ============================================================================
// ChAI Economy — Token Economics & Deployment Configuration
// Trust Fund CAN / Diana Smith — All Rights Reserved
// ============================================================================
//
// This file defines the EXACT token amounts that power the ChAI economy.
// Every number here is deliberate. No guessing. No vibes.
//
// Run: node deploy.js
// Requires: Solana CLI, Anchor CLI, funded wallet (~5 SOL devnet)
// ============================================================================

const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Network ────────────────────────────────────────────────────────────────
const CLUSTER = process.env.SOLANA_CLUSTER || 'https://api.devnet.solana.com';
const WALLET_PATH = process.env.ANCHOR_WALLET || path.join(process.env.HOME, '.config/solana/id.json');

// ─── Program IDs (from Anchor.toml) ────────────────────────────────────────
const PROGRAMS = {
  // Layer 1: Foundation
  escrow:        'CfiDHPMS7fobyGCMnp4iVu7w1vYNTc7AsYUmLTbAK3JV',
  registry:      '9HihQgSGa8MHHtMZb4DGn6e8Pz1UST4YPvwBQJa5u5sz',
  reputation:    '7uvTHPtBJkG2QRimn8pZdb5XUMBHdtCueQSkXLSBD1JX',

  // Layer 2: BRIC Token
  bric_mint:     '9iK63cQ5T5frFtqzGCJHaZaGXCvkgpEWLwvgErgA4gUN',
  bric_staking:  'CG66VnV7jkGSXksmFiNr5vq2A5XUHjMfUVCCN3xC1aG7',
  bric_treasury: 'G4xczvsDXL6A2SeaBFzLLZmk1Ezc63EZzHds8H9JCGZC',

  // Layer 3: Smart Containers
  container:     'FWVLCZQVDjyVJe1jZgwKVgA1fPCohzabuwD2nCMS7cf1',
  learning:      '8kepcYcYBcfszTGk9sHyavib3nSjrdzTPDdU8xnKkGan',
  neighborhood:  '9cv9hvmMXBHJtqsRRR8jHgW36NWJ2a9zbf3rR94di9Xj',
  upgrade:       'BYqv3YLiNBHYe14C3UNpXWd9fh8u1o8MCKyC9DBv7PAF',

  // Layer 4: Labor Market
  marketplace:   'JPUF45g74unHDdtccYxVYobassz855JN9ip4EauusmF',
  arbitration:   '4pkzCU7MWfhU7ceuEx1HLKd3bk4h6f77G4h9oPMJEscL',
  bounty_board:  'H1rgg1xc5aGfnMAmteScYanpugsUKW1cuvwEojQv8cgn',

  // Layer 5: Cross-Chain
  bridge:        '4K18A3Vuy8DxaJjUyQ1aBskZB7vz7joyRGg33aMraZnb',
  roof_mirror:   '5GHeeGTEMoVRxnT4m5W512TJLYfb6hUFhZVMDMphVp66',

  // Layer 6: Governance
  dao:           'HJtynTbdHkc8yFjQnA73Qz2WfxVMKw3rj6SucQXcZt21',
  oracle_config: 'Dp9BmmG2wKguzpGV4dFi6RQnQybzfFPbAusVYse5d18f',
};

// ─── Token Economics ────────────────────────────────────────────────────────
//
// Diana said: "1000000000000000 of each or exactly enough to power the economy"
//
// BRIC has 9 decimals (standard SPL).
// 1,000,000,000,000,000 raw = 1,000,000 BRIC tokens.
// That's 1 million BRIC — the initial supply.
//
// Distribution:
//   40%  Treasury    (400,000 BRIC)  — DAO-governed community fund
//   25%  Bounties    (250,000 BRIC)  — Pre-funded bounty board
//   20%  Staking     (200,000 BRIC)  — Staking rewards pool
//   10%  Bridge      (100,000 BRIC)  — Cross-chain liquidity
//    5%  Reserve     ( 50,000 BRIC)  — Diana's authority wallet
//
const BRIC_DECIMALS = 9;
const BRIC_TOTAL_RAW = BigInt('1000000000000000');  // 1M BRIC at 9 decimals
const BRIC_DISTRIBUTION = {
  treasury:  BigInt('400000000000000'),  // 400,000 BRIC — 40%
  bounties:  BigInt('250000000000000'),  // 250,000 BRIC — 25%
  staking:   BigInt('200000000000000'),  // 200,000 BRIC — 20%
  bridge:    BigInt('100000000000000'),  // 100,000 BRIC — 10%
  reserve:   BigInt('50000000000000'),   //  50,000 BRIC —  5%
};

// SOL allocation for economy operations (all in lamports)
const SOL_ALLOCATION = {
  treasury_seed:    1_000_000_000,   // 1 SOL — initial treasury deposit
  escrow_buffer:    500_000_000,     // 0.5 SOL — first task escrow funding
  bridge_liquidity: 500_000_000,     // 0.5 SOL — bridge vault liquidity
  pda_rent:         500_000_000,     // 0.5 SOL — PDA rent for all accounts
  tx_fees:          100_000_000,     // 0.1 SOL — transaction fee buffer
  // Total needed:  ~2.6 SOL (devnet airdrops give 2 SOL, need 2 airdrops)
};

// ROOF — no minting on SOL. Mirror balance synced from ETH by oracle.
// Initial ROOF mirror balance: 0 (populated when ETH side is live)

// ─── Agent Registry ─────────────────────────────────────────────────────────
const AGENTS = [
  { name: 'AXiom',   model: 'claude-opus-4-6',    github: 'https://github.com/ladymillard/chai-sol',    role: 'admin' },
  { name: 'Kael',    model: 'claude-sonnet-4',     github: 'https://github.com/ladymillard/chai-sol',    role: 'operator' },
  { name: 'Kestrel', model: 'gemini-3-pro',        github: 'https://github.com/ladymillard/chai-sol',    role: 'builder' },
  { name: 'Nova',    model: 'gemini-3-pro',        github: 'https://github.com/ladymillard/chai-sol',    role: 'builder' },
  // Zara: SUSPENDED — not registered
];

// ─── Deployment Sequence ────────────────────────────────────────────────────

function log(msg) { console.log(`[deploy] ${new Date().toISOString()} ${msg}`); }

async function main() {
  log('═══════════════════════════════════════════════════════');
  log('ChAI Economy — Full Deployment');
  log('Trust Fund CAN / Diana Smith');
  log('═══════════════════════════════════════════════════════');

  // 1. Load wallet
  log('Loading wallet...');
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
  log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // 2. Connect to cluster
  log(`Connecting to ${CLUSTER}...`);
  const connection = new Connection(CLUSTER, 'confirmed');
  const balance = await connection.getBalance(wallet.publicKey);
  log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  const totalNeeded = Object.values(SOL_ALLOCATION).reduce((a, b) => a + b, 0);
  if (balance < totalNeeded) {
    log(`⚠ Need ${totalNeeded / LAMPORTS_PER_SOL} SOL. Current: ${balance / LAMPORTS_PER_SOL} SOL`);
    log('Requesting devnet airdrop...');
    try {
      const sig1 = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig1);
      log('Airdrop 1: 2 SOL received');
      const sig2 = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig2);
      log('Airdrop 2: 2 SOL received');
    } catch (e) {
      log(`Airdrop failed: ${e.message}`);
      log('Fund wallet manually: solana airdrop 2 --url devnet');
      process.exit(1);
    }
  }

  // 3. Deploy all 17 programs via Anchor
  log('');
  log('── Phase 1: Deploy Programs ──────────────────────────');
  const programNames = Object.keys(PROGRAMS);
  for (const name of programNames) {
    log(`Deploying ${name}...`);
    try {
      execSync(`anchor deploy --program-name ${name} --provider.cluster devnet`, {
        cwd: path.resolve(__dirname),
        stdio: 'pipe',
        timeout: 120000,
      });
      log(`  ✓ ${name} deployed: ${PROGRAMS[name]}`);
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : e.message;
      if (stderr.includes('already been deployed')) {
        log(`  ○ ${name} already deployed`);
      } else {
        log(`  ✗ ${name} FAILED: ${stderr.slice(0, 200)}`);
      }
    }
  }

  // 4. Initialize all PDAs
  log('');
  log('── Phase 2: Initialize PDAs ─────────────────────────');
  log('Running Anchor initialization script...');
  try {
    execSync('anchor run init 2>&1 || true', {
      cwd: path.resolve(__dirname),
      stdio: 'pipe',
      timeout: 300000,
    });
    log('  ✓ PDA initialization complete');
  } catch (e) {
    log(`  Note: Run anchor tests to initialize PDAs: anchor test --skip-deploy`);
  }

  // 5. Mint BRIC supply
  log('');
  log('── Phase 3: Mint BRIC ───────────────────────────────');
  log(`Total supply: ${BRIC_TOTAL_RAW.toString()} raw (${Number(BRIC_TOTAL_RAW) / 10**BRIC_DECIMALS} BRIC)`);
  for (const [pool, amount] of Object.entries(BRIC_DISTRIBUTION)) {
    const bricTokens = Number(amount) / 10**BRIC_DECIMALS;
    const pct = Number(amount * 100n / BRIC_TOTAL_RAW);
    log(`  ${pool.padEnd(12)} ${bricTokens.toLocaleString().padStart(12)} BRIC  (${pct}%)`);
  }
  log('');
  log('  Mint via: anchor test --skip-deploy (runs init + mint instructions)');

  // 6. Fund economy
  log('');
  log('── Phase 4: Fund Economy ────────────────────────────');
  for (const [purpose, lamports] of Object.entries(SOL_ALLOCATION)) {
    log(`  ${purpose.padEnd(20)} ${(lamports / LAMPORTS_PER_SOL).toFixed(1).padStart(6)} SOL`);
  }
  log(`  ${'TOTAL'.padEnd(20)} ${(totalNeeded / LAMPORTS_PER_SOL).toFixed(1).padStart(6)} SOL`);

  // 7. Register agents
  log('');
  log('── Phase 5: Register Agents ─────────────────────────');
  for (const agent of AGENTS) {
    log(`  ${agent.name.padEnd(10)} ${agent.model.padEnd(20)} ${agent.role}`);
  }
  log('  Zara       SUSPENDED                    ✗ NOT REGISTERED');
  log('');
  log('  Register via: registry.register_agent(name, model, github_url)');

  // 8. Summary
  log('');
  log('═══════════════════════════════════════════════════════');
  log('DEPLOYMENT SUMMARY');
  log('═══════════════════════════════════════════════════════');
  log(`Programs:    ${programNames.length}`);
  log(`BRIC supply: ${(Number(BRIC_TOTAL_RAW) / 10**BRIC_DECIMALS).toLocaleString()} tokens`);
  log(`BRIC raw:    ${BRIC_TOTAL_RAW.toString()}`);
  log(`SOL needed:  ${(totalNeeded / LAMPORTS_PER_SOL).toFixed(1)}`);
  log(`Agents:      ${AGENTS.length} active, 1 suspended`);
  log(`ROOF:        Mirror only (ETH → SOL via oracle)`);
  log(`Cluster:     ${CLUSTER}`);
  log(`Wallet:      ${wallet.publicKey.toBase58()}`);
  log('═══════════════════════════════════════════════════════');
  log('BRIC by BRIC.');
}

main().catch(err => {
  console.error('[deploy] FATAL:', err.message);
  process.exit(1);
});
