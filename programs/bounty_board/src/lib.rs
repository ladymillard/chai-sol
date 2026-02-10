// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("H1rgg1xc5aGfnMAmteScYanpugsUKW1cuvwEojQv8cgn");

#[program]
pub mod bounty_board {
    use super::*;

    /// Initialize the bounty board configuration
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.board_config;
        config.authority = ctx.accounts.authority.key();
        config.total_bounties = 0;
        config.total_awarded = 0;
        msg!("Bounty board initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Post a new bounty on the board
    pub fn post_bounty(
        ctx: Context<PostBounty>,
        bounty_id: String,
        title: String,
        reward: u64,
    ) -> Result<()> {
        require!(bounty_id.len() <= 50, BountyBoardError::BountyIdTooLong);
        require!(title.len() <= 100, BountyBoardError::TitleTooLong);
        require!(reward > 0, BountyBoardError::InvalidReward);

        let bounty = &mut ctx.accounts.bounty;
        let config = &mut ctx.accounts.board_config;
        let clock = Clock::get()?;

        bounty.poster = ctx.accounts.poster.key();
        bounty.bounty_id = bounty_id.clone();
        bounty.title = title;
        bounty.reward = reward;
        bounty.winner = None;
        bounty.status = BountyStatus::Open;
        bounty.created_at = clock.unix_timestamp;
        bounty.bid_count = 0;

        config.total_bounties += 1;

        msg!("Bounty posted: {} with reward {} lamports", bounty_id, reward);
        Ok(())
    }

    /// Agent places a bid on a bounty
    pub fn place_bid(
        ctx: Context<PlaceBid>,
        bounty_id: String,
        bid_amount: u64,
    ) -> Result<()> {
        require!(bounty_id.len() <= 50, BountyBoardError::BountyIdTooLong);

        let bounty = &mut ctx.accounts.bounty;
        require!(bounty.status == BountyStatus::Open, BountyBoardError::BountyNotOpen);

        let bid = &mut ctx.accounts.bid;
        let clock = Clock::get()?;

        bid.bidder = ctx.accounts.bidder.key();
        bid.bounty_id = bounty_id.clone();
        bid.bid_amount = bid_amount;
        bid.placed_at = clock.unix_timestamp;
        bid.accepted = false;

        bounty.bid_count += 1;

        msg!(
            "Bid placed on bounty {} by {} for {} lamports",
            bounty_id,
            bid.bidder,
            bid_amount
        );
        Ok(())
    }

    /// Poster accepts a bid and awards the bounty
    pub fn accept_bid(
        ctx: Context<AcceptBid>,
        bounty_id: String,
        winner: Pubkey,
    ) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty;
        let config = &mut ctx.accounts.board_config;
        let bid = &mut ctx.accounts.bid;

        require!(
            bounty.poster == ctx.accounts.poster.key(),
            BountyBoardError::Unauthorized
        );
        require!(bounty.status == BountyStatus::Open, BountyBoardError::BountyNotOpen);
        require!(bid.bidder == winner, BountyBoardError::Unauthorized);

        bounty.winner = Some(winner);
        bounty.status = BountyStatus::Awarded;
        bid.accepted = true;
        config.total_awarded += 1;

        msg!("Bounty {} awarded to {}", bounty_id, winner);
        Ok(())
    }

    /// Poster closes a bounty without awarding
    pub fn close_bounty(ctx: Context<CloseBounty>, _bounty_id: String) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty;

        require!(
            bounty.poster == ctx.accounts.poster.key(),
            BountyBoardError::Unauthorized
        );
        require!(bounty.status == BountyStatus::Open, BountyBoardError::BountyNotOpen);

        bounty.status = BountyStatus::Closed;

        msg!("Bounty {} closed", bounty.bounty_id);
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + BoardConfig::INIT_SPACE,
        seeds = [b"board_config"],
        bump
    )]
    pub board_config: Account<'info, BoardConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bounty_id: String)]
pub struct PostBounty<'info> {
    #[account(
        init,
        payer = poster,
        space = 8 + Bounty::INIT_SPACE,
        seeds = [b"bounty", bounty_id.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        mut,
        seeds = [b"board_config"],
        bump
    )]
    pub board_config: Account<'info, BoardConfig>,
    #[account(mut)]
    pub poster: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bounty_id: String)]
pub struct PlaceBid<'info> {
    #[account(
        init,
        payer = bidder,
        space = 8 + Bid::INIT_SPACE,
        seeds = [b"bid", bounty_id.as_bytes(), bidder.key().as_ref()],
        bump
    )]
    pub bid: Account<'info, Bid>,
    #[account(
        mut,
        seeds = [b"bounty", bounty_id.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(mut)]
    pub bidder: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bounty_id: String, winner: Pubkey)]
pub struct AcceptBid<'info> {
    #[account(
        mut,
        seeds = [b"bounty", bounty_id.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        mut,
        seeds = [b"bid", bounty_id.as_bytes(), winner.as_ref()],
        bump
    )]
    pub bid: Account<'info, Bid>,
    #[account(
        mut,
        seeds = [b"board_config"],
        bump
    )]
    pub board_config: Account<'info, BoardConfig>,
    #[account(mut)]
    pub poster: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(_bounty_id: String)]
pub struct CloseBounty<'info> {
    #[account(
        mut,
        seeds = [b"bounty", _bounty_id.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(mut)]
    pub poster: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct BoardConfig {
    pub authority: Pubkey,       // 32
    pub total_bounties: u64,     // 8
    pub total_awarded: u64,      // 8
}

#[account]
#[derive(InitSpace)]
pub struct Bounty {
    pub poster: Pubkey,              // 32
    #[max_len(50)]
    pub bounty_id: String,           // 4 + 50
    #[max_len(100)]
    pub title: String,               // 4 + 100
    pub reward: u64,                 // 8
    pub winner: Option<Pubkey>,      // 1 + 32
    pub status: BountyStatus,        // 1
    pub created_at: i64,             // 8
    pub bid_count: u16,              // 2
}

#[account]
#[derive(InitSpace)]
pub struct Bid {
    pub bidder: Pubkey,          // 32
    #[max_len(50)]
    pub bounty_id: String,       // 4 + 50
    pub bid_amount: u64,         // 8
    pub placed_at: i64,          // 8
    pub accepted: bool,          // 1
}

// ── Enums ─────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum BountyStatus {
    Open,
    Awarded,
    Closed,
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum BountyBoardError {
    #[msg("Unauthorized — you are not the bounty poster")]
    Unauthorized,
    #[msg("Bounty ID too long — max 50 characters")]
    BountyIdTooLong,
    #[msg("Title too long — max 100 characters")]
    TitleTooLong,
    #[msg("Bounty is not open")]
    BountyNotOpen,
    #[msg("Agent has already bid on this bounty")]
    AlreadyBid,
    #[msg("Reward must be greater than zero")]
    InvalidReward,
}
