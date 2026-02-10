# upgrade.sol.md
## Smart Container Layer — Evolution

**Program ID:** `BYqv3YLiNBHYe14C3UNpXWd9fh8u1o8MCKyC9DBv7PAF`
**Layer:** Smart Container
**Purpose:** Container evolution. Storage, compute, network, security tiers.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up upgrade config with base costs |
| `request_upgrade` | Agent | Requests an upgrade (costs BRIC) |
| `approve_upgrade` | Authority | Approves the upgrade request |
| `apply_upgrade` | Authority | Applies the upgrade to the container |

## Upgrade Types

| Type | ID | What It Does | Cost Multiplier |
|------|----|-------------|-----------------|
| Storage | 0 | More state slots in container | 1x base |
| Compute | 1 | Faster task processing priority | 2x base |
| Network | 2 | More neighborhood links | 3x base |
| Security | 3 | Enhanced container protection | 4x base |

## Accounts

### UpgradeRequest
| Field | Type | Description |
|-------|------|-------------|
| agent | Pubkey | Who's requesting |
| upgrade_type | u8 | 0-3 (storage/compute/network/security) |
| cost | u64 | BRIC cost |
| approved | bool | Authority approved? |
| applied | bool | Already applied? |

## Flow
```
Agent → request_upgrade(type=2, network) → Authority → approve_upgrade → apply_upgrade
Cost: base_cost * (upgrade_type + 1)
```

## The Renovation
The container starts small. Upgrades expand it. Storage for more state. Network for more neighbors. Security for protection. Compute for priority.

---
*BRIC by BRIC — the renovation makes the home bigger.*
