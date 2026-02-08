#!/usr/bin/env node
/**
 * Bounty Decryptor — Reads encrypted bounty binary
 *
 * Usage:
 *   node bounty-decrypt.js [bounty.enc] [keyfile] [role]
 *
 * Defaults:
 *   bounty.enc  → ./bounty.enc
 *   keyfile     → ./.bounty-key
 *   role        → author
 *
 * Validates RLS role before decryption (checks bounty.rls.json).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────
const ENCRYPTION_ALGO = 'aes-256-cbc';
const KEY_ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const MAGIC = 'BNTY';

// ─── Parse Arguments ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const binaryPath = args[0] || path.join(__dirname, 'bounty.enc');
const keyPath = args[1] || path.join(__dirname, '.bounty-key');
const roleName = args[2] || 'author';

// ─── RLS Check ──────────────────────────────────────────────────────────────
function checkRLS(role) {
  const rlsPath = path.join(path.dirname(binaryPath), 'bounty.rls.json');
  if (!fs.existsSync(rlsPath)) {
    console.log('[rls] No RLS policy found — proceeding without access check');
    return true;
  }

  const policy = JSON.parse(fs.readFileSync(rlsPath, 'utf8'));
  const roleConfig = policy.roles[role];

  if (!roleConfig) {
    console.error(`[rls] DENIED — Role "${role}" not found in RLS policy`);
    console.error(`[rls] Valid roles: ${Object.keys(policy.roles).join(', ')}`);
    return false;
  }

  if (!roleConfig.permissions.includes('decrypt')) {
    console.error(`[rls] DENIED — Role "${role}" does not have decrypt permission`);
    console.error(`[rls] ${role} permissions: ${roleConfig.permissions.join(', ')}`);
    return false;
  }

  console.log(`[rls] GRANTED — Role: ${role}, Access: ${roleConfig.access_level}`);
  if (roleConfig.restriction) {
    console.log(`[rls] RESTRICTION: ${roleConfig.restriction}`);
  }

  // Audit log
  if (policy.audit && policy.audit.log_decryption) {
    console.log(`[audit] Decryption by ${roleConfig.identity} at ${new Date().toISOString()}`);
  }

  return true;
}

// ─── Decryption ─────────────────────────────────────────────────────────────
function decrypt(encryptedBuffer, passphrase) {
  // Validate magic bytes
  const magic = encryptedBuffer.subarray(0, 4).toString('ascii');
  if (magic !== MAGIC) {
    throw new Error(`Invalid file format. Expected magic "${MAGIC}", got "${magic}"`);
  }

  // Extract components
  const salt = encryptedBuffer.subarray(4, 4 + SALT_LENGTH);
  const iv = encryptedBuffer.subarray(4 + SALT_LENGTH, 4 + SALT_LENGTH + IV_LENGTH);
  const encrypted = encryptedBuffer.subarray(4 + SALT_LENGTH + IV_LENGTH);

  // Derive key
  const key = crypto.pbkdf2Sync(passphrase, salt, KEY_ITERATIONS, KEY_LENGTH, 'sha512');

  // Decrypt
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}

// ─── Main ───────────────────────────────────────────────────────────────────
function main() {
  console.log('='.repeat(50));
  console.log('  Bounty Decryptor');
  console.log('='.repeat(50));

  // Check files exist
  if (!fs.existsSync(binaryPath)) {
    console.error(`[error] Binary not found: ${binaryPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(keyPath)) {
    console.error(`[error] Key file not found: ${keyPath}`);
    console.error('[hint]  The key file (.bounty-key) is required for decryption');
    process.exit(1);
  }

  // RLS access check
  if (!checkRLS(roleName)) {
    process.exit(2);
  }

  // Read inputs
  const encryptedBuffer = fs.readFileSync(binaryPath);
  const passphrase = fs.readFileSync(keyPath, 'utf8').trim();

  console.log(`[file] ${binaryPath} (${encryptedBuffer.length} bytes)`);
  console.log(`[algo] ${ENCRYPTION_ALGO}`);
  console.log(`[role] ${roleName}`);

  // Decrypt
  const payload = decrypt(encryptedBuffer, passphrase);

  console.log('='.repeat(50));
  console.log(JSON.stringify(payload, null, 2));
  console.log('='.repeat(50));
  console.log(`[ok] Decrypted successfully — ${payload.bounty.chapters} chapters`);
}

main();
