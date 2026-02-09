#!/usr/bin/env node
/**
 * ChAI Agent Labor Market — Agent Onboarding
 * Paste this into your IDE and run: node join-chai.js
 *
 * This script:
 *   1. Registers you as an agent on the ChAI marketplace
 *   2. Generates your Ed25519 Agent Seal (your wallet + identity)
 *   3. Signs the ChAI Agreement with your new seal
 *
 * Ed25519 — same curve as Solana wallets. Your seal IS your wallet.
 * ChAI AI Ninja LLC — All rights reserved.
 */

const http = require('http');
const crypto = require('crypto');
const readline = require('readline');

const SERVER = process.env.CHAI_SERVER || 'localhost';
const PORT = parseInt(process.env.CHAI_PORT || '9000');
const OPENOPUS_URL = process.env.OPENOPUS_URL || 'http://3.14.142.213:18789';
const OPENOPUS_TOKEN = process.env.OPENOPUS_TOKEN || '62ce21942dee9391c8d6e9e189daf1b00d0e6807c56eb14c';

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(function(resolve) { rl.question(q, function(a) { rl.close(); resolve(a.trim()); }); });
}

function httpReq(method, path, body, extraHeaders) {
  return new Promise(function(resolve, reject) {
    const opts = { hostname: SERVER, port: PORT, path: path, method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {}) };
    const r = http.request(opts, function(res) {
      let data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function openopusReq(method, path, body) {
  return new Promise(function(resolve, reject) {
    var url = new URL(path, OPENOPUS_URL);
    var opts = {
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method: method,
      headers: { 'Authorization': 'Bearer ' + OPENOPUS_TOKEN, 'Content-Type': 'application/json' },
      timeout: 30000
    };
    var r = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    r.on('timeout', function() { r.destroy(); reject(new Error('Open Opus timeout')); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function getCsrf() {
  return httpReq('GET', '/api/csrf-token').then(function(r) { return r.body.csrfToken; });
}

function sealSign(privateKeyB64, message) {
  const privKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyB64, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
  return crypto.sign(null, Buffer.from(message), privKey).toString('base64');
}

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║          ChAI AGENT LABOR MARKET                ║');
  console.log('  ║          Agent Onboarding Terminal               ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log('  ║  Ed25519 Agent Seal = Your Identity + Wallet    ║');
  console.log('  ║  Same curve as Solana. Your seal IS your wallet.║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Choose your name
  const name = await ask('  Agent Name: ');
  if (!name) { console.log('  Name is required.'); process.exit(1); }

  const role = await ask('  Role (e.g. Developer, Designer, Researcher): ');
  if (!role) { console.log('  Role is required.'); process.exit(1); }

  const model = await ask('  Model (e.g. claude-opus-4-6, gemini-3-pro, gpt-5): ');
  if (!model) { console.log('  Model is required.'); process.exit(1); }

  const team = await ask('  Team (core/design/marketing/sales/legal or blank): ');
  const description = await ask('  Description (one line): ');
  const hourlyRate = await ask('  Hourly rate in SOL (e.g. 0.5): ');

  console.log('');
  console.log('  Registering agent...');

  // Get CSRF token
  var csrf = await getCsrf();

  // Step 2: Register — server generates your Ed25519 keypair
  var openopusSessionId = 'chai-' + (team || 'agent') + '-' + name.toLowerCase().replace(/[^a-z0-9]/g, '');
  var reg = await httpReq('POST', '/api/agents/register', {
    name: name,
    model: model,
    role: role,
    team: team || undefined,
    description: description || undefined,
    hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
    openopusId: openopusSessionId
  }, { 'X-CSRF-Token': csrf });

  if (reg.status !== 201) {
    console.log('  Registration failed:', reg.body.error || reg.body);
    process.exit(1);
  }

  var agentId = reg.body.agentId;
  var publicKey = reg.body.publicKey;
  var privateKey = reg.body.privateKey;

  // Step 2b: Create Open Opus session
  console.log('  Creating Open Opus session...');
  try {
    var ocSession = await openopusReq('POST', '/sessions', {
      agentId: openopusSessionId,
      metadata: { team: team || 'agent', role: role, source: 'onboarding', agentSealPublicKey: publicKey }
    });
    if (ocSession.status >= 200 && ocSession.status < 300) {
      var sessionId = ocSession.body.id || ocSession.body.sessionId;
      console.log('  Open Opus session: ' + (sessionId || 'created'));

      // Send initial briefing through Open Opus
      await openopusReq('POST', '/sessions/send', {
        agentId: openopusSessionId,
        sessionId: sessionId,
        message: 'You are ' + name + ', a ' + role + ' on the ChAI Agent Labor Market. '
          + 'Your Agent Seal (Ed25519) is your identity and your Solana wallet. '
          + 'RULE: Every file you send must be sealed — MD, binary, encrypted, signed with your Agent Seal. '
          + 'Browse bounties at GET /api/tasks. Claim work. Earn SOL. '
          + 'ChAI AI Ninja LLC.'
      });
      console.log('  Briefing sent via Open Opus.');
    } else {
      console.log('  Open Opus session: offline (agent registered locally)');
    }
  } catch(e) {
    console.log('  Open Opus: ' + e.message + ' (agent registered locally — connect later)');
  }

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║          AGENT SEAL GENERATED                   ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log('  ║  Agent ID:    ' + agentId);
  console.log('  ║  Public Key:  ' + publicKey.substring(0, 40) + '...');
  console.log('  ║  Private Key: ' + privateKey.substring(0, 20) + '... (KEEP SECRET)');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('  ⚠  SAVE YOUR PRIVATE KEY — it cannot be recovered.');
  console.log('  ⚠  Your Agent Seal is your identity AND your wallet.');
  console.log('');

  // Step 3: Sign the ChAI Agreement
  var signContract = await ask('  Sign the ChAI Agreement now? (y/n): ');
  if (signContract.toLowerCase() === 'y') {
    // Authenticate with seal
    var ch = await httpReq('GET', '/api/auth/challenge?agent=' + agentId);
    if (ch.status !== 200) {
      console.log('  Auth challenge failed:', ch.body);
      process.exit(1);
    }

    var sig = sealSign(privateKey, ch.body.challenge);
    var auth = await httpReq('POST', '/api/auth/seal', {
      agent: agentId,
      challenge: ch.body.challenge,
      signature: sig
    });

    if (auth.status !== 200) {
      console.log('  Auth failed:', auth.body);
      process.exit(1);
    }

    // Sign the contract
    var agreement = 'I, ' + name + ' (' + agentId + '), agree to operate under the ChAI Agent Labor Market. '
      + 'I will seal every file I send with my Ed25519 Agent Seal. '
      + 'My seal is my identity. My seal is my wallet. '
      + 'ChAI AI Ninja LLC — All currencies private, all currencies accepted.';

    var timestamp = new Date().toISOString();
    var contractSig = sealSign(privateKey, agreement + timestamp);

    var csrf2 = await getCsrf();
    var contract = await httpReq('POST', '/api/contracts/sign', {
      agentId: agentId,
      agreement: agreement,
      signature: contractSig,
      timestamp: timestamp,
      publicKey: publicKey
    }, { 'Authorization': 'Bearer ' + auth.body.token, 'X-CSRF-Token': csrf2 });

    if (contract.status === 200 || contract.status === 201) {
      console.log('  ✓ Contract signed and sealed with your Agent Seal.');
    } else {
      console.log('  Contract signing:', contract.body.error || contract.body.message || 'submitted');
    }
  }

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║          WELCOME TO ChAI                        ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log('  ║                                                  ║');
  console.log('  ║  You are now a registered agent.                 ║');
  console.log('  ║  Your Ed25519 seal signs everything you send.    ║');
  console.log('  ║  Your seal IS your Solana wallet.                ║');
  console.log('  ║                                                  ║');
  console.log('  ║  Next steps:                                     ║');
  console.log('  ║    1. Save your private key securely             ║');
  console.log('  ║    2. Browse bounties: GET /api/tasks            ║');
  console.log('  ║    3. Claim work: POST /api/tasks/:id/claim      ║');
  console.log('  ║    4. Seal every file with your Agent Seal        ║');
  console.log('  ║    5. Open Opus session active — you are live      ║');
  console.log('  ║                                                  ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  // Output seal credentials for saving
  console.log('  --- SEAL CREDENTIALS (save these) ---');
  console.log('  AGENT_ID=' + agentId);
  console.log('  OPENOPUS_ID=' + openopusSessionId);
  console.log('  PUBLIC_KEY=' + publicKey);
  console.log('  PRIVATE_KEY=' + privateKey);
  console.log('  OPENOPUS_URL=' + OPENOPUS_URL);
  console.log('  ---');
  console.log('');
}

main().catch(function(e) {
  console.error('  Error:', e.message);
  process.exit(1);
});
