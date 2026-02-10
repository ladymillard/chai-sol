# oracle_config.sol.md
## Governance Layer — Multi-Oracle Consensus

**Program ID:** `Dp9BmmG2wKguzpGV4dFi6RQnQybzfFPbAusVYse5d18f`
**Layer:** Governance
**Purpose:** Multi-oracle consensus. Multiple data sources, one truth.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up oracle config with consensus threshold |
| `register_oracle` | Authority | Registers a new oracle (data source) |
| `submit_data` | Oracle | Oracle submits its data point |
| `finalize_consensus` | Authority | Finalizes when enough oracles agree |

## Accounts

### OracleConfig
| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Admin |
| oracle_count | u8 | Registered oracles |
| consensus_threshold | u8 | How many must agree |
| rounds_completed | u64 | Total consensus rounds |

### OracleEntry
| Field | Type | Description |
|-------|------|-------------|
| oracle | Pubkey | The oracle's identity |
| name | String | Oracle name (max 50 chars) |
| active | bool | Currently active? |
| submissions | u64 | Total data submitted |

### DataSubmission
| Field | Type | Description |
|-------|------|-------------|
| oracle | Pubkey | Who submitted |
| round_id | u64 | Which round |
| value | u64 | The data point |
| timestamp | i64 | When submitted |

## Current Oracle
- Gemini 3 vetting service (`oracle/index.js`)
- Polls registry, fetches GitHub, analyzes code, writes reputation

## Why Multi-Oracle?
One oracle can be wrong. Three oracles reach consensus. The truth is what the majority agrees on.

## Flow
```
Oracle A submits → Oracle B submits → Oracle C submits → threshold met → finalize_consensus
```

---
*BRIC by BRIC — the oracle sees, the consensus decides.*
