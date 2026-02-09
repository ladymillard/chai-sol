// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("JPUF45g74unHDdtccYxVYobassz855JN9ip4EauusmF");

#[program]
pub mod marketplace {
    use super::*;

    /// Initialize the marketplace configuration
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.market_config;
        config.authority = ctx.accounts.authority.key();
        config.total_listings = 0;
        config.total_matches = 0;
        msg!("Marketplace initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// List a new task on the marketplace
    pub fn list_task(
        ctx: Context<ListTask>,
        task_id: String,
        description: String,
        required_skill: String,
        min_reputation: u8,
    ) -> Result<()> {
        require!(task_id.len() <= 50, MarketplaceError::TaskIdTooLong);
        require!(description.len() <= 200, MarketplaceError::DescriptionTooLong);
        require!(required_skill.len() <= 50, MarketplaceError::SkillTooLong);

        let listing = &mut ctx.accounts.task_listing;
        let config = &mut ctx.accounts.market_config;
        let clock = Clock::get()?;

        listing.poster = ctx.accounts.poster.key();
        listing.task_id = task_id.clone();
        listing.description = description;
        listing.required_skill = required_skill;
        listing.min_reputation = min_reputation;
        listing.matched_agent = None;
        listing.status = ListingStatus::Open;
        listing.created_at = clock.unix_timestamp;

        config.total_listings += 1;

        msg!("Task listed: {}", task_id);
        Ok(())
    }

    /// Agent applies for a task
    pub fn apply_for_task(ctx: Context<ApplyForTask>, task_id: String) -> Result<()> {
        require!(task_id.len() <= 50, MarketplaceError::TaskIdTooLong);

        let listing = &ctx.accounts.task_listing;
        require!(listing.status == ListingStatus::Open, MarketplaceError::ListingNotOpen);

        let application = &mut ctx.accounts.application;
        let clock = Clock::get()?;

        application.agent = ctx.accounts.agent.key();
        application.task_id = task_id.clone();
        application.applied_at = clock.unix_timestamp;
        application.selected = false;

        msg!("Agent {} applied for task {}", application.agent, task_id);
        Ok(())
    }

    /// Poster selects an agent for a task
    pub fn match_agent(ctx: Context<MatchAgent>, task_id: String, agent: Pubkey) -> Result<()> {
        let listing = &mut ctx.accounts.task_listing;
        let config = &mut ctx.accounts.market_config;
        let application = &mut ctx.accounts.application;

        require!(
            listing.poster == ctx.accounts.poster.key(),
            MarketplaceError::Unauthorized
        );
        require!(listing.status == ListingStatus::Open, MarketplaceError::ListingNotOpen);
        require!(application.agent == agent, MarketplaceError::Unauthorized);

        listing.matched_agent = Some(agent);
        listing.status = ListingStatus::Matched;
        application.selected = true;
        config.total_matches += 1;

        msg!("Agent {} matched to task {}", agent, task_id);
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MarketConfig::INIT_SPACE,
        seeds = [b"market_config"],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct ListTask<'info> {
    #[account(
        init,
        payer = poster,
        space = 8 + TaskListing::INIT_SPACE,
        seeds = [b"listing", task_id.as_bytes()],
        bump
    )]
    pub task_listing: Account<'info, TaskListing>,
    #[account(
        mut,
        seeds = [b"market_config"],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub poster: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct ApplyForTask<'info> {
    #[account(
        init,
        payer = agent,
        space = 8 + Application::INIT_SPACE,
        seeds = [b"application", task_id.as_bytes(), agent.key().as_ref()],
        bump
    )]
    pub application: Account<'info, Application>,
    #[account(
        seeds = [b"listing", task_id.as_bytes()],
        bump
    )]
    pub task_listing: Account<'info, TaskListing>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String, agent: Pubkey)]
pub struct MatchAgent<'info> {
    #[account(
        mut,
        seeds = [b"listing", task_id.as_bytes()],
        bump
    )]
    pub task_listing: Account<'info, TaskListing>,
    #[account(
        mut,
        seeds = [b"application", task_id.as_bytes(), agent.as_ref()],
        bump
    )]
    pub application: Account<'info, Application>,
    #[account(
        mut,
        seeds = [b"market_config"],
        bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub poster: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct MarketConfig {
    pub authority: Pubkey,       // 32
    pub total_listings: u64,     // 8
    pub total_matches: u64,      // 8
}

#[account]
#[derive(InitSpace)]
pub struct TaskListing {
    pub poster: Pubkey,              // 32
    #[max_len(50)]
    pub task_id: String,             // 4 + 50
    #[max_len(200)]
    pub description: String,         // 4 + 200
    #[max_len(50)]
    pub required_skill: String,      // 4 + 50
    pub min_reputation: u8,          // 1
    pub matched_agent: Option<Pubkey>, // 1 + 32
    pub status: ListingStatus,       // 1
    pub created_at: i64,             // 8
}

#[account]
#[derive(InitSpace)]
pub struct Application {
    pub agent: Pubkey,           // 32
    #[max_len(50)]
    pub task_id: String,         // 4 + 50
    pub applied_at: i64,         // 8
    pub selected: bool,          // 1
}

// ── Enums ─────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ListingStatus {
    Open,
    Matched,
    Closed,
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum MarketplaceError {
    #[msg("Unauthorized — you are not the task poster")]
    Unauthorized,
    #[msg("Task ID too long — max 50 characters")]
    TaskIdTooLong,
    #[msg("Description too long — max 200 characters")]
    DescriptionTooLong,
    #[msg("Skill too long — max 50 characters")]
    SkillTooLong,
    #[msg("Listing is not open")]
    ListingNotOpen,
    #[msg("Agent has already applied for this task")]
    AlreadyApplied,
}
