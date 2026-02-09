// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of malicious
// code, injection attacks, or abuse of this program or its agents is strictly
// prohibited. We will prosecute to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

use anchor_lang::prelude::*;

declare_id!("8kepcYcYBcfszTGk9sHyavib3nSjrdzTPDdU8xnKkGan");

#[program]
pub mod learning {
    use super::*;

    /// Initialize the learning system
    pub fn initialize(ctx: Context<InitializeLearning>) -> Result<()> {
        let config = &mut ctx.accounts.learning_config;
        config.authority = ctx.accounts.authority.key();
        config.total_skills_recorded = 0;
        config.total_xp_awarded = 0;
        msg!("Learning system initialized. Authority: {}", config.authority);
        Ok(())
    }

    /// Record or update a skill for an agent
    pub fn record_skill(
        ctx: Context<RecordSkill>,
        agent: Pubkey,
        skill_name: String,
        proficiency: u8,
    ) -> Result<()> {
        require!(skill_name.len() <= 50, LearningError::SkillNameTooLong);
        require!(proficiency <= 100, LearningError::InvalidProficiency);

        let skill = &mut ctx.accounts.skill_record;
        let config = &mut ctx.accounts.learning_config;

        skill.agent = agent;
        skill.skill_name = skill_name;
        skill.proficiency = proficiency;
        skill.tasks_completed += 1;
        skill.last_updated = Clock::get()?.unix_timestamp;

        config.total_skills_recorded += 1;

        msg!("Skill recorded for agent {}: proficiency {}/100", agent, proficiency);
        Ok(())
    }

    /// Record experience gained from a task
    pub fn record_experience(
        ctx: Context<RecordExperience>,
        agent: Pubkey,
        task_type: String,
        xp_gained: u64,
    ) -> Result<()> {
        require!(task_type.len() <= 50, LearningError::TaskTypeTooLong);

        let xp = &mut ctx.accounts.experience_log;
        let config = &mut ctx.accounts.learning_config;

        xp.agent = agent;
        xp.task_type = task_type;
        xp.total_xp += xp_gained;
        xp.tasks_in_category += 1;
        xp.last_updated = Clock::get()?.unix_timestamp;

        config.total_xp_awarded += xp_gained;

        msg!("Agent {} gained {} XP. Total: {}", agent, xp_gained, xp.total_xp);
        Ok(())
    }
}

// ── Account Contexts ──────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeLearning<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + LearningConfig::INIT_SPACE,
        seeds = [b"learning_config"],
        bump
    )]
    pub learning_config: Account<'info, LearningConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent: Pubkey, skill_name: String)]
pub struct RecordSkill<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + SkillRecord::INIT_SPACE,
        seeds = [b"skill", agent.as_ref(), skill_name.as_bytes()],
        bump
    )]
    pub skill_record: Account<'info, SkillRecord>,
    #[account(
        mut,
        seeds = [b"learning_config"],
        bump,
        has_one = authority @ LearningError::Unauthorized
    )]
    pub learning_config: Account<'info, LearningConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent: Pubkey, task_type: String)]
pub struct RecordExperience<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + ExperienceLog::INIT_SPACE,
        seeds = [b"xp", agent.as_ref(), task_type.as_bytes()],
        bump
    )]
    pub experience_log: Account<'info, ExperienceLog>,
    #[account(
        mut,
        seeds = [b"learning_config"],
        bump,
        has_one = authority @ LearningError::Unauthorized
    )]
    pub learning_config: Account<'info, LearningConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ── Account Data ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct LearningConfig {
    pub authority: Pubkey,             // 32
    pub total_skills_recorded: u64,    // 8
    pub total_xp_awarded: u64,        // 8
}

#[account]
#[derive(InitSpace)]
pub struct SkillRecord {
    pub agent: Pubkey,                 // 32
    #[max_len(50)]
    pub skill_name: String,            // 4 + 50
    pub proficiency: u8,               // 1
    pub tasks_completed: u64,          // 8
    pub last_updated: i64,             // 8
}

#[account]
#[derive(InitSpace)]
pub struct ExperienceLog {
    pub agent: Pubkey,                 // 32
    #[max_len(50)]
    pub task_type: String,             // 4 + 50
    pub total_xp: u64,                // 8
    pub tasks_in_category: u64,        // 8
    pub last_updated: i64,             // 8
}

// ── Errors ────────────────────────────────────────────────────

#[error_code]
pub enum LearningError {
    #[msg("Unauthorized — only the learning authority can perform this action")]
    Unauthorized,
    #[msg("Skill name too long — max 50 characters")]
    SkillNameTooLong,
    #[msg("Task type too long — max 50 characters")]
    TaskTypeTooLong,
    #[msg("Invalid proficiency — must be 0-100")]
    InvalidProficiency,
}
