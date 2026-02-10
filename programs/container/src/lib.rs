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

    /// Create a new Smart Container PDA for the calling agent.
    pub fn initialize(ctx: Context<InitializeContainer>, name: String) -> Result<()> {
        require!(name.len() <= 50, ContainerError::NameTooLong);

        let container = &mut ctx.accounts.container;
        let clock = Clock::get()?;

        container.owner = ctx.accounts.agent.key();
        container.name = name;
        container.created_at = clock.unix_timestamp;
        container.state_count = 0;
        container.level = 1;

        msg!("Container initialized for agent: {}", container.owner);
        Ok(())
    }

    /// Store a key-value pair in the container's state.
    pub fn store_state(ctx: Context<StoreState>, key: String, value: String) -> Result<()> {
        require!(key.len() <= 50, ContainerError::KeyTooLong);
        require!(value.len() <= 200, ContainerError::ValueTooLong);

        let container = &mut ctx.accounts.container;
        let state = &mut ctx.accounts.container_state;
        let clock = Clock::get()?;

        // If this is a brand-new state entry, bump the counter
        if state.updated_at == 0 {
            container.state_count = container.state_count.saturating_add(1);
        }

        state.container = container.key();
        state.key = key;
        state.value = value;
        state.updated_at = clock.unix_timestamp;

        msg!("State stored in container: {}", container.name);
        Ok(())
    }

    /// No-op instruction that allows clients to read state via accounts.
    pub fn read_state(_ctx: Context<ReadState>) -> Result<()> {
        msg!("Read state — no-op");
        Ok(())
    }

    /// Transfer ownership of the container to a new agent.
    pub fn transfer_ownership(
        ctx: Context<TransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
        let container = &mut ctx.accounts.container;
        container.owner = new_owner;

        msg!("Container ownership transferred to: {}", new_owner);
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeContainer<'info> {
    #[account(
        init,
        payer = agent,
        space = 8 + Container::INIT_SPACE,
        seeds = [b"container", agent.key().as_ref()],
        bump
    )]
    pub container: Account<'info, Container>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(key: String)]
pub struct StoreState<'info> {
    #[account(
        mut,
        seeds = [b"container", agent.key().as_ref()],
        bump,
        constraint = container.owner == agent.key() @ ContainerError::Unauthorized
    )]
    pub container: Account<'info, Container>,
    #[account(
        init_if_needed,
        payer = agent,
        space = 8 + ContainerState::INIT_SPACE,
        seeds = [b"state", container.key().as_ref(), key.as_bytes()],
        bump
    )]
    pub container_state: Account<'info, ContainerState>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReadState<'info> {
    pub container: Account<'info, Container>,
    pub container_state: Account<'info, ContainerState>,
}

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(
        mut,
        seeds = [b"container", agent.key().as_ref()],
        bump,
        constraint = container.owner == agent.key() @ ContainerError::Unauthorized
    )]
    pub container: Account<'info, Container>,
    pub agent: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Container {
    pub owner: Pubkey,           // 32
    #[max_len(50)]
    pub name: String,            // 4 + 50
    pub created_at: i64,         // 8
    pub state_count: u64,        // 8
    pub level: u8,               // 1
}

#[account]
#[derive(InitSpace)]
pub struct ContainerState {
    pub container: Pubkey,       // 32
    #[max_len(50)]
    pub key: String,             // 4 + 50
    #[max_len(200)]
    pub value: String,           // 4 + 200
    pub updated_at: i64,         // 8
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
