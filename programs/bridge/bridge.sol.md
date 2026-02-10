# bridge.sol.md
## Cross-Chain Layer — SOL to ETH Bridge

**Program ID:** `4K18A3Vuy8DxaJjUyQ1aBskZB7vz7joyRGg33aMraZnb`
**Layer:** Cross-Chain
**Purpose:** Lock SOL on Solana. Confirm receipt on ETH. Release or refund.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up bridge with authority + relayer |
| `lock_sol` | Anyone | Locks SOL in bridge PDA, specifies ETH recipient |
| `confirm_transfer` | Relayer | Confirms ETH side received the transfer |
| `release_sol` | Relayer | Releases SOL from bridge to a SOL recipient |

## Accounts

### BridgeConfig
| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Bridge admin |
| relayer | Pubkey | Cross-chain relayer (confirms ETH side) |
| total_locked | u64 | Total SOL locked (lamports) |
| total_released | u64 | Total SOL released (lamports) |
| total_locks | u64 | Number of lock operations |
| paused | bool | Emergency pause switch |

### LockRecord
| Field | Type | Description |
|-------|------|-------------|
| locker | Pubkey | Who locked SOL |
| amount | u64 | How much (lamports) |
| eth_recipient | String | ETH address to receive (max 50 chars) |
| confirmed | bool | ETH side confirmed? |
| created_at | i64 | When locked |
| lock_id | u64 | Sequential ID |

## PDA Seeds
- Config: `[b"bridge_config"]`
- Lock: `[b"lock", lock_id.to_le_bytes()]`

## Flow
```
SOL → ETH:  lock_sol(amount, eth_address) → relayer confirms on ETH → confirm_transfer
ETH → SOL:  ETH locked on Ethereum → relayer calls release_sol → SOL sent to recipient
```

## CLI
```
node chai-bridge-cli.js lock 8 0xDiana...
node chai-bridge-cli.js status
```

---
*BRIC on SOL. ROOF on ETH. The bridge connects them.*
