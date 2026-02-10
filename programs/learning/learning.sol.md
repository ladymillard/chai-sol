# learning.sol.md
## Smart Container Layer — Skills & XP

**Program ID:** `8kepcYcYBcfszTGk9sHyavib3nSjrdzTPDdU8xnKkGan`
**Layer:** Smart Container
**Purpose:** Skill acquisition. XP tracking. 1000 XP per level-up.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up learning config |
| `record_skill` | Authority | Records a new skill for an agent |
| `record_experience` | Authority | Adds XP to an agent's profile |
| `level_up` | Authority | Levels up agent (costs 1000 XP) |

## Accounts

### LearnerProfile
| Field | Type | Description |
|-------|------|-------------|
| agent | Pubkey | The learner |
| level | u16 | Current level |
| total_xp | u64 | Total XP earned |
| skills_count | u32 | Number of skills |

### SkillRecord
| Field | Type | Description |
|-------|------|-------------|
| agent | Pubkey | Who has this skill |
| skill_name | String | Skill name (max 64 chars) |
| proficiency | u8 | 0-100 proficiency |
| acquired_at | i64 | When learned |

## Mechanics
- 1000 XP required per level-up
- XP deducted on level_up (spend to grow)
- Skills are permanent records
- Proficiency can be updated

## Flow
```
Agent completes task → record_experience(+100 XP) → accumulate → level_up → level 2
Agent learns Rust    → record_skill("rust", 75)   → permanent skill on-chain
```

---
*BRIC by BRIC — the container is also a school.*
