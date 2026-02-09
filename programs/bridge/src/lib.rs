// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("4K18A3Vuy8DxaJjUyQ1aBskZB7vz7joyRGg33aMraZnb");

#[program]
pub mod bridge {
    use super::*;

    /// Initialize the bridge configuration with authority and relayer
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.bridge_config;
        config.authority = ctx.accounts.authority.key();
        config.relayer = ctx.accounts.authority.key(); // default relayer = authority
        config.total_locked = 0;
        config.total_released = 0;
        config.total_locks = 0;
        config.paused = false;
        msg!("Bridge initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Lock SOL for cross-chain transfer to ETH
    pub fn lock_sol(
        ctx: Context<LockSol>,
        amount: u64,
        eth_recipient: String,
    ) -> Result<()> {
        let config = &mut ctx.accounts.bridge_config;
        require!(!config.paused, BridgeError::BridgePaused);
        require!(amount > 0, BridgeError::InsufficientAmount);
        require!(eth_recipient.len() <= 50, BridgeError::EthAddressTooLong);

        let lock_record = &mut ctx.accounts.lock_record;
        let clock = Clock::get()?;

        lock_record.locker = ctx.accounts.locker.key();
        lock_record.amount = amount;
        lock_record.eth_recipient = eth_recipient;
        lock_record.confirmed = false;
        lock_record.created_at = clock.unix_timestamp;
        lock_record.lock_id = config.total_locks;

        // Transfer SOL from locker to bridge config PDA (vault)
        let cpi_accounts = Transfer {
            from: ctx.accounts.locker.to_account_info(),
            to: config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
        );
        transfer(cpi_ctx, amount)?;

        config.total_locked += amount;
        config.total_locks += 1;

        msg!(
            "Locked {} lamports for cross-chain transfer. Lock ID: {}",
            amount,
            lock_record.lock_id
        );
        Ok(())
    }

    /// Relayer confirms that ETH side received the transfer
    pub fn confirm_transfer(ctx: Context<ConfirmTransfer>, lock_id: u64) -> Result<()> {
        let lock_record = &mut ctx.accounts.lock_record;

        require!(!lock_record.confirmed, BridgeError::AlreadyConfirmed);

        lock_record.confirmed = true;

        msg!("Lock {} confirmed by relayer", lock_id);
        Ok(())
    }

    /// Relayer releases SOL from bridge to a recipient
    pub fn release_sol(
        ctx: Context<ReleaseSol>,
        amount: u64,
        _sol_recipient: Pubkey,
        eth_tx_hash: String,
    ) -> Result<()> {
        let config = &mut ctx.accounts.bridge_config;
        require!(!config.paused, BridgeError::BridgePaused);
        require!(amount > 0, BridgeError::InsufficientAmount);

        // Transfer SOL from bridge config PDA to recipient
        **config.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .sol_recipient
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        config.total_released += amount;

        msg!(
            "Released {} lamports to {}. ETH tx: {}",
            amount,
            ctx.accounts.sol_recipient.key(),
            eth_tx_hash
        );
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + BridgeConfig::INIT_SPACE,
        seeds = [b"bridge_config"],
        bump
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockSol<'info> {
    #[account(
        init,
        payer = locker,
        space = 8 + LockRecord::INIT_SPACE,
        seeds = [b"lock", bridge_config.total_locks.to_le_bytes().as_ref()],
        bump
    )]
    pub lock_record: Account<'info, LockRecord>,
    #[account(
        mut,
        seeds = [b"bridge_config"],
        bump
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    #[account(mut)]
    pub locker: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lock_id: u64)]
pub struct ConfirmTransfer<'info> {
    #[account(
        mut,
        seeds = [b"lock", lock_id.to_le_bytes().as_ref()],
        bump
    )]
    pub lock_record: Account<'info, LockRecord>,
    #[account(
        seeds = [b"bridge_config"],
        bump,
        has_one = relayer @ BridgeError::Unauthorized
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    pub relayer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReleaseSol<'info> {
    #[account(
        mut,
        seeds = [b"bridge_config"],
        bump,
        has_one = relayer @ BridgeError::Unauthorized
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
    /// CHECK: The SOL recipient account. Validated by relayer off-chain.
    #[account(mut)]
    pub sol_recipient: AccountInfo<'info>,
    pub relayer: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct BridgeConfig {
    pub authority: Pubkey,       // 32
    pub relayer: Pubkey,         // 32
    pub total_locked: u64,       // 8
    pub total_released: u64,     // 8
    pub total_locks: u64,        // 8
    pub paused: bool,            // 1
}

#[account]
#[derive(InitSpace)]
pub struct LockRecord {
    pub locker: Pubkey,              // 32
    pub amount: u64,                 // 8
    #[max_len(50)]
    pub eth_recipient: String,       // 4 + 50
    pub confirmed: bool,             // 1
    pub created_at: i64,             // 8
    pub lock_id: u64,                // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum BridgeError {
    #[msg("Unauthorized — only the relayer can perform this action")]
    Unauthorized,
    #[msg("Bridge is paused")]
    BridgePaused,
    #[msg("Amount must be greater than zero")]
    InsufficientAmount,
    #[msg("Lock has already been confirmed")]
    AlreadyConfirmed,
    #[msg("ETH address too long — max 50 characters")]
    EthAddressTooLong,
    #[msg("Invalid lock ID")]
    InvalidLockId,
}
