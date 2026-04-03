import { MARKET_TOKEN_DECIMALS, MARKET_TOKEN_SYMBOL, MIN_STAKE_BASE_UNITS } from "./config";

export function parseTokenAmount(value: string, decimals = MARKET_TOKEN_DECIMALS): bigint | null {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const paddedFraction = (fractionPart + "0".repeat(decimals)).slice(0, decimals);
  try {
    const whole = BigInt(wholePart || "0");
    const fraction = BigInt(paddedFraction || "0");
    return whole * 10n ** BigInt(decimals) + fraction;
  } catch {
    return null;
  }
}

export function formatTokenAmount(
  value: bigint,
  decimals = MARKET_TOKEN_DECIMALS,
  precision = Math.min(decimals, 4)
): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  if (precision === 0) return whole.toString();

  const rawFraction = fraction.toString().padStart(decimals, "0").slice(0, precision);
  const trimmedFraction = rawFraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
}

export function formatMinimumStakeLabel(): string {
  return `${formatTokenAmount(MIN_STAKE_BASE_UNITS)} ${MARKET_TOKEN_SYMBOL}`;
}
