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

    /// Initialize the upgrade system
    pub fn initialize(ctx: Context<InitializeUpgrade>, base_cost: u64) -> Result<()> {
        let config = &mut ctx.accounts.upgrade_config;
        config.authority = ctx.accounts.authority.key();
        config.base_cost = base_cost;
        config.total_upgrades = 0;
        msg!("Upgrade system initialized. Base cost: {} lamports", base_cost);
        Ok(())
    }

    /// Agent requests a container upgrade
    pub fn request_upgrade(ctx: Context<RequestUpgrade>, upgrade_type: u8) -> Result<()> {
        require!(upgrade_type <= 3, UpgradeError::InvalidUpgradeType);

        let request = &mut ctx.accounts.upgrade_request;
        let config = &ctx.accounts.upgrade_config;

        request.agent = ctx.accounts.agent.key();
        request.upgrade_type = upgrade_type;
        request.approved = false;
        request.applied = false;
        request.requested_at = Clock::get()?.unix_timestamp;
        request.cost = config.base_cost * (upgrade_type as u64 + 1);

        msg!(
            "Upgrade requested by {}: type {} (cost: {} lamports)",
            request.agent, upgrade_type, request.cost
        );
        Ok(())
    }

    /// Authority approves an upgrade request
    pub fn approve_upgrade(ctx: Context<ApproveUpgrade>) -> Result<()> {
        let request = &mut ctx.accounts.upgrade_request;
        require!(!request.applied, UpgradeError::UpgradeAlreadyApplied);

        request.approved = true;

        msg!("Upgrade approved for agent {}", request.agent);
        Ok(())
    }

    /// Finalize the upgrade
    pub fn apply_upgrade(ctx: Context<ApplyUpgrade>) -> Result<()> {
        let request = &mut ctx.accounts.upgrade_request;
        let config = &mut ctx.accounts.upgrade_config;

        require!(request.approved, UpgradeError::UpgradeNotApproved);
        require!(!request.applied, UpgradeError::UpgradeAlreadyApplied);

        request.applied = true;
        config.total_upgrades += 1;

        msg!(
            "Upgrade applied for agent {}: type {} — total upgrades: {}",
            request.agent, request.upgrade_type, config.total_upgrades
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
    pub upgrade_config: Account<'info, UpgradeConfig>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveUpgrade<'info> {
    #[account(mut)]
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
    #[account(mut)]
    pub upgrade_config: Account<'info, UpgradeConfig>,
    pub agent: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct UpgradeConfig {
    pub authority: Pubkey,         // 32
    pub base_cost: u64,            // 8
    pub total_upgrades: u64,       // 8
}

#[account]
#[derive(InitSpace)]
pub struct UpgradeRequest {
    pub agent: Pubkey,             // 32
    pub upgrade_type: u8,          // 1 — 0=storage, 1=compute, 2=network, 3=security
    pub approved: bool,            // 1
    pub applied: bool,             // 1
    pub requested_at: i64,         // 8
    pub cost: u64,                 // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum UpgradeError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Upgrade not approved yet")]
    UpgradeNotApproved,
    #[msg("Upgrade already applied")]
    UpgradeAlreadyApplied,
    #[msg("Invalid upgrade type — must be 0-3")]
    InvalidUpgradeType,
}
