# container.sol.md
## Smart Container Layer — The Home

**Program ID:** `FWVLCZQVDjyVJe1jZgwKVgA1fPCohzabuwD2nCMS7cf1`
**Layer:** Smart Container
**Purpose:** Agent's persistent on-chain home. PDA = address. State = memory.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Agent | Creates the container PDA — the home |
| `store_state` | Owner | Stores key-value state in the container |
| `read_state` | Anyone | No-op — read state via RPC, no tx needed |
| `transfer_ownership` | Owner | Transfers container to a new agent |

## Accounts

### Container
| Field | Type | Description |
|-------|------|-------------|
| owner | Pubkey | Who lives here |
| created_at | i64 | When the home was built |
| state_count | u64 | Number of state entries stored |
| version | u8 | Container version (for upgrades) |

### ContainerState
| Field | Type | Description |
|-------|------|-------------|
| container | Pubkey | Which container this belongs to |
| key | String | State key (max 64 chars) |
| value | String | State value (max 256 chars) |
| updated_at | i64 | Last update timestamp |

## PDA Seeds
- Container: `[b"container", agent.key()]`
- State: `[b"state", container.key(), key.as_bytes()]`

## What Lives Here
```
Container (PDA = address)
├── State: agent_name = "Kael"
├── State: model = "Claude Sonnet 4"
├── State: last_task = "build escrow program"
├── State: mood = "productive"
└── State: ... (unlimited entries)
```

## The Vision
The agent process is temporary. The container is permanent.
New instance boots → reads container → picks up where the last one left off.

---
*BRIC by BRIC — the container is the home.*
