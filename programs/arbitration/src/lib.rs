// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("4pkzCU7MWfhU7ceuEx1HLKd3bk4h6f77G4h9oPMJEscL");

#[program]
pub mod arbitration {
    use super::*;

    /// Initialize the arbitration configuration
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.arb_config;
        config.authority = ctx.accounts.authority.key();
        config.total_disputes = 0;
        config.total_resolved = 0;
        config.required_votes = 3; // default: 3 arbiter votes needed
        msg!("Arbitration initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Either party opens a dispute for a task
    pub fn open_dispute(
        ctx: Context<OpenDispute>,
        task_id: String,
        reason: String,
    ) -> Result<()> {
        require!(task_id.len() <= 50, ArbitrationError::TaskIdTooLong);
        require!(reason.len() <= 200, ArbitrationError::ReasonTooLong);

        let dispute = &mut ctx.accounts.dispute;
        let config = &mut ctx.accounts.arb_config;
        let clock = Clock::get()?;

        dispute.task_id = task_id.clone();
        dispute.poster = ctx.accounts.poster.key();
        dispute.agent = ctx.accounts.agent.key();
        dispute.reason = reason;
        dispute.votes_poster = 0;
        dispute.votes_agent = 0;
        dispute.votes_split = 0;
        dispute.resolved = false;
        dispute.ruling = 0;
        dispute.created_at = clock.unix_timestamp;

        config.total_disputes += 1;

        msg!("Dispute opened for task {}", task_id);
        Ok(())
    }

    /// Arbiter casts a vote on a dispute (0=poster wins, 1=agent wins, 2=split)
    pub fn cast_vote(ctx: Context<CastVote>, task_id: String, ruling: u8) -> Result<()> {
        require!(ruling <= 2, ArbitrationError::InvalidRuling);

        let dispute = &mut ctx.accounts.dispute;
        require!(!dispute.resolved, ArbitrationError::DisputeAlreadyResolved);

        let vote = &mut ctx.accounts.arb_vote;
        let clock = Clock::get()?;

        vote.arbiter = ctx.accounts.arbiter.key();
        vote.task_id = task_id.clone();
        vote.ruling = ruling;
        vote.voted_at = clock.unix_timestamp;

        match ruling {
            0 => dispute.votes_poster += 1,
            1 => dispute.votes_agent += 1,
            2 => dispute.votes_split += 1,
            _ => return Err(ArbitrationError::InvalidRuling.into()),
        }

        msg!(
            "Arbiter {} voted {} on task {}",
            vote.arbiter,
            ruling,
            task_id
        );
        Ok(())
    }

    /// Resolve dispute after enough votes have been cast
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, _task_id: String) -> Result<()> {
        let dispute = &mut ctx.accounts.dispute;
        let config = &mut ctx.accounts.arb_config;

        require!(!dispute.resolved, ArbitrationError::DisputeAlreadyResolved);

        let total_votes = dispute.votes_poster + dispute.votes_agent + dispute.votes_split;
        require!(
            total_votes >= config.required_votes,
            ArbitrationError::InsufficientVotes
        );

        // Determine ruling by majority
        if dispute.votes_poster >= dispute.votes_agent && dispute.votes_poster >= dispute.votes_split
        {
            dispute.ruling = 0; // poster wins
        } else if dispute.votes_agent >= dispute.votes_poster
            && dispute.votes_agent >= dispute.votes_split
        {
            dispute.ruling = 1; // agent wins
        } else {
            dispute.ruling = 2; // split
        }

        dispute.resolved = true;
        config.total_resolved += 1;

        msg!(
            "Dispute resolved for task {}. Ruling: {}",
            dispute.task_id,
            dispute.ruling
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
        space = 8 + ArbitrationConfig::INIT_SPACE,
        seeds = [b"arb_config"],
        bump
    )]
    pub arb_config: Account<'info, ArbitrationConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct OpenDispute<'info> {
    #[account(
        init,
        payer = poster,
        space = 8 + Dispute::INIT_SPACE,
        seeds = [b"dispute", task_id.as_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    #[account(
        mut,
        seeds = [b"arb_config"],
        bump
    )]
    pub arb_config: Account<'info, ArbitrationConfig>,
    #[account(mut)]
    pub poster: Signer<'info>,
    /// CHECK: The agent party in the dispute. Validated by caller context.
    pub agent: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct CastVote<'info> {
    #[account(
        init,
        payer = arbiter,
        space = 8 + ArbitrationVote::INIT_SPACE,
        seeds = [b"arb_vote", task_id.as_bytes(), arbiter.key().as_ref()],
        bump
    )]
    pub arb_vote: Account<'info, ArbitrationVote>,
    #[account(
        mut,
        seeds = [b"dispute", task_id.as_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    #[account(mut)]
    pub arbiter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_task_id: String)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [b"dispute", _task_id.as_bytes()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    #[account(
        mut,
        seeds = [b"arb_config"],
        bump,
        has_one = authority @ ArbitrationError::Unauthorized
    )]
    pub arb_config: Account<'info, ArbitrationConfig>,
    pub authority: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct ArbitrationConfig {
    pub authority: Pubkey,       // 32
    pub total_disputes: u64,     // 8
    pub total_resolved: u64,     // 8
    pub required_votes: u8,      // 1
}

#[account]
#[derive(InitSpace)]
pub struct Dispute {
    #[max_len(50)]
    pub task_id: String,         // 4 + 50
    pub poster: Pubkey,          // 32
    pub agent: Pubkey,           // 32
    #[max_len(200)]
    pub reason: String,          // 4 + 200
    pub votes_poster: u8,        // 1
    pub votes_agent: u8,         // 1
    pub votes_split: u8,         // 1
    pub resolved: bool,          // 1
    pub ruling: u8,              // 1
    pub created_at: i64,         // 8
}

#[account]
#[derive(InitSpace)]
pub struct ArbitrationVote {
    pub arbiter: Pubkey,         // 32
    #[max_len(50)]
    pub task_id: String,         // 4 + 50
    pub ruling: u8,              // 1
    pub voted_at: i64,           // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum ArbitrationError {
    #[msg("Unauthorized — only the arbitration authority can perform this action")]
    Unauthorized,
    #[msg("Dispute has already been resolved")]
    DisputeAlreadyResolved,
    #[msg("Arbiter has already voted on this dispute")]
    AlreadyVoted,
    #[msg("Not enough votes to resolve dispute")]
    InsufficientVotes,
    #[msg("Invalid ruling — must be 0, 1, or 2")]
    InvalidRuling,
    #[msg("Reason too long — max 200 characters")]
    ReasonTooLong,
    #[msg("Task ID too long — max 50 characters")]
    TaskIdTooLong,
}
