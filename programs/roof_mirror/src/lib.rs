// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("5GHeeGTEMoVRxnT4m5W512TJLYfb6hUFhZVMDMphVp66");

/// Threshold for an agent to be considered as "has roof" (owns a home)
const ROOF_THRESHOLD: u64 = 1_000_000;

#[program]
pub mod roof_mirror {
    use super::*;

    /// Initialize the mirror configuration with oracle
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.mirror_config;
        config.oracle = ctx.accounts.oracle.key();
        config.last_sync_block = 0;
        config.total_mirrored = 0;
        msg!("ROOF mirror initialized. Oracle: {}", config.oracle);
        Ok(())
    }

    /// Oracle syncs an agent's ETH ROOF balance to SOL-side mirror
    pub fn sync_balance(
        ctx: Context<SyncBalance>,
        agent: Pubkey,
        eth_roof_balance: u64,
        block_number: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.mirror_config;
        let mirror = &mut ctx.accounts.mirror_balance;
        let clock = Clock::get()?;

        let is_new = mirror.agent == Pubkey::default();

        mirror.agent = agent;
        mirror.roof_balance = eth_roof_balance;
        mirror.last_synced = clock.unix_timestamp;
        mirror.block_number = block_number;
        mirror.has_roof = eth_roof_balance >= ROOF_THRESHOLD;

        if block_number > config.last_sync_block {
            config.last_sync_block = block_number;
        }
        if is_new {
            config.total_mirrored += 1;
        }

        msg!(
            "Synced ROOF balance for agent {}: {} (has_roof: {})",
            agent,
            eth_roof_balance,
            mirror.has_roof
        );
        Ok(())
    }

    /// Verify if an agent has ROOF (enough balance = has home)
    pub fn verify_roof(ctx: Context<VerifyRoof>, agent: Pubkey) -> Result<()> {
        let mirror = &ctx.accounts.mirror_balance;

        require!(mirror.agent == agent, RoofMirrorError::AgentNotSynced);
        require!(mirror.last_synced > 0, RoofMirrorError::AgentNotSynced);

        // Check that the sync is not too old (within 24 hours = 86400 seconds)
        let clock = Clock::get()?;
        let age = clock.unix_timestamp - mirror.last_synced;
        require!(age <= 86400, RoofMirrorError::SyncTooOld);

        msg!(
            "Agent {} ROOF verification: has_roof={}, balance={}",
            agent,
            mirror.has_roof,
            mirror.roof_balance
        );
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = oracle,
        space = 8 + MirrorConfig::INIT_SPACE,
        seeds = [b"mirror_config"],
        bump
    )]
    pub mirror_config: Account<'info, MirrorConfig>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent: Pubkey)]
pub struct SyncBalance<'info> {
    #[account(
        init_if_needed,
        payer = oracle,
        space = 8 + MirrorBalance::INIT_SPACE,
        seeds = [b"mirror_bal", agent.as_ref()],
        bump
    )]
    pub mirror_balance: Account<'info, MirrorBalance>,
    #[account(
        mut,
        seeds = [b"mirror_config"],
        bump,
        has_one = oracle @ RoofMirrorError::Unauthorized
    )]
    pub mirror_config: Account<'info, MirrorConfig>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent: Pubkey)]
pub struct VerifyRoof<'info> {
    #[account(
        seeds = [b"mirror_bal", agent.as_ref()],
        bump
    )]
    pub mirror_balance: Account<'info, MirrorBalance>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct MirrorConfig {
    pub oracle: Pubkey,          // 32
    pub last_sync_block: u64,    // 8
    pub total_mirrored: u64,     // 8
}

#[account]
#[derive(InitSpace)]
pub struct MirrorBalance {
    pub agent: Pubkey,           // 32
    pub roof_balance: u64,       // 8
    pub last_synced: i64,        // 8
    pub block_number: u64,       // 8
    pub has_roof: bool,          // 1
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum RoofMirrorError {
    #[msg("Unauthorized — only the oracle can perform this action")]
    Unauthorized,
    #[msg("Agent has not been synced yet")]
    AgentNotSynced,
    #[msg("Sync data is too old — must be within 24 hours")]
    SyncTooOld,
}
