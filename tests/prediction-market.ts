import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

const MARKET_SEED = Buffer.from("market");
const VAULT_SEED = Buffer.from("vault");
const BOND_VAULT_SEED = Buffer.from("bond-vault");
const POSITION_SEED = Buffer.from("position");
const REG_SEED = Buffer.from("registry");
const FAKE_CLUSTER = Keypair.generate().publicKey;

function shortArray(value: number): number[] {
  return Array.from(new Uint8Array(32).fill(value));
}

async function airdrop(connection: anchor.web3.Connection, wallet: PublicKey) {
  const sig = await connection.requestAirdrop(wallet, LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

describe("prediction-market matrix", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program<any>;
  const authority = provider.wallet as anchor.Wallet;
  const challenger = Keypair.generate();
  const oracles = Array.from({ length: 5 }, () => Keypair.generate());

  let mint: PublicKey;
  let registryPDA: PublicKey;
  let marketPDA: PublicKey;
  let vaultPDA: PublicKey;
  let bondVaultPDA: PublicKey;
  let positionPDA: PublicKey;
  let authorityAta: PublicKey;
  let challengerAta: PublicKey;

  before(async () => {
    [registryPDA] = PublicKey.findProgramAddressSync([REG_SEED], program.programId);
    [marketPDA] = PublicKey.findProgramAddressSync(
      [MARKET_SEED, Buffer.from(new Uint8Array(8))],
      program.programId
    );
    [vaultPDA] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, Buffer.from(new Uint8Array(8))],
      program.programId
    );
    [bondVaultPDA] = PublicKey.findProgramAddressSync(
      [BOND_VAULT_SEED, Buffer.from(new Uint8Array(8))],
      program.programId
    );
    [positionPDA] = PublicKey.findProgramAddressSync(
      [POSITION_SEED, marketPDA.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );

    await Promise.all([
      airdrop(provider.connection, challenger.publicKey),
      ...oracles.map((oracle) => airdrop(provider.connection, oracle.publicKey)),
    ]);

    mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );

    const authorityAtaInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      mint,
      authority.publicKey
    );
    authorityAta = authorityAtaInfo.address;

    const challengerAtaInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      mint,
      challenger.publicKey
    );
    challengerAta = challengerAtaInfo.address;

    await mintTo(
      provider.connection,
      authority.payer,
      mint,
      authorityAta,
      authority.publicKey,
      20_000_000
    );

    await mintTo(
      provider.connection,
      authority.payer,
      mint,
      challengerAta,
      authority.publicKey,
      20_000_000
    );
  });

  it("initializes registry", async () => {
    await program.methods
      .initialize(FAKE_CLUSTER, oracles.map((oracle) => oracle.publicKey))
      .accounts({
        registry: registryPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const registry = await program.account.marketRegistry.fetch(registryPDA);
    assert.equal(registry.arciumCluster.toBase58(), FAKE_CLUSTER.toBase58());
    assert.equal(registry.totalMarkets.toNumber(), 0);
  });

  it("creates a market", async () => {
    const resolutionTs = Math.floor(Date.now() / 1000) + 3600;

    await program.methods
      .createMarket(
        "Encrypted macro market",
        "Test market for encrypted positions.",
        new BN(resolutionTs)
      )
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        vault: vaultPDA,
        bondVault: bondVaultPDA,
        tokenMint: mint,
        creator: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const market = await program.account.market.fetch(marketPDA);
    assert.deepEqual(market.status, { open: {} });
  });

  it("submits encrypted position", async () => {
    const fakeEncStake = { c1: shortArray(0xaa), c2: shortArray(0xbb) };
    const fakeEncChoice = { c1: shortArray(0xcc), c2: shortArray(0xdd) };

    await program.methods
      .submitPosition(fakeEncStake, fakeEncChoice, new BN(1_000_000), shortArray(0x11))
      .accounts({
        market: marketPDA,
        position: positionPDA,
        vault: vaultPDA,
        userTokenAccount: authorityAta,
        user: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const position = await program.account.position.fetch(positionPDA);
    assert.equal(position.claimed, false);
  });

  it("prevents duplicate oracle votes and enters settlement window", async () => {
    await program.methods
      .voteOnOutcome(true)
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        oracle: oracles[0].publicKey,
      })
      .signers([oracles[0]])
      .rpc();

    let duplicateFailed = false;
    try {
      await program.methods
        .voteOnOutcome(true)
        .accounts({
          registry: registryPDA,
          market: marketPDA,
          oracle: oracles[0].publicKey,
        })
        .signers([oracles[0]])
        .rpc();
    } catch {
      duplicateFailed = true;
    }
    assert.equal(duplicateFailed, true);

    await program.methods
      .voteOnOutcome(true)
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        oracle: oracles[1].publicKey,
      })
      .signers([oracles[1]])
      .rpc();

    await program.methods
      .voteOnOutcome(true)
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        oracle: oracles[2].publicKey,
      })
      .signers([oracles[2]])
      .rpc();

    const market = await program.account.market.fetch(marketPDA);
    assert.deepEqual(market.status, { settledPending: {} });
  });

  it("reveals stakes, opens challenge, and resolves dispute", async () => {
    await program.methods
      .revealStakes(new BN(2_000_000), new BN(1_000_000))
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        authority: authority.publicKey,
      })
      .rpc();

    await program.methods
      .challengeSettlement(new BN(5_000_000))
      .accounts({
        market: marketPDA,
        bondVault: bondVaultPDA,
        challengerTokenAccount: challengerAta,
        challenger: challenger.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([challenger])
      .rpc();

    const challengedMarket = await program.account.market.fetch(marketPDA);
    assert.deepEqual(challengedMarket.status, { challenged: {} });

    await program.methods
      .resolveDispute({ uphold: {} })
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        bondVault: bondVaultPDA,
        challengerTokenAccount: challengerAta,
        authorityTokenAccount: authorityAta,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const resolvedMarket = await program.account.market.fetch(marketPDA);
    assert.deepEqual(resolvedMarket.status, { settled: {} });
  });
});
