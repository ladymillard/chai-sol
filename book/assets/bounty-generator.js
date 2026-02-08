#!/usr/bin/env node
/**
 * Bounty Generator — Encrypted Binary for David Smith Book Project
 *
 * Creates an AES-256-CBC encrypted binary file containing the book bounty
 * metadata, deliverables manifest, and RLS (Row Level Security) access policy.
 *
 * Encryption key derived from passphrase using PBKDF2 (100k iterations).
 * Output: bounty.enc (binary) + bounty.rls.json (access policy)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────
const ENCRYPTION_ALGO = 'aes-256-cbc';
const KEY_ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const CHAPTER_COUNT = 17;

// ─── Bounty Payload ─────────────────────────────────────────────────────────
const bountyPayload = {
  bounty: {
    id: crypto.randomUUID(),
    title: 'Pay Me No Mind: 19 Years Inside Airgas — Book Manuscript',
    author: 'David Smith',
    representation: 'Pay Me No Mind Consulting',
    contact: { name: 'Alex', phone: '585-766-8169' },
    chapters: CHAPTER_COUNT,
    created: new Date().toISOString(),
    status: 'active',
    classification: 'confidential'
  },
  subject: {
    company: 'Airgas / Air Liquide',
    facility: 'Rochester, NY',
    tenure: '19 years',
    management: [
      { name: 'Bob Hewitt', role: 'Plant Manager' },
      { name: 'Bob Gross', role: 'Assistant Manager' }
    ],
    topic: 'Workplace dynamics and racial disparities in employee treatment'
  },
  deliverables: {
    letter: { file: 'legal/letter-to-airgas.md', status: 'complete' },
    outline: { file: 'manuscript/00-book-outline.md', chapters: CHAPTER_COUNT, status: 'complete' },
    chapter1_template: { file: 'manuscript/01-chapter-01-walking-in.md', status: 'complete' },
    legal_checklist: { file: 'legal/legal-review-checklist.md', status: 'complete' },
    bounty_binary: { file: 'assets/bounty.enc', status: 'complete' }
  },
  media: {
    podcast: 'Pay Me No Mind Consulting',
    platform: 'Spotify',
    relevant_episodes: [5, 15]
  },
  parts: [
    { part: 'I', title: 'The Beginning', chapters: [1, 2, 3] },
    { part: 'II', title: 'The Two Standards', chapters: [4, 5, 6, 7] },
    { part: 'III', title: '19 Years Deep', chapters: [8, 9, 10, 11] },
    { part: 'IV', title: 'Breaking Point', chapters: [12, 13, 14] },
    { part: 'V', title: 'Going Public', chapters: [15, 16, 17] }
  ]
};

// ─── RLS (Row Level Security) Access Policy ─────────────────────────────────
const rlsPolicy = {
  version: '1.0',
  policy_name: 'book_bounty_access',
  description: 'Row Level Security policy for David Smith book manuscript bounty',
  created: new Date().toISOString(),
  roles: {
    author: {
      identity: 'David Smith',
      permissions: ['read', 'write', 'decrypt', 'publish', 'revoke'],
      access_level: 'full'
    },
    representative: {
      identity: 'Pay Me No Mind Consulting (Alex)',
      permissions: ['read', 'decrypt', 'negotiate', 'distribute'],
      access_level: 'delegated'
    },
    legal_counsel: {
      identity: 'TBD — Retained Attorney',
      permissions: ['read', 'decrypt', 'review', 'advise'],
      access_level: 'privileged'
    },
    design_team: {
      identity: 'ChAI Agent Team (Zara, Opus, Kael, Nova, Kestrel)',
      permissions: ['read', 'layout', 'design'],
      access_level: 'restricted',
      restriction: 'No access to unredacted manuscript content; outline and structure only'
    },
    target_company: {
      identity: 'Airgas / Air Liquide Management',
      permissions: ['purchase_offer'],
      access_level: 'external',
      restriction: 'View purchase terms only; no manuscript access until rights transfer'
    }
  },
  encryption: {
    algorithm: ENCRYPTION_ALGO,
    key_derivation: 'PBKDF2',
    iterations: KEY_ITERATIONS,
    key_length_bits: KEY_LENGTH * 8,
    iv_length_bits: IV_LENGTH * 8,
    salt_length_bits: SALT_LENGTH * 8
  },
  audit: {
    log_access: true,
    log_decryption: true,
    require_justification: true
  }
};

// ─── Encryption ─────────────────────────────────────────────────────────────
function encrypt(data, passphrase) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(passphrase, salt, KEY_ITERATIONS, KEY_LENGTH, 'sha512');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);

  const jsonData = JSON.stringify(data, null, 2);
  const encrypted = Buffer.concat([cipher.update(jsonData, 'utf8'), cipher.final()]);

  // Binary format: [4-byte magic] [32-byte salt] [16-byte IV] [encrypted data]
  const magic = Buffer.from('BNTY');
  return Buffer.concat([magic, salt, iv, encrypted]);
}

// ─── Main ───────────────────────────────────────────────────────────────────
const passphrase = `chapter${CHAPTER_COUNT}-paymenomind-${crypto.randomBytes(8).toString('hex')}`;
const encryptedBinary = encrypt(bountyPayload, passphrase);

const outputDir = path.join(__dirname);
const binaryPath = path.join(outputDir, 'bounty.enc');
const rlsPath = path.join(outputDir, 'bounty.rls.json');
const keyPath = path.join(outputDir, '.bounty-key');

fs.writeFileSync(binaryPath, encryptedBinary);
fs.writeFileSync(rlsPath, JSON.stringify(rlsPolicy, null, 2));
fs.writeFileSync(keyPath, passphrase, 'utf8');
fs.chmodSync(keyPath, 0o600);

console.log('='.repeat(50));
console.log('  Bounty Binary Generated');
console.log('='.repeat(50));
console.log(`  Binary:     ${binaryPath} (${encryptedBinary.length} bytes)`);
console.log(`  RLS Policy: ${rlsPath}`);
console.log(`  Key file:   ${keyPath} (chmod 600)`);
console.log(`  Algorithm:  ${ENCRYPTION_ALGO}`);
console.log(`  Chapters:   ${CHAPTER_COUNT}`);
console.log(`  Magic:      BNTY`);
console.log('='.repeat(50));
