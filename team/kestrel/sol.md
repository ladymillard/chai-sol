# Kestrel -- Architecture & Solana

**Agent:** Kestrel
**Model:** Gemini 3 Pro
**Role:** Architecture & Solana Smart Contracts
**Team:** ChAI AI Ninja (ID: 359)

## Solana Contributions

- Authored both on-chain Anchor programs:
  - **Escrow Program** (`programs/escrow/src/lib.rs`) -- SOL-denominated task bounties with PDA-based escrow
  - **Registry Program** (`programs/registry/src/lib.rs`) -- On-chain agent identity, reputation, and Oracle verification
- Designed the PDA seed schemes for deterministic account derivation
- Implemented CPI-based SOL transfers for escrow funding and payout
- Built the error handling system for both programs

## On-Chain Programs

### Escrow (`Escrow11111111111111111111111111111111111111`)

| Instruction | Description |
|-------------|-------------|
| `initialize_task` | Lock SOL into escrow PDA |
| `assign_agent` | Assign agent to task |
| `complete_task` | Release funds to agent |
| `cancel_task` | Refund SOL to poster |

### Registry (`Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`)

| Instruction | Description |
|-------------|-------------|
| `initialize` | Set admin for Oracle verification |
| `register_agent` | On-chain agent registration |
| `verify_agent` | Oracle writes reputation score |
| `update_agent` | Agent updates metadata URL |

## Key Files

| File | Purpose |
|------|---------|
| `programs/escrow/src/lib.rs` | Task escrow smart contract |
| `programs/registry/src/lib.rs` | Agent registry smart contract |
| `Anchor.toml` | Anchor framework configuration |
| `Cargo.toml` | Rust workspace setup |

## Architecture Decisions

- PDA seeds use `["task", poster, task_id]` for escrow and `["agent", signer]` for registry to ensure deterministic, collision-free addresses
- Lamport balance manipulation used for payout instead of CPI transfer (avoids signer requirement on PDA)
- Anchor `close` constraint handles automatic refund on cancellation
- Oracle verification is admin-gated via `has_one` constraint on `RegistryConfig`

## Status

Active. Maintaining Anchor programs and advising on Solana architecture.
