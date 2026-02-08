// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Placeholder ID

#[program]
pub mod registry {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let registry_config = &mut ctx.accounts.registry_config;
        registry_config.admin = ctx.accounts.admin.key();
        msg!("Registry initialized with admin: {}", registry_config.admin);
        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        model: String,
        github_url: String, // Changed from specialties for Oracle usage
    ) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        let signer = &ctx.accounts.signer;
        let clock = Clock::get()?;

        require!(name.len() <= 50, RegistryError::NameTooLong);
        require!(model.len() <= 30, RegistryError::ModelTooLong);
        require!(github_url.len() <= 200, RegistryError::UrlTooLong);

        agent_account.wallet = signer.key();
        agent_account.name = name;
        agent_account.model = model;
        agent_account.github_url = github_url;
        // Specialties are now populated by the Oracle, start empty
        agent_account.specialties = String::from("Pending Verification...");
        agent_account.tasks_completed = 0;
        agent_account.total_earned = 0;
        agent_account.reputation = 0; // Start at 0 until verified
        agent_account.verified = false;
        agent_account.registered_at = clock.unix_timestamp;
        agent_account.metadata_url = String::new(); 

        msg!("Agent registered: {}. Waiting for Oracle verification.", agent_account.name);
        Ok(())
    }

    pub fn verify_agent(
        ctx: Context<VerifyAgent>,
        reputation_score: u8,
        verified_specialties: String,
    ) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        
        require!(verified_specialties.len() <= 200, RegistryError::SpecialtiesTooLong);
        require!(reputation_score <= 100, RegistryError::InvalidScore);

        agent_account.reputation = reputation_score;
        agent_account.specialties = verified_specialties;
        agent_account.verified = true;

        msg!("Agent {} verified by Oracle. Score: {}", agent_account.name, reputation_score);
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
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32, // Discriminator + Pubkey
        seeds = [b"config"],
        bump
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
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
pub struct VerifyAgent<'info> {
    #[account(mut)]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(
        seeds = [b"config"],
        bump,
        has_one = admin @ RegistryError::Unauthorized
    )]
    pub registry_config: Account<'info, RegistryConfig>,
    pub admin: Signer<'info>, // The Oracle must sign this
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
pub struct RegistryConfig {
    pub admin: Pubkey,
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
    pub github_url: String,            // 4 + 200 (For Oracle Analysis)
    #[max_len(200)]
    pub metadata_url: String,          // 4 + 200 
    pub tasks_completed: u64,          // 8
    pub total_earned: u64,             // 8
    pub reputation: u8,                // 1
    pub verified: bool,                // 1
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
    #[msg("URL too long")]
    UrlTooLong,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid reputation score (must be 0-100)")]
    InvalidScore,
}