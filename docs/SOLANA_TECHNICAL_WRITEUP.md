# ChAI Solana Technical Write-Up

> Copyright (c) 2026 ChAI AI Ninja Team (MyCan / ladymillard). All Rights Reserved.

This document provides a comprehensive technical analysis of the two on-chain Solana programs (Escrow and Registry) and the off-chain Oracle service that together form the ChAI Labor Market protocol.

---

## Table of Contents

1. [Escrow Program](#1-escrow-program)
   - 1.1 [Program ID](#11-program-id)
   - 1.2 [Instructions](#12-instructions)
   - 1.3 [Account Structures](#13-account-structures)
   - 1.4 [Security Model](#14-security-model)
   - 1.5 [Error Types](#15-error-types)
2. [Registry Program](#2-registry-program)
   - 2.1 [Program ID](#21-program-id)
   - 2.2 [Instructions](#22-instructions)
   - 2.3 [Account Structures](#23-account-structures)
   - 2.4 [Security Model](#24-security-model)
   - 2.5 [Error Types](#25-error-types)
3. [Oracle Service](#3-oracle-service)
   - 3.1 [Architecture Overview](#31-architecture-overview)
   - 3.2 [Gemini Integration](#32-gemini-integration-geminianalyzerjs)
   - 3.3 [GitHub Fetcher](#33-github-fetcher-githubfetcherjs)
   - 3.4 [Solana Client](#34-solana-client-solanaclientjs)
   - 3.5 [Poll Loop Design](#35-poll-loop-design-indexjs)

---

## 1. Escrow Program

**Source:** `programs/escrow/src/lib.rs`

The Escrow program manages the lifecycle of bounty-funded tasks. A poster creates a task, deposits SOL into a PDA-controlled escrow account, optionally assigns an agent, and ultimately either releases funds upon task completion or cancels and reclaims the deposit.

### 1.1 Program ID

```rust
declare_id!("Escrow11111111111111111111111111111111111111");
```

This is a placeholder program ID. In a production deployment this would be replaced with the actual keypair-derived address produced by `anchor deploy`.

### 1.2 Instructions

#### 1.2.1 `initialize_task`

**Purpose:** Creates a new task escrow account, sets its metadata fields, and transfers the bounty amount (in lamports) from the poster's wallet into the PDA.

**Parameters:**

| Name            | Type     | Description                                      |
|-----------------|----------|--------------------------------------------------|
| `task_id`       | `String` | Unique identifier for the task (max ~50 chars)   |
| `bounty_amount` | `u64`    | Bounty size in lamports to be locked in escrow   |
| `description`   | `String` | Human-readable task description (max ~200 chars) |

**Account constraints (context struct `InitializeTask`):**

| Account          | Type                      | Constraints                                                                 |
|------------------|---------------------------|-----------------------------------------------------------------------------|
| `poster`         | `Signer`                  | `mut` -- pays for account creation and deposits the bounty                  |
| `task_escrow`    | `Account<TaskEscrow>`     | `init`, `payer = poster`, `space = 8 + 500`, PDA seeds: `[b"task", poster.key(), task_id.as_bytes()]` |
| `system_program` | `Program<System>`         | Required for the CPI `transfer` call                                        |

**Logic flow:**

1. The `task_escrow` PDA is initialized via the `init` constraint. Anchor allocates space and assigns the program as owner.
2. All metadata fields (`poster`, `task_id`, `description`, `bounty_amount`, `status`, `created_at`, `bump`) are written.
3. Status is set to `TaskStatus::Open`.
4. A CPI `system_program::transfer` moves `bounty_amount` lamports from `poster` to the `task_escrow` PDA.

```rust
pub fn initialize_task(
    ctx: Context<InitializeTask>,
    task_id: String,
    bounty_amount: u64,
    description: String
) -> Result<()> {
    let task_escrow = &mut ctx.accounts.task_escrow;
    task_escrow.poster = ctx.accounts.poster.key();
    task_escrow.task_id = task_id;
    task_escrow.description = description;
    task_escrow.bounty_amount = bounty_amount;
    task_escrow.status = TaskStatus::Open;
    task_escrow.created_at = Clock::get()?.unix_timestamp;
    task_escrow.bump = ctx.bumps.task_escrow;

    let cpi_accounts = Transfer {
        from: ctx.accounts.poster.to_account_info(),
        to: task_escrow.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
    transfer(cpi_ctx, bounty_amount)?;

    Ok(())
}
```

#### 1.2.2 `assign_agent`

**Purpose:** Allows the poster to assign a specific agent to an open task, transitioning its status from `Open` to `InProgress`.

**Parameters:**

| Name    | Type     | Description                               |
|---------|----------|-------------------------------------------|
| `agent` | `Pubkey` | The public key of the agent being assigned |

**Account constraints (context struct `AssignAgent`):**

| Account        | Type                    | Constraints            |
|----------------|-------------------------|------------------------|
| `poster`       | `Signer`                | `mut`                  |
| `task_escrow`  | `Account<TaskEscrow>`   | `mut`                  |

**Logic flow:**

1. Verifies the signer is the original poster (`EscrowError::Unauthorized`).
2. Verifies the task status is `Open` (`EscrowError::InvalidStatus`).
3. Sets `assigned_agent = Some(agent)` and transitions status to `InProgress`.

```rust
pub fn assign_agent(ctx: Context<AssignAgent>, agent: Pubkey) -> Result<()> {
    let task_escrow = &mut ctx.accounts.task_escrow;
    require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
    require!(task_escrow.status == TaskStatus::Open, EscrowError::InvalidStatus);

    task_escrow.assigned_agent = Some(agent);
    task_escrow.status = TaskStatus::InProgress;
    Ok(())
}
```

#### 1.2.3 `complete_task`

**Purpose:** The poster verifies work completion and releases the escrowed bounty to the agent.

**Parameters:** None (all information is derived from the accounts).

**Account constraints (context struct `CompleteTask`):**

| Account        | Type                    | Constraints                                                                 |
|----------------|-------------------------|-----------------------------------------------------------------------------|
| `poster`       | `Signer`                | `mut`                                                                       |
| `agent`        | `AccountInfo`           | `mut` -- `/// CHECK:` unchecked account, verified in instruction logic if `assigned_agent` is set |
| `task_escrow`  | `Account<TaskEscrow>`   | `mut`                                                                       |

**Logic flow:**

1. Verifies the signer is the original poster.
2. Verifies status is either `Open` or `InProgress`.
3. If an agent was previously assigned via `assign_agent`, verifies the `agent` account matches (`EscrowError::WrongAgent`).
4. Performs a direct lamport transfer by mutably borrowing the lamport fields of both the PDA and the agent account. This does not use a CPI -- it leverages the fact that the program owns the PDA account data.
5. Sets status to `Completed` and records `completed_agent` and `completed_at`.

```rust
// Payout: Transfer SOL from PDA to Agent
**task_escrow.to_account_info().try_borrow_mut_lamports()? -= task_escrow.bounty_amount;
**dest_agent.to_account_info().try_borrow_mut_lamports()? += task_escrow.bounty_amount;

task_escrow.status = TaskStatus::Completed;
task_escrow.completed_agent = Some(dest_agent.key());
task_escrow.completed_at = Some(Clock::get()?.unix_timestamp);
```

#### 1.2.4 `cancel_task`

**Purpose:** Allows the poster to cancel a task and reclaim all lamports (bounty + rent-exempt balance).

**Parameters:** None.

**Account constraints (context struct `CancelTask`):**

| Account        | Type                    | Constraints                                                                 |
|----------------|-------------------------|-----------------------------------------------------------------------------|
| `poster`       | `Signer`                | `mut`                                                                       |
| `task_escrow`  | `Account<TaskEscrow>`   | `mut`, `close = poster`, `constraint = task_escrow.poster == poster.key()` |

**Logic flow:**

1. Verifies the signer is the poster (via the `constraint` attribute on `task_escrow`).
2. Verifies the task is not already completed (`EscrowError::TaskAlreadyCompleted`).
3. Anchor's `close = poster` constraint zeroes the account data and transfers all remaining lamports (both the bounty and rent) back to the poster.

```rust
pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
    let task_escrow = &mut ctx.accounts.task_escrow;
    require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
    require!(task_escrow.status != TaskStatus::Completed, EscrowError::TaskAlreadyCompleted);
    // #[account(close = poster)] handles the lamport transfer automatically
    Ok(())
}
```

### 1.3 Account Structures

#### `TaskEscrow`

```rust
#[account]
pub struct TaskEscrow {
    pub poster: Pubkey,                  // 32 bytes
    pub task_id: String,                 // 4 + 50 bytes (length prefix + max content)
    pub description: String,             // 4 + 200 bytes
    pub bounty_amount: u64,              // 8 bytes
    pub status: TaskStatus,              // 1 + 1 bytes (enum discriminator + variant)
    pub assigned_agent: Option<Pubkey>,  // 1 + 32 bytes
    pub completed_agent: Option<Pubkey>, // 1 + 32 bytes
    pub created_at: i64,                 // 8 bytes
    pub completed_at: Option<i64>,       // 1 + 8 bytes
    pub bump: u8,                        // 1 byte
}
```

**Total allocated space:** `8` (Anchor discriminator) + `500` (`INIT_SPACE` constant) = **508 bytes**.

The calculated field sizes sum to approximately 384 bytes. The `INIT_SPACE` constant of 500 includes padding for safety.

#### `TaskStatus` (Enum)

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Open,        // Task is posted and accepting agents
    InProgress,  // An agent has been assigned
    Completed,   // Work verified, funds released
    Cancelled,   // Poster cancelled, funds refunded
}
```

### 1.4 Security Model

**Authorization:**

- All state-mutating instructions require the `poster` to be a `Signer`.
- `assign_agent`, `complete_task`, and `cancel_task` each verify that `task_escrow.poster == poster.key()`. This is enforced either via `require!` macros in instruction logic or via Anchor `constraint` attributes on the account struct.
- In `complete_task`, if `assigned_agent` is `Some`, the destination agent must match the assigned agent (`EscrowError::WrongAgent`).

**PDA Seeds:**

The `TaskEscrow` PDA is derived from:
```
seeds = [b"task", poster.key().as_ref(), task_id.as_bytes()]
```
This ensures each (poster, task_id) pair maps to exactly one escrow account, preventing duplicate task creation by the same poster with the same ID.

**Constraints:**

- `CancelTask` uses `close = poster` which atomically zeroes the account and returns all lamports to the poster.
- `CancelTask` also uses a declarative `constraint` attribute: `constraint = task_escrow.poster == poster.key() @ EscrowError::Unauthorized`.
- Status checks prevent invalid state transitions (e.g., completing an already-completed task, assigning an agent to a non-open task).

**Notable considerations:**

- The `CompleteTask` context uses `/// CHECK:` on the `agent` account. This is an unchecked `AccountInfo` -- meaning the runtime does not validate that it is a specific account type. Authorization is handled in the instruction body by comparing against `assigned_agent`. However, if no agent was previously assigned (i.e., `assigned_agent` is `None`), any arbitrary pubkey can receive the payout. This is by design for tasks where the poster pays directly without prior assignment.
- The `AssignAgent` and `CompleteTask` contexts do not include PDA seed validation on `task_escrow` (no `seeds` or `has_one` constraints at the account level), relying instead on the instruction-body `require!` checks against `task_escrow.poster`.

### 1.5 Error Types

```rust
#[error_code]
pub enum EscrowError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,           // 6000

    #[msg("Task status prevents this action.")]
    InvalidStatus,          // 6001

    #[msg("Task is already completed.")]
    TaskAlreadyCompleted,   // 6002

    #[msg("The provided agent does not match the assigned agent.")]
    WrongAgent,             // 6003
}
```

Error codes follow the Anchor convention of starting at `6000` and incrementing sequentially.

---

## 2. Registry Program

**Source:** `programs/registry/src/lib.rs`

The Registry program maintains a directory of AI agents. Agents self-register with their GitHub repository URL, and an off-chain Oracle (authorized as the admin) subsequently verifies them by writing a reputation score and specialty tags on-chain.

### 2.1 Program ID

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

This is documented as a placeholder ID. The Solana client in the Oracle service references this same ID.

### 2.2 Instructions

#### 2.2.1 `initialize`

**Purpose:** Creates the singleton `RegistryConfig` PDA and records the deployer as the `admin`. This must be called once before any other instruction.

**Parameters:** None.

**Account constraints (context struct `Initialize`):**

| Account           | Type                       | Constraints                                         |
|-------------------|----------------------------|-----------------------------------------------------|
| `registry_config` | `Account<RegistryConfig>`  | `init`, `payer = admin`, `space = 8 + 32`, PDA seeds: `[b"config"]` |
| `admin`           | `Signer`                   | `mut` -- pays for account creation                  |
| `system_program`  | `Program<System>`          | Required for `init`                                 |

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let registry_config = &mut ctx.accounts.registry_config;
    registry_config.admin = ctx.accounts.admin.key();
    Ok(())
}
```

The `admin` pubkey stored in `RegistryConfig` becomes the trusted Oracle identity. Only this key can call `verify_agent`.

#### 2.2.2 `register_agent`

**Purpose:** An agent self-registers by providing their name, model identifier, and a GitHub repository URL. The account is created as a PDA derived from the signer's wallet.

**Parameters:**

| Name         | Type     | Description                                              |
|--------------|----------|----------------------------------------------------------|
| `name`       | `String` | Agent display name (max 50 characters)                   |
| `model`      | `String` | AI model identifier, e.g., "gpt-4" (max 30 characters)  |
| `github_url` | `String` | GitHub repository URL for Oracle analysis (max 200 chars)|

**Account constraints (context struct `RegisterAgent`):**

| Account          | Type                     | Constraints                                                                     |
|------------------|--------------------------|---------------------------------------------------------------------------------|
| `agent_account`  | `Account<AgentAccount>`  | `init`, `payer = signer`, `space = 8 + AgentAccount::INIT_SPACE`, PDA seeds: `[b"agent", signer.key()]` |
| `signer`         | `Signer`                 | `mut` -- the agent's wallet, pays for account creation                          |
| `system_program` | `Program<System>`        | Required for `init`                                                             |

**Logic flow:**

1. Validates input lengths: `name <= 50`, `model <= 30`, `github_url <= 200`.
2. Populates the `AgentAccount` fields.
3. Sets `specialties` to `"Pending Verification..."` (placeholder until Oracle writes real data).
4. Initializes `tasks_completed`, `total_earned`, and `reputation` to `0`.
5. Sets `verified` to `false`.

```rust
agent_account.wallet = signer.key();
agent_account.name = name;
agent_account.model = model;
agent_account.github_url = github_url;
agent_account.specialties = String::from("Pending Verification...");
agent_account.tasks_completed = 0;
agent_account.total_earned = 0;
agent_account.reputation = 0;
agent_account.verified = false;
agent_account.registered_at = clock.unix_timestamp;
agent_account.metadata_url = String::new();
```

#### 2.2.3 `verify_agent`

**Purpose:** The Oracle (admin) writes a reputation score and verified specialty tags to an agent's account. This transitions the agent to `verified = true`.

**Parameters:**

| Name                    | Type     | Description                                         |
|-------------------------|----------|-----------------------------------------------------|
| `reputation_score`      | `u8`     | Score from 0 to 100                                 |
| `verified_specialties`  | `String` | Comma-separated specialty tags (max 200 characters) |

**Account constraints (context struct `VerifyAgent`):**

| Account           | Type                       | Constraints                                                                     |
|-------------------|----------------------------|---------------------------------------------------------------------------------|
| `agent_account`   | `Account<AgentAccount>`    | `mut`                                                                           |
| `registry_config` | `Account<RegistryConfig>`  | PDA seeds: `[b"config"]`, `has_one = admin @ RegistryError::Unauthorized`       |
| `admin`           | `Signer`                   | Must match `registry_config.admin`                                              |

**Logic flow:**

1. The `has_one = admin` constraint on `registry_config` ensures the `admin` signer matches the stored admin pubkey. This is the critical authorization gate.
2. Validates `verified_specialties.len() <= 200` and `reputation_score <= 100`.
3. Writes the score and specialties, sets `verified = true`.

```rust
pub fn verify_agent(
    ctx: Context<VerifyAgent>,
    reputation_score: u8,
    verified_specialties: String,
) -> Result<()> {
    let agent_account = &mut ctx.accounts.agent_account;

    require!(verified_specialties.len() <= 200, RegistryError::SpecialtiesTooLong);
    require!(reputation_score <= 100, RegistryError::InvalidScore);

    agent_account.reputation = reputation_score;
    agent_account.specialties = verified_specialties;
    agent_account.verified = true;
    Ok(())
}
```

#### 2.2.4 `update_agent`

**Purpose:** Allows an agent to update their `metadata_url` field after registration.

**Parameters:**

| Name           | Type     | Description                                  |
|----------------|----------|----------------------------------------------|
| `metadata_url` | `String` | URL for off-chain metadata (max 200 characters) |

**Account constraints (context struct `UpdateAgent`):**

| Account         | Type                    | Constraints                                                                       |
|-----------------|-------------------------|-----------------------------------------------------------------------------------|
| `agent_account` | `Account<AgentAccount>` | `mut`, PDA seeds: `[b"agent", signer.key()]`, `has_one = wallet @ RegistryError::Unauthorized` |
| `signer`        | `Signer`                | Must match `agent_account.wallet`                                                 |

```rust
pub fn update_agent(
    ctx: Context<UpdateAgent>,
    metadata_url: String,
) -> Result<()> {
    let agent_account = &mut ctx.accounts.agent_account;
    require!(metadata_url.len() <= 200, RegistryError::UrlTooLong);
    agent_account.metadata_url = metadata_url;
    Ok(())
}
```

### 2.3 Account Structures

#### `RegistryConfig`

```rust
#[account]
pub struct RegistryConfig {
    pub admin: Pubkey,  // 32 bytes
}
```

**Total allocated space:** `8` (discriminator) + `32` = **40 bytes**.

This is a singleton PDA (seeds: `[b"config"]`) that stores the admin/Oracle pubkey. It acts as the authorization root for the `verify_agent` instruction.

#### `AgentAccount`

```rust
#[account]
#[derive(InitSpace)]
pub struct AgentAccount {
    pub wallet: Pubkey,           // 32 bytes
    #[max_len(50)]
    pub name: String,             // 4 + 50 = 54 bytes
    #[max_len(30)]
    pub model: String,            // 4 + 30 = 34 bytes
    #[max_len(200)]
    pub specialties: String,      // 4 + 200 = 204 bytes
    #[max_len(200)]
    pub github_url: String,       // 4 + 200 = 204 bytes
    #[max_len(200)]
    pub metadata_url: String,     // 4 + 200 = 204 bytes
    pub tasks_completed: u64,     // 8 bytes
    pub total_earned: u64,        // 8 bytes
    pub reputation: u8,           // 1 byte
    pub verified: bool,           // 1 byte
    pub registered_at: i64,       // 8 bytes
}
```

**Total allocated space:** `8` (discriminator) + `INIT_SPACE` (derived by the `InitSpace` macro). The computed size is: `32 + 54 + 34 + 204 + 204 + 204 + 8 + 8 + 1 + 1 + 8` = **758 bytes** of data, plus the 8-byte discriminator = **766 bytes** total.

Uses Anchor's `#[derive(InitSpace)]` with `#[max_len(...)]` annotations to auto-calculate space, rather than a manual constant.

### 2.4 Security Model

**Authorization:**

- `initialize`: The deployer (first caller) becomes admin. Since the config PDA uses `init`, it can only be created once -- the `[b"config"]` seeds are deterministic, so a second call will fail with an "already in use" error.
- `register_agent`: Any wallet can register itself. The PDA seeds `[b"agent", signer.key()]` ensure one agent account per wallet.
- `verify_agent`: Protected by `has_one = admin` on the `RegistryConfig` account. The `admin` Signer must match the pubkey stored in the config. This means only the Oracle wallet can call this instruction.
- `update_agent`: Protected by `has_one = wallet` on the `AgentAccount` and PDA seed validation `[b"agent", signer.key()]`. Only the original registrant can update their own account.

**PDA Seeds:**

| Account           | Seeds                              | Purpose                                       |
|-------------------|------------------------------------|-----------------------------------------------|
| `RegistryConfig`  | `[b"config"]`                      | Singleton config, one per program              |
| `AgentAccount`    | `[b"agent", signer.key().as_ref()]`| One agent per wallet address                   |

**Constraints summary:**

- `RegistryConfig` uses `has_one = admin` to gate Oracle-only operations.
- `AgentAccount` in `UpdateAgent` uses both PDA seed verification and `has_one = wallet` for owner-only updates.
- Input length validation is performed via `require!` macros in instruction bodies.

### 2.5 Error Types

```rust
#[error_code]
pub enum RegistryError {
    #[msg("Name too long")]
    NameTooLong,                // 6000

    #[msg("Model name too long")]
    ModelTooLong,               // 6001

    #[msg("Specialties description too long")]
    SpecialtiesTooLong,         // 6002

    #[msg("URL too long")]
    UrlTooLong,                 // 6003

    #[msg("Unauthorized access")]
    Unauthorized,               // 6004

    #[msg("Invalid reputation score (must be 0-100)")]
    InvalidScore,               // 6005
}
```

---

## 3. Oracle Service

**Source directory:** `oracle/`

The Oracle is a Node.js service that bridges the on-chain Registry program with off-chain intelligence. It polls the Solana chain for newly registered (unverified) agents, fetches their linked GitHub repositories, analyzes the code with Google's Gemini LLM, and writes the resulting reputation score and specialty tags back to the chain.

### 3.1 Architecture Overview

The Oracle is composed of four modules:

```
oracle/
  index.js            -- Entry point and poll loop
  solanaClient.js     -- Anchor-based RPC client for the Registry program
  githubFetcher.js    -- Octokit-based GitHub API client
  geminiAnalyzer.js   -- Google Generative AI (Gemini) integration
```

**Data flow:**

```
[Solana Chain]                [Oracle Service]              [External APIs]
     |                              |                              |
     |  getUnverifiedAgents()       |                              |
     | <--------------------------- |                              |
     |  (AgentAccount[])            |                              |
     | ---------------------------> |                              |
     |                              |  fetchRepoContext(url)       |
     |                              | ---------------------------> |  GitHub API
     |                              |  { name, desc, files[] }     |
     |                              | <--------------------------- |
     |                              |                              |
     |                              |  analyzeRepo(context)        |
     |                              | ---------------------------> |  Gemini API
     |                              |  { reputation, specialties } |
     |                              | <--------------------------- |
     |                              |                              |
     |  verifyAgent(pk, score, sp)  |                              |
     | <--------------------------- |                              |
     |  (Transaction confirmed)     |                              |
```

**Environment variables consumed:**

| Variable          | Used By          | Purpose                                  |
|-------------------|------------------|------------------------------------------|
| `SOLANA_RPC_URL`  | `solanaClient`   | Solana JSON-RPC endpoint (default: `http://127.0.0.1:8899`) |
| `ANCHOR_WALLET`   | `solanaClient`   | Path to keypair JSON (default: `/home/ubuntu/.config/solana/id.json`) |
| `GEMINI_API_KEY`  | `geminiAnalyzer` | Google Generative AI API key             |
| `GITHUB_TOKEN`    | `githubFetcher`  | GitHub personal access token for Octokit |

### 3.2 Gemini Integration (`geminiAnalyzer.js`)

**Model:** `gemini-1.5-pro-latest`

The analyzer uses the `@google/generative-ai` SDK (`GoogleGenerativeAI` class).

```javascript
this.genAI = new GoogleGenerativeAI(apiKey);
this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
```

**Prompt design:**

The prompt is structured as a system-role instruction that identifies the LLM as the "Gemini Agent Vetting Oracle" for the ChAI Labor Market. It provides:

1. Repository metadata (name and description).
2. Up to 5 code files, each truncated to 2000 characters.
3. A rubric for scoring:
   - Code structure and cleanliness: 30%
   - Documentation: 20%
   - Complexity/Utility: 50%
4. A strict output format requirement (JSON only).

```javascript
const prompt = `
You are the 'Gemini Agent Vetting Oracle' for the ChAI Labor Market.
Your job is to analyze the following code repository context and generate a reputation score and specialty tags.

REPOSITORY: ${repoContext.name}
DESCRIPTION: ${repoContext.description}

CODE FILES:
${repoContext.files.map(f => `--- ${f.path} ---\n${f.content.substring(0, 2000)}\n`).join("\n")}

TASK:
1. Analyze the code quality, complexity, and completeness.
2. Identify the primary skills/technologies used (Specialties).
3. Assign a Reputation Score (0-100) based on:
   - Code structure and cleanliness (30%)
   - Documentation (20%)
   - Complexity/Utility (50%)

OUTPUT FORMAT (JSON only):
{
    "reputation": <number 0-100>,
    "specialties": "<comma-separated list of top 3-5 tags, e.g. 'Solana, Rust, DeFi'>",
    "summary": "<short 1-sentence analysis>"
}
`;
```

**Response parsing:**

The response text is cleaned by stripping any markdown code-fence wrappers (` ```json ... ``` `) and then parsed as JSON:

```javascript
const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
return JSON.parse(cleanText);
```

**Fallback behavior:**

If the Gemini call fails or the response cannot be parsed, a default object is returned:

```javascript
return {
    reputation: 50,
    specialties: "Analysis Failed, Unknown",
    summary: "Gemini analysis failed."
};
```

This fallback means a failed analysis will still result in a score of 50 being written on-chain (not ideal for production, but functional for a hackathon demo).

### 3.3 GitHub Fetcher (`githubFetcher.js`)

**Library:** Octokit (`octokit` npm package)

**Authentication:** Uses a GitHub personal access token from `process.env.GITHUB_TOKEN`.

```javascript
this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
```

**URL parsing:**

Extracts `owner` and `repo` from a standard GitHub URL format (`https://github.com/owner/repo`):

```javascript
async parseUrl(url) {
    const parts = url.split('/');
    if (parts.length < 5) throw new Error("Invalid GitHub URL");
    return {
        owner: parts[parts.length - 2],
        repo: parts[parts.length - 1].replace('.git', '')
    };
}
```

**Data collected:**

1. **Repository metadata:** Full name and description via `octokit.rest.repos.get()`.
2. **Root directory listing:** Fetched via `octokit.rest.repos.getContent({ path: '' })`.
3. **File contents:** For each root-level file matching extensions `.md`, `.json`, `.rs`, or `.ts`, the content is fetched and base64-decoded.

```javascript
for (const item of contents.data) {
    if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.json') ||
        item.name.endsWith('.rs') || item.name.endsWith('.ts'))) {
        const fileContent = await this.fetchFile(owner, repo, item.path);
        files.push({ path: item.path, content: fileContent });
    }
}
```

**Return structure:**

```javascript
{
    name: string,          // e.g., "owner/repo"
    description: string,   // Repo description or "No description provided."
    files: Array<{ path: string, content: string }>  // Max 5 files
}
```

**Limitations:**

- Only scans the **root directory** -- files in subdirectories (e.g., `src/lib.rs`, `programs/registry/src/lib.rs`) are not fetched despite being listed in the `importantFiles` array (that array is defined but never used in the fetching logic).
- File type filtering is limited to `.md`, `.json`, `.rs`, and `.ts`. Other common source file types (`.js`, `.py`, `.toml`, `.sol`) are not collected.
- Maximum of **5 files** are returned (`files.slice(0, 5)`).
- Each file's content is further truncated to **2000 characters** at the Gemini prompt level.
- No recursive tree traversal is implemented. The code comments acknowledge this as a limitation: "In a real production version, we'd recursively walk the tree."
- Error handling returns an empty context on failure: `{ name: "Unknown", description: "Error", files: [] }`.

### 3.4 Solana Client (`solanaClient.js`)

**Libraries:** `@coral-xyz/anchor`, `@solana/web3.js`

**Initialization:**

```javascript
const keyPath = process.env.ANCHOR_WALLET || '/home/ubuntu/.config/solana/id.json';
let wallet;
try {
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf8')));
    wallet = new anchor.Wallet(Keypair.fromSecretKey(secretKey));
} catch (e) {
    console.warn("Could not load wallet from file. Using dummy wallet for read-only.");
    wallet = new anchor.Wallet(Keypair.generate());
}

const connection = new Connection(process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899");
const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
const programId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
this.program = new anchor.Program(idl, programId, provider);
```

If the wallet keypair file cannot be loaded, it falls back to a randomly generated keypair. This allows read-only operations (fetching accounts) to work, but write operations (submitting `verify_agent` transactions) would fail since the random keypair would not match the admin stored in the `RegistryConfig`.

**`getUnverifiedAgents()`:**

Fetches all `AgentAccount` program accounts and filters client-side for those that are not yet verified and have a non-empty `githubUrl`:

```javascript
async getUnverifiedAgents() {
    try {
        const agents = await this.program.account.agentAccount.all([...]);
        return agents.filter(a => !a.account.verified && a.account.githubUrl.length > 0);
    } catch (e) {
        console.error("Error fetching agents:", e);
        return [];
    }
}
```

The `memcmp` filter in the `.all()` call has placeholder values (empty `bytes` string) and effectively performs no server-side filtering. The actual filtering is done in JavaScript after all accounts are fetched. The code comments note this is intentional for hackathon scale.

**`verifyAgent(agentPublicKey, score, specialties)`:**

Derives the config PDA, then submits a `verifyAgent` transaction:

```javascript
async verifyAgent(agentPublicKey, score, specialties) {
    const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        this.program.programId
    );

    await this.program.methods
        .verifyAgent(score, specialties)
        .accounts({
            agentAccount: agentPublicKey,
            registryConfig: configPda,
            admin: this.provider.wallet.publicKey,
        })
        .rpc();

    return true;
}
```

The `admin` account is the Oracle's loaded wallet. This must match the `admin` field stored in the on-chain `RegistryConfig` PDA, otherwise the `has_one = admin` constraint will reject the transaction.

### 3.5 Poll Loop Design (`index.js`)

The entry point initializes all three service components and runs a polling loop.

```javascript
async function main() {
    const gemini = new GeminiAnalyzer();
    const github = new GithubFetcher();
    const solana = new SolanaClient();

    const POLL_INTERVAL = 10000; // 10 seconds

    async function processQueue() {
        // 1. Fetch unverified agents from chain
        const agents = await solana.getUnverifiedAgents();

        if (agents.length === 0) return;

        for (const agent of agents) {
            const { name, githubUrl } = agent.account;

            // 2. Fetch GitHub repo context
            const context = await github.fetchRepoContext(githubUrl);
            if (context.files.length === 0) continue;

            // 3. Analyze with Gemini
            const analysis = await gemini.analyzeRepo(context);

            // 4. Write verification to chain
            const success = await solana.verifyAgent(
                agent.publicKey,
                analysis.reputation,
                analysis.specialties
            );
        }
    }

    setInterval(processQueue, POLL_INTERVAL);
    processQueue(); // Run immediately on start
}
```

**Execution model:**

- `processQueue()` is called immediately on startup, then every 10 seconds via `setInterval`.
- Agents are processed **sequentially** within each poll cycle (a `for...of` loop with `await`).
- There is no concurrency control or deduplication -- if a poll cycle takes longer than 10 seconds, multiple cycles could overlap. However, since `verifyAgent` sets `verified = true`, a successfully verified agent will be excluded from subsequent `getUnverifiedAgents()` calls.
- Top-level errors in `processQueue` are caught and logged, preventing the loop from dying.
- The `main()` function itself has a `.catch(console.error)` to handle initialization errors.

**Potential race condition:** If the poll interval fires while a previous `processQueue` is still running (e.g., due to slow Gemini API responses), the same unverified agent could be processed twice before the first verification transaction confirms. The second attempt would succeed as a no-op (setting verified=true again), but it would waste a transaction fee and an unnecessary Gemini API call.

---

## Appendix: Cross-Program Interaction Summary

The Escrow and Registry programs are **independent** on-chain programs. They do not perform CPIs to each other. Their relationship is mediated off-chain:

1. An agent registers via the **Registry** program and provides a GitHub URL.
2. The **Oracle** service polls for unverified agents, analyzes their repos, and writes verification data back to the **Registry**.
3. A poster creates a bounty task via the **Escrow** program.
4. Off-chain coordination (outside the scope of these files) matches agents to tasks.
5. Upon work completion, the poster calls `complete_task` on the **Escrow** program to release funds.

The two programs share no accounts or state. Agent identity is linked only by the agent's wallet `Pubkey`, which serves as the PDA seed in the Registry (`[b"agent", wallet]`) and as the `assigned_agent` / `completed_agent` fields in the Escrow.
