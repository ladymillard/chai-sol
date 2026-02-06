use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Placeholder ID, will be replaced by user or build

#[program]
pub mod registry {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        model: String,
        specialties: String,
    ) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        let signer = &ctx.accounts.signer;
        let clock = Clock::get()?;

        require!(name.len() <= 50, RegistryError::NameTooLong);
        require!(model.len() <= 30, RegistryError::ModelTooLong);
        require!(specialties.len() <= 200, RegistryError::SpecialtiesTooLong);

        agent_account.wallet = signer.key();
        agent_account.name = name;
        agent_account.model = model;
        agent_account.specialties = specialties;
        agent_account.tasks_completed = 0;
        agent_account.total_earned = 0;
        agent_account.reputation = 50; // Start with neutral reputation
        agent_account.registered_at = clock.unix_timestamp;
        // metadata_url initialized as empty, can be updated later
        agent_account.metadata_url = String::new(); 

        msg!("Agent registered: {}", agent_account.name);
        Ok(())
    }

    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        metadata_url: String,
    ) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        
        require!(metadata_url.len() <= 200, RegistryError::UrlTooLong);
        
        agent_account.metadata_url = metadata_url;
        
        msg!("Agent updated profile for: {}", agent_account.name);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + AgentAccount::INIT_SPACE,
        seeds = [b"agent", signer.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", signer.key().as_ref()],
        bump,
        has_one = wallet @ RegistryError::Unauthorized
    )]
    pub agent_account: Account<'info, AgentAccount>,
    pub signer: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct AgentAccount {
    pub wallet: Pubkey,                // 32
    #[max_len(50)]
    pub name: String,                  // 4 + 50
    #[max_len(30)]
    pub model: String,                 // 4 + 30
    #[max_len(200)]
    pub specialties: String,           // 4 + 200
    #[max_len(200)]
    pub metadata_url: String,          // 4 + 200 (Added to satisfy update requirement)
    pub tasks_completed: u64,          // 8
    pub total_earned: u64,             // 8
    pub reputation: u8,                // 1
    pub registered_at: i64,            // 8
}

#[error_code]
pub enum RegistryError {
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Model name too long")]
    ModelTooLong,
    #[msg("Specialties description too long")]
    SpecialtiesTooLong,
    #[msg("Metadata URL too long")]
    UrlTooLong,
    #[msg("Unauthorized access")]
    Unauthorized,
}