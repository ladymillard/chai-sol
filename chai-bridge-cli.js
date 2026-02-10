#!/usr/bin/env node
// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// All access is logged. All activity is monitored. https://mycan.website

/**
 * ChAI Bridge CLI — Lock, release, and transfer SOL
 *
 * Usage:
 *   node chai-bridge-cli.js lock <amount_sol> <eth_address>
 *   node chai-bridge-cli.js release <amount_sol> <sol_recipient> <eth_tx_hash>
 *   node chai-bridge-cli.js status
 *   node chai-bridge-cli.js fund <wallet_address> <amount_sol>  (devnet only)
 *
 * Requires: ANCHOR_WALLET env var pointing to keypair JSON
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Config
const CLUSTER = process.env.SOLANA_CLUSTER || 'https://api.devnet.solana.com';
const BRIDGE_PROGRAM_ID = new PublicKey('4K18A3Vuy8DxaJjUyQ1aBskZB7vz7joyRGg33aMraZnb');

function loadWallet() {
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME, '.config/solana/id.json');
  if (!fs.existsSync(walletPath)) {
    console.error('No wallet found. Set ANCHOR_WALLET or run: solana-keygen new');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function getBalance(connection, pubkey) {
  const balance = await connection.getBalance(pubkey);
  return balance / LAMPORTS_PER_SOL;
}

async function airdrop(connection, pubkey, solAmount) {
  console.log(`Requesting ${solAmount} SOL airdrop to ${pubkey.toBase58()}...`);
  const sig = await connection.requestAirdrop(pubkey, solAmount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig);
  const balance = await getBalance(connection, pubkey);
  console.log(`Airdrop confirmed. Balance: ${balance} SOL`);
  return balance;
}

async function status(connection, wallet) {
  const balance = await getBalance(connection, wallet.publicKey);
  console.log('');
  console.log('  ChAI Bridge Status');
  console.log('  ──────────────────');
  console.log(`  Cluster:  ${CLUSTER}`);
  console.log(`  Wallet:   ${wallet.publicKey.toBase58()}`);
  console.log(`  Balance:  ${balance} SOL`);
  console.log(`  Program:  ${BRIDGE_PROGRAM_ID.toBase58()}`);
  console.log('');
}

async function fundWallet(connection, fromWallet, toAddress, solAmount) {
  if (CLUSTER.includes('devnet')) {
    // On devnet, use airdrop
    const toPubkey = new PublicKey(toAddress);
    await airdrop(connection, toPubkey, solAmount);
  } else {
    // On mainnet, transfer from wallet
    const toPubkey = new PublicKey(toAddress);
    const { Transaction } = require('@solana/web3.js');
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromWallet.publicKey,
        toPubkey: toPubkey,
        lamports: solAmount * LAMPORTS_PER_SOL,
      })
    );
    const sig = await connection.sendTransaction(tx, [fromWallet]);
    await connection.confirmTransaction(sig);
    console.log(`Sent ${solAmount} SOL to ${toAddress}`);
    console.log(`TX: ${sig}`);
  }
}

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.log('Usage:');
    console.log('  node chai-bridge-cli.js status');
    console.log('  node chai-bridge-cli.js fund <wallet_address> <amount_sol>');
    console.log('  node chai-bridge-cli.js lock <amount_sol> <eth_address>');
    console.log('  node chai-bridge-cli.js release <amount_sol> <sol_recipient> <eth_tx_hash>');
    process.exit(0);
  }

  const connection = new Connection(CLUSTER, 'confirmed');
  const wallet = loadWallet();

  switch (command) {
    case 'status':
      await status(connection, wallet);
      break;

    case 'fund':
      if (args.length < 2) {
        console.error('Usage: fund <wallet_address> <amount_sol>');
        process.exit(1);
      }
      await fundWallet(connection, wallet, args[0], parseFloat(args[1]));
      break;

    case 'lock':
      if (args.length < 2) {
        console.error('Usage: lock <amount_sol> <eth_address>');
        process.exit(1);
      }
      console.log(`Lock ${args[0]} SOL → ETH address: ${args[1]}`);
      console.log('(Requires deployed bridge program — run anchor deploy first)');
      break;

    case 'release':
      if (args.length < 3) {
        console.error('Usage: release <amount_sol> <sol_recipient> <eth_tx_hash>');
        process.exit(1);
      }
      console.log(`Release ${args[0]} SOL → ${args[1]} (ETH tx: ${args[2]})`);
      console.log('(Requires deployed bridge program — run anchor deploy first)');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
