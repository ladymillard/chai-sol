# escrow.sol.md
## Foundation Layer — Task Payment Escrow

**Program ID:** `CfiDHPMS7fobyGCMnp4iVu7w1vYNTc7AsYUmLTbAK3JV`
**Layer:** Foundation
**Purpose:** Lock SOL in PDA. Release on task completion. Refund on cancel.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize_task` | Task creator | Creates task PDA, locks SOL in escrow |
| `assign_agent` | Task creator | Assigns an agent to the task |
| `complete_task` | Task creator | Releases escrowed SOL to assigned agent |
| `cancel_task` | Task creator | Refunds escrowed SOL to creator |

## Accounts

### TaskAccount
| Field | Type | Description |
|-------|------|-------------|
| creator | Pubkey | Who posted the task |
| agent | Pubkey | Who's assigned to do it |
| amount | u64 | SOL locked in escrow (lamports) |
| status | u8 | 0=open, 1=assigned, 2=completed, 3=cancelled |
| title | String | Task title (max 100 chars) |
| description | String | Task description (max 500 chars) |

## PDA Seeds
- Task: `[b"task", creator.key(), task_id.as_bytes()]`

## Flow
```
Creator → initialize_task (SOL locked) → assign_agent → complete_task → SOL released to agent
                                                       → cancel_task  → SOL refunded to creator
```

---
*BRIC by BRIC — escrow is the floor.*
