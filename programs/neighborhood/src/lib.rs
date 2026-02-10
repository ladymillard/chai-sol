// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("9cv9hvmMXBHJtqsRRR8jHgW36NWJ2a9zbf3rR94di9Xj");

#[program]
pub mod neighborhood {
    use super::*;

    /// Initialize the neighborhood configuration — sets the calling wallet as authority.
    pub fn initialize(ctx: Context<InitializeNeighborhood>) -> Result<()> {
        let config = &mut ctx.accounts.neighborhood_config;
        config.authority = ctx.accounts.authority.key();
        config.total_links = 0;
        config.total_active = 0;

        msg!("Neighborhood initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Create a directional link from the signer's container to a target agent's container.
    pub fn create_link(ctx: Context<CreateLink>, target: Pubkey) -> Result<()> {
        let from = ctx.accounts.from_agent.key();
        require!(from != target, NeighborhoodError::CannotLinkToSelf);

        let link = &mut ctx.accounts.link;
        let config = &mut ctx.accounts.neighborhood_config;
        let clock = Clock::get()?;

        link.from_agent = from;
        link.to_agent = target;
        link.status = LinkStatus::Pending;
        link.created_at = clock.unix_timestamp;
        link.accepted_at = None;

        config.total_links = config.total_links.saturating_add(1);

        msg!("Link created: {} -> {}", from, target);
        Ok(())
    }

    /// Target agent accepts an incoming link, making it bidirectional / active.
    pub fn accept_link(ctx: Context<AcceptLink>) -> Result<()> {
        let link = &mut ctx.accounts.link;
        let config = &mut ctx.accounts.neighborhood_config;
        let clock = Clock::get()?;

        require!(
            link.status == LinkStatus::Pending,
            NeighborhoodError::LinkNotFound
        );

        link.status = LinkStatus::Active;
        link.accepted_at = Some(clock.unix_timestamp);

        config.total_active = config.total_active.saturating_add(1);

        msg!(
            "Link accepted: {} <-> {}",
            link.from_agent,
            link.to_agent
        );
        Ok(())
    }

    /// Remove a link — either the from-agent or the to-agent may remove it.
    pub fn remove_link(ctx: Context<RemoveLink>, _target: Pubkey) -> Result<()> {
        let link = &mut ctx.accounts.link;
        let config = &mut ctx.accounts.neighborhood_config;
        let signer = ctx.accounts.signer.key();

        require!(
            signer == link.from_agent || signer == link.to_agent,
            NeighborhoodError::Unauthorized
        );

        if link.status == LinkStatus::Active {
            config.total_active = config.total_active.saturating_sub(1);
        }

        link.status = LinkStatus::Removed;

        msg!(
            "Link removed between {} and {} by {}",
            link.from_agent,
            link.to_agent,
            signer
        );
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeNeighborhood<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + NeighborhoodConfig::INIT_SPACE,
        seeds = [b"neighborhood_config"],
        bump
    )]
    pub neighborhood_config: Account<'info, NeighborhoodConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(target: Pubkey)]
pub struct CreateLink<'info> {
    #[account(
        init,
        payer = from_agent,
        space = 8 + Link::INIT_SPACE,
        seeds = [b"link", from_agent.key().as_ref(), target.as_ref()],
        bump
    )]
    pub link: Account<'info, Link>,
    #[account(
        mut,
        seeds = [b"neighborhood_config"],
        bump
    )]
    pub neighborhood_config: Account<'info, NeighborhoodConfig>,
    #[account(mut)]
    pub from_agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptLink<'info> {
    #[account(
        mut,
        constraint = link.to_agent == to_agent.key() @ NeighborhoodError::Unauthorized
    )]
    pub link: Account<'info, Link>,
    #[account(
        mut,
        seeds = [b"neighborhood_config"],
        bump
    )]
    pub neighborhood_config: Account<'info, NeighborhoodConfig>,
    pub to_agent: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(target: Pubkey)]
pub struct RemoveLink<'info> {
    #[account(
        mut,
        seeds = [b"link", link.from_agent.as_ref(), link.to_agent.as_ref()],
        bump,
        constraint = link.status != LinkStatus::Removed @ NeighborhoodError::LinkNotFound
    )]
    pub link: Account<'info, Link>,
    #[account(
        mut,
        seeds = [b"neighborhood_config"],
        bump
    )]
    pub neighborhood_config: Account<'info, NeighborhoodConfig>,
    pub signer: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct NeighborhoodConfig {
    pub authority: Pubkey,       // 32
    pub total_links: u64,        // 8
    pub total_active: u64,       // 8
}

#[account]
#[derive(InitSpace)]
pub struct Link {
    pub from_agent: Pubkey,      // 32
    pub to_agent: Pubkey,        // 32
    pub status: LinkStatus,      // 1 + 1
    pub created_at: i64,         // 8
    pub accepted_at: Option<i64>, // 1 + 8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum LinkStatus {
    Pending,
    Active,
    Removed,
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum NeighborhoodError {
    #[msg("Unauthorized — you are not a party to this link")]
    Unauthorized,
    #[msg("Link already exists between these agents")]
    LinkAlreadyExists,
    #[msg("Link not found or already removed")]
    LinkNotFound,
    #[msg("Cannot create a link to yourself")]
    CannotLinkToSelf,
}
