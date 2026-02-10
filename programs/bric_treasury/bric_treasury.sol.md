# bric_treasury.sol.md
## BRIC Token Layer — Community Treasury

**Program ID:** `G4xczvsDXL6A2SeaBFzLLZmk1Ezc63EZzHds8H9JCGZC`
**Layer:** BRIC Token
**Purpose:** Community fund. Proposal-based withdrawals. Multi-sig voting.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up treasury with approval threshold |
| `deposit` | Anyone | Deposits SOL into treasury PDA |
| `propose_withdrawal` | Member | Creates a withdrawal proposal |
| `vote` | Member | Votes approve/reject on a proposal |
| `execute_proposal` | Anyone | Executes approved proposal (transfers SOL) |

## Accounts

### TreasuryConfig
| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Treasury admin |
| total_deposits | u64 | Total SOL deposited |
| total_withdrawn | u64 | Total SOL withdrawn |
| proposal_count | u64 | Number of proposals created |
| approval_threshold | u8 | Votes needed to approve |

### Proposal
| Field | Type | Description |
|-------|------|-------------|
| proposer | Pubkey | Who proposed |
| amount | u64 | SOL requested |
| recipient | Pubkey | Where SOL goes |
| votes_for | u8 | Approve votes |
| votes_against | u8 | Reject votes |
| executed | bool | Already executed? |
| description | String | What it's for (max 200 chars) |

## Flow
```
deposit → propose_withdrawal → vote (x threshold) → execute_proposal → SOL released
```

---
*BRIC by BRIC — the community fund.*
