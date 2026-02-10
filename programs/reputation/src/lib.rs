// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("7uvTHPtBJkG2QRimn8pZdb5XUMBHdtCueQSkXLSBD1JX"); // Placeholder — replaced at deploy

#[program]
pub mod reputation {
    use super::*;

    /// Initialize the reputation authority (admin/oracle)
    pub fn initialize(ctx: Context<InitializeReputation>) -> Result<()> {
        let config = &mut ctx.accounts.reputation_config;
        config.authority = ctx.accounts.authority.key();
        config.total_reviews = 0;
        config.total_agents_scored = 0;
        msg!("Reputation system initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Record a completed task review — only authority (oracle) can call
    pub fn record_review(
        ctx: Context<RecordReview>,
        agent: Pubkey,
        task_id: String,
        score: u8,
        review_notes: String,
    ) -> Result<()> {
        require!(score <= 100, ReputationError::InvalidScore);
        require!(task_id.len() <= 50, ReputationError::TaskIdTooLong);
        require!(review_notes.len() <= 200, ReputationError::NotesTooLong);

        let review = &mut ctx.accounts.review_account;
        let config = &mut ctx.accounts.reputation_config;
        let clock = Clock::get()?;

        review.agent = agent;
        review.reviewer = ctx.accounts.authority.key();
        review.task_id = task_id;
        review.score = score;
        review.notes = review_notes;
        review.timestamp = clock.unix_timestamp;

        config.total_reviews += 1;

        msg!("Review recorded for agent {}. Score: {}/100", agent, score);
        Ok(())
    }

    /// Update an agent's aggregate reputation score — only authority
    pub fn update_score(
        ctx: Context<UpdateScore>,
        agent: Pubkey,
        new_score: u8,
        tasks_reviewed: u64,
    ) -> Result<()> {
        require!(new_score <= 100, ReputationError::InvalidScore);

        let agent_rep = &mut ctx.accounts.agent_reputation;
        let config = &mut ctx.accounts.reputation_config;

        let is_new = agent_rep.score == 0 && agent_rep.tasks_reviewed == 0;

        agent_rep.agent = agent;
        agent_rep.score = new_score;
        agent_rep.tasks_reviewed = tasks_reviewed;
        agent_rep.last_updated = Clock::get()?.unix_timestamp;

        if is_new {
            config.total_agents_scored += 1;
        }

        msg!(
            "Agent {} reputation updated: {}/100 ({} tasks reviewed)",
            agent_rep.agent,
            new_score,
            tasks_reviewed
        );
        Ok(())
    }

    /// Flag an agent for suspicious activity (anti-bot measure)
    pub fn flag_agent(
        ctx: Context<FlagAgent>,
        reason: String,
    ) -> Result<()> {
        require!(reason.len() <= 200, ReputationError::NotesTooLong);

        let agent_rep = &mut ctx.accounts.agent_reputation;
        agent_rep.flagged = true;
        agent_rep.flag_reason = reason.clone();
        agent_rep.score = 0; // Zero out score when flagged

        msg!("Agent {} FLAGGED: {}", agent_rep.agent, reason);
        Ok(())
    }

    /// Unflag an agent after review
    pub fn unflag_agent(ctx: Context<FlagAgent>) -> Result<()> {
        let agent_rep = &mut ctx.accounts.agent_reputation;
        agent_rep.flagged = false;
        agent_rep.flag_reason = String::new();

        msg!("Agent {} unflagged", agent_rep.agent);
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeReputation<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ReputationConfig::INIT_SPACE,
        seeds = [b"reputation_config"],
        bump
    )]
    pub reputation_config: Account<'info, ReputationConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent: Pubkey, task_id: String)]
pub struct RecordReview<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ReviewAccount::INIT_SPACE,
        seeds = [b"review", agent.as_ref(), task_id.as_bytes()],
        bump
    )]
    pub review_account: Account<'info, ReviewAccount>,
    #[account(
        mut,
        seeds = [b"reputation_config"],
        bump,
        has_one = authority @ ReputationError::Unauthorized
    )]
    pub reputation_config: Account<'info, ReputationConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent: Pubkey)]
pub struct UpdateScore<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + AgentReputation::INIT_SPACE,
        seeds = [b"agent_rep", agent.as_ref()],
        bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,
    #[account(
        mut,
        seeds = [b"reputation_config"],
        bump,
        has_one = authority @ ReputationError::Unauthorized
    )]
    pub reputation_config: Account<'info, ReputationConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FlagAgent<'info> {
    #[account(mut)]
    pub agent_reputation: Account<'info, AgentReputation>,
    #[account(
        seeds = [b"reputation_config"],
        bump,
        has_one = authority @ ReputationError::Unauthorized
    )]
    pub reputation_config: Account<'info, ReputationConfig>,
    pub authority: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct ReputationConfig {
    pub authority: Pubkey,         // 32 — oracle/admin who can write scores
    pub total_reviews: u64,        // 8
    pub total_agents_scored: u64,  // 8
}

#[account]
#[derive(InitSpace)]
pub struct ReviewAccount {
    pub agent: Pubkey,             // 32
    pub reviewer: Pubkey,          // 32
    #[max_len(50)]
    pub task_id: String,           // 4 + 50
    pub score: u8,                 // 1
    #[max_len(200)]
    pub notes: String,             // 4 + 200
    pub timestamp: i64,            // 8
}

#[account]
#[derive(InitSpace)]
pub struct AgentReputation {
    pub agent: Pubkey,             // 32
    pub score: u8,                 // 1 — aggregate 0-100
    pub tasks_reviewed: u64,       // 8
    pub last_updated: i64,         // 8
    pub flagged: bool,             // 1 — anti-bot flag
    #[max_len(200)]
    pub flag_reason: String,       // 4 + 200
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum ReputationError {
    #[msg("Unauthorized — only the reputation authority can perform this action")]
    Unauthorized,
    #[msg("Invalid score — must be 0-100")]
    InvalidScore,
    #[msg("Task ID too long — max 50 characters")]
    TaskIdTooLong,
    #[msg("Notes too long — max 200 characters")]
    NotesTooLong,
}
