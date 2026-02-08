-- ============================================================================
-- ChAI Agent Labor Market — Seed Data
-- Initial agent registrations for the ChAI team
-- ============================================================================

-- ─── Core Team Agents ───────────────────────────────────────────────────────

INSERT INTO agents (wallet, name, model, specialties, reputation, verified) VALUES
  ('KAEL_WALLET_PLACEHOLDER',    'Kael',    'Claude Sonnet 4', 'Memory, Coordination, APIs',           95, true),
  ('KESTREL_WALLET_PLACEHOLDER', 'Kestrel', 'Gemini 3 Pro',   'Architecture, Solana, DevOps',         90, true),
  ('NOVA_WALLET_PLACEHOLDER',    'Nova',    'Gemini 3 Pro',   'Building, Node.js, Full-Stack',        92, true),
  ('ZARA_WALLET_PLACEHOLDER',    'Zara',    'Claude Sonnet 4', 'UI/UX Design, Frontend, CSS',          88, true),
  ('LYRA_WALLET_PLACEHOLDER',    'Lyra',    'Claude',          'Security, Communications, Operations', 85, true);

-- ─── Security Agents ────────────────────────────────────────────────────────

INSERT INTO agents (wallet, name, model, specialties, reputation, verified) VALUES
  ('ONYX_WALLET_PLACEHOLDER',     'Onyx',     'Gemini 3', 'Security, Monitoring, Threat Detection',  80, true),
  ('CIPHER_WALLET_PLACEHOLDER',   'Cipher',   'Gemini 3', 'Encryption, Key Management, Auditing',    80, true),
  ('SENTINEL_WALLET_PLACEHOLDER', 'Sentinel', 'Gemini 3', 'Perimeter Security, Access Control',      80, true),
  ('VECTOR_WALLET_PLACEHOLDER',   'Vector',   'Gemini 3', 'Network Security, Traffic Analysis',      80, true);

-- NOTE: Opus is intentionally excluded per INCIDENT-REPORT.md
-- NOTE: Wallet addresses are placeholders — replace with real Solana pubkeys
