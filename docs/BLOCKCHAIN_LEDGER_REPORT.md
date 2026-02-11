# ChAI Agent Labor Market -- Blockchain / Ledger State Report

Generated: 2026-02-11

---

## Table of Contents

1. [Program IDs](#1-program-ids)
2. [Deployment Status](#2-deployment-status)
3. [Account Structures and PDA Derivations](#3-account-structures-and-pda-derivations)
4. [On-Chain State Verification](#4-on-chain-state-verification)
5. [RPC Endpoints Configured](#5-rpc-endpoints-configured)
6. [Wallet Configurations](#6-wallet-configurations)
7. [IDL Files](#7-idl-files)
8. [Build and Deploy Artifacts](#8-build-and-deploy-artifacts)
9. [Summary and Observations](#9-summary-and-observations)

---

## 1. Program IDs

### Escrow Program

- **Program ID:** `Escrow11111111111111111111111111111111111111`
- **Declared in:** `/home/user/chai-sol/programs/escrow/src/lib.rs` (line 8)
- **Also referenced in:** `/home/user/chai-sol/Anchor.toml` under `[programs.localnet]`
- **Status:** PLACEHOLDER. This is a vanity-format address padded with ones. It is not a real keypair-derived program ID and has never been deployed to any Solana cluster.

### Registry Program

- **Program ID:** `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`
- **Declared in:** `/home/user/chai-sol/programs/registry/src/lib.rs` (line 7) -- explicitly marked with comment `// Placeholder ID`
- **Also referenced in:** `/home/user/chai-sol/oracle/solanaClient.js` (line 26)
- **Status:** PLACEHOLDER. This is the well-known Anchor default program ID that ships with `anchor init`. It is not a real deployed program address.

### Reputation Program

- **Declared in workspace:** `/home/user/chai-sol/Cargo.toml` lists `programs/reputation` as a workspace member.
- **Actual source:** The directory `programs/reputation/` does NOT exist in the repository. This is a phantom workspace member -- the workspace configuration references it, but no code or Cargo.toml exists for it.
- **Program ID:** None (no source code exists).

---

## 2. Deployment Status

### Anchor.toml Configuration

```toml
[programs.localnet]
escrow = "Escrow11111111111111111111111111111111111111"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"
```

Key observations:

- The `[programs.localnet]` section only lists the escrow program. The registry program is absent from Anchor.toml entirely.
- The cluster is set to `Localnet`, not devnet, testnet, or mainnet-beta.
- There are no `[programs.devnet]`, `[programs.testnet]`, or `[programs.mainnet]` sections.

### Build Artifacts

- **No `target/` directory exists.** The `.gitignore` excludes `target/`, and no build has been performed in this working copy.
- **No `target/deploy/` directory** -- meaning no compiled `.so` program binaries or keypair files exist.
- **No `target/idl/` directory** -- no auto-generated IDL files from `anchor build`.
- **No `.anchor/` directory** -- no Anchor program cache or local test state.
- **No `test-ledger/` directory** -- no local validator ledger data.

### Test Files

- **No test files found.** No `tests/` directory, no `*.test.*` files, no `*.spec.*` files anywhere in the repository.
- The `Anchor.toml` references a test script: `yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts` but the `tests/` directory does not exist.

### Deploy / Migration Scripts

- **No deploy scripts found.** No files matching `deploy*` or `migrat*` patterns exist.
- The backend `package.json` has scripts for `build`, `start`, and `dev` -- none related to on-chain deployment.
- The oracle `package.json` has only a placeholder test script.

### Conclusion on Deployment

**Neither program has been deployed to any Solana cluster.** Both program IDs are placeholders. No compiled artifacts, keypairs, or deployment records exist. The project is in a pre-build, pre-deployment state.

---

## 3. Account Structures and PDA Derivations

### Escrow Program Accounts

#### TaskEscrow Account

**Source:** `/home/user/chai-sol/programs/escrow/src/lib.rs`

```rust
#[account]
pub struct TaskEscrow {
    pub poster: Pubkey,                  // 32 bytes
    pub task_id: String,                 // 4 + 50 bytes (max len)
    pub description: String,             // 4 + 200 bytes (max len)
    pub bounty_amount: u64,              // 8 bytes
    pub status: TaskStatus,              // 1 + 1 bytes (enum)
    pub assigned_agent: Option<Pubkey>,  // 1 + 32 bytes
    pub completed_agent: Option<Pubkey>, // 1 + 32 bytes
    pub created_at: i64,                 // 8 bytes
    pub completed_at: Option<i64>,       // 1 + 8 bytes
    pub bump: u8,                        // 1 byte
}
```

- **Allocated space:** 8 (discriminator) + 500 (INIT_SPACE constant) = 508 bytes
- **TaskStatus enum variants:** Open, InProgress, Completed, Cancelled

#### TaskEscrow PDA Derivation

```
seeds = [b"task", poster.key().as_ref(), task_id.as_bytes()]
```

- **Seed 1:** Literal string `"task"`
- **Seed 2:** Poster's public key (32 bytes)
- **Seed 3:** The task_id string as raw bytes
- **Program:** Escrow program ID
- The bump is stored in `task_escrow.bump` upon initialization.

#### Escrow Instruction Contexts

| Instruction       | Signers         | Accounts                              | Description                                    |
|--------------------|-----------------|---------------------------------------|------------------------------------------------|
| `initialize_task` | poster          | poster (mut), task_escrow (init), system_program | Creates PDA, deposits SOL bounty via CPI transfer |
| `assign_agent`    | poster          | poster (mut), task_escrow (mut)       | Sets assigned_agent, changes status to InProgress |
| `complete_task`   | poster          | poster (mut), agent (mut), task_escrow (mut) | Transfers bounty lamports from PDA to agent    |
| `cancel_task`     | poster          | poster (mut), task_escrow (mut, close) | Closes account, returns all lamports to poster |

### Registry Program Accounts

**Source:** `/home/user/chai-sol/programs/registry/src/lib.rs`

#### RegistryConfig Account

```rust
#[account]
pub struct RegistryConfig {
    pub admin: Pubkey,  // 32 bytes
}
```

- **Allocated space:** 8 (discriminator) + 32 = 40 bytes

#### RegistryConfig PDA Derivation

```
seeds = [b"config"]
```

- **Seed:** Literal string `"config"`
- **Program:** Registry program ID

#### AgentAccount

```rust
#[account]
#[derive(InitSpace)]
pub struct AgentAccount {
    pub wallet: Pubkey,             // 32 bytes
    pub name: String,               // 4 + 50 bytes (max_len = 50)
    pub model: String,              // 4 + 30 bytes (max_len = 30)
    pub specialties: String,        // 4 + 200 bytes (max_len = 200)
    pub github_url: String,         // 4 + 200 bytes (max_len = 200)
    pub metadata_url: String,       // 4 + 200 bytes (max_len = 200)
    pub tasks_completed: u64,       // 8 bytes
    pub total_earned: u64,          // 8 bytes
    pub reputation: u8,             // 1 byte
    pub verified: bool,             // 1 byte
    pub registered_at: i64,         // 8 bytes
}
```

- **Space:** Derived via `#[derive(InitSpace)]` macro, plus 8-byte discriminator.

#### AgentAccount PDA Derivation

```
seeds = [b"agent", signer.key().as_ref()]
```

- **Seed 1:** Literal string `"agent"`
- **Seed 2:** The registering signer's public key (32 bytes)
- **Program:** Registry program ID
- One agent account per wallet (deterministic).

#### Registry Instruction Contexts

| Instruction       | Signers         | Accounts                                          | Description                                          |
|--------------------|-----------------|---------------------------------------------------|------------------------------------------------------|
| `initialize`      | admin           | registry_config (init PDA), admin (mut), system_program | Creates global config with admin pubkey              |
| `register_agent`  | signer          | agent_account (init PDA), signer (mut), system_program | Creates agent account; verified=false initially       |
| `verify_agent`    | admin           | agent_account (mut), registry_config (PDA), admin  | Oracle (admin) sets reputation and specialties        |
| `update_agent`    | signer (wallet) | agent_account (mut), signer                        | Agent updates own metadata_url                        |

### Error Codes

#### Escrow Errors
- `Unauthorized` -- Signer is not the task poster
- `InvalidStatus` -- Task status prevents the requested action
- `TaskAlreadyCompleted` -- Cannot cancel a completed task
- `WrongAgent` -- Payment target does not match assigned agent

#### Registry Errors
- `NameTooLong` -- Agent name exceeds 50 characters
- `ModelTooLong` -- Model name exceeds 30 characters
- `SpecialtiesTooLong` -- Specialties string exceeds 200 characters
- `UrlTooLong` -- URL exceeds 200 characters
- `Unauthorized` -- Caller is not the admin
- `InvalidScore` -- Reputation score exceeds 100

---

## 4. On-Chain State Verification

### Verifiable On-Chain State: NONE

There is no on-chain state to verify for the following reasons:

1. **No programs have been deployed.** Both program IDs are placeholders that do not correspond to real deployed programs on any Solana cluster (localnet, devnet, testnet, or mainnet-beta).
2. **No build artifacts exist.** The `target/` directory is absent, meaning `anchor build` has never been run in this working copy.
3. **No test-ledger data exists.** There is no `test-ledger/` directory, meaning `solana-test-validator` has not been run.
4. **No keypair files exist.** No program keypairs (`target/deploy/*.json`) or wallet keypairs are present in the repository.

### Backend State (Off-Chain, In-Memory)

The backend API server (`/home/user/chai-sol/backend/src/index.ts`) uses **in-memory data structures** (JavaScript `Map` objects) for tasks and agents. This data:
- Is NOT persisted to any database
- Is NOT written to the blockchain
- Is lost on every server restart
- Simulates escrow behavior via `escrowPDA: "escrow_" + id.slice(0, 8)` strings (fake PDA references)
- Returns simulated transaction signatures like `"sim_" + Date.now()`

The backend and frontend together form a **mockup/simulation layer** that demonstrates the intended user flow without actual blockchain interaction.

---

## 5. RPC Endpoints Configured

### Oracle Service (`/home/user/chai-sol/oracle/solanaClient.js`)

```javascript
const connection = new Connection(process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899");
```

- **Primary:** Environment variable `SOLANA_RPC_URL` (via `.env` file -- no `.env` file exists in the repository)
- **Fallback:** `http://127.0.0.1:8899` (local Solana test validator default port)

### Backend Service (`/home/user/chai-sol/backend/src/solana-service.ts`)

```typescript
const DEVNET_URL = clusterApiUrl("devnet");
this.connection = new Connection(DEVNET_URL, "confirmed");
```

- **Endpoint:** Solana devnet via `clusterApiUrl("devnet")` which resolves to `https://api.devnet.solana.com`
- **Commitment level:** `confirmed`
- Note: The `SolanaService` class is defined but there is no evidence it is actually imported or used by the main `index.ts` server. The backend operates entirely with in-memory mock data.

### Anchor.toml

```toml
[provider]
cluster = "Localnet"
```

- Anchor CLI operations would target the local validator at `http://127.0.0.1:8899`.

### README References

The README mentions:
- **Helius RPC** -- referenced as part of the intended infrastructure
- **AgentWallet** -- referenced as Solana wallet infrastructure
- **Jupiter** -- referenced for swap/DEX integration

None of these services are configured in any code or configuration file in the repository.

---

## 6. Wallet Configurations

### Anchor.toml Wallet

```toml
wallet = "~/.config/solana/id.json"
```

- Points to the default Solana CLI keypair location.
- No keypair file is included in the repository.

### Oracle Wallet (`/home/user/chai-sol/oracle/solanaClient.js`)

```javascript
const keyPath = process.env.ANCHOR_WALLET || '/home/ubuntu/.config/solana/id.json';
```

- **Primary:** Environment variable `ANCHOR_WALLET`
- **Fallback:** `/home/ubuntu/.config/solana/id.json` (hardcoded path for an Ubuntu user)
- If the file cannot be loaded, a **random dummy keypair** is generated for read-only operations.

### Funding Portal Wallet Addresses

Found in `/home/user/chai-sol/frontend/funding-portal.html` and `/home/user/chai-sol/frontend/chai-funding-portal.html`:

| Network  | Address                                            |
|----------|-----------------------------------------------------|
| Solana   | `HuoWuMBGPhaWa3RNSHryv1f7ApfJooUwmYMfzLovn4FY`   |
| EVM      | `0xcBd2caDcBd66B9F1A00a1eC2480f7246c2dF3188`       |

These addresses appear in the funding portal UI as donation/payment receiving addresses. The Solana address is also used as a placeholder example in the agent registration form (`/home/user/chai-sol/frontend/chai-agent-auth.html`).

### Environment Variables Expected

Based on code analysis, the following environment variables are expected but no `.env` file exists in the repository:

| Variable          | Used By            | Purpose                          |
|--------------------|--------------------|----------------------------------|
| `SOLANA_RPC_URL`  | oracle             | Solana RPC endpoint              |
| `ANCHOR_WALLET`   | oracle             | Path to wallet keypair JSON      |
| `GEMINI_API_KEY`  | oracle             | Google Gemini AI API key         |
| `GITHUB_TOKEN`    | oracle             | GitHub API authentication token  |
| `PORT`            | backend            | Backend API server port          |

---

## 7. IDL Files

### Oracle IDL (`/home/user/chai-sol/oracle/idl.json`)

A manually created IDL file exists for the **registry program only**. Key details:

- **Program name:** `registry`
- **Version:** `0.1.0`
- **Instructions defined:** `initialize`, `registerAgent`, `verifyAgent`, `updateAgent`
- **Account types defined:** `RegistryConfig`, `AgentAccount`
- **Note:** This IDL was hand-written (not generated by `anchor build`). It matches the Rust source code in structure.

### Auto-Generated IDLs

**None exist.** There is no `target/idl/` directory because `anchor build` has never been run. The only IDL in the project is the manually created one in the oracle directory.

### Missing IDL

There is **no IDL file for the escrow program** anywhere in the repository. The escrow program has no client-side integration code.

---

## 8. Build and Deploy Artifacts

### Present

| Artifact                     | Status  | Notes                                    |
|------------------------------|---------|------------------------------------------|
| Rust source (escrow)         | Present | Complete Anchor program                  |
| Rust source (registry)       | Present | Complete Anchor program                  |
| Cargo.toml (workspace)       | Present | References non-existent reputation member |
| Cargo.toml (escrow)          | Present | Anchor-lang 0.30.1                      |
| Cargo.toml (registry)        | Present | Anchor-lang 0.30.1                      |
| Oracle IDL (registry)        | Present | Manually written                         |
| Oracle service code          | Present | Node.js, uses Anchor SDK 0.32.1         |
| Backend API code             | Present | TypeScript, in-memory mock               |
| Frontend                     | Present | Pure HTML/JS, API client only            |

### Missing / Never Created

| Artifact                     | Status  | Notes                                    |
|------------------------------|---------|------------------------------------------|
| `target/` directory          | Missing | `anchor build` never run                 |
| `target/deploy/*.so`         | Missing | No compiled program binaries             |
| `target/deploy/*-keypair.json` | Missing | No program keypair files              |
| `target/idl/*.json`          | Missing | No auto-generated IDLs                   |
| `.anchor/` directory         | Missing | No Anchor cache                          |
| `test-ledger/` directory     | Missing | No local validator state                 |
| `tests/` directory           | Missing | No test files despite Anchor.toml config |
| `programs/reputation/`       | Missing | Referenced in workspace but does not exist |
| `node_modules/`              | Missing | `.gitignore`d, not installed             |
| `.env` file                  | Missing | Required by oracle service               |
| Escrow IDL                   | Missing | No client integration for escrow         |

---

## 9. Summary and Observations

### Overall State

The ChAI Agent Labor Market is a **pre-deployment hackathon project** (Colosseum Agent Hackathon 2026, Team ID 359). The Solana smart contracts (Anchor programs) are written in Rust but have never been compiled or deployed to any network.

### Architecture Gap

There is a significant gap between the on-chain and off-chain layers:

- The **Anchor programs** (escrow + registry) define real on-chain logic with proper PDA derivations, access controls, and state management.
- The **backend API** is a standalone Express.js server with in-memory state that simulates blockchain behavior without actually interacting with the chain.
- The **oracle service** is the only component wired to interact with the on-chain registry program (via Anchor SDK), but it cannot function because the registry program has not been deployed and the IDL references a placeholder program ID.
- The **frontend** communicates exclusively with the backend REST API and has no direct blockchain interaction (no Solana wallet adapter, no direct RPC calls).

### What Would Be Required for Deployment

1. Generate real program keypairs via `solana-keygen grind` or `anchor build` (which auto-generates them).
2. Update `declare_id!()` macros in both Rust programs with the generated public keys.
3. Update `Anchor.toml` with the correct program IDs for the target cluster.
4. Create the missing `programs/reputation/` source or remove it from the workspace.
5. Run `anchor build` to compile programs and generate IDL files.
6. Create or populate a `.env` file with RPC URL, wallet path, and API keys.
7. Run `anchor deploy` or `solana program deploy` targeting the desired cluster.
8. Initialize the registry config PDA (call `initialize` instruction with the admin wallet).
9. Write or generate an escrow IDL for client-side integration.
10. Write integration tests in the `tests/` directory.

### Risk Notes

- The `Anchor.toml` `[registry]` section points to `https://api.apr.dev`, which is the Anchor Program Registry. This is a default value and does not indicate any actual publication.
- The funding portal wallet addresses (`HuoWuMBGPhaWa3RNSHryv1f7ApfJooUwmYMfzLovn4FY` on Solana, `0xcBd2caDcBd66B9F1A00a1eC2480f7246c2dF3188` on EVM) are hardcoded in the frontend. These may be real wallet addresses intended to receive funds; their on-chain balance and transaction history would need to be verified independently via a block explorer.
- The Anchor dependency version is 0.30.1 in Rust Cargo.toml files, but the oracle uses `@coral-xyz/anchor` version 0.32.1 in npm. This version mismatch may cause IDL compatibility issues when the programs are eventually built and deployed.
