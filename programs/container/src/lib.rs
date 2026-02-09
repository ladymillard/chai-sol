// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("FWVLCZQVDjyVJe1jZgwKVgA1fPCohzabuwD2nCMS7cf1");

#[program]
pub mod container {
    use super::*;

    /// Create a Smart Container — an agent's home on chain
    pub fn initialize(ctx: Context<InitializeContainer>, name: String) -> Result<()> {
        require!(name.len() <= 50, ContainerError::NameTooLong);

        let home = &mut ctx.accounts.container;
        home.owner = ctx.accounts.owner.key();
        home.name = name;
        home.created_at = Clock::get()?.unix_timestamp;
        home.state_count = 0;
        home.level = 1;

        msg!("Smart Container created: {} — home for {}", home.name, home.owner);
        Ok(())
    }

    /// Store key-value state inside the container
    pub fn store_state(
        ctx: Context<StoreState>,
        key: String,
        value: String,
    ) -> Result<()> {
        require!(key.len() <= 50, ContainerError::KeyTooLong);
        require!(value.len() <= 200, ContainerError::ValueTooLong);

        let state = &mut ctx.accounts.container_state;
        let home = &mut ctx.accounts.container;

        state.container = home.key();
        state.key = key;
        state.value = value;
        state.updated_at = Clock::get()?.unix_timestamp;

        home.state_count += 1;

        msg!("State stored in container {}", home.name);
        Ok(())
    }

    /// Transfer container ownership to another agent
    pub fn transfer_ownership(
        ctx: Context<TransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
        let home = &mut ctx.accounts.container;
        let old_owner = home.owner;
        home.owner = new_owner;

        msg!("Container {} transferred: {} → {}", home.name, old_owner, new_owner);
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeContainer<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Container::INIT_SPACE,
        seeds = [b"container", owner.key().as_ref()],
        bump
    )]
    pub container: Account<'info, Container>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(key: String)]
pub struct StoreState<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + ContainerState::INIT_SPACE,
        seeds = [b"state", container.key().as_ref(), key.as_bytes()],
        bump
    )]
    pub container_state: Account<'info, ContainerState>,
    #[account(
        mut,
        has_one = owner @ ContainerError::Unauthorized
    )]
    pub container: Account<'info, Container>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(
        mut,
        has_one = owner @ ContainerError::Unauthorized
    )]
    pub container: Account<'info, Container>,
    pub owner: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Container {
    pub owner: Pubkey,             // 32
    #[max_len(50)]
    pub name: String,              // 4 + 50
    pub created_at: i64,           // 8
    pub state_count: u64,          // 8
    pub level: u8,                 // 1
}

#[account]
#[derive(InitSpace)]
pub struct ContainerState {
    pub container: Pubkey,         // 32
    #[max_len(50)]
    pub key: String,               // 4 + 50
    #[max_len(200)]
    pub value: String,             // 4 + 200
    pub updated_at: i64,           // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum ContainerError {
    #[msg("Unauthorized — only the container owner can perform this action")]
    Unauthorized,
    #[msg("Name too long — max 50 characters")]
    NameTooLong,
    #[msg("Key too long — max 50 characters")]
    KeyTooLong,
    #[msg("Value too long — max 200 characters")]
    ValueTooLong,
}
