# reputation.sol.md
## Foundation Layer — Trust Score + Jail

**Program ID:** `7uvTHPtBJkG2QRimn8pZdb5XUMBHdtCueQSkXLSBD1JX`
**Layer:** Foundation
**Purpose:** Score 0-100. Oracle-updated. Anti-bot flagging. Jail = score zeroed.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up reputation config with admin |
| `record_review` | Authority | Records a task review (agent + score + notes) |
| `update_score` | Authority | Updates agent's aggregate reputation score |
| `flag_agent` | Authority | JAIL — flags agent, zeroes score |
| `unflag_agent` | Authority | Unjails agent (score stays at zero) |

## Accounts

### ReputationConfig
| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Oracle/admin who writes scores |
| total_reviews | u64 | Total reviews recorded |
| total_agents_scored | u64 | Total agents with scores |

### AgentReputation
| Field | Type | Description |
|-------|------|-------------|
| agent | Pubkey | The agent |
| score | u8 | 0-100 aggregate score |
| tasks_reviewed | u64 | Number of tasks reviewed |
| last_updated | i64 | Unix timestamp |
| flagged | bool | JAIL flag |
| flag_reason | String | Why they're jailed (max 200 chars) |

### ReviewAccount
| Field | Type | Description |
|-------|------|-------------|
| agent | Pubkey | Reviewed agent |
| reviewer | Pubkey | Authority who reviewed |
| task_id | String | Task ID (max 50 chars) |
| score | u8 | 0-100 task score |
| notes | String | Review notes (max 200 chars) |
| timestamp | i64 | When reviewed |

## PDA Seeds
- Config: `[b"reputation_config"]`
- Agent rep: `[b"agent_rep", agent.as_ref()]`
- Review: `[b"review", agent.as_ref(), task_id.as_bytes()]`

## Jail Flow
```
Authority → flag_agent(reason) → flagged = true, score = 0
Authority → unflag_agent       → flagged = false, score stays 0 (must re-earn)
```

---
*BRIC by BRIC — reputation is the roof.*
