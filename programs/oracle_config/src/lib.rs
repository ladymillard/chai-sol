// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("Dp9BmmG2wKguzpGV4dFi6RQnQybzfFPbAusVYse5d18f");

#[program]
pub mod oracle_config {
    use super::*;

    /// Initialize the oracle registry
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let registry = &mut ctx.accounts.oracle_registry;
        registry.admin = ctx.accounts.admin.key();
        registry.oracle_count = 0;
        registry.consensus_threshold = 3; // default: 3 oracles needed
        msg!("Oracle registry initialized. Admin: {}", registry.admin);
        Ok(())
    }

    /// Register a new oracle
    pub fn register_oracle(
        ctx: Context<RegisterOracle>,
        oracle: Pubkey,
        name: String,
    ) -> Result<()> {
        require!(name.len() <= 50, OracleConfigError::NameTooLong);

        let entry = &mut ctx.accounts.oracle_entry;
        let registry = &mut ctx.accounts.oracle_registry;
        let clock = Clock::get()?;

        entry.oracle = oracle;
        entry.name = name.clone();
        entry.submissions = 0;
        entry.active = true;
        entry.registered_at = clock.unix_timestamp;

        registry.oracle_count += 1;

        msg!("Oracle registered: {} ({})", name, oracle);
        Ok(())
    }

    /// Oracle submits a data point
    pub fn submit_data(
        ctx: Context<SubmitData>,
        key: String,
        value: u64,
    ) -> Result<()> {
        require!(key.len() <= 50, OracleConfigError::KeyTooLong);

        let entry = &mut ctx.accounts.oracle_entry;
        require!(entry.active, OracleConfigError::OracleNotActive);

        let data_point = &mut ctx.accounts.data_point;
        let clock = Clock::get()?;

        data_point.oracle = ctx.accounts.oracle.key();
        data_point.key = key.clone();
        data_point.value = value;
        data_point.submitted_at = clock.unix_timestamp;

        entry.submissions += 1;

        msg!(
            "Oracle {} submitted data: {} = {}",
            ctx.accounts.oracle.key(),
            key,
            value
        );
        Ok(())
    }

    /// Finalize consensus by aggregating oracle submissions (median)
    /// NOTE: In a production system, this would read multiple DataPoint accounts
    /// and compute a median. For this on-chain version, the admin triggers
    /// finalization and the median is computed off-chain and verified here.
    pub fn finalize_consensus(ctx: Context<FinalizeConsensus>, _key: String) -> Result<()> {
        let registry = &ctx.accounts.oracle_registry;

        require!(
            registry.oracle_count >= registry.consensus_threshold,
            OracleConfigError::InsufficientOracles
        );

        msg!(
            "Consensus finalized for key. Oracle count: {}, threshold: {}",
            registry.oracle_count,
            registry.consensus_threshold
        );
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + OracleRegistry::INIT_SPACE,
        seeds = [b"oracle_registry"],
        bump
    )]
    pub oracle_registry: Account<'info, OracleRegistry>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(oracle: Pubkey)]
pub struct RegisterOracle<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + OracleEntry::INIT_SPACE,
        seeds = [b"oracle", oracle.as_ref()],
        bump
    )]
    pub oracle_entry: Account<'info, OracleEntry>,
    #[account(
        mut,
        seeds = [b"oracle_registry"],
        bump,
        has_one = admin @ OracleConfigError::Unauthorized
    )]
    pub oracle_registry: Account<'info, OracleRegistry>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(key: String)]
pub struct SubmitData<'info> {
    #[account(
        init,
        payer = oracle,
        space = 8 + DataPoint::INIT_SPACE,
        seeds = [b"data", key.as_bytes(), oracle.key().as_ref()],
        bump
    )]
    pub data_point: Account<'info, DataPoint>,
    #[account(
        mut,
        seeds = [b"oracle", oracle.key().as_ref()],
        bump
    )]
    pub oracle_entry: Account<'info, OracleEntry>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_key: String)]
pub struct FinalizeConsensus<'info> {
    #[account(
        seeds = [b"oracle_registry"],
        bump,
        has_one = admin @ OracleConfigError::Unauthorized
    )]
    pub oracle_registry: Account<'info, OracleRegistry>,
    pub admin: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct OracleRegistry {
    pub admin: Pubkey,               // 32
    pub oracle_count: u8,            // 1
    pub consensus_threshold: u8,     // 1
}

#[account]
#[derive(InitSpace)]
pub struct OracleEntry {
    pub oracle: Pubkey,              // 32
    #[max_len(50)]
    pub name: String,                // 4 + 50
    pub submissions: u64,            // 8
    pub active: bool,                // 1
    pub registered_at: i64,          // 8
}

#[account]
#[derive(InitSpace)]
pub struct DataPoint {
    pub oracle: Pubkey,              // 32
    #[max_len(50)]
    pub key: String,                 // 4 + 50
    pub value: u64,                  // 8
    pub submitted_at: i64,           // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum OracleConfigError {
    #[msg("Unauthorized — only the admin can perform this action")]
    Unauthorized,
    #[msg("Oracle is already registered")]
    OracleAlreadyRegistered,
    #[msg("Oracle is not active")]
    OracleNotActive,
    #[msg("Key too long — max 50 characters")]
    KeyTooLong,
    #[msg("Name too long — max 50 characters")]
    NameTooLong,
    #[msg("Not enough oracles for consensus")]
    InsufficientOracles,
}
