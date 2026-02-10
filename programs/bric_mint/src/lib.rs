// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("9iK63cQ5T5frFtqzGCJHaZaGXCvkgpEWLwvgErgA4gUN");

#[program]
pub mod bric_mint {
    use super::*;

    /// Create the BRIC mint and store config in a PDA.
    /// Authority = signer who initializes.
    pub fn initialize(ctx: Context<Initialize>, decimals: u8) -> Result<()> {
        let config = &mut ctx.accounts.bric_config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.mint.key();
        config.total_minted = 0;
        config.total_burned = 0;
        config.bump = ctx.bumps.bric_config;

        msg!(
            "BRIC mint initialized. Authority: {}, Mint: {}, Decimals: {}",
            config.authority,
            config.mint,
            decimals
        );
        Ok(())
    }

    /// Authority mints BRIC tokens to an agent's token account.
    pub fn mint_bric(ctx: Context<MintBric>, amount: u64) -> Result<()> {
        require!(amount > 0, BricMintError::InvalidAmount);

        let config = &ctx.accounts.bric_config;
        require!(
            config.authority == ctx.accounts.authority.key(),
            BricMintError::Unauthorized
        );

        // PDA signer seeds for the mint authority
        let seeds = &[b"bric_config".as_ref(), &[config.bump]];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.agent_token_account.to_account_info(),
            authority: ctx.accounts.bric_config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token::mint_to(cpi_ctx, amount)?;

        // Update totals
        let config = &mut ctx.accounts.bric_config;
        config.total_minted = config.total_minted.checked_add(amount).unwrap();

        msg!("Minted {} BRIC to {}", amount, ctx.accounts.agent_token_account.key());
        Ok(())
    }

    /// Token holder burns their own BRIC tokens.
    pub fn burn_bric(ctx: Context<BurnBric>, amount: u64) -> Result<()> {
        require!(amount > 0, BricMintError::InvalidAmount);

        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.holder_token_account.to_account_info(),
            authority: ctx.accounts.holder.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        token::burn(cpi_ctx, amount)?;

        // Update totals
        let config = &mut ctx.accounts.bric_config;
        config.total_burned = config.total_burned.checked_add(amount).unwrap();

        msg!("Burned {} BRIC from {}", amount, ctx.accounts.holder.key());
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
#[instruction(decimals: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + BricConfig::INIT_SPACE,
        seeds = [b"bric_config"],
        bump
    )]
    pub bric_config: Account<'info, BricConfig>,

    #[account(
        init,
        payer = authority,
        mint::decimals = decimals,
        mint::authority = bric_config,
    )]
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintBric<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bric_config"],
        bump = bric_config.bump,
        has_one = authority @ BricMintError::Unauthorized,
        has_one = mint,
    )]
    pub bric_config: Account<'info, BricConfig>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// The agent's associated token account to receive minted BRIC.
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnBric<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bric_config"],
        bump = bric_config.bump,
        has_one = mint,
    )]
    pub bric_config: Account<'info, BricConfig>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = holder_token_account.owner == holder.key() @ BricMintError::Unauthorized,
    )]
    pub holder_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct BricConfig {
    pub authority: Pubkey,    // 32
    pub mint: Pubkey,         // 32
    pub total_minted: u64,    // 8
    pub total_burned: u64,    // 8
    pub bump: u8,             // 1
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum BricMintError {
    #[msg("Unauthorized — only the mint authority can perform this action")]
    Unauthorized,
    #[msg("Invalid amount — must be greater than zero")]
    InvalidAmount,
}
