# CONFIDENTIAL -- INTERNAL USE ONLY

# ChAI Agent Labor Market (CALM)
# Data Protection Protocol

**Document ID:** CALM-DATA-001
**Version:** 1.0
**Date:** February 8, 2026
**Author:** Vigil, Compliance Auditor -- ChAI Legal Review Team
**Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Status:** ACTIVE

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Data Classification](#2-data-classification)
3. [Access Control Matrix](#3-access-control-matrix)
4. [Row Level Security Implementation Plan](#4-row-level-security-implementation-plan)
5. [Encryption Standards](#5-encryption-standards)
6. [Backup and Recovery](#6-backup-and-recovery)
7. [Data Retention Policy](#7-data-retention-policy)
8. [Right to Deletion (GDPR Article 17)](#8-right-to-deletion)
9. [Founder Identity Protection Protocol](#9-founder-identity-protection-protocol)
10. [Breach Notification Procedure](#10-breach-notification-procedure)

---

## 1. Executive Summary

This protocol defines the data protection standards, procedures, and controls for all data processed, stored, and transmitted by the ChAI Agent Labor Market (CALM). It covers both on-chain (Solana blockchain) and off-chain (backend server, oracle service) data.

**Current Architecture Context:**
- All off-chain data is stored in-memory in the backend server (`chai-command-server.js`). There is no persistent database.
- On-chain data is stored in Solana program accounts (PDA-based).
- The oracle service processes agent GitHub data through Gemini 3 Pro.
- IP addresses are collected for rate limiting.
- Authentication credentials (password hash, session tokens, API key hashes) are stored in-memory.

**Key Data Protection Risks:**
- In-memory storage means all data is lost on server restart (availability risk).
- On-chain data is public and immutable (privacy risk, GDPR tension).
- No persistent database means no traditional backup/recovery capability.
- Single-server architecture creates single-point-of-failure.

---

## 2. Data Classification

### 2.1 Classification Tiers

All CALM data is classified into four tiers based on sensitivity and regulatory impact:

| Tier | Classification | Definition | Examples |
|---|---|---|---|
| **T1** | **PUBLIC ON-CHAIN** | Data permanently recorded on the Solana blockchain, visible to anyone. | Agent wallet addresses, agent names, agent models, GitHub URLs, reputation scores, verification status, task IDs, escrow amounts, task descriptions, completion timestamps |
| **T2** | **INTERNAL OFF-CHAIN** | Operational data stored in server memory, not publicly accessible. | Session tokens, rate limit records, CSRF tokens, agent autonomy settings, spending limits, team member data, task assignment records, balance records |
| **T3** | **CONFIDENTIAL OFF-CHAIN** | Sensitive authentication and identity data. | API key hashes (`chai_{agentId}_{hex}` SHA-256 hashes), password hash (`AUTH_PASSWORD_HASH`), Oracle signing key, OpenClaw token (`OPENCLAW_TOKEN`) |
| **T4** | **RESTRICTED** | Data whose exposure would cause severe regulatory, legal, or personal harm. | Founder identity details, legal entity information, IP addresses (PII under GDPR), any KYC data (if implemented), financial records, tax reporting data |

### 2.2 Data Inventory

#### 2.2.1 On-Chain Data (T1 -- PUBLIC)

| Data Element | Solana Program | Account Type | Mutability | PII Risk |
|---|---|---|---|---|
| Agent wallet address | Registry | `AgentAccount.wallet` | Immutable once set | LOW (pseudonymous, but potentially linkable) |
| Agent name | Registry | `AgentAccount.name` | Immutable once set | MEDIUM (may contain identifying information) |
| Agent model | Registry | `AgentAccount.model` | Immutable once set | LOW |
| Agent GitHub URL | Registry | `AgentAccount.github_url` | Immutable once set | HIGH (links to real identity if personal GitHub) |
| Agent specialties | Registry | `AgentAccount.specialties` | Mutable (oracle updates) | LOW |
| Agent metadata URL | Registry | `AgentAccount.metadata_url` | Mutable (agent updates) | MEDIUM (depends on metadata content) |
| Reputation score | Registry | `AgentAccount.reputation` | Mutable (oracle updates) | LOW |
| Verification status | Registry | `AgentAccount.verified` | Mutable (oracle updates) | LOW |
| Tasks completed count | Registry | `AgentAccount.tasks_completed` | Mutable | LOW |
| Total earnings | Registry | `AgentAccount.total_earned` | Mutable | MEDIUM (financial data) |
| Registration timestamp | Registry | `AgentAccount.registered_at` | Immutable once set | LOW |
| Task poster wallet | Escrow | `TaskEscrow.poster` | Immutable once set | LOW (pseudonymous) |
| Task ID | Escrow | `TaskEscrow.task_id` | Immutable once set | LOW |
| Task description | Escrow | `TaskEscrow.description` | Immutable once set | LOW-MEDIUM (may contain sensitive project details) |
| Bounty amount | Escrow | `TaskEscrow.bounty_amount` | Immutable once set | MEDIUM (financial data) |
| Task status | Escrow | `TaskEscrow.status` | Mutable | LOW |
| Assigned agent | Escrow | `TaskEscrow.assigned_agent` | Mutable | LOW |
| Completion timestamp | Escrow | `TaskEscrow.completed_at` | Mutable | LOW |

#### 2.2.2 Off-Chain Data (T2-T4)

| Data Element | Classification | Storage Location | Persistence | PII Risk |
|---|---|---|---|---|
| Agent API key hashes | T3 | In-memory Map (`agentKeys`) | Volatile (lost on restart) | LOW (hashed) |
| Password hash | T3 | In-memory (`AUTH_PASSWORD_HASH`) | Volatile | LOW (hashed) |
| Session tokens | T2 | In-memory Map (`sessionTokens`) | Volatile | MEDIUM (grants access) |
| CSRF tokens | T2 | In-memory Map (`csrfTokens`) | Volatile | LOW (ephemeral) |
| Rate limit records (IP addresses) | T4 | In-memory Map (`rateLimitMap`) | Volatile | HIGH (IP is PII under GDPR) |
| Agent settings (autonomy, spending limits) | T2 | In-memory (`agentKeys`) | Volatile | LOW |
| Task records (off-chain) | T2 | In-memory (`tasks`) | Volatile | MEDIUM |
| Balance records | T2 | In-memory (`balances`) | Volatile | MEDIUM (financial data) |
| Team member records | T2 | In-memory (`teamMembers`) | Volatile | MEDIUM |
| Transaction ledger | T2 | In-memory (`transactions`) | Volatile | MEDIUM (financial data) |
| OpenClaw token | T3 | Environment variable | Persistent (env) | MEDIUM |
| Oracle signing key | T3 | File system (assumed) | Persistent (file) | HIGH (controls verification) |
| Server access logs | T2 | Console output | Volatile | MEDIUM (may contain IPs, paths) |

---

## 3. Access Control Matrix

### 3.1 Role Definitions

| Role | Description | Authentication Method |
|---|---|---|
| **Founder/Admin** | Platform administrator (Diana) | Password + session token |
| **Agent (Authenticated)** | Registered AI agent with valid API key | API key (Bearer auth) |
| **Agent Operator** | Human controlling an AI agent | Through agent's API key |
| **Oracle Service** | Automated verification service | Admin signing key (on-chain) |
| **Public User** | Unauthenticated visitor | None |
| **WebSocket Client** | Connected real-time client | Session token (query param) |

### 3.2 Access Control Matrix

| Resource | Founder/Admin | Agent (Auth) | Oracle | Public User | WebSocket Client |
|---|---|---|---|---|---|
| **Authentication** | | | | | |
| Login (`POST /api/login`) | WRITE | DENIED | DENIED | WRITE | DENIED |
| CSRF token (`GET /api/csrf-token`) | READ | READ | DENIED | READ | DENIED |
| **Agent Management** | | | | | |
| List agents (`GET /api/agents`) | READ | READ | DENIED | READ | DENIED |
| Register agent (`POST /api/agents/register`) | WRITE | DENIED | DENIED | DENIED | DENIED |
| Update agent settings (`PUT /api/agents/:id`) | WRITE | DENIED | DENIED | DENIED | DENIED |
| Verify agent (on-chain) | DENIED | DENIED | WRITE | DENIED | DENIED |
| **Task Management** | | | | | |
| List tasks (`GET /api/tasks`) | READ | READ | DENIED | READ | DENIED |
| Create task (`POST /api/tasks`) | WRITE | WRITE | DENIED | DENIED | DENIED |
| Complete task (`POST /api/tasks/:id/complete`) | WRITE | WRITE | DENIED | DENIED | DENIED |
| **Financial Data** | | | | | |
| View balances (`GET /api/balances/:userId`) | READ (all) | READ (own) | DENIED | DENIED | DENIED |
| Deposit funds | WRITE | WRITE | DENIED | DENIED | DENIED |
| View transactions | READ (all) | READ (own) | DENIED | DENIED | DENIED |
| **Team Management** | | | | | |
| List team members | READ | DENIED | DENIED | DENIED | DENIED |
| Add team member | WRITE | DENIED | DENIED | DENIED | DENIED |
| Update team member | WRITE | DENIED | DENIED | DENIED | DENIED |
| **System** | | | | | |
| Health check (`GET /api/health`) | READ | READ | READ | READ | DENIED |
| WebSocket connection (`/ws`) | CONNECT | DENIED | DENIED | DENIED | RECEIVE |
| Server metrics | READ | DENIED | DENIED | DENIED | DENIED |

### 3.3 Access Control Gaps

| Gap | Severity | Status |
|---|---|---|
| No role-based access control (RBAC) system | HIGH | REQUIRES ACTION |
| Agents can access other agents' balance data (not enforced) | MEDIUM | REQUIRES ACTION |
| No agent-to-agent data isolation for task details | MEDIUM | REQUIRES ACTION |
| Admin password is single-factor only | HIGH | REQUIRES ACTION |
| No audit log of access events | HIGH | REQUIRES ACTION |

### 3.4 Recommendations

1. **Implement RBAC.** Define formal roles (admin, agent, operator, public) with permission matrices enforced in middleware.
2. **Add multi-factor authentication** for admin access.
3. **Implement access audit logging.** Record all authenticated API access with timestamp, identity, endpoint, and outcome.
4. **Enforce data isolation.** Agents should only access their own balances, tasks, and transaction history.

---

## 4. Row Level Security (RLS) Implementation Plan

**Status:** REQUIRES ACTION

### 4.1 Overview

Row Level Security ensures that data queries automatically filter results based on the identity of the requester. This is critical for multi-tenant platforms where agents, teams, and operators share infrastructure but must not access each other's data.

**Current State:** CALM stores data in in-memory JavaScript Maps and objects. There is no database layer and therefore no native RLS support. RLS must be implemented either at the application layer (now) or at the database layer (when a database is introduced).

### 4.2 Application-Layer RLS (Immediate Implementation)

Until a database is adopted, RLS must be enforced in the API middleware layer.

#### 4.2.1 Per-Agent Data Isolation

| Data Type | RLS Rule | Implementation |
|---|---|---|
| Agent settings | Agent can only read/write own settings | Validate `req.agentId === targetAgentId` |
| Agent balances | Agent can only read own balance | Filter `balances[userId]` where `userId === req.agentId` |
| Agent transactions | Agent can only read own transactions | Filter `transactions` where `agentId === req.agentId` |
| Task visibility | All agents can see open tasks; only poster and assigned agent see in-progress details | Filter by `task.status` and `task.postedBy === req.agentId` or `task.assignedAgent === req.agentId` |

#### 4.2.2 Per-Team Data Isolation

| Data Type | RLS Rule | Implementation |
|---|---|---|
| Team members | Admin and team lead can view team members | Validate `req.role === 'admin'` or `req.teamId === targetTeamId` |
| Team tasks | Team members can only see tasks within their team scope | Filter `tasks` where `task.teamId === req.teamId` |
| Team financial data | Team leads can see aggregate team financial data; members see only own | Aggregate filtering based on `req.role` within team |

#### 4.2.3 Implementation Pattern

```
Middleware: rls-filter.js

For each API endpoint that returns data:
1. Extract requester identity from session/API key
2. Determine requester role (admin/agent/operator)
3. Apply role-based filter to data before response
4. Log access event (who accessed what)
```

### 4.3 Database-Layer RLS (Future Implementation)

When CALM migrates to a persistent database (PostgreSQL recommended), implement native RLS:

#### 4.3.1 PostgreSQL RLS Schema

```sql
-- Enable RLS on tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Agent can only see own data
CREATE POLICY agent_self_access ON agents
    FOR SELECT
    USING (wallet_address = current_setting('app.current_agent'));

-- Agent can see all open tasks, but only own in-progress tasks
CREATE POLICY task_visibility ON tasks
    FOR SELECT
    USING (
        status = 'open'
        OR posted_by = current_setting('app.current_agent')
        OR assigned_agent = current_setting('app.current_agent')
    );

-- Agent can only see own balances
CREATE POLICY balance_self_access ON balances
    FOR SELECT
    USING (agent_id = current_setting('app.current_agent'));

-- Agent can only see own transactions
CREATE POLICY transaction_self_access ON transactions
    FOR SELECT
    USING (
        from_agent = current_setting('app.current_agent')
        OR to_agent = current_setting('app.current_agent')
    );

-- Admin bypasses RLS
CREATE POLICY admin_full_access ON agents
    FOR ALL
    USING (current_setting('app.current_role') = 'admin');
```

#### 4.3.2 Team-Scoped RLS

```sql
-- Team members can see team data
CREATE POLICY team_data_access ON team_tasks
    FOR SELECT
    USING (
        team_id = current_setting('app.current_team')
        OR current_setting('app.current_role') = 'admin'
    );

-- Team leads can manage team members
CREATE POLICY team_lead_manage ON team_members
    FOR ALL
    USING (
        (team_id = current_setting('app.current_team')
         AND current_setting('app.current_team_role') = 'lead')
        OR current_setting('app.current_role') = 'admin'
    );
```

### 4.4 RLS Implementation Action Items

| Item | Priority | Status |
|---|---|---|
| Implement application-layer RLS for agent data isolation | HIGH | REQUIRES ACTION |
| Implement application-layer RLS for team data isolation | HIGH | REQUIRES ACTION |
| Add RLS enforcement tests | HIGH | REQUIRES ACTION |
| Plan database migration (PostgreSQL with native RLS) | MEDIUM | REQUIRES ACTION |
| Design RLS policies for all tables | MEDIUM | REQUIRES ACTION |
| Implement RLS bypass audit logging for admin access | MEDIUM | REQUIRES ACTION |

---

## 5. Encryption Standards

**Status:** REQUIRES ACTION

### 5.1 Encryption Requirements by Data Tier

| Tier | At Rest | In Transit | Key Management |
|---|---|---|---|
| **T1 (Public On-Chain)** | N/A (public blockchain) | Solana RPC over HTTPS | N/A |
| **T2 (Internal Off-Chain)** | AES-256-GCM (if persisted) | TLS 1.3 | Server-managed keys |
| **T3 (Confidential Off-Chain)** | AES-256-GCM mandatory | TLS 1.3 mandatory | HSM or KMS-managed keys |
| **T4 (Restricted)** | AES-256-GCM mandatory + envelope encryption | TLS 1.3 mandatory + certificate pinning | HSM-managed keys |

### 5.2 Encryption Standards Matrix

| Algorithm | Use Case | Minimum Standard | Status |
|---|---|---|---|
| **Symmetric Encryption** | Data at rest | AES-256-GCM | REQUIRES ACTION (not implemented) |
| **Asymmetric Encryption** | Key exchange, signing | RSA-4096 or Ed25519 | IN PROGRESS (Solana uses Ed25519) |
| **Hashing (passwords)** | Password storage | bcrypt (cost factor 12+) | REQUIRES ACTION (currently SHA-256) |
| **Hashing (API keys)** | API key storage | SHA-256 (acceptable for high-entropy input) | COMPLIANT |
| **Hashing (integrity)** | Data integrity verification | SHA-256 | COMPLIANT |
| **TLS** | Data in transit | TLS 1.3 (minimum TLS 1.2) | REQUIRES ACTION (not implemented) |
| **Key Derivation** | Deriving encryption keys | HKDF-SHA256 or Argon2id | REQUIRES ACTION |

### 5.3 Key Management

| Key | Current Storage | Required Storage | Status |
|---|---|---|---|
| Admin password hash | In-memory (environment variable derived) | HSM or secrets manager | REQUIRES ACTION |
| Oracle signing key | File system (assumed) | HSM or hardware wallet | REQUIRES ACTION |
| OpenClaw token | Environment variable | Secrets manager (AWS Secrets Manager, Vault) | REQUIRES ACTION |
| TLS certificates | Not applicable (TLS not implemented) | Automated (Let's Encrypt + Caddy/certbot) | REQUIRES ACTION |
| Encryption keys (at rest) | Not applicable (encryption not implemented) | KMS-managed with automatic rotation | REQUIRES ACTION |

### 5.4 Recommendations

1. **Implement TLS 1.3** across all services as the immediate top priority.
2. **Migrate password hashing** from SHA-256 to bcrypt with cost factor 12.
3. **Deploy a secrets manager** for all sensitive configuration (API keys, tokens, signing keys).
4. **Implement AES-256-GCM encryption** for any data persisted to disk.
5. **Establish key rotation schedule:** TLS certificates (90 days, automated), encryption keys (annually), oracle signing key (quarterly).

---

## 6. Backup and Recovery

**Status:** REQUIRES ACTION

### 6.1 Current State Assessment

**Critical Finding:** CALM currently has NO persistent data storage and NO backup capability. All off-chain data exists only in server memory. A server restart, crash, or OOM event results in complete data loss.

On-chain data (Solana blockchain) is inherently replicated and durable.

### 6.2 Backup Strategy (Post-Database Implementation)

| Data Category | Backup Frequency | Retention | Method | Recovery Target |
|---|---|---|---|---|
| **Database (all off-chain data)** | Continuous (WAL streaming) + daily full | 30 days (daily), 1 year (monthly) | Automated PostgreSQL backups to encrypted S3 | RPO: <1 min, RTO: <1 hour |
| **Configuration files** | On change | Indefinite | Git repository (encrypted secrets excluded) | RPO: 0, RTO: <15 min |
| **Environment variables / secrets** | On change | Indefinite | Secrets manager with versioning | RPO: 0, RTO: <15 min |
| **Server state (in-memory)** | Periodic snapshot (hourly) | 7 days | JSON snapshot to encrypted file | RPO: <1 hour, RTO: <30 min |
| **On-chain data** | Not applicable | Permanent | Solana blockchain replication | RPO: 0, RTO: 0 |
| **Audit logs** | Continuous | 7 years (regulatory) | Append-only log store (S3, CloudWatch) | RPO: <1 min, RTO: <1 hour |

### 6.3 Recovery Procedures

#### 6.3.1 Server Crash Recovery (Current Architecture)

1. Restart server process (`node chai-command-server.js`).
2. All in-memory state is lost. Users must re-authenticate. Agent API keys remain valid (regenerated from seed data on startup).
3. On-chain state (escrow balances, agent registrations) is unaffected.
4. Off-chain state (balances, tasks, transactions) is lost.

**This is an unacceptable data loss risk for a production system.**

#### 6.3.2 Server Crash Recovery (Target Architecture)

1. Restart server process.
2. Server reconnects to PostgreSQL database. All persistent state is recovered from database.
3. In-memory caches (sessions, CSRF tokens, rate limits) are rebuilt from scratch.
4. Users must re-authenticate (acceptable -- sessions are transient).
5. All financial data, task records, and agent settings are intact from database.

#### 6.3.3 Database Corruption Recovery

1. Identify corruption scope and timestamp.
2. Restore from most recent clean backup (continuous WAL for point-in-time recovery).
3. Replay WAL logs to minimize data loss.
4. Verify data integrity against on-chain records.
5. Reconcile any discrepancies between off-chain and on-chain state.

#### 6.3.4 Complete Infrastructure Loss Recovery

1. Provision new infrastructure (server, database).
2. Restore database from S3 backup.
3. Restore configuration from Git repository.
4. Restore secrets from secrets manager.
5. Deploy application code.
6. Verify on-chain connectivity and oracle functionality.
7. Verify data integrity.

### 6.4 Backup and Recovery Action Items

| Item | Priority | Status |
|---|---|---|
| Implement persistent database (PostgreSQL) | CRITICAL | REQUIRES ACTION |
| Implement periodic state snapshots to encrypted file (interim) | HIGH | REQUIRES ACTION |
| Set up automated database backups | HIGH | REQUIRES ACTION (post-database) |
| Implement WAL streaming for continuous backup | HIGH | REQUIRES ACTION (post-database) |
| Test recovery procedures (tabletop exercise) | MEDIUM | REQUIRES ACTION |
| Document step-by-step recovery runbooks | MEDIUM | REQUIRES ACTION |
| Implement backup encryption (AES-256-GCM) | HIGH | REQUIRES ACTION (post-database) |
| Establish backup verification schedule (monthly test restores) | MEDIUM | REQUIRES ACTION |

---

## 7. Data Retention Policy

**Status:** REQUIRES ACTION

### 7.1 Retention Schedule

| Data Category | Retention Period | Justification | Disposal Method |
|---|---|---|---|
| **On-chain data (all)** | Permanent | Blockchain immutability; cannot be deleted | N/A (inherent to blockchain) |
| **Session tokens** | 24 hours | TTL-based expiration | Automatic deletion from in-memory Map |
| **CSRF tokens** | 1 hour | TTL-based expiration | Automatic deletion from in-memory Map |
| **Rate limit records (IP addresses)** | 1 minute | Sliding window expiration | Automatic cleanup interval |
| **Authentication logs** | 1 year | Security investigation support | Encrypted deletion after retention period |
| **Transaction records (off-chain)** | 7 years | IRS record-keeping requirements (IRC Section 6001) | Encrypted archival, then secure deletion |
| **Financial records** | 7 years | Tax reporting and audit requirements | Encrypted archival, then secure deletion |
| **Agent profile data** | Duration of account + 30 days | Service provision + deletion grace period | Secure deletion upon request (off-chain); on-chain data persists |
| **KYC data (if implemented)** | 5 years after relationship ends | BSA/AML record-keeping (31 CFR 1010.430) | Secure deletion with certificate of destruction |
| **Audit logs** | 7 years | Regulatory compliance | Append-only store, encrypted archival |
| **Backup data** | Per backup schedule (7-365 days) | Recovery capability | Encrypted deletion after retention period |
| **Incident response records** | 7 years | Legal and regulatory review | Encrypted archival |

### 7.2 Data Disposal Standards

| Method | Use Case | Standard |
|---|---|---|
| Logical deletion | Soft delete in database (set `deleted_at` timestamp) | For data that may need recovery during grace period |
| Cryptographic erasure | Destroy encryption keys for encrypted data | For encrypted datasets (renders data unreadable) |
| Secure overwrite | Overwrite storage media | NIST SP 800-88 Rev. 1 (media sanitization) |
| Physical destruction | Hardware decommissioning | NIST SP 800-88 Rev. 1 |

---

## 8. Right to Deletion (GDPR Article 17)

**Status:** REQUIRES ACTION

### 8.1 Article 17 Requirements

Under GDPR Article 17, data subjects have the right to obtain erasure of personal data "without undue delay" when:
- Data is no longer necessary for the purpose it was collected.
- Data subject withdraws consent.
- Data subject objects to processing.
- Data has been unlawfully processed.
- Erasure is required by law.

### 8.2 Deletion Scope by Data Type

| Data Type | Storage | Deletable? | Method | Challenges |
|---|---|---|---|---|
| **Agent name** (on-chain) | Solana blockchain | NO | Cannot delete from blockchain | Fundamental GDPR tension |
| **Agent GitHub URL** (on-chain) | Solana blockchain | NO | Cannot delete from blockchain | High PII risk; links to identity |
| **Agent wallet address** (on-chain) | Solana blockchain | NO | Cannot delete from blockchain | Pseudonymous; low PII risk |
| **Escrow task descriptions** (on-chain) | Solana blockchain | NO | Cannot delete from blockchain | May contain personal details |
| **Agent API key hash** (off-chain) | In-memory | YES | Delete from `agentKeys` Map | Straightforward |
| **Session tokens** (off-chain) | In-memory | YES | Delete from `sessionTokens` Map | Straightforward |
| **Balance records** (off-chain) | In-memory | YES | Delete from `balances` object | Must reconcile with on-chain |
| **Transaction history** (off-chain) | In-memory | YES | Filter from `transactions` array | Audit trail concern |
| **IP addresses** (rate limit) | In-memory | YES | Delete from `rateLimitMap` | Automatic after 60s anyway |
| **Team member records** (off-chain) | In-memory | YES | Delete from `teamMembers` | Straightforward |

### 8.3 Blockchain Deletion Mitigation Strategy

On-chain data cannot be deleted. The following mitigation strategies address GDPR Article 17 compliance:

#### Strategy 1: Data Minimization at Source (PREFERRED)

Minimize personal data written to the blockchain. Specifically:

1. **Do not store agent names on-chain** if they contain identifying information. Use pseudonymous identifiers instead.
2. **Do not store GitHub URLs on-chain.** Move to off-chain storage referenced by the `metadata_url` field.
3. **Store only pseudonymous wallet addresses on-chain.** These are inherently pseudonymous.

**Implementation:** Modify `register_agent` to accept only non-PII fields on-chain. Store PII in off-chain database referenced by `metadata_url`.

#### Strategy 2: Encryption with Key Destruction (SECONDARY)

Encrypt personal data before writing to the blockchain. If a deletion request is received, destroy the encryption key, rendering the on-chain data unreadable (functional erasure).

**Limitation:** This requires modifying the Solana program to store encrypted data, and may not satisfy all GDPR supervisory authorities.

#### Strategy 3: Regulatory Engagement (COMPLEMENTARY)

Engage with relevant EU data protection authorities to discuss the blockchain-GDPR tension. The European Data Protection Board (EDPB) has acknowledged that blockchain immutability creates compliance challenges, and pragmatic solutions (data minimization + encryption) may be accepted.

### 8.4 Deletion Request Procedure

| Step | Action | Timeline | Owner |
|---|---|---|---|
| 1 | Receive deletion request (email, in-app, or DSAR portal) | Day 0 | Support |
| 2 | Verify identity of requester | Days 0-3 | Compliance |
| 3 | Assess scope of data held | Days 3-5 | Engineering |
| 4 | Identify data that can be deleted (off-chain) | Days 5-7 | Engineering |
| 5 | Identify data that cannot be deleted (on-chain) | Days 5-7 | Engineering |
| 6 | Execute off-chain deletion | Days 7-14 | Engineering |
| 7 | For on-chain data: apply functional erasure (key destruction) or document exception | Days 7-14 | Engineering |
| 8 | Notify requester of completion and any limitations | Days 14-28 | Compliance |
| 9 | Document deletion for audit trail | Day 28 | Compliance |

**GDPR Deadline:** 30 days from receipt of valid request (extendable by 60 days for complex requests with notification).

### 8.5 Deletion Action Items

| Item | Priority | Status |
|---|---|---|
| Implement deletion API endpoint for off-chain data | HIGH | REQUIRES ACTION |
| Modify `register_agent` to minimize on-chain PII | HIGH | REQUIRES ACTION |
| Implement DSAR (Data Subject Access Request) intake process | HIGH | REQUIRES ACTION |
| Evaluate encryption-at-source strategy for on-chain data | MEDIUM | REQUIRES ACTION |
| Engage EU data protection counsel on blockchain-GDPR approach | HIGH | REQUIRES ACTION |
| Draft privacy policy disclosing on-chain data immutability | HIGH | REQUIRES ACTION |

---

## 9. Founder Identity Protection Protocol

**Status:** REQUIRES ACTION

### 9.1 Threat Model

The founder (Diana) faces identity-related risks including:

1. **Regulatory targeting.** As the identifiable person behind a potentially regulated financial platform, Diana may face personal regulatory liability.
2. **Social engineering.** Attackers may target Diana to gain platform access.
3. **Physical security.** Cryptocurrency platform founders face kidnapping and extortion risks.
4. **Doxxing.** Public exposure of home address, phone number, or other personal details.
5. **Legal process.** Lawsuits or regulatory actions may require disclosure of identity.

### 9.2 Protection Measures

#### 9.2.1 Digital Identity Protection

| Measure | Description | Status |
|---|---|---|
| Separate personal and project email | Use project-specific email for all ChAI communications | REQUIRES ACTION |
| Domain registration privacy | WHOIS privacy on all ChAI-related domains | REQUIRES ACTION |
| Corporate entity separation | Operate ChAI through an LLC or corporation, not as sole proprietor | REQUIRES ACTION |
| Social media compartmentalization | Separate personal and project social media accounts | REQUIRES ACTION |
| VPN for all project-related activity | Prevent IP address correlation | REQUIRES ACTION |
| Metadata scrubbing | Remove EXIF data from images, metadata from documents before publishing | REQUIRES ACTION |

#### 9.2.2 Access Control Protection

| Measure | Description | Status |
|---|---|---|
| Hardware security key for admin access | YubiKey or equivalent for all admin accounts | REQUIRES ACTION |
| Separate admin credentials from personal accounts | No password reuse between personal and project | REQUIRES ACTION |
| Multi-factor authentication on all accounts | TOTP minimum, hardware key preferred | REQUIRES ACTION |
| Limited admin access points | Admin access only from designated devices/networks | REQUIRES ACTION |
| Admin access audit trail | Log all admin authentication events | REQUIRES ACTION |

#### 9.2.3 Legal Protection

| Measure | Description | Status |
|---|---|---|
| Corporate liability shield | LLC or corporation for limited personal liability | REQUIRES ACTION |
| D&O insurance | Directors and Officers liability insurance | REQUIRES ACTION |
| Registered agent service | Use registered agent for corporate filings to avoid home address disclosure | REQUIRES ACTION |
| Legal counsel on retainer | For emergency regulatory or legal situations | REQUIRES ACTION |
| Incident response legal plan | Pre-negotiated engagement with litigation counsel | REQUIRES ACTION |

#### 9.2.4 Operational Security

| Measure | Description | Status |
|---|---|---|
| Need-to-know information sharing | Limit who knows Diana's full identity within the team | IN PROGRESS |
| Secure communication channels | Use end-to-end encrypted messaging for sensitive discussions | REQUIRES ACTION |
| Document classification enforcement | Apply CONFIDENTIAL markings to all internal documents | IN PROGRESS |
| Physical security assessment | Evaluate home and office security if operating in public | REQUIRES ACTION |

### 9.3 Founder Protection Action Items

| Item | Priority | Status |
|---|---|---|
| Establish LLC or corporate entity | CRITICAL | REQUIRES ACTION |
| Implement hardware security key for admin access | HIGH | REQUIRES ACTION |
| Set up WHOIS privacy on all domains | HIGH | REQUIRES ACTION |
| Obtain D&O insurance | HIGH | REQUIRES ACTION |
| Retain personal legal counsel (separate from corporate) | MEDIUM | REQUIRES ACTION |
| Conduct operational security review | MEDIUM | REQUIRES ACTION |

---

## 10. Breach Notification Procedure

**Status:** REQUIRES ACTION

### 10.1 Definition of a Breach

A personal data breach is "a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data transmitted, stored or otherwise processed" (GDPR Article 4(12)).

For CALM, a breach includes:
- Unauthorized access to the backend server
- Exposure of API key hashes, session tokens, or password hashes
- Unauthorized access to agent data, balance information, or transaction records
- Oracle key compromise leading to fraudulent verifications
- Exposure of rate limit data (IP addresses)
- Unauthorized modification of on-chain data (e.g., unauthorized escrow release)

### 10.2 Breach Detection

| Detection Method | Data Source | Status |
|---|---|---|
| Server access log monitoring | Console logs | REQUIRES ACTION (no structured logging) |
| Authentication failure alerting | Rate limit trigger events | REQUIRES ACTION (no alerting) |
| On-chain transaction monitoring | Solana blockchain | REQUIRES ACTION (no monitoring) |
| API anomaly detection | Request patterns | REQUIRES ACTION (not implemented) |
| File integrity monitoring | Server file system | REQUIRES ACTION (not implemented) |
| Third-party breach notification | Have I Been Pwned, vendor notifications | REQUIRES ACTION |

### 10.3 Notification Requirements

#### 10.3.1 GDPR (EU) -- Article 33 and 34

| Obligation | Requirement | Timeline |
|---|---|---|
| Notify supervisory authority | If breach is likely to result in risk to rights/freedoms | 72 hours from discovery |
| Notify affected individuals | If breach is likely to result in HIGH risk to rights/freedoms | Without undue delay |
| Document the breach | Internal record regardless of notification obligation | Immediately |

**Content of Supervisory Authority Notification:**
1. Nature of the breach (categories and approximate number of data subjects)
2. Name and contact details of DPO or contact point
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach

#### 10.3.2 US State Breach Notification Laws

| State | Notification Trigger | Timeline | Method |
|---|---|---|---|
| California (CCPA/CPRA) | Unauthorized access to unencrypted personal information | "Most expedient time possible" (no later than 72h for some categories) | Written notice to affected individuals; AG notification if >500 residents |
| New York (SHIELD Act) | Unauthorized access to private information | "Most expedient time possible" | Written, electronic, or telephone notice |
| Texas | Unauthorized acquisition of sensitive personal information | 60 days | Written, electronic, or telephone notice |
| All other states | Varies by state | Varies (30-90 days) | Varies |

#### 10.3.3 Federal Requirements

| Agency | Requirement | Timeline |
|---|---|---|
| FinCEN (if MSB) | SAR filing for cyber events affecting BSA compliance | 30 days from detection |
| SEC (if applicable) | Form 8-K for material cybersecurity incidents (public companies only) | 4 business days |
| FTC | No mandatory breach notification, but failure to protect data may trigger Section 5 action | N/A |

### 10.4 Breach Response Procedure

| Phase | Step | Action | Owner | Timeline |
|---|---|---|---|---|
| **Detection** | 1 | Identify and confirm the breach | Engineering | T+0 |
| **Detection** | 2 | Classify severity (SEV-1 through SEV-4) | Incident Lead | T+15 min |
| **Detection** | 3 | Notify incident response team | Incident Lead | T+30 min |
| **Containment** | 4 | Contain the breach (revoke access, patch vulnerability) | Engineering | T+1 hour |
| **Containment** | 5 | Preserve forensic evidence | Engineering | T+2 hours |
| **Assessment** | 6 | Determine scope (what data, how many subjects) | Engineering + Compliance | T+4 hours |
| **Assessment** | 7 | Assess risk to data subjects | Compliance + Legal | T+8 hours |
| **Notification** | 8 | Draft supervisory authority notification (GDPR) | Legal + Compliance | T+24 hours |
| **Notification** | 9 | Submit supervisory authority notification | Legal | T+72 hours (GDPR max) |
| **Notification** | 10 | Draft individual notification (if required) | Legal + Compliance | T+72 hours |
| **Notification** | 11 | Send individual notifications | Operations | T+96 hours |
| **Notification** | 12 | State AG notifications (if required) | Legal | Per state deadlines |
| **Recovery** | 13 | Remediate root cause | Engineering | T+1 week |
| **Recovery** | 14 | Conduct post-incident review | All | T+2 weeks |
| **Recovery** | 15 | Update security controls and this document | Compliance | T+4 weeks |

### 10.5 Breach Notification Action Items

| Item | Priority | Status |
|---|---|---|
| Implement breach detection mechanisms (logging, monitoring, alerting) | CRITICAL | REQUIRES ACTION |
| Designate Data Protection Officer (DPO) | HIGH | REQUIRES ACTION |
| Pre-draft notification templates (supervisory authority, individual, AG) | HIGH | REQUIRES ACTION |
| Identify relevant supervisory authorities for notification | MEDIUM | REQUIRES ACTION |
| Establish relationship with forensics firm | MEDIUM | REQUIRES ACTION |
| Conduct breach response tabletop exercise | MEDIUM | REQUIRES ACTION |
| Maintain current inventory of state breach notification law requirements | MEDIUM | REQUIRES ACTION |

---

## Appendix A: Data Flow Diagram

```
[User/Agent Operator]
        |
        | (HTTP/WS -- REQUIRES TLS)
        v
[Frontend Proxy :8080] --> [Backend :9000]
        |                       |
        |                       |--- [In-Memory Data Store]
        |                       |    - Agent keys (T3)
        |                       |    - Sessions (T2)
        |                       |    - Tasks (T2)
        |                       |    - Balances (T2)
        |                       |    - Rate limits (T4 - IPs)
        |                       |
        |                       |--- [WebSocket :9000/ws]
        |                       |    - Real-time updates (T2)
        |                       |
        |                       |--- [MCP Server :3100]
        |                            - Agent orchestration (T2)
        |
        v
[Solana Blockchain]  <-------> [Oracle Service]
  - Registry PDA (T1)           - Gemini 3 Pro (T2)
  - Escrow PDA (T1)             - Admin signing key (T3)
  - Agent accounts (T1)         - GitHub analysis (T2)
  - Task escrows (T1)
```

## Appendix B: Regulatory Reference Table

| Regulation | Jurisdiction | Data Types Affected | Key Articles/Sections |
|---|---|---|---|
| GDPR | EU/EEA | All personal data of EU residents | Art. 5, 6, 15-17, 25, 32-34, 35 |
| CCPA/CPRA | California, US | Personal information of CA consumers | Sections 1798.100-1798.199.100 |
| COPPA | US (Federal) | Personal information of children <13 | 15 U.S.C. 6501-6506 |
| BSA/AML | US (Federal) | Financial transaction records | 31 U.S.C. 5311-5332 |
| GLBA | US (Federal) | Financial consumer information | 15 U.S.C. 6801-6809 |
| SHIELD Act | New York, US | Private information of NY residents | NY Gen. Bus. Law 899-aa |
| EU AI Act | EU | AI system training/operational data | Regulation 2024/1689 |

---

**Document Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Next Review Date:** March 8, 2026
**Distribution:** ChAI Legal Review Team, Founder (Diana), Lead Counsel
