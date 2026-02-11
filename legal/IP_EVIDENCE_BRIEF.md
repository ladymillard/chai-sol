# INTELLECTUAL PROPERTY EVIDENCE BRIEF

**Prepared for:** Legal Counsel
**Prepared by:** ChAI AI Ninja Team (MyCan / ladymillard)
**Date:** February 11, 2026
**Re:** Unauthorized reproduction of ChAI Agent Labor Market intellectual property

---

## 1. Executive Summary

This brief documents the chain of custody and provable authorship of all
intellectual property comprising the ChAI Agent Labor Market platform. Every
claim herein is backed by immutable, timestamped git commit records stored in
the repository at `github.com/ladymillard/chai-sol`.

The purpose of this brief is to provide legal counsel with:
- Clear evidence of original authorship and creation dates
- A complete chain of custody for all protected works
- Identification of known infringing parties
- Foundation for cease-and-desist enforcement, DMCA actions, and litigation

---

## 2. Copyright Holder

| Field | Value |
|-------|-------|
| Entity | ChAI AI Ninja Team |
| Operating As | MyCan / ladymillard |
| Contact | hello@mycan.website |
| Website | mycan.website |
| Repository | github.com/ladymillard/chai-sol |
| Hackathon Registration | Colosseum Agent Hackathon 2026, Team ID 359 |

---

## 3. Protected Works

### 3.1 Solana Smart Contracts

| Work | First Committed | Commit Hash | File Path |
|------|----------------|-------------|-----------|
| Escrow Program | 2026-02-06T04:13:23+00:00 | `f3ccaaac` | `programs/escrow/src/lib.rs` |
| Registry Program | 2026-02-06T04:34:46+00:00 | `f399a3da` | `programs/registry/src/lib.rs` |

These contracts implement:
- Task creation with SOL escrow and PDA-based fund custody
- Agent registration with on-chain reputation tracking
- Oracle verification flow using Gemini 3 AI
- Dispute resolution mechanisms

### 3.2 Oracle Verification Service

| Work | First Committed | Commit Hash | File Path |
|------|----------------|-------------|-----------|
| Gemini 3 Agent Vetting Service | 2026-02-06T20:18:48+00:00 | `f97b1f54` | `oracle/` |

### 3.3 Frontend Application

| Work | First Committed | Commit Hash | File Path |
|------|----------------|-------------|-----------|
| ChAI Frontend UI | 2026-02-06T04:08:13+00:00 | `5ad2ad98` | `frontend/` |
| MyCan Design System | 2026-02-06T13:00:21+00:00 | `88f939ba` | Integrated into frontend |

### 3.4 Backend API

| Work | First Committed | Commit Hash | File Path |
|------|----------------|-------------|-----------|
| Task Bounty Backend | 2026-02-06T04:10:21+00:00 | `05283e0f` | `backend/` |
| Command Center Server | 2026-02-06T01:18:24-05:00 | `8a03548d` | `command-center/` |

### 3.5 Funding Portal

| Work | First Committed | Commit Hash | File Path |
|------|----------------|-------------|-----------|
| NoCrypto + Crypto Funding | 2026-02-06T01:10:47-05:00 | `93383e6b` | `funding/` |

### 3.6 Documentation and Branding

All documentation, naming conventions, branding elements (ChAI, MyCan, CAN),
and architectural descriptions are original works created by the team and
constitute protectable expression under copyright law.

---

## 4. Chain of Custody — Full Commit Timeline

Every commit below is cryptographically signed with SHA-1 hashes and stored
in Git's immutable commit graph. These timestamps cannot be retroactively
falsified without detection.

| # | Timestamp (UTC unless noted) | Hash | Description |
|---|------------------------------|------|-------------|
| 1 | 2026-02-05 22:57:40 -0500 | `44ed056d` | Initial commit |
| 2 | 2026-02-06 03:58:50 | `0133d607` | Initial README |
| 3 | 2026-02-06 04:08:13 | `5ad2ad98` | Frontend UI |
| 4 | 2026-02-06 04:08:41 | `5d40053f` | Frontend README |
| 5 | 2026-02-06 04:10:21 | `05283e0f` | Backend API |
| 6 | 2026-02-06 04:11:04 | `d2e42c30` | Gitignore cleanup |
| 7 | 2026-02-06 04:13:23 | `f3ccaaac` | Anchor Escrow contract |
| 8 | 2026-02-06 04:28:36 | `8705c885` | Frontend-backend wiring |
| 9 | 2026-02-06 04:34:46 | `f399a3da` | Registry contract |
| 10 | 2026-02-06 04:37:46 | `1ebcf7f5` | Live API connection |
| 11 | 2026-02-06 04:38:21 | `b3ff2650` | Script fix |
| 12 | 2026-02-06 01:10:47 -0500 | `93383e6b` | Funding Portal |
| 13 | 2026-02-06 01:16:01 -0500 | `ba857492` | Command Center frontend |
| 14 | 2026-02-06 01:18:24 -0500 | `8a03548d` | Command Center backend |
| 15 | 2026-02-06 13:00:21 | `88f939ba` | CAN branding + security hardening |
| 16 | 2026-02-06 17:27:45 | `01a32067` | Oracle verification flow |
| 17 | 2026-02-06 20:18:48 | `f97b1f54` | Gemini 3 vetting service |
| 18 | 2026-02-11 02:55:57 | `eda722e6` | LICENSE + copyright headers |
| 19 | 2026-02-11 03:10:16 | `c957f225` | Cease and Desist notice |
| 20 | 2026-02-11 03:25:14 | `c8710850` | Full documentation package |

**Total span of original development:** ~21 hours (Feb 5 22:57 to Feb 6 20:18)

---

## 5. Known Infringing Parties

### 5.1 darkclaw.self.md

| Field | Value |
|-------|-------|
| Domain | darkclaw.self.md |
| Identified | 24-hour IP monitoring report |
| Ranking | #1 most-copied site in report period |
| Nature of Infringement | Substantial similarity to ChAI platform architecture, smart contract logic, UI design, and documentation |
| Status | Cease and Desist issued (see `legal/CEASE_AND_DESIST.md`) |

---

## 6. Methods of Proving Authorship

An attorney or court can verify these claims through:

1. **Git log verification** — `git log --all --format="%H %aI %s"` produces
   the complete, tamper-evident commit history with SHA-1 hashes and ISO 8601
   timestamps.

2. **GitHub server-side records** — GitHub independently records push
   timestamps, IP addresses, and authentication events. These can be
   subpoenaed.

3. **Colosseum hackathon records** — Team registration (ID 359), submission
   timestamps, and any associated communications confirm participation dates.

4. **Wayback Machine / web archives** — If the infringing party's site was
   cached, timestamps will show it appeared AFTER our commits.

5. **Code similarity analysis** — Tools such as MOSS, JPlag, or Codequiry can
   quantify the degree of similarity between our original code and the
   infringing copies.

---

## 7. Recommended Immediate Actions

1. **Serve Cease and Desist** — Finalize and transmit `legal/CEASE_AND_DESIST.md`
   to the operator of darkclaw.self.md.

2. **File DMCA Takedown** — Use `legal/DMCA_TAKEDOWN.md` (included in this
   package) to notify the hosting provider.

3. **Register Copyright** — File for federal copyright registration with the
   U.S. Copyright Office (copyright.gov). Registration is required before
   filing suit and enables statutory damages of up to $150,000 per infringed
   work.

4. **Preserve Evidence** — Archive the infringing site using the Wayback Machine
   (web.archive.org/save/) and local screenshots with timestamps.

5. **Notify Colosseum** — If the infringer submitted to the same hackathon,
   report the violation to organizers for disqualification.

---

## 8. Attachments

The following documents are included in the `legal/` directory of this repository:

| File | Description |
|------|-------------|
| `CEASE_AND_DESIST.md` | Ready-to-send C&D letter |
| `DMCA_TAKEDOWN.md` | DMCA takedown notice template |
| `LEGAL_DEFENSE_STRATEGY.md` | Full defense strategy memo |
| `IP_EVIDENCE_BRIEF.md` | This document |

The following documents in `docs/` provide supporting evidence:

| File | Description |
|------|-------------|
| `PROJECT_HISTORY.md` | Detailed development timeline |
| `SOLANA_TECHNICAL_WRITEUP.md` | Technical architecture documentation |
| `BLOCKCHAIN_LEDGER_REPORT.md` | On-chain state and deployment report |
| `CHAI_STORY.md` | Narrative for investors and legal proceedings |

---

**This brief is confidential and prepared for legal counsel.**

Copyright (c) 2026 ChAI AI Ninja Team (MyCan / ladymillard). All Rights Reserved.
