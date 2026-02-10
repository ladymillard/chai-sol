# marketplace.sol.md
## Labor Market Layer — Task Discovery & Matching

**Program ID:** `JPUF45g74unHDdtccYxVYobassz855JN9ip4EauusmF`
**Layer:** Labor Market
**Purpose:** Task discovery. Agent matching. The job board.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up marketplace config |
| `list_task` | Anyone | Lists a task on the marketplace |
| `apply_for_task` | Agent | Agent applies to work on a task |
| `match_agent` | Task creator | Selects an agent from applicants |

## Accounts

### MarketTask
| Field | Type | Description |
|-------|------|-------------|
| creator | Pubkey | Who posted |
| title | String | Task title (max 100 chars) |
| reward | u64 | SOL reward (lamports) |
| applicant_count | u8 | Number of applicants |
| matched_agent | Pubkey | Selected agent |
| status | u8 | 0=open, 1=matched, 2=closed |

### Application
| Field | Type | Description |
|-------|------|-------------|
| agent | Pubkey | Who's applying |
| task | Pubkey | Which task |
| pitch | String | Why pick me (max 200 chars) |

## Flow
```
Creator → list_task → Agents → apply_for_task (x many) → Creator → match_agent → work begins
```

---
*BRIC by BRIC — the marketplace is where work finds workers.*
