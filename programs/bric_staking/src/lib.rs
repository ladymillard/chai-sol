// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("CG66VnV7jkGSXksmFiNr5vq2A5XUHjMfUVCCN3xC1aG7");

/// Lockup period in seconds (7 days).
const LOCKUP_PERIOD: i64 = 7 * 24 * 60 * 60;

/// Default reward rate: 1 lamport per staked lamport per day (scaled).
const DEFAULT_REWARD_RATE: u64 = 1;

#[program]
pub mod bric_staking {
    use super::*;

    /// Initialize the staking configuration PDA. Authority = signer.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.staking_config;
        config.authority = ctx.accounts.authority.key();
        config.total_staked = 0;
        config.reward_rate = DEFAULT_REWARD_RATE;

        msg!("Staking config initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Agent deposits BRIC (tracked in lamports) into staking.
    /// Creates or updates StakeAccount PDA per agent.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::InsufficientStake);

        let clock = Clock::get()?;
        let stake_account = &mut ctx.accounts.stake_account;
        let config = &mut ctx.accounts.staking_config;

        stake_account.agent = ctx.accounts.agent.key();
        stake_account.amount = stake_account.amount.checked_add(amount).unwrap();
        stake_account.staked_at = clock.unix_timestamp;

        // Initialize last_claimed if first stake
        if stake_account.last_claimed == 0 {
            stake_account.last_claimed = clock.unix_timestamp;
        }

        config.total_staked = config.total_staked.checked_add(amount).unwrap();

        msg!(
            "Agent {} staked {} lamports. Total staked: {}",
            stake_account.agent,
            amount,
            stake_account.amount
        );
        Ok(())
    }

    /// Withdraw BRIC from staking after lockup period expires.
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::InsufficientStake);

        let clock = Clock::get()?;
        let stake_account = &mut ctx.accounts.stake_account;
        let config = &mut ctx.accounts.staking_config;

        // Ensure lockup period has passed
        let elapsed = clock.unix_timestamp.checked_sub(stake_account.staked_at).unwrap();
        require!(elapsed >= LOCKUP_PERIOD, StakingError::LockupNotExpired);

        // Ensure sufficient balance
        require!(stake_account.amount >= amount, StakingError::InsufficientStake);

        stake_account.amount = stake_account.amount.checked_sub(amount).unwrap();
        config.total_staked = config.total_staked.checked_sub(amount).unwrap();

        msg!(
            "Agent {} unstaked {} lamports. Remaining: {}",
            stake_account.agent,
            amount,
            stake_account.amount
        );
        Ok(())
    }

    /// Claim staking rewards based on duration staked.
    /// Rewards = staked_amount * reward_rate * days_elapsed / 10000
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let clock = Clock::get()?;
        let stake_account = &mut ctx.accounts.stake_account;
        let config = &ctx.accounts.staking_config;

        require!(stake_account.amount > 0, StakingError::InsufficientStake);

        let seconds_elapsed = clock
            .unix_timestamp
            .checked_sub(stake_account.last_claimed)
            .unwrap();

        // Must have at least 1 day elapsed
        require!(seconds_elapsed > 0, StakingError::NoRewardsToClaim);

        // Calculate rewards: amount * rate * days / 10_000 (basis-point scaling)
        let days_elapsed = (seconds_elapsed as u64) / 86_400;
        require!(days_elapsed > 0, StakingError::NoRewardsToClaim);

        let reward = stake_account
            .amount
            .checked_mul(config.reward_rate)
            .unwrap()
            .checked_mul(days_elapsed)
            .unwrap()
            .checked_div(10_000)
            .unwrap();

        require!(reward > 0, StakingError::NoRewardsToClaim);

        stake_account.last_claimed = clock.unix_timestamp;

        msg!(
            "Agent {} claimed {} reward lamports ({} days staked)",
            stake_account.agent,
            reward,
            days_elapsed
        );
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + StakingConfig::INIT_SPACE,
        seeds = [b"staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        init_if_needed,
        payer = agent,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [b"stake", agent.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        mut,
        seeds = [b"staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake", agent.key().as_ref()],
        bump,
        constraint = stake_account.agent == agent.key() @ StakingError::Unauthorized,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        mut,
        seeds = [b"staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfig>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake", agent.key().as_ref()],
        bump,
        constraint = stake_account.agent == agent.key() @ StakingError::Unauthorized,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        seeds = [b"staking_config"],
        bump
    )]
    pub staking_config: Account<'info, StakingConfig>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct StakingConfig {
    pub authority: Pubkey,    // 32
    pub total_staked: u64,    // 8
    pub reward_rate: u64,     // 8
}

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub agent: Pubkey,        // 32
    pub amount: u64,          // 8
    pub staked_at: i64,       // 8
    pub last_claimed: i64,    // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum StakingError {
    #[msg("Unauthorized — only the staking agent can perform this action")]
    Unauthorized,
    #[msg("Insufficient stake — amount must be greater than zero and within balance")]
    InsufficientStake,
    #[msg("Lockup period has not expired — must wait 7 days after staking")]
    LockupNotExpired,
    #[msg("No rewards to claim — not enough time has elapsed")]
    NoRewardsToClaim,
}
