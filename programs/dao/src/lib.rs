// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("HJtynTbdHkc8yFjQnA73Qz2WfxVMKw3rj6SucQXcZt21");

#[program]
pub mod dao {
    use super::*;

    /// Initialize the DAO configuration with vote threshold
    pub fn initialize(ctx: Context<Initialize>, vote_threshold: u8) -> Result<()> {
        let config = &mut ctx.accounts.dao_config;
        config.authority = ctx.accounts.authority.key();
        config.vote_threshold = vote_threshold;
        config.total_proposals = 0;
        config.total_executed = 0;
        msg!(
            "DAO initialized. Authority: {}, threshold: {}",
            config.authority,
            vote_threshold
        );
        Ok(())
    }

    /// Create a new proposal
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
    ) -> Result<()> {
        require!(title.len() <= 100, DaoError::TitleTooLong);
        require!(description.len() <= 200, DaoError::DescriptionTooLong);

        let config = &mut ctx.accounts.dao_config;
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        proposal.proposer = ctx.accounts.proposer.key();
        proposal.proposal_id = config.total_proposals;
        proposal.title = title;
        proposal.description = description;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.executed = false;
        proposal.created_at = clock.unix_timestamp;

        config.total_proposals += 1;

        msg!("Proposal {} created", proposal.proposal_id);
        Ok(())
    }

    /// Cast a vote on a proposal
    pub fn cast_vote(ctx: Context<CastVote>, proposal_id: u64, approve: bool) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        require!(!proposal.executed, DaoError::ProposalAlreadyExecuted);

        let vote = &mut ctx.accounts.dao_vote;
        let clock = Clock::get()?;

        vote.voter = ctx.accounts.voter.key();
        vote.proposal_id = proposal_id;
        vote.approve = approve;
        vote.voted_at = clock.unix_timestamp;

        if approve {
            proposal.votes_for += 1;
        } else {
            proposal.votes_against += 1;
        }

        msg!(
            "Vote cast on proposal {} by {}: approve={}",
            proposal_id,
            vote.voter,
            approve
        );
        Ok(())
    }

    /// Execute a proposal if vote threshold is met
    pub fn execute_proposal(ctx: Context<ExecuteProposal>, _proposal_id: u64) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let config = &mut ctx.accounts.dao_config;

        require!(!proposal.executed, DaoError::ProposalAlreadyExecuted);

        let total_votes = proposal.votes_for + proposal.votes_against;
        require!(total_votes > 0, DaoError::InsufficientVotes);

        // Check if votes_for meets the threshold percentage
        let approval_pct = ((proposal.votes_for as u32) * 100) / (total_votes as u32);
        require!(
            approval_pct >= config.vote_threshold as u32,
            DaoError::InsufficientVotes
        );

        proposal.executed = true;
        config.total_executed += 1;

        msg!(
            "Proposal {} executed. Approval: {}%",
            proposal.proposal_id,
            approval_pct
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
        space = 8 + DaoConfig::INIT_SPACE,
        seeds = [b"dao_config"],
        bump
    )]
    pub dao_config: Account<'info, DaoConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = proposer,
        space = 8 + DaoProposal::INIT_SPACE,
        seeds = [b"proposal", dao_config.total_proposals.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, DaoProposal>,
    #[account(
        mut,
        seeds = [b"dao_config"],
        bump
    )]
    pub dao_config: Account<'info, DaoConfig>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct CastVote<'info> {
    #[account(
        init,
        payer = voter,
        space = 8 + DaoVote::INIT_SPACE,
        seeds = [b"dao_vote", proposal_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub dao_vote: Account<'info, DaoVote>,
    #[account(
        mut,
        seeds = [b"proposal", proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, DaoProposal>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_proposal_id: u64)]
pub struct ExecuteProposal<'info> {
    #[account(
        mut,
        seeds = [b"proposal", _proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, DaoProposal>,
    #[account(
        mut,
        seeds = [b"dao_config"],
        bump,
        has_one = authority @ DaoError::Unauthorized
    )]
    pub dao_config: Account<'info, DaoConfig>,
    pub authority: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct DaoConfig {
    pub authority: Pubkey,       // 32
    pub vote_threshold: u8,      // 1
    pub total_proposals: u64,    // 8
    pub total_executed: u64,     // 8
}

#[account]
#[derive(InitSpace)]
pub struct DaoProposal {
    pub proposer: Pubkey,            // 32
    pub proposal_id: u64,            // 8
    #[max_len(100)]
    pub title: String,               // 4 + 100
    #[max_len(200)]
    pub description: String,         // 4 + 200
    pub votes_for: u16,              // 2
    pub votes_against: u16,          // 2
    pub executed: bool,              // 1
    pub created_at: i64,             // 8
}

#[account]
#[derive(InitSpace)]
pub struct DaoVote {
    pub voter: Pubkey,           // 32
    pub proposal_id: u64,        // 8
    pub approve: bool,           // 1
    pub voted_at: i64,           // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum DaoError {
    #[msg("Unauthorized — only the DAO authority can perform this action")]
    Unauthorized,
    #[msg("Proposal not found")]
    ProposalNotFound,
    #[msg("Already voted on this proposal")]
    AlreadyVoted,
    #[msg("Proposal has already been executed")]
    ProposalAlreadyExecuted,
    #[msg("Insufficient votes to execute proposal")]
    InsufficientVotes,
    #[msg("Title too long — max 100 characters")]
    TitleTooLong,
    #[msg("Description too long — max 200 characters")]
    DescriptionTooLong,
}
