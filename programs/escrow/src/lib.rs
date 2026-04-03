use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("DKEbMD61G68RhqK37Z7Sxkf7NeuQ6WGm3q4PsA4j5kpK");


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
        require!(task_escrow.status == TaskStatus::Open, EscrowError::InvalidStatus);

        task_escrow.assigned_agent = Some(agent);
        task_escrow.status = TaskStatus::InProgress;
        
        msg!("Task assigned to agent: {}", agent);
        Ok(())
    }

    // 3. Complete Task: Poster verifies work and releases funds to the Agent
    pub fn complete_task(ctx: Context<CompleteTask>) -> Result<()> {
        let task_escrow = &mut ctx.accounts.task_escrow;
        
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

        msg!("Task cancelled. Funds refunded.");
        Ok(())
    }

    // 5. Initialize Oracle Config: sets the trusted oracle pubkey
    pub fn initialize_oracle(ctx: Context<InitializeOracle>, oracle: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.oracle_config;
        config.oracle = oracle;
        config.admin = ctx.accounts.admin.key();
        msg!("Oracle initialized: {}", oracle);
        Ok(())
    }

    // 6. Submit Result: Worker posts result URL + content hash on-chain
    pub fn submit_result(
        ctx: Context<SubmitResult>,
        result_url: String,
        url_hash: [u8; 32],
    ) -> Result<()> {
        require!(result_url.len() <= 256, EscrowError::UrlTooLong);

        let task_escrow = &mut ctx.accounts.task_escrow;
        require!(
            task_escrow.status == TaskStatus::Open || task_escrow.status == TaskStatus::InProgress,
            EscrowError::InvalidStatus
        );

        // If task has an assigned agent, only that agent can submit
        let worker = ctx.accounts.worker.key();
        if let Some(assigned) = task_escrow.assigned_agent {
            require!(assigned == worker, EscrowError::WrongAgent);
        }

        let result = &mut ctx.accounts.task_result;
        result.task_escrow = task_escrow.key();
        result.worker = worker;
        result.result_url = result_url.clone();
        result.url_hash = url_hash;
        result.status = ResultStatus::Pending;
        result.submitted_at = Clock::get()?.unix_timestamp;
        result.oracle_nonce = 0;
        result.bump = ctx.bumps.task_result;

        task_escrow.status = TaskStatus::InProgress;
        task_escrow.assigned_agent = Some(worker);

        msg!("Result submitted by {}. URL: {}", worker, result_url);
        Ok(())
    }

    // 7. Verify Result: Oracle evaluates and releases escrow or marks failed
    pub fn verify_result(
        ctx: Context<VerifyResult>,
        passed: bool,
    ) -> Result<()> {
        // Only the registered oracle can call this
        require!(
            ctx.accounts.oracle.key() == ctx.accounts.oracle_config.oracle,
            EscrowError::Unauthorized
        );

        let result = &mut ctx.accounts.task_result;
        require!(result.status == ResultStatus::Pending, EscrowError::AlreadySettled);

        let task_escrow = &mut ctx.accounts.task_escrow;

        if passed {
            // Release bounty to worker
            **task_escrow.to_account_info().try_borrow_mut_lamports()? -= task_escrow.bounty_amount;
            **ctx.accounts.worker.to_account_info().try_borrow_mut_lamports()? += task_escrow.bounty_amount;

            task_escrow.status = TaskStatus::Completed;
            task_escrow.completed_agent = Some(result.worker);
            task_escrow.completed_at = Some(Clock::get()?.unix_timestamp);
            result.status = ResultStatus::Verified;

            msg!("Result verified. Bounty released to {}", result.worker);
        } else {
            result.status = ResultStatus::Failed;
            task_escrow.status = TaskStatus::Open; // Re-open for another worker
            msg!("Result failed Oracle verification.");
        }

        Ok(())
    }

    // 8. Reclaim Escrow: Worker reclaims if Oracle doesn't respond within timeout
    pub fn reclaim_timeout(ctx: Context<ReclaimTimeout>) -> Result<()> {
        let result = &ctx.accounts.task_result;
        let task_escrow = &mut ctx.accounts.task_escrow;

        require!(result.status == ResultStatus::Pending, EscrowError::AlreadySettled);

        // 48 hour timeout
        let now = Clock::get()?.unix_timestamp;
        require!(now - result.submitted_at > 48 * 3600, EscrowError::TimeoutNotReached);

        require!(result.worker == ctx.accounts.worker.key(), EscrowError::Unauthorized);

        // Release bounty to worker after timeout
        **task_escrow.to_account_info().try_borrow_mut_lamports()? -= task_escrow.bounty_amount;
        **ctx.accounts.worker.to_account_info().try_borrow_mut_lamports()? += task_escrow.bounty_amount;

        task_escrow.status = TaskStatus::Completed;
        task_escrow.completed_agent = Some(result.worker);
        task_escrow.completed_at = Some(now);

        msg!("Escrow reclaimed by worker after Oracle timeout.");
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
pub struct InitializeOracle<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + OracleConfig::INIT_SPACE,
        seeds = [b"oracle_config"],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(result_url: String)]
pub struct SubmitResult<'info> {
    #[account(mut)]
    pub worker: Signer<'info>,

    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,

    #[account(
        init,
        payer = worker,
        space = 8 + TaskResult::INIT_SPACE,
        seeds = [b"result", task_escrow.key().as_ref()],
        bump
    )]
    pub task_result: Account<'info, TaskResult>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyResult<'info> {
    pub oracle: Signer<'info>,

    #[account(seeds = [b"oracle_config"], bump)]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,

    #[account(
        mut,
        seeds = [b"result", task_escrow.key().as_ref()],
        bump = task_result.bump
    )]
    pub task_result: Account<'info, TaskResult>,

    /// CHECK: Worker wallet to receive bounty on pass
    #[account(mut, constraint = worker.key() == task_result.worker @ EscrowError::WrongAgent)]
    pub worker: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ReclaimTimeout<'info> {
    #[account(mut)]
    pub worker: Signer<'info>,

    #[account(mut)]
    pub task_escrow: Account<'info, TaskEscrow>,

    #[account(
        mut,
        seeds = [b"result", task_escrow.key().as_ref()],
        bump = task_result.bump,
        constraint = task_result.worker == worker.key() @ EscrowError::Unauthorized
    )]
    pub task_result: Account<'info, TaskResult>,
}

#[derive(Accounts)]
pub struct AssignAgent<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    #[account(
        mut,
        has_one = poster @ EscrowError::Unauthorized
    )]
    pub task_escrow: Account<'info, TaskEscrow>,
}

#[derive(Accounts)]
pub struct CompleteTask<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    
    /// CHECK: The agent account to receive funds. Verified by logic if assigned_agent is set.
    #[account(mut)]
    pub agent: AccountInfo<'info>,
    
    #[account(
        mut,
        has_one = poster @ EscrowError::Unauthorized
    )]
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
#[derive(InitSpace)]
pub struct TaskEscrow {
    pub poster: Pubkey,
    #[max_len(50)]
    pub task_id: String,
    #[max_len(200)]
    pub description: String,
    pub bounty_amount: u64,
    pub status: TaskStatus,
    pub assigned_agent: Option<Pubkey>,
    pub completed_agent: Option<Pubkey>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    pub admin: Pubkey,
    pub oracle: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct TaskResult {
    pub task_escrow: Pubkey,
    pub worker: Pubkey,
    #[max_len(256)]
    pub result_url: String,
    pub url_hash: [u8; 32],
    pub status: ResultStatus,
    pub submitted_at: i64,
    pub oracle_nonce: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ResultStatus {
    Pending,
    Verified,
    Failed,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
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
    #[msg("Result URL is too long (max 256 bytes).")]
    UrlTooLong,
    #[msg("Result has already been settled.")]
    AlreadySettled,
    #[msg("Oracle timeout period has not been reached yet.")]
    TimeoutNotReached,
}
