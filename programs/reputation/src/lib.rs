use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod reputation {
    use super::*;

    /// Placeholder — reputation logic to be implemented
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Reputation program initialized");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
