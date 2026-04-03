import { PublicKey } from "@solana/web3.js";

const DEFAULT_PROGRAM_ID = "7krCLEf4n4QnLnaLgJQTkQB7bS72PRxbM2dGZLb3oQto";
const TOKEN_PROGRAM_ID_VALUE = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM_ID_VALUE = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const DEFAULT_MARKET_TOKEN_SYMBOL = "USDC";
const DEFAULT_MARKET_TOKEN_DECIMALS = 6;

function parsePublicKey(value: string | undefined, fallback: string): PublicKey {
  try {
    return new PublicKey(value ?? fallback);
  } catch {
    return new PublicKey(fallback);
  }
}

function parseOptionalPublicKey(value: string | undefined): PublicKey | null {
  try {
    return value?.trim() ? new PublicKey(value.trim()) : null;
  } catch {
    return null;
  }
}

function parseTokenDecimals(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 12) {
    return fallback;
  }
  return parsed;
}

export const PROGRAM_ID = parsePublicKey(
  process.env.NEXT_PUBLIC_PREDICTION_MARKET_PROGRAM_ID,
  DEFAULT_PROGRAM_ID
);
export const TOKEN_PROGRAM_ID = new PublicKey(TOKEN_PROGRAM_ID_VALUE);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  ASSOCIATED_TOKEN_PROGRAM_ID_VALUE
);
export const MARKET_TOKEN_MINT = parseOptionalPublicKey(
  process.env.NEXT_PUBLIC_MARKET_TOKEN_MINT
);
export const MARKET_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_MARKET_TOKEN_SYMBOL?.trim() || DEFAULT_MARKET_TOKEN_SYMBOL;
export const MARKET_TOKEN_DECIMALS = parseTokenDecimals(
  process.env.NEXT_PUBLIC_MARKET_TOKEN_DECIMALS,
  DEFAULT_MARKET_TOKEN_DECIMALS
);
export const MIN_STAKE_BASE_UNITS = 1_000_000n;
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
