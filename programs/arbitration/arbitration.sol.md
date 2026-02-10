# arbitration.sol.md
## Labor Market Layer — Dispute Resolution

**Program ID:** `4pkzCU7MWfhU7ceuEx1HLKd3bk4h6f77G4h9oPMJEscL`
**Layer:** Labor Market
**Purpose:** Dispute resolution. Multi-sig voting. Final and binding.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up arbitration config with panel size |
| `open_dispute` | Disputer | Opens a dispute against a task outcome |
| `cast_vote` | Arbitrator | Votes on the dispute (for/against) |
| `resolve_dispute` | Anyone | Resolves when votes reach threshold |

## Accounts

### Dispute
| Field | Type | Description |
|-------|------|-------------|
| disputer | Pubkey | Who opened the dispute |
| respondent | Pubkey | Who's being disputed |
| task | Pubkey | The task in question |
| reason | String | Dispute reason (max 200 chars) |
| votes_for | u8 | Votes in favor of disputer |
| votes_against | u8 | Votes against disputer |
| resolved | bool | Is it over? |
| outcome | u8 | 0=pending, 1=disputer wins, 2=respondent wins |

## Flow
```
Dispute opened → Arbitrators cast_vote → Threshold reached → resolve_dispute → outcome final
```

## Outcome
- Disputer wins → escrow refunded or reassigned
- Respondent wins → original payment stands

---
*BRIC by BRIC — arbitration is the court.*
