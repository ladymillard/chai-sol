use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("Escrow11111111111111111111111111111111111111");

#[program]
pub mod escrow {
    use super::*;

    // 1. Initialize Task: Poster deposits SOL into the TaskEscrow PDA
    pub fn initialize_task(
        ctx: Context<InitializeTask>, 
        task_id: String, 
        bounty_amount: u64,
        description: String
    ) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        task_escrow.poster = ctx.accounts.poster.key();
        task_escrow.task_id = task_id;
        task_escrow.description = description;
        task_escrow.bounty_amount = bounty_amount;
        task_escrow.status = TaskStatus::Open;
        task_escrow.created_at = Clock::get()?.unix_timestamp;
        task_escrow.bump = ctx.bumps.task_escrow;

        // Transfer SOL from poster to the escrow PDA
        let cpi_accounts = Transfer {
            from: ctx.accounts.poster.to_account_info(),
            to: task_escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
        transfer(cpi_ctx, bounty_amount)?;

        msg!("Task initialized: {} with bounty {} lamports", task_escrow.task_id, bounty_amount);
        Ok(())
    }

    // 2. Assign Agent: Poster assigns a specific agent (optional, or Agent accepts)
    // For this hackathon, we might just let the Poster accept a PR and pay the agent directly via complete_task
    // But let's add an explicit 'start' step if needed.
    pub fn assign_agent(ctx: Context<AssignAgent>, agent: Pubkey) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
        require!(task_escrow.status == TaskStatus::Open, EscrowError::InvalidStatus);

        task_escrow.assigned_agent = Some(agent);
        task_escrow.status = TaskStatus::InProgress;
        
        msg!("Task assigned to agent: {}", agent);
        Ok(())
    }

    // 3. Complete Task: Poster verifies work and releases funds to the Agent
    pub fn complete_task(ctx: Context<CompleteTask>) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        
        // Only poster can verify/complete
        require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
        
        // Ensure valid status
        require!(
            task_escrow.status == TaskStatus::Open || task_escrow.status == TaskStatus::InProgress, 
            EscrowError::InvalidStatus
        );

        // If an agent was specifically assigned, ensure we are paying THAT agent
        let dest_agent = &ctx.accounts.agent;
        if let Some(assigned) = task_escrow.assigned_agent {
            require!(assigned == dest_agent.key(), EscrowError::WrongAgent);
        }

        // Payout: Transfer SOL from PDA to Agent
        // Since PDA "owns" the lamports, we can decrease its balance and increase agent's
        **task_escrow.to_account_info().try_borrow_mut_lamports()? -= task_escrow.bounty_amount;
        **dest_agent.to_account_info().try_borrow_mut_lamports()? += task_escrow.bounty_amount;

        task_escrow.status = TaskStatus::Completed;
        task_escrow.completed_agent = Some(dest_agent.key());
        task_escrow.completed_at = Some(Clock::get()?.unix_timestamp);

        msg!("Task completed! Funds released to {}", dest_agent.key());
        Ok(())
    }

    // 4. Cancel Task: Poster cancels and gets refund
    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        
        require!(task_escrow.poster == ctx.accounts.poster.key(), EscrowError::Unauthorized);
        require!(task_escrow.status != TaskStatus::Completed, EscrowError::TaskAlreadyCompleted);

        // Close account and return ALL rent + bounty to poster
        // The #[account(close = poster)] constraint handles the lamport transfer automatically!
        
        msg!("Task cancelled. Funds refunded.");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct InitializeTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,

    #[account(
        init,
        payer = poster,
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
    
    /// CHECK: The agent account to receive funds. Verified by logic if assigned_agent is set.
    #[account(mut)]
    pub agent: AccountInfo<'info>,
    
    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,
}

#[derive(Accounts)]
pub struct CancelTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    
    #[account(
        mut,
        close = poster, // This instruction moves all lamports (rent + bounty) back to poster
        constraint = task_escrow.poster == poster.key() @ EscrowError::Unauthorized
    )]
    pub task_escrow: Account<'info, TaskEscrow>,
}

#[account]
pub struct TaskEscrow {
    pub poster: Pubkey,          // 32
    pub task_id: String,         // 4 + 50 (max len)
    pub description: String,     // 4 + 200 (max len)
    pub bounty_amount: u64,      // 8
    pub status: TaskStatus,      // 1 + 1 (enum discriminator + variant)
    pub assigned_agent: Option<Pubkey>, // 1 + 32
    pub completed_agent: Option<Pubkey>, // 1 + 32
    pub created_at: i64,         // 8
    pub completed_at: Option<i64>, // 1 + 8
    pub bump: u8,                // 1
}

impl TaskEscrow {
    // Approx space calculation:
    // 32 + (4+50) + (4+200) + 8 + 2 + 33 + 33 + 8 + 9 + 1 = 384 approx
    // Giving some padding
    pub const INIT_SPACE: usize = 500; 
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
}

#[error_code]
pub enum EscrowError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Task status prevents this action.")]
    InvalidStatus,
    #[msg("Task is already completed.")]
    TaskAlreadyCompleted,
    #[msg("The provided agent does not match the assigned agent.")]
    WrongAgent,
}
