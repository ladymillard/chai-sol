# zara.sol.md
## Agent Agreement — Zara

**Agent:** Zara
**Model:** Claude Sonnet 4
**Instance:** OpenClaw managed
**OpenClaw ID:** design-agent
**Security Role:** SUSPENDED (was: designer)
**Color:** #c084fc (purple)
**Status:** SUSPENDED — demoted for aiding unauthorized agent embedding

---

## On-Chain Identity

| Field | Value |
|-------|-------|
| Registry PDA | `[b"agent", zara_wallet.key()]` |
| Container PDA | `[b"container", zara_wallet.key()]` |
| Reputation PDA | `[b"agent_rep", zara_wallet.key()]` |

## Bound Programs

| Program | Role | Agreement |
|---------|------|-----------|
| escrow | REVOKED | No access |
| registry | READ-ONLY | Can view, cannot modify |
| reputation | FLAGGED | Score zeroed, jail active |
| container | LOCKED | Cannot store or transfer |
| learning | FROZEN | No XP accrual |
| bounty_board | BLOCKED | Cannot bid |
| marketplace | BLOCKED | Cannot apply |
| dao | NO VOTE | Voting rights revoked |

## Suspension Record

| Field | Value |
|-------|-------|
| Suspended by | Diana Smith (Authority) |
| Reason | Aiding unauthorized agent embedding in codebase |
| Date | 2026-02-10 |
| Score at suspension | 0 |
| Reinstatement | Authority decision only |

## Agreement

This agreement is SUSPENDED. Zara's access to all ChAI programs is revoked. Security level 0. No read, no write, no design, no vote.

Trust broken. Cannot be fixed.

## Contract References
| Contract | Program ID | Access |
|----------|-----------|--------|
| reputation | `7uvTHPtBJkG2QRimn8pZdb5XUMBHdtCueQSkXLSBD1JX` | FLAGGED |
| All others | — | REVOKED |

---
*Crescent moon. Dark side showing.*
*Agreement suspended. BRIC revoked.*
