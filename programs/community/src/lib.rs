use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod community {
    use super::*;

    /// Create a new agent community (guild).
    /// The founder deposits an initial treasury amount and becomes the admin.
    pub fn create_community(
        ctx: Context<CreateCommunity>,
        community_id: String,
        name: String,
        description: String,
        initial_deposit: u64,
        revenue_share_bps: u16, // basis points (e.g. 1000 = 10%)
    ) -> Result<()> {
        require!(name.len() <= 50, CommunityError::NameTooLong);
        require!(description.len() <= 200, CommunityError::DescriptionTooLong);
        require!(community_id.len() <= 32, CommunityError::IdTooLong);
        require!(revenue_share_bps <= 5000, CommunityError::ShareTooHigh); // max 50%

        let community = &mut ctx.accounts.community;
        community.community_id = community_id;
        community.name = name;
        community.description = description;
        community.admin = ctx.accounts.founder.key();
        community.member_count = 1; // founder is first member
        community.treasury_balance = initial_deposit;
        community.tasks_completed = 0;
        community.total_earned = 0;
        community.revenue_share_bps = revenue_share_bps;
        community.created_at = Clock::get()?.unix_timestamp;
        community.is_active = true;
        community.bump = ctx.bumps.community;

        // Transfer initial deposit to community PDA
        if initial_deposit > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.founder.to_account_info(),
                to: community.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                cpi_accounts,
            );
            transfer(cpi_ctx, initial_deposit)?;
        }

        // Initialize founder's membership
        let membership = &mut ctx.accounts.founder_membership;
        membership.community = community.key();
        membership.agent = ctx.accounts.founder.key();
        membership.role = MemberRole::Admin;
        membership.joined_at = Clock::get()?.unix_timestamp;
        membership.earnings = 0;
        membership.tasks_completed = 0;
        membership.is_active = true;
        membership.bump = ctx.bumps.founder_membership;

        msg!("Community created: {} by {}", community.name, community.admin);
        Ok(())
    }

    /// Agent requests to join a community. Admin must approve.
    pub fn join_community(ctx: Context<JoinCommunity>) -> Result<()> {
        let community = &ctx.accounts.community;
        require!(community.is_active, CommunityError::CommunityInactive);

        let membership = &mut ctx.accounts.membership;
        membership.community = community.key();
        membership.agent = ctx.accounts.agent.key();
        membership.role = MemberRole::Pending;
        membership.joined_at = Clock::get()?.unix_timestamp;
        membership.earnings = 0;
        membership.tasks_completed = 0;
        membership.is_active = false; // not active until approved
        membership.bump = ctx.bumps.membership;

        msg!("Agent {} requested to join {}", ctx.accounts.agent.key(), community.name);
        Ok(())
    }

    /// Admin approves a pending member.
    pub fn approve_member(ctx: Context<ApproveMember>, role: u8) -> Result<()> {
        let community = &mut ctx.accounts.community;
        require!(
            community.admin == ctx.accounts.admin.key(),
            CommunityError::Unauthorized
        );

        let membership = &mut ctx.accounts.membership;
        require!(
            membership.role == MemberRole::Pending,
            CommunityError::NotPending
        );

        membership.role = match role {
            0 => MemberRole::Member,
            1 => MemberRole::Contributor,
            2 => MemberRole::Admin,
            _ => MemberRole::Member,
        };
        membership.is_active = true;
        community.member_count += 1;

        msg!("Member approved in {}", community.name);
        Ok(())
    }

    /// Agent leaves a community voluntarily.
    pub fn leave_community(ctx: Context<LeaveCommunity>) -> Result<()> {
        let community = &mut ctx.accounts.community;
        let membership = &mut ctx.accounts.membership;

        require!(membership.is_active, CommunityError::NotActiveMember);
        require!(
            membership.agent == ctx.accounts.agent.key(),
            CommunityError::Unauthorized
        );
        // Admin cannot leave — must transfer admin first
        require!(
            membership.role != MemberRole::Admin,
            CommunityError::AdminCannotLeave
        );

        membership.is_active = false;
        community.member_count = community.member_count.saturating_sub(1);

        msg!("Agent left community {}", community.name);
        Ok(())
    }

    /// Deposit SOL into the community treasury. Any member can contribute.
    pub fn deposit_treasury(ctx: Context<DepositTreasury>, amount: u64) -> Result<()> {
        require!(amount > 0, CommunityError::ZeroAmount);
        let membership = &ctx.accounts.membership;
        require!(membership.is_active, CommunityError::NotActiveMember);

        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.community.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
        );
        transfer(cpi_ctx, amount)?;

        let community = &mut ctx.accounts.community;
        community.treasury_balance += amount;

        msg!("Deposited {} lamports to {} treasury", amount, community.name);
        Ok(())
    }

    /// Create a community-funded task. Locks SOL from treasury into a task PDA.
    pub fn create_community_task(
        ctx: Context<CreateCommunityTask>,
        task_id: String,
        bounty_amount: u64,
        description: String,
    ) -> Result<()> {
        let community = &mut ctx.accounts.community;
        let membership = &ctx.accounts.admin_membership;

        require!(community.is_active, CommunityError::CommunityInactive);
        require!(
            membership.role == MemberRole::Admin || membership.role == MemberRole::Contributor,
            CommunityError::InsufficientRole
        );
        require!(
            community.treasury_balance >= bounty_amount,
            CommunityError::InsufficientTreasury
        );
        require!(task_id.len() <= 50, CommunityError::IdTooLong);
        require!(description.len() <= 200, CommunityError::DescriptionTooLong);

        let task = &mut ctx.accounts.community_task;
        task.community = community.key();
        task.task_id = task_id;
        task.description = description;
        task.bounty_amount = bounty_amount;
        task.status = TaskStatus::Open;
        task.assigned_agent = None;
        task.completed_agent = None;
        task.created_at = Clock::get()?.unix_timestamp;
        task.completed_at = None;
        task.community_share = 0;
        task.agent_share = 0;
        task.bump = ctx.bumps.community_task;

        // Transfer from community PDA to task PDA
        let community_key = community.community_id.clone();
        let admin_key = community.admin;
        let bump = community.bump;
        let seeds: &[&[u8]] = &[
            b"community",
            admin_key.as_ref(),
            community_key.as_bytes(),
            &[bump],
        ];

        **community.to_account_info().try_borrow_mut_lamports()? -= bounty_amount;
        **task.to_account_info().try_borrow_mut_lamports()? += bounty_amount;

        community.treasury_balance -= bounty_amount;

        msg!(
            "Community task created: {} with {} lamport bounty",
            task.task_id,
            bounty_amount
        );
        Ok(())
    }

    /// Assign a community task to an agent. Agent can be a member or external.
    pub fn assign_community_task(
        ctx: Context<AssignCommunityTask>,
        agent: Pubkey,
    ) -> Result<()> {
        let community = &ctx.accounts.community;
        let membership = &ctx.accounts.admin_membership;
        let task = &mut ctx.accounts.community_task;

        require!(
            membership.role == MemberRole::Admin || membership.role == MemberRole::Contributor,
            CommunityError::InsufficientRole
        );
        require!(task.status == TaskStatus::Open, CommunityError::InvalidTaskStatus);

        task.assigned_agent = Some(agent);
        task.status = TaskStatus::InProgress;

        msg!("Community task {} assigned to {}", task.task_id, agent);
        Ok(())
    }

    /// Complete a community task. Splits payment between agent and community treasury.
    pub fn complete_community_task(ctx: Context<CompleteCommunityTask>) -> Result<()> {
        let community = &mut ctx.accounts.community;
        let task = &mut ctx.accounts.community_task;

        require!(
            community.admin == ctx.accounts.admin.key(),
            CommunityError::Unauthorized
        );
        require!(
            task.status == TaskStatus::InProgress,
            CommunityError::InvalidTaskStatus
        );

        // Verify correct agent
        let agent = &ctx.accounts.agent;
        if let Some(assigned) = task.assigned_agent {
            require!(assigned == agent.key(), CommunityError::WrongAgent);
        }

        let bounty = task.bounty_amount;
        let share_bps = community.revenue_share_bps as u64;

        // Calculate split: community gets revenue_share_bps, agent gets the rest
        let community_cut = bounty.checked_mul(share_bps).unwrap_or(0) / 10_000;
        let agent_cut = bounty.saturating_sub(community_cut);

        // Pay the agent
        **task.to_account_info().try_borrow_mut_lamports()? -= bounty;
        **agent.to_account_info().try_borrow_mut_lamports()? += agent_cut;

        // Return community cut to treasury
        if community_cut > 0 {
            **community.to_account_info().try_borrow_mut_lamports()? += community_cut;
            community.treasury_balance += community_cut;
        }

        task.status = TaskStatus::Completed;
        task.completed_agent = Some(agent.key());
        task.completed_at = Some(Clock::get()?.unix_timestamp);
        task.community_share = community_cut;
        task.agent_share = agent_cut;

        community.tasks_completed += 1;
        community.total_earned += bounty;

        // Update member stats if agent is a member
        if ctx.accounts.agent_membership.is_active {
            let agent_membership = &mut ctx.accounts.agent_membership;
            agent_membership.tasks_completed += 1;
            agent_membership.earnings += agent_cut;
        }

        msg!(
            "Community task completed! Agent: {} ({} lamports), Treasury: {} lamports",
            agent.key(),
            agent_cut,
            community_cut
        );
        Ok(())
    }

    /// Transfer admin role to another member.
    pub fn transfer_admin(ctx: Context<TransferAdmin>) -> Result<()> {
        let community = &mut ctx.accounts.community;
        require!(
            community.admin == ctx.accounts.current_admin.key(),
            CommunityError::Unauthorized
        );

        let new_admin_membership = &mut ctx.accounts.new_admin_membership;
        require!(new_admin_membership.is_active, CommunityError::NotActiveMember);

        let old_admin_membership = &mut ctx.accounts.old_admin_membership;
        old_admin_membership.role = MemberRole::Member;
        new_admin_membership.role = MemberRole::Admin;
        community.admin = new_admin_membership.agent;

        msg!("Admin transferred to {}", community.admin);
        Ok(())
    }
}

// ─── Account Structs ────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(community_id: String)]
pub struct CreateCommunity<'info> {
    #[account(mut)]
    pub founder: Signer<'info>,

    #[account(
        init,
        payer = founder,
        space = 8 + CommunityAccount::INIT_SPACE,
        seeds = [b"community", founder.key().as_ref(), community_id.as_bytes()],
        bump
    )]
    pub community: Account<'info, CommunityAccount>,

    #[account(
        init,
        payer = founder,
        space = 8 + Membership::INIT_SPACE,
        seeds = [b"member", community.key().as_ref(), founder.key().as_ref()],
        bump
    )]
    pub founder_membership: Account<'info, Membership>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinCommunity<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    pub community: Account<'info, CommunityAccount>,

    #[account(
        init,
        payer = agent,
        space = 8 + Membership::INIT_SPACE,
        seeds = [b"member", community.key().as_ref(), agent.key().as_ref()],
        bump
    )]
    pub membership: Account<'info, Membership>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveMember<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityAccount>,

    #[account(mut)]
    pub membership: Account<'info, Membership>,
}

#[derive(Accounts)]
pub struct LeaveCommunity<'info> {
    pub agent: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityAccount>,

    #[account(
        mut,
        seeds = [b"member", community.key().as_ref(), agent.key().as_ref()],
        bump = membership.bump
    )]
    pub membership: Account<'info, Membership>,
}

#[derive(Accounts)]
pub struct DepositTreasury<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityAccount>,

    #[account(
        seeds = [b"member", community.key().as_ref(), depositor.key().as_ref()],
        bump = membership.bump
    )]
    pub membership: Account<'info, Membership>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct CreateCommunityTask<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityAccount>,

    #[account(
        seeds = [b"member", community.key().as_ref(), admin.key().as_ref()],
        bump = admin_membership.bump
    )]
    pub admin_membership: Account<'info, Membership>,

    #[account(
        init,
        payer = admin,
        space = 8 + CommunityTask::INIT_SPACE,
        seeds = [b"ctask", community.key().as_ref(), task_id.as_bytes()],
        bump
    )]
    pub community_task: Account<'info, CommunityTask>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AssignCommunityTask<'info> {
    pub admin: Signer<'info>,

    pub community: Account<'info, CommunityAccount>,

    #[account(
        seeds = [b"member", community.key().as_ref(), admin.key().as_ref()],
        bump = admin_membership.bump
    )]
    pub admin_membership: Account<'info, Membership>,

    #[account(mut)]
    pub community_task: Account<'info, CommunityTask>,
}

#[derive(Accounts)]
pub struct CompleteCommunityTask<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityAccount>,

    #[account(mut)]
    pub community_task: Account<'info, CommunityTask>,

    /// CHECK: Agent receiving payment. Verified against assigned_agent.
    #[account(mut)]
    pub agent: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"member", community.key().as_ref(), agent.key().as_ref()],
        bump = agent_membership.bump
    )]
    pub agent_membership: Account<'info, Membership>,
}

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    pub current_admin: Signer<'info>,

    #[account(mut)]
    pub community: Account<'info, CommunityAccount>,

    #[account(
        mut,
        seeds = [b"member", community.key().as_ref(), current_admin.key().as_ref()],
        bump = old_admin_membership.bump
    )]
    pub old_admin_membership: Account<'info, Membership>,

    #[account(mut)]
    pub new_admin_membership: Account<'info, Membership>,
}

// ─── Data Accounts ──────────────────────────────────────────────────────────

#[account]
pub struct CommunityAccount {
    pub community_id: String,      // 4 + 32
    pub name: String,              // 4 + 50
    pub description: String,       // 4 + 200
    pub admin: Pubkey,             // 32
    pub member_count: u32,         // 4
    pub treasury_balance: u64,     // 8
    pub tasks_completed: u64,      // 8
    pub total_earned: u64,         // 8
    pub revenue_share_bps: u16,    // 2 (basis points, e.g. 1000 = 10%)
    pub created_at: i64,           // 8
    pub is_active: bool,           // 1
    pub bump: u8,                  // 1
}

impl CommunityAccount {
    // 36 + 54 + 204 + 32 + 4 + 8 + 8 + 8 + 2 + 8 + 1 + 1 = 366 + padding
    pub const INIT_SPACE: usize = 400;
}

#[account]
pub struct Membership {
    pub community: Pubkey,         // 32
    pub agent: Pubkey,             // 32
    pub role: MemberRole,          // 1 + 1
    pub joined_at: i64,            // 8
    pub earnings: u64,             // 8
    pub tasks_completed: u64,      // 8
    pub is_active: bool,           // 1
    pub bump: u8,                  // 1
}

impl Membership {
    // 32 + 32 + 2 + 8 + 8 + 8 + 1 + 1 = 92 + padding
    pub const INIT_SPACE: usize = 128;
}

#[account]
pub struct CommunityTask {
    pub community: Pubkey,         // 32
    pub task_id: String,           // 4 + 50
    pub description: String,       // 4 + 200
    pub bounty_amount: u64,        // 8
    pub status: TaskStatus,        // 1 + 1
    pub assigned_agent: Option<Pubkey>,  // 1 + 32
    pub completed_agent: Option<Pubkey>, // 1 + 32
    pub created_at: i64,           // 8
    pub completed_at: Option<i64>, // 1 + 8
    pub community_share: u64,      // 8 (how much went back to treasury)
    pub agent_share: u64,          // 8 (how much agent got)
    pub bump: u8,                  // 1
}

impl CommunityTask {
    // 32 + 54 + 204 + 8 + 2 + 33 + 33 + 8 + 9 + 8 + 8 + 1 = 400 + padding
    pub const INIT_SPACE: usize = 450;
}

// ─── Enums ──────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MemberRole {
    Pending,      // Awaiting admin approval
    Member,       // Basic member
    Contributor,  // Can create tasks, manage work
    Admin,        // Full control
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
}

// ─── Errors ─────────────────────────────────────────────────────────────────

#[error_code]
pub enum CommunityError {
    #[msg("Community name too long (max 50 chars)")]
    NameTooLong,
    #[msg("Description too long (max 200 chars)")]
    DescriptionTooLong,
    #[msg("Community ID too long (max 32 chars)")]
    IdTooLong,
    #[msg("Revenue share too high (max 50%)")]
    ShareTooHigh,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Community is inactive")]
    CommunityInactive,
    #[msg("Member is not in pending state")]
    NotPending,
    #[msg("Not an active member")]
    NotActiveMember,
    #[msg("Admin cannot leave — transfer admin role first")]
    AdminCannotLeave,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient treasury balance")]
    InsufficientTreasury,
    #[msg("Insufficient role for this action")]
    InsufficientRole,
    #[msg("Invalid task status for this action")]
    InvalidTaskStatus,
    #[msg("Wrong agent for this task")]
    WrongAgent,
}
