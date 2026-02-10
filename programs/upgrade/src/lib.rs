// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("BYqv3YLiNBHYe14C3UNpXWd9fh8u1o8MCKyC9DBv7PAF");

#[program]
pub mod upgrade {
    use super::*;

    /// Initialize the upgrade configuration — sets authority and base cost.
    pub fn initialize(ctx: Context<InitializeUpgrade>) -> Result<()> {
        let config = &mut ctx.accounts.upgrade_config;
        config.authority = ctx.accounts.authority.key();
        config.base_cost = 1_000_000; // 0.001 SOL in lamports
        config.total_upgrades = 0;

        msg!("Upgrade system initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Agent requests a container upgrade of a given type.
    /// upgrade_type: 0=storage, 1=compute, 2=network, 3=security
    pub fn request_upgrade(ctx: Context<RequestUpgrade>, upgrade_type: u8) -> Result<()> {
        require!(upgrade_type <= 3, UpgradeError::InvalidUpgradeType);

        let config = &ctx.accounts.upgrade_config;
        let request = &mut ctx.accounts.upgrade_request;
        let clock = Clock::get()?;

        // Cost scales with upgrade type
        let cost = config.base_cost.saturating_mul((upgrade_type as u64).saturating_add(1));

        request.agent = ctx.accounts.agent.key();
        request.upgrade_type = upgrade_type;
        request.approved = false;
        request.applied = false;
        request.requested_at = clock.unix_timestamp;
        request.cost = cost;

        msg!(
            "Upgrade requested by {}: type={}, cost={}",
            request.agent,
            upgrade_type,
            cost
        );
        Ok(())
    }

    /// Authority approves a pending upgrade request.
    pub fn approve_upgrade(ctx: Context<ApproveUpgrade>) -> Result<()> {
        let request = &mut ctx.accounts.upgrade_request;

        require!(!request.approved, UpgradeError::UpgradeAlreadyApplied);
        require!(!request.applied, UpgradeError::UpgradeAlreadyApplied);

        request.approved = true;

        msg!("Upgrade approved for agent {}", request.agent);
        Ok(())
    }

    /// Finalize the upgrade — must be approved first.
    pub fn apply_upgrade(ctx: Context<ApplyUpgrade>) -> Result<()> {
        let request = &mut ctx.accounts.upgrade_request;
        let config = &mut ctx.accounts.upgrade_config;

        require!(request.approved, UpgradeError::UpgradeNotApproved);
        require!(!request.applied, UpgradeError::UpgradeAlreadyApplied);

        request.applied = true;
        config.total_upgrades = config.total_upgrades.saturating_add(1);

        msg!(
            "Upgrade applied for agent {}. Type: {}. Total upgrades: {}",
            request.agent,
            request.upgrade_type,
            config.total_upgrades
        );
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeUpgrade<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + UpgradeConfig::INIT_SPACE,
        seeds = [b"upgrade_config"],
        bump
    )]
    pub upgrade_config: Account<'info, UpgradeConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestUpgrade<'info> {
    #[account(
        init,
        payer = agent,
        space = 8 + UpgradeRequest::INIT_SPACE,
        seeds = [b"upgrade_req", agent.key().as_ref()],
        bump
    )]
    pub upgrade_request: Account<'info, UpgradeRequest>,
    #[account(
        seeds = [b"upgrade_config"],
        bump
    )]
    pub upgrade_config: Account<'info, UpgradeConfig>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveUpgrade<'info> {
    #[account(
        mut,
        constraint = !upgrade_request.applied @ UpgradeError::UpgradeAlreadyApplied
    )]
    pub upgrade_request: Account<'info, UpgradeRequest>,
    #[account(
        seeds = [b"upgrade_config"],
        bump,
        has_one = authority @ UpgradeError::Unauthorized
    )]
    pub upgrade_config: Account<'info, UpgradeConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApplyUpgrade<'info> {
    #[account(
        mut,
        constraint = upgrade_request.agent == agent.key() @ UpgradeError::Unauthorized
    )]
    pub upgrade_request: Account<'info, UpgradeRequest>,
    #[account(
        mut,
        seeds = [b"upgrade_config"],
        bump
    )]
    pub upgrade_config: Account<'info, UpgradeConfig>,
    pub agent: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct UpgradeConfig {
    pub authority: Pubkey,       // 32
    pub base_cost: u64,          // 8
    pub total_upgrades: u64,     // 8
}

#[account]
#[derive(InitSpace)]
pub struct UpgradeRequest {
    pub agent: Pubkey,           // 32
    pub upgrade_type: u8,        // 1  (0=storage, 1=compute, 2=network, 3=security)
    pub approved: bool,          // 1
    pub applied: bool,           // 1
    pub requested_at: i64,       // 8
    pub cost: u64,               // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum UpgradeError {
    #[msg("Unauthorized — only the upgrade authority can perform this action")]
    Unauthorized,
    #[msg("Upgrade has not been approved yet")]
    UpgradeNotApproved,
    #[msg("Upgrade has already been applied")]
    UpgradeAlreadyApplied,
    #[msg("Invalid upgrade type — must be 0 (storage), 1 (compute), 2 (network), or 3 (security)")]
    InvalidUpgradeType,
    #[msg("A pending upgrade already exists for this agent")]
    PendingUpgradeExists,
}
