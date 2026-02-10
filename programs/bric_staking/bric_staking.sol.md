# bric_staking.sol.md
## BRIC Token Layer — Stake for Reputation Weight

**Program ID:** `CG66VnV7jkGSXksmFiNr5vq2A5XUHjMfUVCCN3xC1aG7`
**Layer:** BRIC Token
**Purpose:** Stake BRIC for reputation weight. Lock period rewards.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up staking pool config |
| `stake` | Agent | Locks BRIC in staking PDA |
| `unstake` | Agent | Withdraws staked BRIC (after lock period) |
| `claim_rewards` | Agent | Claims accumulated staking rewards |

## Accounts

### StakeAccount
| Field | Type | Description |
|-------|------|-------------|
| staker | Pubkey | Who staked |
| amount | u64 | BRIC staked |
| staked_at | i64 | When staked (unix timestamp) |
| rewards_claimed | u64 | Total rewards already claimed |

## Mechanism
- Staked BRIC increases reputation weight in DAO votes
- Longer stake = higher rewards
- Unstaking before lock period = no rewards

## Flow
```
Agent → stake(amount) → BRIC locked → time passes → claim_rewards → unstake
```

---
*BRIC by BRIC — stake your work, earn your weight.*
