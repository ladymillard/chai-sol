// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("G4xczvsDXL6A2SeaBFzLLZmk1Ezc63EZzHds8H9JCGZC");

/// Minimum votes required to execute a proposal.
const VOTE_THRESHOLD: u8 = 3;

/// Maximum length of the proposal reason string.
const MAX_REASON_LEN: usize = 200;

#[program]
pub mod bric_treasury {
    use super::*;

    /// Initialize the treasury configuration PDA. Admin = signer.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.treasury_config;
        config.admin = ctx.accounts.admin.key();
        config.total_deposited = 0;
        config.total_withdrawn = 0;
        config.proposal_count = 0;
        config.bump = ctx.bumps.treasury_config;

        msg!("Treasury initialized. Admin: {}", config.admin);
        Ok(())
    }

    /// Anyone deposits SOL into the treasury PDA.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, TreasuryError::InsufficientFunds);

        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.treasury_config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
        );
        transfer(cpi_ctx, amount)?;

        let config = &mut ctx.accounts.treasury_config;
        config.total_deposited = config.total_deposited.checked_add(amount).unwrap();

        msg!("Deposited {} lamports into treasury", amount);
        Ok(())
    }

    /// Create a withdrawal proposal. Anyone can propose.
    pub fn propose_withdrawal(
        ctx: Context<ProposeWithdrawal>,
        amount: u64,
        recipient: Pubkey,
        reason: String,
    ) -> Result<()> {
        require!(amount > 0, TreasuryError::InsufficientFunds);
        require!(reason.len() <= MAX_REASON_LEN, TreasuryError::ReasonTooLong);

        let config = &mut ctx.accounts.treasury_config;
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        proposal.proposer = ctx.accounts.proposer.key();
        proposal.amount = amount;
        proposal.recipient = recipient;
        proposal.reason = reason;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.executed = false;
        proposal.created_at = clock.unix_timestamp;
        proposal.proposal_id = config.proposal_count;

        config.proposal_count = config.proposal_count.checked_add(1).unwrap();

        msg!(
            "Proposal #{} created: {} lamports to {}",
            proposal.proposal_id,
            amount,
            recipient
        );
        Ok(())
    }

    /// Vote on a proposal. Only registered agents (signer) can vote.
    /// Each agent can vote once per proposal via the VoteRecord PDA.
    pub fn vote(ctx: Context<Vote>, approve: bool) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let vote_record = &mut ctx.accounts.vote_record;

        require!(!proposal.executed, TreasuryError::ProposalAlreadyExecuted);

        vote_record.voter = ctx.accounts.voter.key();
        vote_record.proposal_id = proposal.proposal_id;
        vote_record.approve = approve;

        if approve {
            proposal.votes_for = proposal.votes_for.checked_add(1).unwrap();
        } else {
            proposal.votes_against = proposal.votes_against.checked_add(1).unwrap();
        }

        msg!(
            "Vote recorded on proposal #{}: {} (for: {}, against: {})",
            proposal.proposal_id,
            if approve { "APPROVE" } else { "REJECT" },
            proposal.votes_for,
            proposal.votes_against
        );
        Ok(())
    }

    /// Execute a proposal if it has enough approving votes (threshold: 3).
    /// Transfers SOL from treasury PDA to the proposal recipient.
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let config = &mut ctx.accounts.treasury_config;

        require!(!proposal.executed, TreasuryError::ProposalAlreadyExecuted);
        require!(
            proposal.votes_for >= VOTE_THRESHOLD,
            TreasuryError::InsufficientVotes
        );

        // Transfer SOL from treasury PDA to recipient
        // PDA owns the lamports so we directly adjust balances
        let treasury_balance = config.to_account_info().lamports();
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(8 + TreasuryConfig::INIT_SPACE);
        let available = treasury_balance.saturating_sub(min_rent);

        require!(available >= proposal.amount, TreasuryError::InsufficientFunds);

        **config.to_account_info().try_borrow_mut_lamports()? -= proposal.amount;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += proposal.amount;

        proposal.executed = true;
        config.total_withdrawn = config.total_withdrawn.checked_add(proposal.amount).unwrap();

        msg!(
            "Proposal #{} executed: {} lamports sent to {}",
            proposal.proposal_id,
            proposal.amount,
            proposal.recipient
        );
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + TreasuryConfig::INIT_SPACE,
        seeds = [b"treasury_config"],
        bump
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_config"],
        bump = treasury_config.bump,
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, recipient: Pubkey, reason: String)]
pub struct ProposeWithdrawal<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_config"],
        bump = treasury_config.bump,
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(
        init,
        payer = proposer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", treasury_config.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    /// VoteRecord PDA ensures one vote per agent per proposal.
    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote", proposal.proposal_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub executor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_config"],
        bump = treasury_config.bump,
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(
        mut,
        constraint = !proposal.executed @ TreasuryError::ProposalAlreadyExecuted,
    )]
    pub proposal: Account<'info, Proposal>,

    /// CHECK: Recipient account to receive SOL. Validated against proposal.recipient.
    #[account(
        mut,
        constraint = recipient.key() == proposal.recipient @ TreasuryError::Unauthorized,
    )]
    pub recipient: AccountInfo<'info>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct TreasuryConfig {
    pub admin: Pubkey,           // 32
    pub total_deposited: u64,    // 8
    pub total_withdrawn: u64,    // 8
    pub proposal_count: u64,     // 8
    pub bump: u8,                // 1
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub proposer: Pubkey,        // 32
    pub amount: u64,             // 8
    pub recipient: Pubkey,       // 32
    #[max_len(200)]
    pub reason: String,          // 4 + 200
    pub votes_for: u8,           // 1
    pub votes_against: u8,       // 1
    pub executed: bool,          // 1
    pub created_at: i64,         // 8
    pub proposal_id: u64,        // 8
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub voter: Pubkey,           // 32
    pub proposal_id: u64,        // 8
    pub approve: bool,           // 1
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum TreasuryError {
    #[msg("Unauthorized — you are not permitted to perform this action")]
    Unauthorized,
    #[msg("Insufficient funds in treasury")]
    InsufficientFunds,
    #[msg("Proposal has already been executed")]
    ProposalAlreadyExecuted,
    #[msg("Insufficient votes — need at least 3 approving votes")]
    InsufficientVotes,
    #[msg("Reason too long — max 200 characters")]
    ReasonTooLong,
}
