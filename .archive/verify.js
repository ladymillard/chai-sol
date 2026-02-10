#!/usr/bin/env node
// Verify ChAI archive integrity — run this to check for tampering
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'MANIFEST.json'), 'utf8'));
let ok = 0, fail = 0;

console.log('ChAI Archive Integrity Check');
console.log('============================');

// Check bundle
const bundlePath = path.join(__dirname, manifest.archives.bundle.file);
if (fs.existsSync(bundlePath)) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(bundlePath)).digest('hex');
  if (hash === manifest.archives.bundle.sha256) { console.log('[OK] Bundle intact'); ok++; }
  else { console.log('[FAIL] Bundle TAMPERED'); fail++; }
} else { console.log('[MISS] Bundle not found'); fail++; }

// Check tarball
const tarPath = path.join(__dirname, manifest.archives.tarball.file);
if (fs.existsSync(tarPath)) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(tarPath)).digest('hex');
  if (hash === manifest.archives.tarball.sha256) { console.log('[OK] Tarball intact'); ok++; }
  else { console.log('[FAIL] Tarball TAMPERED'); fail++; }
} else { console.log('[MISS] Tarball not found'); fail++; }

// Check source files
let fileOk = 0, fileFail = 0;
for (const [file, expectedHash] of Object.entries(manifest.files)) {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
    if (hash === expectedHash) fileOk++;
    else { console.log('[FAIL] ' + file + ' TAMPERED'); fileFail++; fail++; }
  } else { console.log('[MISS] ' + file + ' DELETED'); fileFail++; fail++; }
}
console.log('[FILES] ' + fileOk + ' OK, ' + fileFail + ' tampered/deleted');
ok += fileOk;

console.log('');
console.log('Result: ' + ok + ' OK, ' + fail + ' FAILED');
if (fail === 0) console.log('ARCHIVE INTEGRITY: VERIFIED');
else console.log('ARCHIVE INTEGRITY: COMPROMISED — ' + fail + ' issues detected');
