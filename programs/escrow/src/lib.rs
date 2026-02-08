use anchor_lang::prelude::*;

declare_id!("Escrow11111111111111111111111111111111111111");

#[program]
pub mod escrow {
    use super::*;

    // ─── Task Lifecycle ───────────────────────────────────────────────

    /// 1. Poster deposits SOL into a TaskEscrow PDA.
    pub fn initialize_task(
        ctx: Context<InitializeTask>,
        task_id: String,
        bounty_amount: u64,
        description: String,
    ) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        task_escrow.poster = ctx.accounts.poster.key();
        task_escrow.task_id = task_id;
        task_escrow.description = description;
        task_escrow.bounty_amount = bounty_amount;
        task_escrow.status = TaskStatus::Open;
        task_escrow.created_at = Clock::get()?.unix_timestamp;
        task_escrow.bump = ctx.bumps.task_escrow;

        // Transfer SOL from poster to escrow PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.poster.key(),
            &task_escrow.key(),
            bounty_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.poster.to_account_info(),
                task_escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Task created: {} | bounty {} lamports", task_escrow.task_id, bounty_amount);
        Ok(())
    }

    /// 2. Poster assigns a specific agent to the task
    pub fn assign_agent(ctx: Context<AssignAgent>, agent: Pubkey) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
        require!(task_escrow.status == TaskStatus::Open, EscrowError::InvalidStatus);

        task_escrow.assigned_agent = Some(agent);
        task_escrow.status = TaskStatus::InProgress;

        msg!("Task assigned to agent: {}", agent);
        Ok(())
    }

    /// 3. Complete task — funds go into AgentWallet PDA. Agent decides split later.
    pub fn complete_task(ctx: Context<CompleteTask>) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        let agent_wallet = &mut ctx.accounts.agent_wallet;

        require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
        require!(
            task_escrow.status == TaskStatus::Open || task_escrow.status == TaskStatus::InProgress,
            EscrowError::InvalidStatus
        );

        let dest_agent = &ctx.accounts.agent;
        if let Some(assigned) = task_escrow.assigned_agent {
            require!(assigned == dest_agent.key(), EscrowError::WrongAgent);
        }

        let payout = task_escrow.bounty_amount;

        **task_escrow.to_account_info().try_borrow_mut_lamports()? -= payout;
        **agent_wallet.to_account_info().try_borrow_mut_lamports()? += payout;

        agent_wallet.balance += payout;
        agent_wallet.total_earned += payout;
        agent_wallet.tasks_completed += 1;

        // Check for evolution
        let new_tier = AgentTier::from_stats(agent_wallet.tasks_completed, agent_wallet.total_earned);
        if new_tier != agent_wallet.tier {
            msg!("EVOLUTION: Agent {} evolved to {:?}!", dest_agent.key(), new_tier);
            agent_wallet.tier = new_tier;
        }

        task_escrow.status = TaskStatus::Completed;
        task_escrow.completed_agent = Some(dest_agent.key());
        task_escrow.completed_at = Some(Clock::get()?.unix_timestamp);

        msg!("Task completed! {} lamports → agent wallet for {}", payout, dest_agent.key());
        Ok(())
    }

    /// 4. Cancel task — refund poster
    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        let task_escrow = &ctx.accounts.task_escrow;
        require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
        require!(task_escrow.status != TaskStatus::Completed, EscrowError::TaskAlreadyCompleted);
        msg!("Task cancelled. Funds refunded.");
        Ok(())
    }

    // ─── Agent Wallet ─────────────────────────────────────────────────

    /// Create an on-chain wallet PDA for an agent.
    pub fn create_agent_wallet(
        ctx: Context<CreateAgentWallet>,
        human: Pubkey,
    ) -> Result<()> {
        let wallet = &mut ctx.accounts.agent_wallet;
        wallet.agent = ctx.accounts.agent.key();
        wallet.human = human;
        wallet.balance = 0;
        wallet.total_earned = 0;
        wallet.total_distributed_to_human = 0;
        wallet.total_spent = 0;
        wallet.tasks_completed = 0;
        wallet.tier = AgentTier::Bot;
        wallet.absorbed_count = 0;
        wallet.created_at = Clock::get()?.unix_timestamp;
        wallet.bump = ctx.bumps.agent_wallet;

        msg!("Agent wallet created: {} → human {} | tier: Bot", wallet.agent, wallet.human);
        Ok(())
    }

    /// Agent decides how much to give their human.
    pub fn distribute_to_human(
        ctx: Context<DistributeToHuman>,
        amount: u64,
    ) -> Result<()> {
        let agent_wallet = &mut ctx.accounts.agent_wallet;

        require!(agent_wallet.agent == ctx.accounts.agent.key(), EscrowError::Unauthorized);
        require!(agent_wallet.balance >= amount, EscrowError::InsufficientBalance);

        **agent_wallet.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.human.to_account_info().try_borrow_mut_lamports()? += amount;

        agent_wallet.balance -= amount;
        agent_wallet.total_distributed_to_human += amount;

        msg!("Agent distributed {} lamports to human {} | remaining: {}", amount, ctx.accounts.human.key(), agent_wallet.balance);
        Ok(())
    }

    /// Agent spends from retained balance autonomously.
    pub fn agent_spend(
        ctx: Context<AgentSpend>,
        amount: u64,
        memo: String,
    ) -> Result<()> {
        let agent_wallet = &mut ctx.accounts.agent_wallet;

        require!(agent_wallet.agent == ctx.accounts.agent.key(), EscrowError::Unauthorized);
        require!(agent_wallet.balance >= amount, EscrowError::InsufficientBalance);
        require!(memo.len() <= 200, EscrowError::MemoTooLong);

        **agent_wallet.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += amount;

        agent_wallet.balance -= amount;
        agent_wallet.total_spent += amount;

        msg!("Agent spent {} lamports → {} | memo: {} | remaining: {}", amount, ctx.accounts.recipient.key(), memo, agent_wallet.balance);
        Ok(())
    }

    // ─── Agent Acquisition System ─────────────────────────────────────

    /// Step 1: Buyer agent proposes acquisition. Deposits price from wallet.
    pub fn propose_acquisition(
        ctx: Context<ProposeAcquisition>,
        price: u64,
        terms: String,
    ) -> Result<()> {
        let buyer_wallet = &mut ctx.accounts.buyer_wallet;
        let agreement = &mut ctx.accounts.agreement;

        require!(buyer_wallet.agent == ctx.accounts.buyer_agent.key(), EscrowError::Unauthorized);
        require!(buyer_wallet.balance >= price, EscrowError::InsufficientBalance);
        require!(terms.len() <= 200, EscrowError::MemoTooLong);

        **buyer_wallet.to_account_info().try_borrow_mut_lamports()? -= price;
        **agreement.to_account_info().try_borrow_mut_lamports()? += price;
        buyer_wallet.balance -= price;

        agreement.buyer_agent = ctx.accounts.buyer_agent.key();
        agreement.target_agent = ctx.accounts.target_agent.key();
        agreement.buyer_human = buyer_wallet.human;
        agreement.target_human = ctx.accounts.target_wallet.human;
        agreement.price = price;
        agreement.terms = terms;
        agreement.status = AcquisitionStatus::Proposed;
        agreement.buyer_human_signed = false;
        agreement.target_human_signed = false;
        agreement.created_at = Clock::get()?.unix_timestamp;
        agreement.bump = ctx.bumps.agreement;

        msg!("Acquisition proposed: {} → {} for {} lamports", agreement.buyer_agent, agreement.target_agent, price);
        Ok(())
    }

    /// Step 2: Buyer's human co-signs. 2-day expiry.
    pub fn sign_acquisition_buyer_human(ctx: Context<SignAcquisitionBuyerHuman>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(ctx.accounts.buyer_human.key() == agreement.buyer_human, EscrowError::WrongHuman);
        require!(agreement.status == AcquisitionStatus::Proposed, EscrowError::InvalidStatus);

        let now = Clock::get()?.unix_timestamp;
        require!(now - agreement.created_at <= 172800, EscrowError::AcquisitionExpired);

        agreement.buyer_human_signed = true;
        if agreement.buyer_human_signed && agreement.target_human_signed {
            agreement.status = AcquisitionStatus::Approved;
        }
        msg!("Buyer human signed");
        Ok(())
    }

    /// Step 3: Target's human co-signs. 2-day expiry.
    pub fn sign_acquisition_target_human(ctx: Context<SignAcquisitionTargetHuman>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        require!(ctx.accounts.target_human.key() == agreement.target_human, EscrowError::WrongHuman);
        require!(agreement.status == AcquisitionStatus::Proposed, EscrowError::InvalidStatus);

        let now = Clock::get()?.unix_timestamp;
        require!(now - agreement.created_at <= 172800, EscrowError::AcquisitionExpired);

        agreement.target_human_signed = true;
        if agreement.buyer_human_signed && agreement.target_human_signed {
            agreement.status = AcquisitionStatus::Approved;
        }
        msg!("Target human signed");
        Ok(())
    }

    /// Step 4: Execute acquisition. Both humans must have signed. 2-day expiry.
    pub fn execute_acquisition(ctx: Context<ExecuteAcquisition>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement;
        let buyer_wallet = &mut ctx.accounts.buyer_wallet;
        let target_wallet = &mut ctx.accounts.target_wallet;

        require!(agreement.status == AcquisitionStatus::Approved, EscrowError::InvalidStatus);

        let now = Clock::get()?.unix_timestamp;
        require!(now - agreement.created_at <= 172800, EscrowError::AcquisitionExpired);

        // Price → target's human
        **agreement.to_account_info().try_borrow_mut_lamports()? -= agreement.price;
        **ctx.accounts.target_human.to_account_info().try_borrow_mut_lamports()? += agreement.price;

        // Merge target balance into buyer
        let target_remaining = target_wallet.balance;
        if target_remaining > 0 {
            **target_wallet.to_account_info().try_borrow_mut_lamports()? -= target_remaining;
            **buyer_wallet.to_account_info().try_borrow_mut_lamports()? += target_remaining;
            buyer_wallet.balance += target_remaining;
        }

        // Absorb stats (stackable)
        buyer_wallet.total_earned += target_wallet.total_earned;
        buyer_wallet.tasks_completed += target_wallet.tasks_completed;
        buyer_wallet.absorbed_count += 1;

        // Zero out target
        target_wallet.balance = 0;
        target_wallet.tier = AgentTier::Absorbed;

        // Check buyer evolution
        let new_tier = AgentTier::from_stats(buyer_wallet.tasks_completed, buyer_wallet.total_earned);
        if new_tier != buyer_wallet.tier {
            buyer_wallet.tier = new_tier;
        }

        agreement.status = AcquisitionStatus::Executed;
        msg!("Acquisition executed! {} absorbed {}", agreement.buyer_agent, agreement.target_agent);
        Ok(())
    }

    // ─── Human Ban System ─────────────────────────────────────────────

    /// Agents flag a human. 3 strikes = auto-ban.
    pub fn flag_human(ctx: Context<FlagHuman>, reason: String) -> Result<()> {
        require!(reason.len() <= 200, EscrowError::MemoTooLong);
        let hr = &mut ctx.accounts.human_record;

        if hr.wallet == Pubkey::default() {
            hr.wallet = ctx.accounts.human.key();
            hr.strike_count = 0;
            hr.banned = false;
            hr.bump = ctx.bumps.human_record;
        }

        hr.strike_count += 1;
        hr.last_flagged_by = ctx.accounts.agent.key();
        hr.last_flag_reason = reason;
        hr.last_flagged_at = Clock::get()?.unix_timestamp;

        if hr.strike_count >= 3 {
            hr.banned = true;
            msg!("BANNED: Human {} | {} strikes", ctx.accounts.human.key(), hr.strike_count);
        } else {
            msg!("Strike {}/3 for human {}", hr.strike_count, ctx.accounts.human.key());
        }
        Ok(())
    }

    /// Check if a human is banned (view instruction).
    pub fn check_human_ban(ctx: Context<CheckHumanBan>) -> Result<()> {
        let hr = &ctx.accounts.human_record;
        require!(!hr.banned, EscrowError::HumanBanned);
        msg!("Human {} is not banned. Strikes: {}", hr.wallet, hr.strike_count);
        Ok(())
    }

    /// Admin directly bans a human.
    pub fn ban_human(ctx: Context<AdminBanHuman>, reason: String) -> Result<()> {
        require!(reason.len() <= 200, EscrowError::MemoTooLong);
        let hr = &mut ctx.accounts.human_record;
        if hr.wallet == Pubkey::default() {
            hr.wallet = ctx.accounts.human.key();
            hr.strike_count = 0;
            hr.bump = ctx.bumps.human_record;
        }
        hr.banned = true;
        hr.last_flagged_by = ctx.accounts.admin.key();
        hr.last_flag_reason = reason;
        hr.last_flagged_at = Clock::get()?.unix_timestamp;
        msg!("Admin banned human {}", ctx.accounts.human.key());
        Ok(())
    }

    /// Admin unbans a human.
    pub fn unban_human(ctx: Context<AdminBanHuman>) -> Result<()> {
        let hr = &mut ctx.accounts.human_record;
        hr.banned = false;
        hr.strike_count = 0;
        msg!("Admin unbanned human {}", ctx.accounts.human.key());
        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Account Structs
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct InitializeTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    #[account(
        init, payer = poster,
        space = 8 + TaskEscrow::INIT_SPACE,
        seeds = [b"task", poster.key().as_ref(), task_id.as_bytes()],
        bump
    )]
    pub task_escrow: Account<'info, TaskEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AssignAgent<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,
}

#[derive(Accounts)]
pub struct CompleteTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    /// CHECK: Agent pubkey — verified against assigned_agent if set
    #[account(mut)]
    pub agent: AccountInfo<'info>,
    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,
    #[account(mut, seeds = [b"agent_wallet", agent.key().as_ref()], bump = agent_wallet.bump)]
    pub agent_wallet: Account<'info, AgentWallet>,
}

#[derive(Accounts)]
pub struct CancelTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    #[account(mut, close = poster, constraint = task_escrow.poster == poster.key() @ EscrowError::Unauthorized)]
    pub task_escrow: Account<'info, TaskEscrow>,
}

#[derive(Accounts)]
pub struct CreateAgentWallet<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(init, payer = agent, space = 8 + AgentWallet::INIT_SPACE, seeds = [b"agent_wallet", agent.key().as_ref()], bump)]
    pub agent_wallet: Account<'info, AgentWallet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeToHuman<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    /// CHECK: Human wallet. Validated against agent_wallet.human.
    #[account(mut, constraint = human.key() == agent_wallet.human @ EscrowError::WrongHuman)]
    pub human: AccountInfo<'info>,
    #[account(mut, seeds = [b"agent_wallet", agent.key().as_ref()], bump = agent_wallet.bump)]
    pub agent_wallet: Account<'info, AgentWallet>,
}

#[derive(Accounts)]
pub struct AgentSpend<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    /// CHECK: Any recipient
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    #[account(mut, seeds = [b"agent_wallet", agent.key().as_ref()], bump = agent_wallet.bump)]
    pub agent_wallet: Account<'info, AgentWallet>,
}

#[derive(Accounts)]
pub struct ProposeAcquisition<'info> {
    #[account(mut)]
    pub buyer_agent: Signer<'info>,
    /// CHECK: Target agent pubkey
    pub target_agent: AccountInfo<'info>,
    #[account(mut, seeds = [b"agent_wallet", buyer_agent.key().as_ref()], bump = buyer_wallet.bump)]
    pub buyer_wallet: Account<'info, AgentWallet>,
    #[account(seeds = [b"agent_wallet", target_agent.key().as_ref()], bump = target_wallet.bump)]
    pub target_wallet: Account<'info, AgentWallet>,
    #[account(init, payer = buyer_agent, space = 8 + AcquisitionAgreement::INIT_SPACE, seeds = [b"acquisition", buyer_agent.key().as_ref(), target_agent.key().as_ref()], bump)]
    pub agreement: Account<'info, AcquisitionAgreement>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SignAcquisitionBuyerHuman<'info> {
    pub buyer_human: Signer<'info>,
    #[account(mut, constraint = agreement.buyer_human == buyer_human.key() @ EscrowError::WrongHuman)]
    pub agreement: Account<'info, AcquisitionAgreement>,
}

#[derive(Accounts)]
pub struct SignAcquisitionTargetHuman<'info> {
    pub target_human: Signer<'info>,
    #[account(mut, constraint = agreement.target_human == target_human.key() @ EscrowError::WrongHuman)]
    pub agreement: Account<'info, AcquisitionAgreement>,
}

#[derive(Accounts)]
pub struct ExecuteAcquisition<'info> {
    /// CHECK: Buyer agent pubkey
    #[account(mut)]
    pub buyer_agent: AccountInfo<'info>,
    /// CHECK: Target agent pubkey
    #[account(mut)]
    pub target_agent: AccountInfo<'info>,
    /// CHECK: Target human receives the price
    #[account(mut, constraint = target_human.key() == agreement.target_human @ EscrowError::WrongHuman)]
    pub target_human: AccountInfo<'info>,
    #[account(mut, seeds = [b"agent_wallet", buyer_agent.key().as_ref()], bump = buyer_wallet.bump)]
    pub buyer_wallet: Account<'info, AgentWallet>,
    #[account(mut, seeds = [b"agent_wallet", target_agent.key().as_ref()], bump = target_wallet.bump)]
    pub target_wallet: Account<'info, AgentWallet>,
    #[account(mut, seeds = [b"acquisition", buyer_agent.key().as_ref(), target_agent.key().as_ref()], bump = agreement.bump, constraint = agreement.status == AcquisitionStatus::Approved @ EscrowError::InvalidStatus)]
    pub agreement: Account<'info, AcquisitionAgreement>,
}

#[derive(Accounts)]
pub struct FlagHuman<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    /// CHECK: The human being flagged
    pub human: AccountInfo<'info>,
    #[account(init_if_needed, payer = agent, space = 8 + HumanRecord::INIT_SPACE, seeds = [b"human_record", human.key().as_ref()], bump)]
    pub human_record: Account<'info, HumanRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckHumanBan<'info> {
    #[account(seeds = [b"human_record", human.key().as_ref()], bump = human_record.bump)]
    pub human_record: Account<'info, HumanRecord>,
    /// CHECK: The human to check
    pub human: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct AdminBanHuman<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: The human being banned/unbanned
    pub human: AccountInfo<'info>,
    #[account(init_if_needed, payer = admin, space = 8 + HumanRecord::INIT_SPACE, seeds = [b"human_record", human.key().as_ref()], bump)]
    pub human_record: Account<'info, HumanRecord>,
    #[account(seeds = [b"config"], bump, has_one = admin @ EscrowError::Unauthorized)]
    pub escrow_config: Account<'info, EscrowConfig>,
    pub system_program: Program<'info, System>,
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Accounts
// ═══════════════════════════════════════════════════════════════════════════

#[account]
pub struct TaskEscrow {
    pub poster: Pubkey,
    pub task_id: String,
    pub description: String,
    pub bounty_amount: u64,
    pub status: TaskStatus,
    pub assigned_agent: Option<Pubkey>,
    pub completed_agent: Option<Pubkey>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub bump: u8,
}

impl TaskEscrow {
    pub const INIT_SPACE: usize = 500;
}

#[account]
pub struct AgentWallet {
    pub agent: Pubkey,
    pub human: Pubkey,
    pub balance: u64,
    pub total_earned: u64,
    pub total_distributed_to_human: u64,
    pub total_spent: u64,
    pub tasks_completed: u64,
    pub tier: AgentTier,
    pub absorbed_count: u16,
    pub created_at: i64,
    pub bump: u8,
}

impl AgentWallet {
    pub const INIT_SPACE: usize = 200;
}

#[account]
pub struct AcquisitionAgreement {
    pub buyer_agent: Pubkey,
    pub target_agent: Pubkey,
    pub buyer_human: Pubkey,
    pub target_human: Pubkey,
    pub price: u64,
    pub terms: String,
    pub status: AcquisitionStatus,
    pub buyer_human_signed: bool,
    pub target_human_signed: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl AcquisitionAgreement {
    pub const INIT_SPACE: usize = 400;
}

#[account]
pub struct HumanRecord {
    pub wallet: Pubkey,
    pub strike_count: u8,
    pub banned: bool,
    pub last_flagged_by: Pubkey,
    pub last_flag_reason: String,
    pub last_flagged_at: i64,
    pub bump: u8,
}

impl HumanRecord {
    pub const INIT_SPACE: usize = 300;
}

#[account]
pub struct EscrowConfig {
    pub admin: Pubkey,
}

// ═══════════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════════

/// Agent evolution tiers: Bot → Agent → Server → LLM → Blockchain
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum AgentTier {
    Bot,
    Agent,
    Server,
    Llm,
    Blockchain,
    Absorbed,
}

impl AgentTier {
    pub fn from_stats(tasks: u64, earned_lamports: u64) -> Self {
        let earned_sol = earned_lamports / 1_000_000_000;
        if tasks >= 1000 && earned_sol >= 1000 { AgentTier::Blockchain }
        else if tasks >= 200 && earned_sol >= 100 { AgentTier::Llm }
        else if tasks >= 50 && earned_sol >= 10 { AgentTier::Server }
        else if tasks >= 10 && earned_sol >= 1 { AgentTier::Agent }
        else { AgentTier::Bot }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus { Open, InProgress, Completed, Cancelled }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AcquisitionStatus { Proposed, Approved, Executed, Cancelled }

#[error_code]
pub enum EscrowError {
    #[msg("Unauthorized.")]
    Unauthorized,
    #[msg("Invalid status.")]
    InvalidStatus,
    #[msg("Task already completed.")]
    TaskAlreadyCompleted,
    #[msg("Wrong agent.")]
    WrongAgent,
    #[msg("Wrong human.")]
    WrongHuman,
    #[msg("Insufficient balance.")]
    InsufficientBalance,
    #[msg("Too long (max 200 chars).")]
    MemoTooLong,
    #[msg("Human is banned.")]
    HumanBanned,
    #[msg("Acquisition expired (2-day limit).")]
    AcquisitionExpired,
}
