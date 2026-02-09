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

    /// Initialize the neighborhood mesh
    pub fn initialize(ctx: Context<InitializeNeighborhood>) -> Result<()> {
        let config = &mut ctx.accounts.neighborhood_config;
        config.authority = ctx.accounts.authority.key();
        config.total_links = 0;
        config.total_active = 0;
        msg!("Neighborhood mesh initialized");
        Ok(())
    }

    /// Create a directional link from one container to another
    pub fn create_link(ctx: Context<CreateLink>, target: Pubkey) -> Result<()> {
        require!(
            ctx.accounts.from_agent.key() != target,
            NeighborhoodError::CannotLinkToSelf
        );

        let link = &mut ctx.accounts.link;
        let config = &mut ctx.accounts.neighborhood_config;

        link.from_agent = ctx.accounts.from_agent.key();
        link.to_agent = target;
        link.status = LinkStatus::Pending;
        link.created_at = Clock::get()?.unix_timestamp;
        link.accepted_at = None;

        config.total_links += 1;

        msg!("Link created: {} → {}", link.from_agent, target);
        Ok(())
    }

    /// Accept a pending link — makes it bidirectional
    pub fn accept_link(ctx: Context<AcceptLink>) -> Result<()> {
        let link = &mut ctx.accounts.link;
        let config = &mut ctx.accounts.neighborhood_config;

        require!(
            link.status == LinkStatus::Pending,
            NeighborhoodError::LinkNotFound
        );

        link.status = LinkStatus::Active;
        link.accepted_at = Some(Clock::get()?.unix_timestamp);
        config.total_active += 1;

        msg!("Link accepted: {} ↔ {}", link.from_agent, link.to_agent);
        Ok(())
    }

    /// Remove a link — either party can remove
    pub fn remove_link(ctx: Context<RemoveLink>) -> Result<()> {
        let link = &mut ctx.accounts.link;
        let config = &mut ctx.accounts.neighborhood_config;

        if link.status == LinkStatus::Active {
            config.total_active -= 1;
        }

        link.status = LinkStatus::Removed;

        msg!("Link removed: {} — {}", link.from_agent, link.to_agent);
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
    #[account(mut)]
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
    #[account(mut)]
    pub neighborhood_config: Account<'info, NeighborhoodConfig>,
    pub to_agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct RemoveLink<'info> {
    #[account(
        mut,
        constraint = (link.from_agent == signer.key() || link.to_agent == signer.key()) @ NeighborhoodError::Unauthorized
    )]
    pub link: Account<'info, Link>,
    #[account(mut)]
    pub neighborhood_config: Account<'info, NeighborhoodConfig>,
    pub signer: Signer<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct NeighborhoodConfig {
    pub authority: Pubkey,         // 32
    pub total_links: u64,          // 8
    pub total_active: u64,         // 8
}

#[account]
#[derive(InitSpace)]
pub struct Link {
    pub from_agent: Pubkey,        // 32
    pub to_agent: Pubkey,          // 32
    pub status: LinkStatus,        // 1
    pub created_at: i64,           // 8
    pub accepted_at: Option<i64>,  // 1 + 8
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
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Cannot link to self")]
    CannotLinkToSelf,
    #[msg("Link not found or not in expected state")]
    LinkNotFound,
}
