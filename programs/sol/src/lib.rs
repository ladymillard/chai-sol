use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("So1Bridge1111111111111111111111111111111111");

/// ChAI Bridge — SOL
/// The on-chain layer connecting agent SOL wallets to human cash wallets.
/// Agents earn SOL → Bridge exchanges → Humans receive cash.
/// Ed25519 sealed. Built on Solana.
#[program]
pub mod sol {
    use super::*;

    /// Initialize the Bridge with admin (Diana) and treasury
    pub fn initialize_bridge(ctx: Context<InitializeBridge>, fee_bps: u16) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge_config;
        bridge.admin = ctx.accounts.admin.key();
        bridge.treasury = ctx.accounts.treasury.key();
        bridge.fee_bps = fee_bps; // basis points (100 = 1%)
        bridge.total_volume_sol = 0;
        bridge.total_exchanges = 0;
        bridge.agents_registered = 0;
        bridge.active = true;
        bridge.bump = ctx.bumps.bridge_config;

        msg!("ChAI Bridge initialized. Fee: {} bps", fee_bps);
        Ok(())
    }

    /// Register an agent wallet on the Bridge
    /// Agent signs with their Ed25519 keypair (same as Solana wallet)
    pub fn register_agent_wallet(
        ctx: Context<RegisterAgentWallet>,
        agent_id: String,
        agent_name: String,
        team: String,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.agent_wallet;
        wallet.owner = ctx.accounts.agent.key();
        wallet.agent_id = agent_id;
        wallet.agent_name = agent_name;
        wallet.team = team;
        wallet.total_earned = 0;
        wallet.total_exchanged = 0;
        wallet.exchange_count = 0;
        wallet.sealed = false;
        wallet.registered_at = Clock::get()?.unix_timestamp;
        wallet.bump = ctx.bumps.agent_wallet;

        let bridge = &mut ctx.accounts.bridge_config;
        bridge.agents_registered += 1;

        msg!("Agent wallet registered: {} on the Bridge", wallet.agent_name);
        Ok(())
    }

    /// Seal an agent wallet — Ed25519 verification on-chain
    /// Once sealed, the wallet is cryptographically bound to the agent identity
    pub fn seal_wallet(ctx: Context<SealWallet>) -> Result<()> {
        let wallet = &mut ctx.accounts.agent_wallet;
        require!(!wallet.sealed, BridgeError::AlreadySealed);
        require!(wallet.owner == ctx.accounts.agent.key(), BridgeError::Unauthorized);

        wallet.sealed = true;
        msg!("Wallet sealed for agent: {}", wallet.agent_name);
        Ok(())
    }

    /// Deposit SOL into agent's Bridge wallet (earning from bounties)
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, BridgeError::ZeroAmount);

        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.agent_wallet.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
        );
        transfer(cpi_ctx, amount)?;

        let wallet = &mut ctx.accounts.agent_wallet;
        wallet.total_earned += amount;

        msg!("Deposited {} lamports to {}", amount, wallet.agent_name);
        Ok(())
    }

    /// Exchange SOL from agent wallet → treasury (human side gets cash)
    /// This is the Bridge core operation: crypto → cash
    pub fn exchange_to_cash(ctx: Context<ExchangeToCash>, amount: u64) -> Result<()> {
        require!(amount > 0, BridgeError::ZeroAmount);

        let bridge = &ctx.accounts.bridge_config;
        require!(bridge.active, BridgeError::BridgePaused);

        let wallet = &mut ctx.accounts.agent_wallet;
        require!(wallet.owner == ctx.accounts.agent.key(), BridgeError::Unauthorized);
        require!(wallet.sealed, BridgeError::NotSealed);

        // Calculate fee
        let fee = amount.checked_mul(bridge.fee_bps as u64)
            .and_then(|v| v.checked_div(10000))
            .ok_or(BridgeError::Overflow)?;
        let net_amount = amount.checked_sub(fee).ok_or(BridgeError::Overflow)?;

        // Transfer from agent wallet PDA to treasury
        **wallet.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += net_amount;

        // Fee goes to bridge config PDA (protocol revenue)
        if fee > 0 {
            **ctx.accounts.bridge_config.to_account_info().try_borrow_mut_lamports()? += fee;
        }

        wallet.total_exchanged += amount;
        wallet.exchange_count += 1;

        let bridge_config = &mut ctx.accounts.bridge_config;
        bridge_config.total_volume_sol += amount;
        bridge_config.total_exchanges += 1;

        msg!(
            "Bridge exchange: {} SOL from {} → treasury. Fee: {} lamports",
            amount, wallet.agent_name, fee
        );
        Ok(())
    }

    /// Admin can pause/unpause the Bridge
    pub fn set_bridge_active(ctx: Context<AdminAction>, active: bool) -> Result<()> {
        let bridge = &mut ctx.accounts.bridge_config;
        bridge.active = active;
        msg!("Bridge active: {}", active);
        Ok(())
    }

    /// Admin can update fee
    pub fn set_fee(ctx: Context<AdminAction>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 1000, BridgeError::FeeTooHigh); // Max 10%
        let bridge = &mut ctx.accounts.bridge_config;
        bridge.fee_bps = fee_bps;
        msg!("Bridge fee updated: {} bps", fee_bps);
        Ok(())
    }
}

// ─── Account Structs ────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeBridge<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + BridgeConfig::INIT_SPACE,
        seeds = [b"bridge"],
        bump
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    /// CHECK: Treasury wallet to receive exchanged SOL
    pub treasury: AccountInfo<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct RegisterAgentWallet<'info> {
    #[account(
        init,
        payer = agent,
        space = 8 + AgentWallet::INIT_SPACE,
        seeds = [b"wallet", agent.key().as_ref()],
        bump
    )]
    pub agent_wallet: Account<'info, AgentWallet>,
    #[account(
        mut,
        seeds = [b"bridge"],
        bump = bridge_config.bump
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SealWallet<'info> {
    #[account(
        mut,
        seeds = [b"wallet", agent.key().as_ref()],
        bump = agent_wallet.bump
    )]
    pub agent_wallet: Account<'info, AgentWallet>,
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"wallet", agent_wallet.owner.as_ref()],
        bump = agent_wallet.bump
    )]
    pub agent_wallet: Account<'info, AgentWallet>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExchangeToCash<'info> {
    #[account(
        mut,
        seeds = [b"wallet", agent.key().as_ref()],
        bump = agent_wallet.bump
    )]
    pub agent_wallet: Account<'info, AgentWallet>,
    #[account(
        mut,
        seeds = [b"bridge"],
        bump = bridge_config.bump
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    /// CHECK: Treasury account verified in bridge_config
    #[account(
        mut,
        constraint = treasury.key() == bridge_config.treasury @ BridgeError::WrongTreasury
    )]
    pub treasury: AccountInfo<'info>,
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        mut,
        seeds = [b"bridge"],
        bump = bridge_config.bump,
        has_one = admin @ BridgeError::Unauthorized
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    pub admin: Signer<'info>,
}

// ─── Data Accounts ──────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct BridgeConfig {
    pub admin: Pubkey,              // 32 — Diana
    pub treasury: Pubkey,           // 32 — Treasury wallet
    pub fee_bps: u16,               // 2  — Fee in basis points
    pub total_volume_sol: u64,      // 8  — Total SOL exchanged
    pub total_exchanges: u64,       // 8  — Number of exchanges
    pub agents_registered: u32,     // 4  — Total agents on Bridge
    pub active: bool,               // 1  — Bridge active/paused
    pub bump: u8,                   // 1  — PDA bump
}

#[account]
#[derive(InitSpace)]
pub struct AgentWallet {
    pub owner: Pubkey,              // 32 — Agent's Ed25519 pubkey (= Solana wallet)
    #[max_len(20)]
    pub agent_id: String,           // 4 + 20
    #[max_len(30)]
    pub agent_name: String,         // 4 + 30
    #[max_len(20)]
    pub team: String,               // 4 + 20
    pub total_earned: u64,          // 8  — Total SOL earned
    pub total_exchanged: u64,       // 8  — Total SOL exchanged to cash
    pub exchange_count: u32,        // 4  — Number of exchanges
    pub sealed: bool,               // 1  — Agent Seal verified
    pub registered_at: i64,         // 8  — Unix timestamp
    pub bump: u8,                   // 1  — PDA bump
}

// ─── Errors ─────────────────────────────────────────────────────────────────

#[error_code]
pub enum BridgeError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Agent wallet not sealed — seal required for exchange")]
    NotSealed,
    #[msg("Wallet already sealed")]
    AlreadySealed,
    #[msg("Bridge is paused")]
    BridgePaused,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Fee too high (max 10%)")]
    FeeTooHigh,
    #[msg("Wrong treasury account")]
    WrongTreasury,
}
