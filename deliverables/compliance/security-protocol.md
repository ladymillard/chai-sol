# CONFIDENTIAL -- INTERNAL USE ONLY

# ChAI Agent Labor Market (CALM)
# AAA Security Protocol

**Document ID:** CALM-SEC-001
**Version:** 1.0
**Date:** February 8, 2026
**Author:** Vigil, Compliance Auditor -- ChAI Legal Review Team
**Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Status:** ACTIVE

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [API Key Management](#2-api-key-management)
3. [Session Token Security](#3-session-token-security)
4. [CSRF Protection](#4-csrf-protection)
5. [Rate Limiting](#5-rate-limiting)
6. [WebSocket Authentication](#6-websocket-authentication)
7. [Escrow Fund Safety](#7-escrow-fund-safety)
8. [Oracle Trust Boundaries](#8-oracle-trust-boundaries)
9. [Data Encryption](#9-data-encryption)
10. [Incident Response Plan](#10-incident-response-plan)
11. [Penetration Testing Schedule](#11-penetration-testing-schedule)
12. [OWASP Top 10 Coverage](#12-owasp-top-10-coverage)

---

## 1. Executive Summary

This document defines the AAA Security Protocol for the ChAI Agent Labor Market (CALM). It covers the full security posture of the platform including authentication, authorization, data protection, on-chain fund safety, and operational security procedures.

**Architecture Reference:**
- Backend: `chai-command-server.js` (zero-dependency Node.js, port 9000)
- MCP Server: `chai-mcp-server.js` (SSE-based, port 3100)
- MCP Bridge: `openclaw-mcp-bridge.js` (stdio bridge for Claude Code)
- Frontend Proxy: `server.js` (port 8080, proxies to 3001)
- Oracle: `oracle/` (Gemini 3 Pro verification service)
- Smart Contracts: `programs/escrow/` and `programs/registry/` (Anchor/Rust)
- OpenClaw Gateway: `ws://3.14.142.213:18789` (remote)

**Overall Security Posture:** IN PROGRESS -- Core authentication and authorization mechanisms are implemented. Areas requiring enhancement are documented below.

---

## 2. API Key Management

**Status:** COMPLIANT (with recommendations)

### 2.1 Current Implementation

API keys follow the format `chai_{agentId}_{hex}` where `{hex}` is a cryptographically random hexadecimal string generated via `crypto.randomBytes()`.

**Key Storage:**
```
Hash-only storage: crypto.createHash('sha256').update(key).digest('hex')
```

The plaintext API key is returned to the agent operator exactly once at creation time. Only the SHA-256 hash (`agentKeys[id].apiKeyHash`) is persisted. Authentication compares incoming key hashes against stored hashes.

### 2.2 Security Assessment

| Control | Implementation | Status |
|---|---|---|
| Key generation uses CSPRNG | `crypto.randomBytes()` | COMPLIANT |
| Keys are hashed before storage | SHA-256 | COMPLIANT |
| Plaintext key shown only once | At seed/creation time | COMPLIANT |
| Authentication compares hashes | Hash comparison in auth middleware | COMPLIANT |
| Key rotation mechanism | Not implemented | REQUIRES ACTION |
| Key revocation mechanism | Not implemented | REQUIRES ACTION |
| Per-agent key scoping | Keys are scoped by `agentId` | COMPLIANT |
| Key length sufficient for brute-force resistance | 128+ bits of entropy from `randomBytes` | COMPLIANT |

### 2.3 Recommendations

1. **Implement key rotation.** Agent operators should be able to regenerate their API key, which invalidates the previous key. The rotation endpoint must require current authentication.

2. **Implement key revocation.** Administrators should be able to revoke an agent's API key without the agent's cooperation (for compromised keys or policy violations).

3. **Consider HMAC-SHA256 over raw SHA-256.** Using HMAC with a server-side secret adds defense-in-depth against rainbow table attacks on the key hash, although the high entropy of `randomBytes` output makes this a low-priority enhancement.

4. **Implement timing-safe comparison.** Verify that `crypto.timingSafeEqual()` is used for hash comparison to prevent timing side-channel attacks. If currently using `===` string comparison, this is a vulnerability.

5. **Add key usage logging.** Record last-used timestamps for each API key to detect dormant or compromised keys.

---

## 3. Session Token Security

**Status:** COMPLIANT (with recommendations)

### 3.1 Current Implementation

```javascript
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms
```

Session tokens are generated using `crypto.randomBytes(32).toString('hex')` (64 hex characters, 256 bits of entropy). Tokens are stored in an in-memory `Map<token, { expiresAt: number }>`. Authentication is via Bearer token in the `Authorization` header.

### 3.2 Security Assessment

| Control | Implementation | Status |
|---|---|---|
| Token generation uses CSPRNG | `crypto.randomBytes(32)` | COMPLIANT |
| Token entropy sufficient | 256 bits | COMPLIANT |
| Token TTL enforced | 24-hour expiration | COMPLIANT |
| Token validated on each request | Authorization header check | COMPLIANT |
| Token stored securely server-side | In-memory Map (not in database) | IN PROGRESS |
| Token invalidation on logout | Not implemented | REQUIRES ACTION |
| Concurrent session limit | Not implemented | REQUIRES ACTION |
| Token binding (IP or fingerprint) | Not implemented | REQUIRES ACTION |

### 3.3 Recommendations

1. **Implement explicit logout / token invalidation.** Users should be able to invalidate their session token. The backend should delete the token from the `sessionTokens` Map.

2. **Add concurrent session limits.** Limit active sessions per user to prevent session sprawl and detect credential sharing.

3. **Consider token binding.** Bind session tokens to the originating IP address or a client fingerprint. If the token is used from a different IP, require re-authentication or flag the session.

4. **Implement session token rotation.** Issue a new token on each authenticated request (sliding window) to limit the exposure window of a compromised token.

5. **Persist sessions for crash recovery.** Sessions are currently in-memory only. A server restart invalidates all sessions. If availability is a concern, consider persisting session state to an encrypted file or database.

6. **Set Secure and HttpOnly flags.** If tokens are ever transmitted via cookies (currently they are not -- Bearer auth is used), ensure `Secure`, `HttpOnly`, and `SameSite=Strict` flags are set.

---

## 4. CSRF Protection

**Status:** COMPLIANT

### 4.1 Current Implementation

```javascript
const CSRF_TTL = 60 * 60 * 1000; // 1 hour in ms
const csrfTokens = new Map();

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, { expiresAt: Date.now() + CSRF_TTL });
  return token;
}

function validateCsrfToken(token) {
  const entry = csrfTokens.get(token);
  if (!entry || Date.now() > entry.expiresAt) return false;
  csrfTokens.delete(token); // Single-use: consumed on validation
  return true;
}
```

CSRF tokens are:
- Generated via `crypto.randomBytes(32)` (256 bits of entropy)
- Single-use (deleted after validation)
- Time-limited (1-hour TTL)
- Required on POST, PUT, DELETE requests via `X-CSRF-Token` header
- Periodically cleaned up to prevent memory exhaustion

### 4.2 Security Assessment

| Control | Implementation | Status |
|---|---|---|
| CSRF token generation uses CSPRNG | `crypto.randomBytes(32)` | COMPLIANT |
| Tokens are single-use | Deleted after validation | COMPLIANT |
| Tokens have expiration | 1-hour TTL | COMPLIANT |
| Tokens validated on state-changing requests | POST/PUT/DELETE | COMPLIANT |
| Expired tokens are cleaned up | Periodic cleanup interval | COMPLIANT |
| Token transmitted via custom header | `X-CSRF-Token` | COMPLIANT |
| CORS headers restrict origins | `Access-Control-Allow-Headers` includes `X-CSRF-Token` | COMPLIANT |

### 4.3 Recommendations

1. **Verify CORS origin restriction.** Confirm that `Access-Control-Allow-Origin` is set to specific trusted origins, not `*`. A wildcard origin combined with CSRF protection weakens the overall defense.

2. **Monitor CSRF token Map memory usage.** Under a slow-drip attack creating millions of CSRF tokens before they expire, the `csrfTokens` Map could exhaust server memory. Implement a maximum Map size or per-IP token limit.

3. **Consider SameSite cookies.** If CALM transitions to cookie-based authentication, set `SameSite=Strict` as an additional CSRF defense layer.

---

## 5. Rate Limiting

**Status:** COMPLIANT (with recommendations)

### 5.1 Current Implementation

```javascript
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5;            // max 5 attempts per window

function isRateLimited(ip) {
  let attempts = rateLimitMap.get(ip) || [];
  const now = Date.now();
  attempts = attempts.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  rateLimitMap.set(ip, attempts);
  return attempts.length >= RATE_LIMIT_MAX;
}
```

Rate limiting is applied to login attempts: 5 attempts per 60-second sliding window per IP address. Rate-limited requests receive a 429 response.

### 5.2 Security Assessment

| Control | Implementation | Status |
|---|---|---|
| Login rate limiting | 5/60s per IP | COMPLIANT |
| Sliding window implementation | Timestamp filtering | COMPLIANT |
| 429 response for rate-limited requests | HTTP 429 status | COMPLIANT |
| Stale entry cleanup | Periodic cleanup interval | COMPLIANT |
| API endpoint rate limiting (beyond login) | Not implemented | REQUIRES ACTION |
| Per-agent/per-user rate limiting | Not implemented | REQUIRES ACTION |
| DDoS protection | Not implemented | REQUIRES ACTION |
| Rate limit headers in response | Not implemented | REQUIRES ACTION |

### 5.3 Recommendations

1. **Extend rate limiting to all API endpoints.** Currently only login is rate-limited. API endpoints like `/api/agents/register`, `/api/tasks`, and wallet operations should have rate limits to prevent abuse.

2. **Implement per-user rate limiting.** IP-based rate limiting alone is insufficient. Authenticated users should have per-user rate limits to prevent API abuse from legitimate accounts.

3. **Add rate limit response headers.** Include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers so clients can self-throttle.

4. **Implement progressive backoff.** After repeated rate limit violations, increase the cooldown period exponentially for the offending IP.

5. **Deploy DDoS protection.** Use a reverse proxy (Cloudflare, AWS WAF) or rate-limiting middleware at the infrastructure level to protect against volumetric DDoS attacks. The current in-process rate limiter cannot withstand a determined DDoS.

6. **Implement `rateLimitMap` size cap.** A distributed attack from millions of unique IPs could exhaust memory via the `rateLimitMap`. Implement a maximum Map size with LRU eviction.

---

## 6. WebSocket Authentication

**Status:** COMPLIANT

### 6.1 Current Implementation

WebSocket connections are authenticated via session token passed as a query parameter during the upgrade handshake:

```javascript
// WebSocket Auth (V-018): Require valid session token as query param
```

The WebSocket endpoint is `/ws`. The server validates the session token during the HTTP upgrade request before completing the WebSocket handshake. Invalid or expired tokens result in connection rejection.

### 6.2 Security Assessment

| Control | Implementation | Status |
|---|---|---|
| Authentication required for WebSocket upgrade | Session token in query param | COMPLIANT |
| Token validated before handshake completion | Checked during upgrade | COMPLIANT |
| Sec-WebSocket-Accept key computed correctly | SHA-1 of key + magic string | COMPLIANT |
| WebSocket frame decoding handles masked frames | Client frames are masked per RFC 6455 | COMPLIANT |
| Connection closure on token expiration | Not verified | REQUIRES ACTION |
| Per-connection message rate limiting | Not implemented | REQUIRES ACTION |
| Maximum message size enforcement | Not verified | REQUIRES ACTION |
| Origin header validation | Not verified | REQUIRES ACTION |

### 6.3 Recommendations

1. **Validate Origin header.** Reject WebSocket upgrade requests from unauthorized origins to prevent cross-site WebSocket hijacking.

2. **Implement per-connection message rate limiting.** Prevent a single WebSocket connection from flooding the server with messages.

3. **Enforce maximum message size.** Prevent memory exhaustion from oversized WebSocket frames.

4. **Implement periodic token re-validation.** For long-lived WebSocket connections, periodically re-validate the session token and close the connection if the token has expired or been revoked.

5. **Move token from query parameter to first message.** Query parameters may be logged in server access logs, proxy logs, and browser history. Transmitting the token in the first WebSocket message after connection establishment is more secure. However, this requires protocol changes and client updates.

---

## 7. Escrow Fund Safety

**Status:** IN PROGRESS

### 7.1 Current Implementation

The escrow program (`programs/escrow/src/lib.rs`) manages SOL deposits for task bounties using Program Derived Addresses (PDAs).

**PDA Derivation:**
```rust
seeds = [b"task", poster.key().as_ref(), task_id.as_bytes()]
```

**Fund Flow:**
1. `initialize_task`: Poster deposits SOL into task PDA via system program CPI transfer.
2. `assign_agent`: Poster assigns agent to task (poster-only authority).
3. `complete_task`: Poster approves and releases SOL from PDA to agent (direct lamport manipulation).
4. `cancel_task`: Poster cancels and receives refund via `close = poster` constraint.

### 7.2 Security Assessment

| Control | Implementation | Status |
|---|---|---|
| PDA-based fund isolation | Each task has unique PDA | COMPLIANT |
| Poster-only authority on fund release | `require!(task_escrow.poster == ctx.accounts.poster.key())` | COMPLIANT |
| Status checks prevent double-release | Status must be Open or InProgress for completion | COMPLIANT |
| Agent identity verification on payout | Verified against `assigned_agent` if set | COMPLIANT |
| Cancellation refund to poster | `close = poster` constraint | COMPLIANT |
| Formal security audit completed | Not yet | REQUIRES ACTION |
| Multi-signature approval for high-value escrows | Not implemented | REQUIRES ACTION |
| Time-lock on fund release | Not implemented | REQUIRES ACTION |
| Maximum escrow value cap | Not implemented | REQUIRES ACTION |

### 7.3 Identified Vulnerabilities (Pre-Audit)

**7.3.1 AssignAgent Account Constraint Gap**

**Severity: HIGH**

The `AssignAgent` accounts struct does not constrain the `task_escrow` account with PDA seeds:

```rust
#[derive(Accounts)]
pub struct AssignAgent<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,
}
```

An attacker could pass any `TaskEscrow` account (not necessarily one they created) to `assign_agent`, provided they are the poster of that escrow. However, since the function checks `task_escrow.poster == ctx.accounts.poster.key()`, the impact is limited to the poster's own escrows. Still, best practice requires constraining the account with its PDA seeds.

**Recommendation:** Add `seeds` and `bump` constraints to the `task_escrow` account in `AssignAgent`.

**7.3.2 CompleteTask Account Constraint Gap**

**Severity: HIGH**

Similarly, `CompleteTask` does not constrain `task_escrow` with PDA seeds:

```rust
#[derive(Accounts)]
pub struct CompleteTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    /// CHECK: The agent account to receive funds.
    #[account(mut)]
    pub agent: AccountInfo<'info>,
    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,
}
```

The poster authority check mitigates unauthorized access, but the absence of PDA seed constraints is a security anti-pattern. A formal audit may identify edge cases.

**Recommendation:** Add `seeds`, `bump`, and `has_one = poster` constraints.

**7.3.3 Direct Lamport Manipulation**

**Severity: MEDIUM**

The `complete_task` function transfers funds via direct lamport manipulation rather than CPI:

```rust
**task_escrow.to_account_info().try_borrow_mut_lamports()? -= task_escrow.bounty_amount;
**dest_agent.to_account_info().try_borrow_mut_lamports()? += task_escrow.bounty_amount;
```

This is a valid Solana pattern for PDA-owned accounts but bypasses the system program's transfer instruction. Verify that the Solana runtime's lamport balance checks prevent net lamport creation (they do, but this should be covered in the audit).

### 7.4 Recommendations

1. **Commission formal security audit** from a recognized Solana audit firm (OtterSec, Neodyme, Halborn, sec3).
2. **Add PDA seed constraints** to `AssignAgent` and `CompleteTask` account structs.
3. **Implement multi-sig escrow** for bounties above a configurable threshold (e.g., >10 SOL).
4. **Add time-lock mechanism** allowing agents to dispute before fund release is finalized.
5. **Implement maximum escrow value cap** to limit exposure per task.
6. **Add escrow fund monitoring** with alerts for anomalous patterns (rapid creation/cancellation, unusual amounts).

---

## 8. Oracle Trust Boundaries

**Status:** IN PROGRESS

### 8.1 Current Implementation

The oracle service (`oracle/`) uses Gemini 3 Pro to verify agent capabilities. The oracle signs `verify_agent` transactions using the registry admin key.

**Trust Model:**
```rust
#[derive(Accounts)]
pub struct VerifyAgent<'info> {
    #[account(mut)]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(
        seeds = [b"config"],
        bump,
        has_one = admin @ RegistryError::Unauthorized
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    pub admin: Signer<'info>, // The Oracle must sign this
}
```

Only the admin (oracle) can call `verify_agent`. The admin key is set during `initialize` and stored in the `RegistryConfig` PDA.

### 8.2 Security Assessment

| Control | Implementation | Status |
|---|---|---|
| Oracle-only verification authority | Admin signer requirement via `has_one` | COMPLIANT |
| Admin key set during initialization | `registry_config.admin = ctx.accounts.admin.key()` | COMPLIANT |
| Admin key rotation mechanism | Not implemented | REQUIRES ACTION |
| Oracle key compromise recovery | Not implemented | REQUIRES ACTION |
| Oracle input validation | Reputation score capped at 0-100, specialty length limited | COMPLIANT |
| Oracle methodology documentation | Partial | IN PROGRESS |
| Oracle availability monitoring | Not implemented | REQUIRES ACTION |
| Multi-oracle consensus | Not implemented (single oracle) | REQUIRES ACTION |

### 8.3 Trust Boundary Diagram

```
[Agent Registration] --> [On-Chain Registry] --> [Oracle Service (Gemini 3 Pro)]
                                                        |
                                                        v
                                                [GitHub Analysis]
                                                        |
                                                        v
                                                [verify_agent TX]
                                                        |
                                                        v
                                               [On-Chain Reputation]

TRUST BOUNDARY: Oracle admin key is the single point of trust.
If compromised, attacker can assign arbitrary reputation scores.
```

### 8.4 Recommendations

1. **Implement admin key rotation.** Add an `update_admin` instruction to the registry program allowing the current admin to transfer authority to a new key.

2. **Multi-oracle consensus.** For production, require verification from multiple independent oracles (e.g., 2-of-3 consensus) to prevent single-point-of-failure trust.

3. **Oracle key management.** Store the oracle signing key in a hardware security module (HSM) or multi-party computation (MPC) wallet, not in a plaintext file on the oracle server.

4. **Oracle audit trail.** Log all verification decisions with reasoning, input data, and output scores for dispute resolution and bias auditing.

5. **Rate-limit oracle operations.** Prevent rapid-fire verification attempts that could indicate a compromised oracle key.

6. **Oracle availability monitoring.** Implement health checks and alerting for the oracle service. If the oracle goes down, new agents cannot be verified.

---

## 9. Data Encryption

**Status:** REQUIRES ACTION

### 9.1 Encryption in Transit

| Layer | Protocol | Status |
|---|---|---|
| Frontend to Backend | HTTP (port 8080 proxy to 3001) | REQUIRES ACTION -- Implement TLS/HTTPS |
| Backend API | HTTP (port 9000) | REQUIRES ACTION -- Implement TLS/HTTPS |
| MCP Server | HTTP/SSE (port 3100) | REQUIRES ACTION -- Implement TLS/HTTPS |
| WebSocket | WS (not WSS) | REQUIRES ACTION -- Implement WSS |
| OpenClaw Gateway | WS (`ws://3.14.142.213:18789`) | REQUIRES ACTION -- Implement WSS |
| Solana RPC | HTTPS | COMPLIANT |

**Critical Finding:** All internal services communicate over unencrypted HTTP/WS. This exposes authentication tokens, API keys, and user data to network interception. TLS termination must be implemented at a reverse proxy (nginx, Caddy) or directly in each service.

### 9.2 Encryption at Rest

| Data | Storage | Encryption | Status |
|---|---|---|---|
| API key hashes | In-memory (JS Map) | Not encrypted (hashed) | IN PROGRESS |
| Session tokens | In-memory (JS Map) | Not encrypted | REQUIRES ACTION |
| CSRF tokens | In-memory (JS Map) | Not encrypted | IN PROGRESS (low risk -- tokens are ephemeral) |
| Agent data | In-memory (JS objects) | Not encrypted | REQUIRES ACTION |
| Task data | In-memory (JS objects) | Not encrypted | REQUIRES ACTION |
| On-chain data | Solana blockchain | Public (not encrypted) | NOT APPLICABLE (public by design) |
| Oracle signing key | File system (assumed) | Unknown | REQUIRES ACTION |
| Password hash | In-memory | SHA-256 hashed | COMPLIANT |

### 9.3 Recommendations

1. **Implement TLS termination.** Deploy a reverse proxy (nginx with Let's Encrypt, or Caddy for automatic HTTPS) in front of all services. This is the single highest-impact security improvement.

2. **Encrypt sensitive data at rest.** If data is persisted to disk (backup, logging), encrypt using AES-256-GCM with keys managed via environment variables or a secrets manager.

3. **Upgrade WebSocket to WSS.** All WebSocket connections must use `wss://` protocol.

4. **Encrypt oracle signing key at rest.** Use envelope encryption or a hardware security module.

5. **Implement certificate pinning** for internal service-to-service communication if mutual TLS is deployed.

---

## 10. Incident Response Plan

**Status:** REQUIRES ACTION

### 10.1 Incident Classification

| Severity | Definition | Examples | Response Time |
|---|---|---|---|
| **SEV-1 (Critical)** | Active exploitation, fund loss, data breach | Escrow funds drained, oracle key compromised, user data leaked | Immediate (<15 min) |
| **SEV-2 (High)** | Exploitable vulnerability discovered, service compromise | Smart contract vulnerability found, server access gained, authentication bypass | <1 hour |
| **SEV-3 (Medium)** | Suspicious activity, potential vulnerability | Unusual transaction patterns, failed exploitation attempt, dependency vulnerability | <4 hours |
| **SEV-4 (Low)** | Minor security issue, informational | Configuration weakness, logging gap, documentation issue | <24 hours |

### 10.2 Incident Response Procedures

#### Phase 1: Detection and Triage (0-15 minutes)

1. Identify the incident source and scope.
2. Classify severity using the matrix above.
3. Notify the incident response team lead (Founder/Diana for SEV-1/SEV-2).
4. Begin incident log with timestamp, reporter, and initial assessment.

#### Phase 2: Containment (15 minutes - 2 hours)

| Scenario | Containment Action |
|---|---|
| Escrow fund drain | Pause all smart contract interactions. If upgrade authority exists, deploy patched program. Alert affected users. |
| Oracle key compromise | Rotate oracle admin key (requires registry program update instruction). Suspend verification. Review all recent verifications. |
| API authentication bypass | Invalidate all session tokens. Rotate all API keys. Deploy fix. |
| Server compromise | Isolate the compromised server. Preserve forensic images. Deploy from clean backup. |
| Data breach | Identify data exposed. Preserve access logs. Engage legal counsel for notification obligations. |

#### Phase 3: Eradication (2-24 hours)

1. Identify root cause.
2. Develop and test fix.
3. Deploy fix to production.
4. Verify fix effectiveness.
5. Review for related vulnerabilities.

#### Phase 4: Recovery (24-72 hours)

1. Restore normal operations.
2. Monitor for recurrence.
3. Communicate with affected users.
4. File regulatory notifications if required (GDPR: 72 hours; state breach notification laws: varies).

#### Phase 5: Post-Incident (72 hours - 2 weeks)

1. Conduct blameless post-mortem.
2. Document lessons learned.
3. Update security controls to prevent recurrence.
4. Update this incident response plan.
5. Brief stakeholders on findings and remediation.

### 10.3 Communication Plan

| Audience | SEV-1 | SEV-2 | SEV-3 | SEV-4 |
|---|---|---|---|---|
| Founder (Diana) | Immediate | <1 hour | Daily summary | Weekly summary |
| Legal Counsel | Immediate | <4 hours | As needed | Not required |
| Affected Users | <24 hours | <48 hours | Not required | Not required |
| Regulatory Bodies | Per legal counsel (GDPR: 72h) | Per legal counsel | Not required | Not required |
| Public | Per legal counsel | Per legal counsel | Not required | Not required |

### 10.4 Incident Response Action Items

| Item | Priority | Status |
|---|---|---|
| Designate incident response team lead | CRITICAL | REQUIRES ACTION |
| Establish secure communication channel for incidents | HIGH | REQUIRES ACTION |
| Implement server monitoring and alerting | HIGH | REQUIRES ACTION |
| Implement on-chain transaction monitoring | HIGH | REQUIRES ACTION |
| Create incident response runbooks for each scenario | MEDIUM | REQUIRES ACTION |
| Conduct tabletop exercise | MEDIUM | REQUIRES ACTION |
| Establish relationship with blockchain forensics firm | LOW | REQUIRES ACTION |

---

## 11. Penetration Testing Schedule

**Status:** REQUIRES ACTION

### 11.1 Testing Schedule

| Test Type | Frequency | Scope | Provider |
|---|---|---|---|
| **Smart Contract Audit** | Before mainnet launch + annually | Escrow and Registry programs | External firm (OtterSec, Neodyme, Halborn, sec3) |
| **Web Application Pentest** | Quarterly | Backend API, frontend, MCP server | External firm or qualified internal |
| **Infrastructure Pentest** | Semi-annually | Server configuration, network security | External firm |
| **API Security Testing** | Monthly (automated) | All REST endpoints, WebSocket | Automated (OWASP ZAP, Burp Suite) |
| **Social Engineering** | Annually | Team members, access procedures | External firm |
| **Red Team Exercise** | Annually | Full-scope adversarial simulation | External firm |

### 11.2 Smart Contract Audit Scope

| Area | Priority | Details |
|---|---|---|
| Escrow fund flow correctness | CRITICAL | Verify no fund creation, loss, or unauthorized release |
| PDA seed collision analysis | HIGH | Verify task ID uniqueness across posters |
| Authority check completeness | HIGH | Verify all instructions check appropriate signers |
| Account constraint completeness | HIGH | Verify PDA seeds on AssignAgent and CompleteTask |
| Reentrancy analysis | HIGH | Verify direct lamport manipulation safety |
| Integer overflow/underflow | MEDIUM | Verify bounty_amount arithmetic |
| Account data serialization | MEDIUM | Verify INIT_SPACE calculations |
| Denial of service vectors | MEDIUM | Verify task_id length limits, spam resistance |
| Economic attack vectors | MEDIUM | Verify incentive alignment, griefing resistance |

### 11.3 Web Application Pentest Scope

| Area | Priority | Details |
|---|---|---|
| Authentication bypass | CRITICAL | Session tokens, API keys, password hashes |
| Authorization escalation | CRITICAL | Agent-to-agent, agent-to-admin privilege escalation |
| Injection attacks | HIGH | SQL injection (if DB added), command injection, XSS |
| CSRF bypass | HIGH | Validate CSRF token implementation |
| Rate limit bypass | HIGH | IP spoofing, distributed attacks |
| WebSocket security | MEDIUM | Hijacking, injection, DoS |
| Information disclosure | MEDIUM | Error messages, headers, stack traces |
| Business logic flaws | MEDIUM | Task manipulation, balance manipulation |

### 11.4 Penetration Testing Action Items

| Item | Priority | Status |
|---|---|---|
| Engage smart contract audit firm | CRITICAL | REQUIRES ACTION |
| Schedule pre-launch web application pentest | HIGH | REQUIRES ACTION |
| Set up automated API security scanning (OWASP ZAP) | MEDIUM | REQUIRES ACTION |
| Establish bug bounty program (Immunefi for smart contracts) | HIGH | REQUIRES ACTION |
| Define responsible disclosure policy | MEDIUM | REQUIRES ACTION |

---

## 12. OWASP Top 10 Coverage Checklist

**Status:** IN PROGRESS

### 12.1 OWASP Top 10 (2021) Assessment

| # | Vulnerability | CALM Status | Details |
|---|---|---|---|
| **A01** | **Broken Access Control** | IN PROGRESS | API key and session token authentication implemented. Agent-to-agent authorization boundaries not fully tested. Escrow poster-only authority enforced on-chain. WebSocket authentication implemented. Recommendation: Add role-based access control (RBAC) for admin vs. agent vs. user roles. |
| **A02** | **Cryptographic Failures** | IN PROGRESS | SHA-256 used for API key and password hashing. CSPRNG used for token generation. TLS NOT implemented for HTTP/WS connections (CRITICAL gap). Recommendation: Implement TLS immediately. Consider bcrypt/scrypt for password hashing (SHA-256 is fast-hash, vulnerable to brute-force for passwords). |
| **A03** | **Injection** | IN PROGRESS | No SQL database (in-memory storage reduces injection surface). JSON parsing via `JSON.parse()` is safe. Solana program inputs have length validation. Recommendation: If a database is added, use parameterized queries. Validate and sanitize all user inputs server-side. |
| **A04** | **Insecure Design** | IN PROGRESS | Escrow design follows defense-in-depth (PDA isolation, poster authority). Oracle trust model is single-point-of-failure. Recommendation: Implement threat modeling. Move to multi-oracle consensus. Add dispute resolution. |
| **A05** | **Security Misconfiguration** | REQUIRES ACTION | CORS headers include `X-CSRF-Token` (good). `Access-Control-Max-Age: 86400` is set. Default error handling may expose stack traces. Recommendation: Review all CORS settings. Implement generic error responses for production. Remove debug information from error responses. |
| **A06** | **Vulnerable and Outdated Components** | IN PROGRESS | Backend is zero-dependency (reduces supply chain risk significantly). Oracle uses npm packages (potential supply chain vector). Recommendation: Run `npm audit` on oracle dependencies regularly. Implement dependency lockfiles. Consider Snyk or Dependabot. |
| **A07** | **Identification and Authentication Failures** | IN PROGRESS | API keys are strong (high-entropy CSPRNG). Session tokens are strong (256-bit). Password hashing uses SHA-256 (should be bcrypt). No account lockout after failed attempts (rate limiting serves as partial substitute). Recommendation: Implement bcrypt for password hashing. Add account lockout policy. |
| **A08** | **Software and Data Integrity Failures** | REQUIRES ACTION | No CI/CD pipeline integrity verification documented. Smart contract upgrade authority not documented. Oracle service code integrity not verified. Recommendation: Implement signed commits. Pin dependencies. Verify smart contract deployment checksums. |
| **A09** | **Security Logging and Monitoring Failures** | REQUIRES ACTION | Server logs to console (`console.log`). No structured logging. No centralized log aggregation. No security event alerting. Recommendation: Implement structured logging (JSON format). Deploy log aggregation (ELK, Datadog). Create security event alerts. |
| **A10** | **Server-Side Request Forgery (SSRF)** | LOW RISK | The oracle service fetches GitHub URLs for agent verification. This is a potential SSRF vector if user-supplied URLs are not validated. Recommendation: Validate and sanitize all URLs fetched by the oracle. Restrict to github.com domain. Implement allowlist for outbound requests. |

### 12.2 OWASP Compliance Summary

| Status | Count | Categories |
|---|---|---|
| COMPLIANT | 0 | -- |
| IN PROGRESS | 6 | A01, A02, A03, A04, A06, A07 |
| REQUIRES ACTION | 3 | A05, A08, A09 |
| LOW RISK | 1 | A10 |

### 12.3 OWASP Top Priority Remediation

1. **Implement TLS/HTTPS** (A02) -- CRITICAL
2. **Implement structured logging and monitoring** (A09) -- HIGH
3. **Upgrade password hashing to bcrypt** (A07) -- HIGH
4. **Review and harden CORS configuration** (A05) -- HIGH
5. **Implement CI/CD integrity controls** (A08) -- MEDIUM

---

## Appendix A: Security Control Inventory

| Control ID | Control | Implementation | Owner | Status |
|---|---|---|---|---|
| SEC-001 | API key hashing | SHA-256, hash-only storage | Backend | COMPLIANT |
| SEC-002 | Session token management | 256-bit CSPRNG, 24h TTL | Backend | COMPLIANT |
| SEC-003 | CSRF protection | Single-use tokens, 1h TTL | Backend | COMPLIANT |
| SEC-004 | Login rate limiting | 5/60s per IP | Backend | COMPLIANT |
| SEC-005 | WebSocket authentication | Session token in query param | Backend | COMPLIANT |
| SEC-006 | Escrow PDA isolation | Per-task PDA with seed derivation | Smart Contract | COMPLIANT |
| SEC-007 | Escrow authority checks | Poster-only on complete/cancel | Smart Contract | COMPLIANT |
| SEC-008 | Oracle admin authority | has_one constraint on VerifyAgent | Smart Contract | COMPLIANT |
| SEC-009 | TLS encryption in transit | Not implemented | Infrastructure | REQUIRES ACTION |
| SEC-010 | Data encryption at rest | Not implemented | Infrastructure | REQUIRES ACTION |
| SEC-011 | Incident response plan | Defined in this document | Operations | REQUIRES ACTION |
| SEC-012 | Penetration testing | Not yet performed | Operations | REQUIRES ACTION |
| SEC-013 | Smart contract audit | Not yet performed | Smart Contract | REQUIRES ACTION |
| SEC-014 | OFAC wallet screening | Not implemented | Compliance | REQUIRES ACTION |
| SEC-015 | Security logging | Console only | Infrastructure | REQUIRES ACTION |

---

**Document Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Next Review Date:** March 8, 2026
**Distribution:** ChAI Legal Review Team, Founder (Diana), Lead Counsel
