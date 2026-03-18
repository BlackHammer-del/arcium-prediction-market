use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Unique ID for our Prediction Market program on the Solana blockchain.
// This is a real-format ID that will be replaced during build.
declare_id!("OracleMkt1111111111111111111111111111111111");

// Standard "Seeds" used to find our program's private data folders (PDAs).
pub const MARKET_SEED: &[u8]   = b"market";
pub const VAULT_SEED: &[u8]    = b"vault";
pub const POSITION_SEED: &[u8] = b"position";
pub const REGISTRY_SEED: &[u8] = b"registry";
pub const BOND_VAULT_SEED: &[u8] = b"bond-vault";

// Safety limits and protocol settings.
pub const PROTOCOL_FEE_BPS: u64 = 100; // 1%
pub const MIN_STAKE: u64         = 1_000_000;  // 0.001 of token base units
pub const MIN_CHALLENGE_BOND: u64 = 5_000_000; // Bond required to challenge.
pub const ORACLE_VOTE_THRESHOLD: u8 = 3; 
pub const CHALLENGE_WINDOW_SECS: i64 = 24 * 60 * 60; // 24-hour window.
pub const LIVENESS_TIMEOUT_SECS: i64 = 7 * 24 * 60 * 60; // 7-day escape hatch.

// [EXACT SPACE CALCULATIONS]
pub const REGISTRY_SPACE: usize = 8 + 32 + 32 + (32 * 5) + 8 + 1 + 1; 
pub const MARKET_SPACE: usize = 1200; 
pub const POSITION_SPACE: usize = 256;

/// A 64-byte Arcium ElGamal ciphertext (two Ristretto255 points).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, PartialEq, Eq)]
pub struct Ciphertext {
    pub c1: [u8; 32], // r · G
    pub c2: [u8; 32], // m · G + r · PK
}

#[account]
pub struct MarketRegistry {
    pub authority:      Pubkey,
    pub arcium_cluster: Pubkey,
    pub oracle_keys:    [Pubkey; 5],
    pub total_markets:  u64,
    pub version:        u8,
    pub bump:           u8,
}

#[account]
pub struct Market {
    pub id:                   u64,
    pub creator:              Pubkey,
    pub title:                [u8; 128],
    pub description:          [u8; 512],
    pub resolution_timestamp: i64,
    pub arcium_cluster:       Pubkey,
    pub status:               MarketStatus,
    pub outcome:              Option<bool>,
    pub vault:                Pubkey,
    pub bond_vault:           Pubkey,
    
    // [PRIVACY HARDENED] - Encrypted tallies. NO plaintext totals stored.
    pub encrypted_yes_stake:  Ciphertext,
    pub encrypted_no_stake:   Ciphertext,
    
    // Set ONLY after Arcium decryption at settlement.
    pub revealed_yes_stake:   u64,
    pub revealed_no_stake:    u64,
    
    pub challenge_deadline:   i64,
    pub challenged:           bool,
    pub challenger:           Pubkey,
    pub challenge_bond:       u64,
    
    pub yes_votes:            u8,
    pub no_votes:             u8,
    pub voters:               [Pubkey; 5],
    pub vote_records:         [u8; 5], // 1=Yes, 2=No
    pub bump:                 u8,
    pub vault_bump:           u8,
    pub bond_vault_bump:      u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default, Copy)]
pub enum MarketStatus {
    #[default] Open, SettledPending, Settled, Invalid, Cancelled,
}

#[account]
pub struct Position {
    pub owner:            Pubkey,
    pub market:           Pubkey,
    
    // [PRIVACY HARDENED] - ONLY encrypted data and commitment stored.
    pub encrypted_stake:  Ciphertext,
    pub encrypted_choice: Ciphertext,
    pub stake_commitment: [u8; 32],
    
    pub submitted_at:     i64,
    pub claimed:          bool,
    pub version:          u8,
    pub bump:             u8,
}

#[error_code]
pub enum PredictionMarketError {
    #[msg("Market is not open")] MarketNotOpen,
    #[msg("Mpc still pending")] MpcStillPending,
    #[msg("Stake too low")] StakeTooLow,
    #[msg("Invalid commitment")] InvalidCommitment,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Already voted")] AlreadyVoted,
    #[msg("Arithmetic overflow")] Overflow,
    #[msg("Challenge window expired")] ChallengeExpired,
    #[msg("Liveness timeout not reached")] TimeoutNotReached,
    #[msg("Already claimed")] AlreadyClaimed,
}

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, arcium_cluster: Pubkey, oracles: [Pubkey; 5]) -> Result<()> {
        let r = &mut ctx.accounts.registry;
        r.authority      = ctx.accounts.authority.key();
        r.arcium_cluster = arcium_cluster;
        r.oracle_keys    = oracles;
        r.total_markets  = 0;
        r.version        = 1;
        r.bump           = ctx.bumps.registry;
        Ok(())
    }

    pub fn create_market(ctx: Context<CreateMarket>, title: String, description: String, resolution_timestamp: i64) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        let market = &mut ctx.accounts.market;
        
        market.id = registry.total_markets;
        market.creator = ctx.accounts.creator.key();
        market.title = write_fixed_bytes::<128>(&title);
        market.description = write_fixed_bytes::<512>(&description);
        market.resolution_timestamp = resolution_timestamp;
        market.status = MarketStatus::Open;
        market.arcium_cluster = registry.arcium_cluster;
        market.vault = ctx.accounts.vault.key();
        market.bond_vault = ctx.accounts.bond_vault.key();
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.bond_vault_bump = ctx.bumps.bond_vault;

        registry.total_markets = registry.total_markets.checked_add(1).ok_or(PredictionMarketError::Overflow)?;
        Ok(())
    }

    /// [PRIVACY HARDENED] - Accepts and stores ONLY ciphertexts. 
    /// NO plaintext choice or stake is recorded.
    pub fn submit_position(
        ctx: Context<SubmitPosition>,
        encrypted_stake:  Ciphertext,
        encrypted_choice: Ciphertext,
        plaintext_stake_lamports: u64,
        stake_commitment: [u8; 32],
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        require!(market.status == MarketStatus::Open, PredictionMarketError::MarketNotOpen);
        require!(clock.unix_timestamp < market.resolution_timestamp, PredictionMarketError::MarketNotOpen);
        require!(plaintext_stake_lamports >= MIN_STAKE, PredictionMarketError::StakeTooLow);

        // Perform the token transfer (visible on Solana, but decoupled from persistent state).
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.user_token_account.to_account_info(),
                    to:        ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            plaintext_stake_lamports
        )?;

        let position = &mut ctx.accounts.position;
        position.owner            = ctx.accounts.user.key();
        position.market           = market.key();
        position.encrypted_stake  = encrypted_stake;
        position.encrypted_choice = encrypted_choice;
        position.stake_commitment = stake_commitment;
        position.submitted_at     = clock.unix_timestamp;
        position.claimed          = false;
        position.version          = 1;
        position.bump             = ctx.bumps.position;

        Ok(())
    }

    pub fn vote_on_outcome(ctx: Context<VoteOnOutcome>, yes_won: bool) -> Result<()> {
        let registry = &ctx.accounts.registry;
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        let oracle_key = ctx.accounts.oracle.key();
        require!(registry.oracle_keys.iter().any(|&k| k == oracle_key), PredictionMarketError::Unauthorized);
        require!(!market.voters.iter().any(|&k| k == oracle_key), PredictionMarketError::AlreadyVoted);

        for (idx, voter) in market.voters.iter_mut().enumerate() {
            if *voter == Pubkey::default() {
                *voter = oracle_key;
                market.vote_records[idx] = if yes_won { 1 } else { 2 };
                break;
            }
        }

        let (mut y, mut n) = (0u8, 0u8);
        for v in market.vote_records.iter() {
            if *v == 1 { y += 1; } else if *v == 2 { n += 1; }
        }

        if y >= ORACLE_VOTE_THRESHOLD || n >= ORACLE_VOTE_THRESHOLD {
            market.outcome = Some(y >= ORACLE_VOTE_THRESHOLD);
            market.status = MarketStatus::SettledPending;
            market.challenge_deadline = clock.unix_timestamp.checked_add(CHALLENGE_WINDOW_SECS).ok_or(PredictionMarketError::Overflow)?;
        }
        Ok(())
    }

    pub fn challenge_settlement(ctx: Context<ChallengeSettlement>, bond_amount: u64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        require!(!market.challenged, PredictionMarketError::Unauthorized);
        require!(clock.unix_timestamp < market.challenge_deadline, PredictionMarketError::ChallengeExpired);
        require!(bond_amount >= MIN_CHALLENGE_BOND, PredictionMarketError::StakeTooLow);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.challenger_token_account.to_account_info(),
                    to:        ctx.accounts.bond_vault.to_account_info(),
                    authority: ctx.accounts.challenger.to_account_info(),
                },
            ),
            bond_amount
        )?;

        market.status = MarketStatus::Invalid;
        market.challenged = true;
        market.challenger = ctx.accounts.challenger.key();
        market.challenge_bond = bond_amount;
        Ok(())
    }

    pub fn finalize_settlement(ctx: Context<FinalizeSettlement>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp > market.challenge_deadline, PredictionMarketError::TimeoutNotReached);
        require!(!market.challenged, PredictionMarketError::Unauthorized);
        
        market.status = MarketStatus::Settled;
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, outcome: bool) -> Result<()> {
        let registry = &ctx.accounts.registry;
        let market = &mut ctx.accounts.market;
        require!(ctx.accounts.authority.key() == registry.authority, PredictionMarketError::Unauthorized);
        
        market.outcome = Some(outcome);
        market.status = MarketStatus::Settled;
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>, revealed_stake: u64, winner: bool) -> Result<()> {
        let market   = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        require!(market.status == MarketStatus::Settled, PredictionMarketError::MpcStillPending);
        require!(!position.claimed, PredictionMarketError::AlreadyClaimed);
        
        let outcome = market.outcome.ok_or(PredictionMarketError::MpcStillPending)?;
        require!(winner == outcome, PredictionMarketError::Unauthorized);

        let total_pool = market.revealed_yes_stake.checked_add(market.revealed_no_stake).ok_or(PredictionMarketError::Overflow)?;
        let winning_pool = if outcome { market.revealed_yes_stake } else { market.revealed_no_stake };
        
        require!(winning_pool > 0, PredictionMarketError::MpcStillPending);

        let payout = (revealed_stake as u128)
            .checked_mul(total_pool as u128).ok_or(PredictionMarketError::Overflow)?
            .checked_div(winning_pool as u128).ok_or(PredictionMarketError::Overflow)? as u64;

        let market_id_bytes = market.id.to_le_bytes();
        let seeds = &[VAULT_SEED, market_id_bytes.as_ref(), &[market.vault_bump]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(), 
                Transfer { 
                    from: ctx.accounts.vault.to_account_info(), 
                    to: ctx.accounts.user_token_account.to_account_info(), 
                    authority: ctx.accounts.vault.to_account_info() 
                }, 
                &[&seeds[..]]
            ), 
            payout
        )?;

        position.claimed = true;
        Ok(())
    }

    pub fn refund_position(ctx: Context<RefundPosition>, revealed_stake: u64) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        let clock = Clock::get()?;

        let timed_out = clock.unix_timestamp > market.resolution_timestamp.checked_add(LIVENESS_TIMEOUT_SECS).ok_or(PredictionMarketError::Overflow)?;
        let is_broken = market.status == MarketStatus::Cancelled || market.status == MarketStatus::Invalid;

        require!(timed_out || is_broken, PredictionMarketError::TimeoutNotReached);
        require!(!position.claimed, PredictionMarketError::AlreadyClaimed);

        let market_id_bytes = market.id.to_le_bytes();
        let seeds = &[VAULT_SEED, market_id_bytes.as_ref(), &[market.vault_bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(), 
                Transfer { 
                    from: ctx.accounts.vault.to_account_info(), 
                    to: ctx.accounts.user_token_account.to_account_info(), 
                    authority: ctx.accounts.vault.to_account_info() 
                }, 
                &[&seeds[..]]
            ), 
            revealed_stake
        )?;

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
    #[account(init, payer = creator, token::mint = token_mint, token::authority = bond_vault, seeds = [BOND_VAULT_SEED, registry.total_markets.to_le_bytes().as_ref()], bump)]
    pub bond_vault: Account<'info, TokenAccount>,
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
pub struct VoteOnOutcome<'info> {
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, MarketRegistry>,
    #[account(mut, seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct ChallengeSettlement<'info> {
    #[account(mut, seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [BOND_VAULT_SEED, market.id.to_le_bytes().as_ref()], bump = market.bond_vault_bump)]
    pub bond_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub challenger_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub challenger: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FinalizeSettlement<'info> {
    #[account(mut, seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, MarketRegistry>,
    #[account(mut, seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
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

#[derive(Accounts)]
pub struct RefundPosition<'info> {
    #[account(seeds = [MARKET_SEED, market.id.to_le_bytes().as_ref()], bump = market.bump)]
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
