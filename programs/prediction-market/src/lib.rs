use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Unique ID for our Prediction Market program on the Solana blockchain.
declare_id!("PredMkt1111111111111111111111111111111111111");

// Standard "Seeds" used to find our program's private data folders (PDAs).
pub const MARKET_SEED: &[u8]   = b"market";
pub const VAULT_SEED: &[u8]    = b"vault";
pub const POSITION_SEED: &[u8] = b"position";
pub const REGISTRY_SEED: &[u8] = b"registry";

pub const PROTOCOL_FEE_BPS: u64 = 100;        // 1%
pub const MIN_STAKE: u64         = 1_000_000;  // 0.001 of token base units
pub const MAX_TITLE_LEN: usize   = 128;
pub const MAX_DESC_LEN: usize    = 512;

// Account space constants.
pub const REGISTRY_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1;
pub const MARKET_SPACE: usize = 8 + 1200; 
pub const POSITION_SPACE: usize = 8 + 32 + 32 + 64 + 64 + 8 + 2 + 32 + 8 + 1 + 1;

/// A 64-byte Arcium ElGamal ciphertext.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, PartialEq, Eq)]
pub struct Ciphertext {
    pub c1: [u8; 32], 
    pub c2: [u8; 32], 
}

/// Arcium job ticket.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct ArciumComputeTicket {
    pub nonce:          [u8; 32],
    pub cluster_id:     Pubkey,
    pub submitted_slot: u64,
}

#[account]
pub struct MarketRegistry {
    pub authority:      Pubkey,
    pub arcium_cluster: Pubkey,
    pub total_markets:  u64,
    pub total_volume:   u64,
    pub bump:           u8,
}

#[account]
pub struct Market {
    pub id:                   u64,
    pub creator:              Pubkey,
    pub title:                [u8; 128],
    pub description:          [u8; 512],
    pub resolution_timestamp: i64,
    pub created_at:           i64,
    pub arcium_cluster:       Pubkey,
    pub encrypted_yes_stake:  Ciphertext,
    pub encrypted_no_stake:   Ciphertext,
    pub revealed_yes_stake:   u64,
    pub revealed_no_stake:    u64,
    pub tally_ticket:         ArciumComputeTicket,
    pub total_participants:   u32,
    pub status:               MarketStatus,
    pub outcome:              Option<bool>,
    pub encrypted_resolution: Ciphertext,
    pub vault:                Pubkey,
    pub token_mint:           Pubkey,
    pub bump:                 u8,
    pub vault_bump:           u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum MarketStatus {
    #[default] Open, Resolving, Settled, Cancelled,
}

/// [PRIVACY HARDENED] - Position account.
/// No plaintext stake or choice is stored here.
#[account]
pub struct Position {
    pub owner:            Pubkey,
    pub market:           Pubkey,
    pub encrypted_stake:  Ciphertext,
    pub encrypted_choice: Ciphertext,
    pub revealed_stake:   u64,          // Set ONLY after Arcium reveal.
    pub revealed_choice:  Option<bool>, // Set ONLY after Arcium reveal.
    pub stake_commitment: [u8; 32],     // SHA-256(amount || nonce)
    pub submitted_at:     i64,
    pub claimed:          bool,
    pub bump:             dT8,
}

#[error_code]
pub enum PredictionMarketError {
    #[msg("Market is not open")] MarketNotOpen,
    #[msg("Mpc still pending")] MpcStillPending,
    #[msg("Stake too low")] StakeTooLow,
    #[msg("Invalid commitment")] InvalidCommitment,
    #[msg("Unauthorized")] Unauthorized,
}

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, arcium_cluster: Pubkey) -> Result<()> {
        let r = &mut ctx.accounts.registry;
        r.authority      = ctx.accounts.authority.key();
        r.arcium_cluster = arcium_cluster;
        r.total_markets  = 0;
        r.total_volume   = 0;
        r.bump           = ctx.bumps.registry;
        Ok(())
    }

    pub fn create_market(ctx: Context<CreateMarket>, title: String, description: String, resolution_timestamp: i64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.id = ctx.accounts.registry.total_markets;
        market.creator = ctx.accounts.creator.key();
        market.resolution_timestamp = resolution_timestamp;
        market.status = MarketStatus::Open;
        market.arcium_cluster = ctx.accounts.registry.arcium_cluster;
        market.vault = ctx.accounts.vault.key();
        market.token_mint = ctx.accounts.token_mint.key();
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        ctx.accounts.registry.total_markets += 1;
        Ok(())
    }

    /// [PRIVACY HARDENED] - Stops persisting plaintext amount.
    pub fn submit_position(
        ctx: Context<SubmitPosition>,
        encrypted_stake:  Ciphertext,
        encrypted_choice: Ciphertext,
        plaintext_stake_lamports: u64,
        stake_commitment: [u8; 32],
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open, PredictionMarketError::MarketNotOpen);
        require!(plaintext_stake_lamports >= MIN_STAKE, PredictionMarketError::StakeTooLow);

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.user_token_account.to_account_info(),
                to:        ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, plaintext_stake_lamports)?;

        let position = &mut ctx.accounts.position;
        position.owner            = ctx.accounts.user.key();
        position.market           = market.key();
        position.encrypted_stake  = encrypted_stake;
        position.encrypted_choice = encrypted_choice;
        position.revealed_stake   = 0; // STAYS HIDDEN
        position.revealed_choice  = None; // STAYS HIDDEN
        position.stake_commitment = stake_commitment;
        position.submitted_at     = Clock::get()?.unix_timestamp;
        position.claimed          = false;
        position.bump             = ctx.bumps.position;

        market.total_participants += 1;
        ctx.accounts.registry.total_volume += plaintext_stake_lamports;
        Ok(())
    }

    pub fn settle_market(ctx: Context<SettleMarket>, yes_stake: u64, no_stake: u64, yes_won: bool) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.revealed_yes_stake = yes_stake;
        market.revealed_no_stake  = no_stake;
        market.outcome            = Some(yes_won);
        market.status             = MarketStatus::Settled;
        Ok(())
    }

    pub fn reveal_position(ctx: Context<RevealPosition>, stake: u64, choice: bool, stake_nonce: [u8; 32]) -> Result<()> {
        let position = &mut ctx.accounts.position;
        let mut preimage = [0u8; 40];
        preimage[..8].copy_from_slice(&stake.to_le_bytes());
        preimage[8..].copy_from_slice(&stake_nonce);
        let digest = anchor_lang::solana_program::hash::hash(&preimage);
        require!(digest.to_bytes() == position.stake_commitment, PredictionMarketError::InvalidCommitment);

        position.revealed_stake  = stake;
        position.revealed_choice = Some(choice);
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market   = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        require!(market.status == MarketStatus::Settled, PredictionMarketError::MpcStillPending);
        
        let outcome = market.outcome.ok_or(PredictionMarketError::MpcStillPending)?;
        let user_choice = position.revealed_choice.ok_or(PredictionMarketError::InvalidCommitment)?;
        require!(user_choice == outcome, PredictionMarketError::Unauthorized);

        let winning_pool = if outcome { market.revealed_yes_stake } else { market.revealed_no_stake };
        let total_pool = market.revealed_yes_stake + market.revealed_no_stake;
        let payout = (position.revealed_stake as u128).checked_mul(total_pool as u128).unwrap().checked_div(winning_pool as u128).unwrap() as u64;

        let seeds = &[VAULT_SEED, market.id.to_le_bytes().as_ref(), &[market.vault_bump]];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer { from: ctx.accounts.vault.to_account_info(), to: ctx.accounts.user_token_account.to_account_info(), authority: ctx.accounts.vault.to_account_info() }, &[&seeds[..]]), payout)?;
        position.claimed = true;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = REGISTRY_SPACE, seeds = [REGISTRY_SEED], bump)]
    pub registry: Account<'info, MarketRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(mut, seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, MarketRegistry>,
    #[account(init, payer = creator, space = MARKET_SPACE, seeds = [MARKET_SEED, registry.total_markets.to_le_bytes().as_ref()], bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = creator, token::mint = token_mint, token::authority = vault, seeds = [VAULT_SEED, registry.total_markets.to_le_bytes().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SubmitPosition<'info> {
    #[account(mut, seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = user, space = POSITION_SPACE, seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()], bump)]
    pub position: Account<'info, Position>,
    #[account(mut, seeds = [VAULT_SEED, market.id.to_le_bytes().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(mut, seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevealPosition<'info> {
    #[account(mut, seeds = [POSITION_SEED, market.key().as_ref(), position.owner.as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    pub market: Account<'info, Market>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    #[account(mut, seeds = [VAULT_SEED, market.id.to_le_bytes().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

fn write_fixed_bytes<const N: usize>(value: &str) -> [u8; N] {
    let mut out = [0u8; N];
    let bytes = value.as_bytes();
    let take = bytes.len().min(N);
    out[..take].copy_from_slice(&bytes[..take]);
    out
}
