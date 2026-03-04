import { PublicKey } from "@solana/web3.js";

const DEFAULT_PROGRAM_ID = "9xQeWvG816bUx9EPfM5f6K4M6R4xM3aMcMBXNte1qNbf";

function parsePublicKey(value: string | undefined, fallback: string): PublicKey {
  try {
    return new PublicKey(value ?? fallback);
  } catch {
    return new PublicKey(fallback);
  }
}

export const PROGRAM_ID = parsePublicKey(
  process.env.NEXT_PUBLIC_PREDICTION_MARKET_PROGRAM_ID,
  DEFAULT_PROGRAM_ID
);

export const MARKET_SEED = Buffer.from("market");
export const VAULT_SEED = Buffer.from("vault");
export const POSITION_SEED = Buffer.from("position");
export const REGISTRY_SEED = Buffer.from("registry");

export function getRegistryPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([REGISTRY_SEED], PROGRAM_ID);
}

export function getMarketPDA(marketId: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(marketId));
  return PublicKey.findProgramAddressSync([MARKET_SEED, idBuf], PROGRAM_ID);
}

export function getVaultPDA(marketId: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(marketId));
  return PublicKey.findProgramAddressSync([VAULT_SEED, idBuf], PROGRAM_ID);
}

export function getPositionPDA(
  marketPubkey: PublicKey,
  userPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POSITION_SEED, marketPubkey.toBuffer(), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

export const DEMO_MARKETS = [
  {
    id: 0,
    title: "Will BTC exceed $100k before Q4 2025?",
    description:
      "Resolves YES if Bitcoin spot price on Binance exceeds $100,000 before October 1, 2025.",
    resolutionTimestamp: new Date("2025-10-01"),
    status: "Open" as const,
    totalParticipants: 312,
    revealedYesStake: undefined,
    revealedNoStake: undefined,
  },
  {
    id: 1,
    title: "Solana TPS > 10k sustained for 7 days?",
    description:
      "Resolves YES if Solana mainnet sustains over 10,000 non-vote TPS for 7 consecutive days.",
    resolutionTimestamp: new Date("2025-12-31"),
    status: "Open" as const,
    totalParticipants: 178,
    revealedYesStake: undefined,
    revealedNoStake: undefined,
  },
  {
    id: 2,
    title: "Ethereum ETF net inflows > $5B in 2025?",
    description:
      "Resolves YES if spot Ethereum ETFs record cumulative net inflows above $5 billion by December 31, 2025.",
    resolutionTimestamp: new Date("2025-12-31"),
    status: "Settled" as const,
    totalParticipants: 521,
    revealedYesStake: 12_400_000_000,
    revealedNoStake: 8_100_000_000,
    outcome: true,
  },
  {
    id: 3,
    title: "Will Arcium launch mainnet in 2025?",
    description:
      "Resolves YES if Arcium announces and launches production mainnet by December 31, 2025.",
    resolutionTimestamp: new Date("2025-12-31"),
    status: "Open" as const,
    totalParticipants: 89,
    revealedYesStake: undefined,
    revealedNoStake: undefined,
  },
];
