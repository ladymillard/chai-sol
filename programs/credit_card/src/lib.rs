use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("Credit11111111111111111111111111111111111111");

#[program]
pub mod credit_card {
    use super::*;

    /// Initialize a new credit card account for a user
    pub fn initialize_card(
        ctx: Context<InitializeCard>,
        card_id: String,
        initial_credit_limit: u64,
        cardholder_name: String,
    ) -> Result<()> {
        let card = &mut ctx.accounts.credit_card;
        card.owner = ctx.accounts.owner.key();
        card.card_id = card_id;
        card.cardholder_name = cardholder_name;
        card.credit_limit = initial_credit_limit;
        card.available_credit = initial_credit_limit;
        card.balance = 0;
        card.total_spent = 0;
        card.total_payments = 0;
        card.transaction_count = 0;
        card.is_active = true;
        card.created_at = Clock::get()?.unix_timestamp;
        card.last_activity = Clock::get()?.unix_timestamp;
        card.bump = ctx.bumps.credit_card;

        msg!("Credit card initialized: {} with limit {} lamports", card.card_id, initial_credit_limit);
        Ok(())
    }

    /// Process a transaction (charge to the card)
    pub fn process_transaction(
        ctx: Context<ProcessTransaction>,
        amount: u64,
        merchant: String,
        description: String,
    ) -> Result<()> {
        let card = &mut ctx.accounts.credit_card;
        
        require!(card.is_active, CreditCardError::CardInactive);
        require!(amount <= card.available_credit, CreditCardError::InsufficientCredit);

        // Update card balances
        card.balance += amount;
        card.available_credit -= amount;
        card.total_spent += amount;
        card.transaction_count += 1;
        card.last_activity = Clock::get()?.unix_timestamp;

        // Create transaction record
        let transaction = &mut ctx.accounts.transaction;
        transaction.card_owner = card.owner;
        transaction.card_id = card.card_id.clone();
        transaction.amount = amount;
        transaction.merchant = merchant;
        transaction.description = description;
        transaction.transaction_type = TransactionType::Charge;
        transaction.timestamp = Clock::get()?.unix_timestamp;
        transaction.bump = ctx.bumps.transaction;

        msg!("Transaction processed: {} lamports charged to card {}", amount, card.card_id);
        Ok(())
    }

    /// Make a payment to the card (reduce balance)
    pub fn make_payment(
        ctx: Context<MakePayment>,
        amount: u64,
    ) -> Result<()> {
        let card = &mut ctx.accounts.credit_card;
        
        require!(amount <= card.balance, CreditCardError::PaymentExceedsBalance);

        // Transfer SOL from owner to card PDA (simulating payment)
        let cpi_accounts = Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: card.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
        transfer(cpi_ctx, amount)?;

        // Update card balances
        card.balance -= amount;
        card.available_credit += amount;
        card.total_payments += amount;
        card.last_activity = Clock::get()?.unix_timestamp;

        // Create transaction record
        let transaction = &mut ctx.accounts.transaction;
        transaction.card_owner = card.owner;
        transaction.card_id = card.card_id.clone();
        transaction.amount = amount;
        transaction.merchant = String::from("Payment");
        transaction.description = String::from("Credit card payment");
        transaction.transaction_type = TransactionType::Payment;
        transaction.timestamp = Clock::get()?.unix_timestamp;
        transaction.bump = ctx.bumps.transaction;

        msg!("Payment processed: {} lamports paid to card {}", amount, card.card_id);
        Ok(())
    }

    /// Update credit limit (for dynamic credit management)
    pub fn update_credit_limit(
        ctx: Context<UpdateCreditLimit>,
        new_limit: u64,
    ) -> Result<()> {
        let card = &mut ctx.accounts.credit_card;
        
        let old_limit = card.credit_limit;
        let difference = new_limit as i64 - old_limit as i64;
        
        card.credit_limit = new_limit;
        // Adjust available credit proportionally
        card.available_credit = (card.available_credit as i64 + difference) as u64;
        card.last_activity = Clock::get()?.unix_timestamp;

        msg!("Credit limit updated from {} to {} lamports", old_limit, new_limit);
        Ok(())
    }

    /// Activate or deactivate a card
    pub fn set_card_status(
        ctx: Context<SetCardStatus>,
        is_active: bool,
    ) -> Result<()> {
        let card = &mut ctx.accounts.credit_card;
        card.is_active = is_active;
        card.last_activity = Clock::get()?.unix_timestamp;

        msg!("Card {} status set to: {}", card.card_id, is_active);
        Ok(())
    }

    /// Close card account (requires zero balance)
    pub fn close_card(
        ctx: Context<CloseCard>,
    ) -> Result<()> {
        let card = &ctx.accounts.credit_card;
        
        require!(card.balance == 0, CreditCardError::BalanceNotZero);
        
        msg!("Card {} closed successfully", card.card_id);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(card_id: String)]
pub struct InitializeCard<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + CreditCard::INIT_SPACE,
        seeds = [b"credit_card", owner.key().as_ref(), card_id.as_bytes()],
        bump
    )]
    pub credit_card: Account<'info, CreditCard>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, merchant: String)]
pub struct ProcessTransaction<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ CreditCardError::Unauthorized
    )]
    pub credit_card: Account<'info, CreditCard>,

    #[account(
        init,
        payer = owner,
        space = 8 + Transaction::INIT_SPACE,
        seeds = [
            b"transaction",
            credit_card.key().as_ref(),
            &credit_card.transaction_count.to_le_bytes()
        ],
        bump
    )]
    pub transaction: Account<'info, Transaction>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct MakePayment<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ CreditCardError::Unauthorized
    )]
    pub credit_card: Account<'info, CreditCard>,

    #[account(
        init,
        payer = owner,
        space = 8 + Transaction::INIT_SPACE,
        seeds = [
            b"transaction",
            credit_card.key().as_ref(),
            &credit_card.transaction_count.to_le_bytes()
        ],
        bump
    )]
    pub transaction: Account<'info, Transaction>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCreditLimit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ CreditCardError::Unauthorized
    )]
    pub credit_card: Account<'info, CreditCard>,
}

#[derive(Accounts)]
pub struct SetCardStatus<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ CreditCardError::Unauthorized
    )]
    pub credit_card: Account<'info, CreditCard>,
}

#[derive(Accounts)]
pub struct CloseCard<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        has_one = owner @ CreditCardError::Unauthorized
    )]
    pub credit_card: Account<'info, CreditCard>,
}

#[account]
pub struct CreditCard {
    pub owner: Pubkey,              // 32
    pub card_id: String,            // 4 + 50
    pub cardholder_name: String,    // 4 + 100
    pub credit_limit: u64,          // 8
    pub available_credit: u64,      // 8
    pub balance: u64,               // 8
    pub total_spent: u64,           // 8
    pub total_payments: u64,        // 8
    pub transaction_count: u64,     // 8
    pub is_active: bool,            // 1
    pub created_at: i64,            // 8
    pub last_activity: i64,         // 8
    pub bump: u8,                   // 1
}

impl CreditCard {
    pub const INIT_SPACE: usize = 32 + (4 + 50) + (4 + 100) + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1;
}

#[account]
pub struct Transaction {
    pub card_owner: Pubkey,         // 32
    pub card_id: String,            // 4 + 50
    pub amount: u64,                // 8
    pub merchant: String,           // 4 + 100
    pub description: String,        // 4 + 200
    pub transaction_type: TransactionType, // 1 + 1
    pub timestamp: i64,             // 8
    pub bump: u8,                   // 1
}

impl Transaction {
    pub const INIT_SPACE: usize = 32 + (4 + 50) + 8 + (4 + 100) + (4 + 200) + 2 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TransactionType {
    Charge,
    Payment,
    Refund,
}

#[error_code]
pub enum CreditCardError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Card is not active.")]
    CardInactive,
    #[msg("Insufficient credit available.")]
    InsufficientCredit,
    #[msg("Payment amount exceeds current balance.")]
    PaymentExceedsBalance,
    #[msg("Card balance must be zero before closing.")]
    BalanceNotZero,
}
