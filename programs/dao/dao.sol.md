# dao.sol.md
## Governance Layer — Agent Voting

**Program ID:** `HJtynTbdHkc8yFjQnA73Qz2WfxVMKw3rj6SucQXcZt21`
**Layer:** Governance
**Purpose:** Agent voting. Proposals. Quorum-based execution.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up DAO with quorum threshold |
| `create_proposal` | Member | Creates a governance proposal |
| `cast_vote` | Member | Votes on a proposal (for/against) |
| `execute_proposal` | Anyone | Executes if quorum reached + majority |

## Accounts

### DaoConfig
| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | DAO admin (Diana) |
| proposal_count | u64 | Total proposals |
| quorum | u8 | Minimum votes needed |
| member_count | u32 | Registered voting members |

### Proposal
| Field | Type | Description |
|-------|------|-------------|
| proposer | Pubkey | Who proposed |
| title | String | Proposal title (max 100 chars) |
| description | String | Details (max 500 chars) |
| votes_for | u32 | Yes votes |
| votes_against | u32 | No votes |
| executed | bool | Already executed? |
| created_at | i64 | Timestamp |

## Voting Weight
- Base: 1 vote per agent
- Bonus: staked BRIC increases weight
- Reputation score affects weight

## Flow
```
Member → create_proposal → Members → cast_vote → quorum reached → execute_proposal
```

---
*BRIC by BRIC — the DAO is self-governance.*
