import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

const MARKET_SEED = Buffer.from("market");
const VAULT_SEED  = Buffer.from("vault");
const POS_SEED    = Buffer.from("position");
const REG_SEED    = Buffer.from("registry");
const FAKE_CLUSTER = Keypair.generate().publicKey;

describe("prediction-market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program<any>;
  const authority = provider.wallet as anchor.Wallet;
  let mint: PublicKey;
  let registryPDA: PublicKey;
  

  before(async () => {
    [registryPDA] = PublicKey.findProgramAddressSync(
      [REG_SEED],
      program.programId
    );
    mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );
  });

  // ── initialize ────────────────────────────────────────────
  it("initialises the protocol registry", async () => {
    await program.methods
      .initialize(FAKE_CLUSTER)
      .accounts({
        registry: registryPDA,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const reg = await program.account.marketRegistry.fetch(registryPDA);
    assert.equal(reg.arciumCluster.toBase58(), FAKE_CLUSTER.toBase58());
    assert.equal(reg.totalMarkets.toNumber(), 0);
    console.log("  ✓ Registry initialised, Arcium cluster:", FAKE_CLUSTER.toBase58());
  });

  // ── create market ─────────────────────────────────────────
  it("creates a new prediction market", async () => {
    const [marketPDA] = PublicKey.findProgramAddressSync(
      [MARKET_SEED, Buffer.alloc(8)], // market id = 0
      program.programId
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, Buffer.alloc(8)],
      program.programId
    );

    const resolutionTs = Math.floor(Date.now() / 1000) + 60 * 60; // +1hr

    await program.methods
      .createMarket(
        "Will SOL exceed $500?",
        "Resolves YES if SOL spot price > $500 at Binance.",
        new BN(resolutionTs)
      )
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        vault: vaultPDA,
        tokenMint: mint,
        creator: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const market = await program.account.market.fetch(marketPDA);
    const title = Buffer.from(market.title).toString("utf8").replace(/\0/g, "");
    assert.equal(title, "Will SOL exceed $500?");
    assert.deepEqual(market.status, { open: {} });
    console.log("  ✓ Market created: id=0, title=", title);
  });

  // ── submit encrypted position ─────────────────────────────
  it("accepts an encrypted position", async () => {
    const [marketPDA] = PublicKey.findProgramAddressSync(
      [MARKET_SEED, Buffer.alloc(8)],
      program.programId
    );
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, Buffer.alloc(8)],
      program.programId
    );
    const [posPDA] = PublicKey.findProgramAddressSync(
      [POS_SEED, marketPDA.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );

    // Mint tokens to user
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      mint,
      authority.publicKey
    );
    await mintTo(
      provider.connection,
      authority.payer,
      mint,
      ata.address,
      authority.publicKey,
      10_000_000
    );

    // Fake Arcium ElGamal ciphertexts (32-byte arrays)
    const fakeEncStake: { c1: number[]; c2: number[] } = {
      c1: Array.from(new Uint8Array(32).fill(0xaa)),
      c2: Array.from(new Uint8Array(32).fill(0xbb)),
    };
    const fakeEncChoice: { c1: number[]; c2: number[] } = {
      c1: Array.from(new Uint8Array(32).fill(0xcc)),
      c2: Array.from(new Uint8Array(32).fill(0xdd)),
    };

    await program.methods
      .submitPosition(fakeEncStake, fakeEncChoice, new BN(1_000_000))
      .accounts({
        registry: registryPDA,
        market: marketPDA,
        position: posPDA,
        vault: vaultPDA,
        userTokenAccount: ata.address,
        user: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const pos = await program.account.position.fetch(posPDA);
    assert.equal(pos.owner.toBase58(), authority.publicKey.toBase58());
    assert.equal(pos.claimed, false);
    console.log("  ✓ Encrypted position submitted — stake & choice as ciphertexts only");
  });
});
