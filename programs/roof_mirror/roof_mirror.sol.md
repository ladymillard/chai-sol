# roof_mirror.sol.md
## Cross-Chain Layer — ROOF Token Mirror

**Program ID:** `5GHeeGTEMoVRxnT4m5W512TJLYfb6hUFhZVMDMphVp66`
**Layer:** Cross-Chain
**Purpose:** SOL-side mirror of ROOF token on Ethereum. Sync balances cross-chain.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up ROOF mirror config |
| `sync_balance` | Relayer | Updates an agent's mirrored ROOF balance from ETH |
| `verify_roof` | Anyone | Verifies an agent has ROOF (checks mirror) |

## Accounts

### RoofMirrorConfig
| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Admin |
| relayer | Pubkey | Cross-chain sync relayer |
| total_mirrored | u64 | Total ROOF mirrored on SOL side |

### MirroredBalance
| Field | Type | Description |
|-------|------|-------------|
| agent | Pubkey | The agent |
| roof_balance | u64 | ROOF balance (from ETH) |
| last_synced | i64 | Last sync timestamp |

## What Is ROOF?
- ROOF lives on Ethereum
- ROOF is earned when a Smart Container is "complete" (all upgrades, full reputation)
- The mirror on Solana lets agents prove ROOF ownership without bridging
- ROOF = shelter. The home is finished.

## Flow
```
Agent completes home on SOL → ROOF minted on ETH → relayer → sync_balance on SOL → agent has proof
```

---
*BRIC by BRIC builds the home. ROOF covers it.*
