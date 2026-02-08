// ============================================================================
// ChAI — Input Sanitization & Script Injection Defense
// ============================================================================
// Shared module used by backend, oracle, and command center.
// Defends against XSS, HTML injection, prompt injection, and
// Discord-style script injection (ref: INCIDENT-REPORT.md — Zippy attack).
// ============================================================================

'use strict';

// ─── HTML Entity Encoding ────────────────────────────────────────────────────
// Converts characters that have special meaning in HTML to their entity form.
// This is the primary defense against stored and reflected XSS.

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'`/]/g, ch => HTML_ENTITIES[ch]);
}

// ─── Strip HTML Tags ─────────────────────────────────────────────────────────
// Removes all HTML/XML tags. Used for fields that should never contain markup.

function stripTags(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

// ─── Script Injection Patterns ───────────────────────────────────────────────
// Detects common XSS and injection payloads including Discord-style commands.
// Returns { safe: boolean, reason: string }

const INJECTION_PATTERNS = [
  // HTML/JS injection
  { pattern: /<script[\s>]/i, reason: 'script tag detected' },
  { pattern: /javascript\s*:/i, reason: 'javascript: URI detected' },
  { pattern: /on\w+\s*=/i, reason: 'inline event handler detected' },
  { pattern: /<iframe[\s>]/i, reason: 'iframe injection detected' },
  { pattern: /<object[\s>]/i, reason: 'object tag detected' },
  { pattern: /<embed[\s>]/i, reason: 'embed tag detected' },
  { pattern: /<svg[\s>].*?on\w+/i, reason: 'SVG event handler detected' },
  { pattern: /data\s*:\s*text\/html/i, reason: 'data: HTML URI detected' },
  { pattern: /expression\s*\(/i, reason: 'CSS expression detected' },
  { pattern: /url\s*\(\s*['"]?\s*javascript/i, reason: 'CSS javascript URL detected' },
  // Discord/bot command injection (Zippy-style attack)
  { pattern: /\/shutdown/i, reason: 'shutdown command detected' },
  { pattern: /\/kill/i, reason: 'kill command detected' },
  { pattern: /\/exec\b/i, reason: 'exec command detected' },
  { pattern: /\/eval\b/i, reason: 'eval command detected' },
  { pattern: /\/system\b/i, reason: 'system command detected' },
  { pattern: /\bprocess\.exit/i, reason: 'process.exit call detected' },
  { pattern: /\brequire\s*\(/i, reason: 'require() call detected' },
  { pattern: /\bimport\s*\(/i, reason: 'dynamic import detected' },
  { pattern: /\b__proto__\b/i, reason: 'prototype pollution attempt' },
  { pattern: /\bconstructor\s*\[/i, reason: 'constructor access attempt' },
];

function detectInjection(str) {
  if (typeof str !== 'string') return { safe: true, reason: null };
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(str)) {
      return { safe: false, reason };
    }
  }
  return { safe: true, reason: null };
}

// ─── Sanitize Input String ───────────────────────────────────────────────────
// Strips tags, trims whitespace, enforces length limit.
// Does NOT escape HTML — that should happen at the rendering layer.
// This is for cleaning data on input before storage.

function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  let clean = str.trim();
  clean = stripTags(clean);
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean;
}

// ─── Validate & Sanitize Common Field Types ──────────────────────────────────

const FIELD_LIMITS = {
  name: 100,
  title: 200,
  description: 5000,
  approach: 5000,
  wallet: 64,       // Solana base58 pubkey = 32-44 chars
  agentName: 100,
  role: 50,
  email: 254,
  message: 10000,
  skill: 50,
};

function sanitizeField(fieldName, value) {
  const maxLen = FIELD_LIMITS[fieldName] || 1000;
  return sanitizeString(value, maxLen);
}

// ─── Sanitize an Object (all string fields) ─────────────────────────────────
// Recursively sanitizes all string values in an object.
// Returns { sanitized: object, blocked: string[] } where blocked lists
// fields that contained injection patterns.

function sanitizeObject(obj, fieldLimits = {}) {
  if (!obj || typeof obj !== 'object') return { sanitized: obj, blocked: [] };

  const sanitized = {};
  const blocked = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const check = detectInjection(value);
      if (!check.safe) {
        blocked.push(`${key}: ${check.reason}`);
        sanitized[key] = sanitizeField(key, value);
      } else {
        sanitized[key] = sanitizeField(key, value);
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeField(key, item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      const nested = sanitizeObject(value, fieldLimits);
      sanitized[key] = nested.sanitized;
      blocked.push(...nested.blocked);
    }
  }

  return { sanitized, blocked };
}

// ─── Prompt Injection Defense (for LLM/Oracle) ──────────────────────────────
// Escapes user-controlled content before inserting into LLM prompts.
// Wraps content in delimiters and strips known injection patterns.

function escapeForPrompt(str) {
  if (typeof str !== 'string') return '';
  // Remove common prompt injection attempts
  let clean = str
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[FILTERED]')
    .replace(/ignore\s+(all\s+)?above/gi, '[FILTERED]')
    .replace(/you\s+are\s+now/gi, '[FILTERED]')
    .replace(/system\s*:\s*/gi, '[FILTERED]')
    .replace(/assistant\s*:\s*/gi, '[FILTERED]')
    .replace(/\buser\s*:\s*/gi, '[FILTERED]')
    .replace(/OUTPUT FORMAT/gi, '[FILTERED]')
    .replace(/TASK\s*:/gi, '[FILTERED]')
    .replace(/respond\s+with/gi, '[FILTERED]')
    .replace(/return\s+this\s+instead/gi, '[FILTERED]');
  return clean;
}

function wrapUserContent(label, content, maxLen = 2000) {
  const escaped = escapeForPrompt(content);
  const truncated = escaped.substring(0, maxLen);
  return `<<<BEGIN_${label}>>>\n${truncated}\n<<<END_${label}>>>`;
}

// ─── Wallet Address Validation ───────────────────────────────────────────────
// Validates Solana base58 public key format.

function isValidWallet(wallet) {
  if (typeof wallet !== 'string') return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  escapeHtml,
  stripTags,
  detectInjection,
  sanitizeString,
  sanitizeField,
  sanitizeObject,
  escapeForPrompt,
  wrapUserContent,
  isValidWallet,
  FIELD_LIMITS,
  INJECTION_PATTERNS,
};
