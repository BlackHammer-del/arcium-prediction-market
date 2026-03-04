import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const DEFAULT_CLUSTER_ID = "11111111111111111111111111111111";

function parsePublicKey(value: string | undefined, fallback: string): PublicKey {
  try {
    return new PublicKey(value ?? fallback);
  } catch {
    return new PublicKey(fallback);
  }
}

export interface Ciphertext {
  c1: Uint8Array;
  c2: Uint8Array;
}

export interface MarketState {
  id: number;
  title: string;
  description: string;
  resolutionTimestamp: Date;
  status: "Open" | "Resolving" | "Settled" | "Cancelled";
  totalParticipants: number;
  outcome?: boolean;
  revealedYesStake?: number;
  revealedNoStake?: number;
}

export const ARCIUM_DEVNET_CLUSTER = parsePublicKey(
  process.env.NEXT_PUBLIC_ARCIUM_CLUSTER_ID,
  DEFAULT_CLUSTER_ID
);

export async function fetchClusterPublicKey(
  _clusterId: PublicKey
): Promise<Uint8Array> {
  return new Uint8Array(32).fill(0x42);
}

export function encryptStake(
  amountLamports: bigint,
  clusterPublicKey: Uint8Array
): Ciphertext {
  const r = nacl.randomBytes(32);
  const c1 = xorBytes(r, clusterPublicKey);
  const c2 = xorBytes(bigintToBytes32(amountLamports), r);
  return { c1, c2 };
}

export function encryptChoice(
  choice: boolean,
  clusterPublicKey: Uint8Array
): Ciphertext {
  const r = nacl.randomBytes(32);
  const c1 = xorBytes(r, clusterPublicKey);
  const choiceBytes = new Uint8Array(32);
  choiceBytes[0] = choice ? 1 : 0;
  const c2 = xorBytes(choiceBytes, r);
  return { c1, c2 };
}

export function serializeCiphertext(e: Ciphertext): { c1: number[]; c2: number[] } {
  return { c1: Array.from(e.c1), c2: Array.from(e.c2) };
}

export function decodeMarketTitle(bytes: number[]): string {
  const array = Uint8Array.from(bytes);
  const end = array.indexOf(0);
  const effective = end === -1 ? array : array.slice(0, end);
  return new TextDecoder().decode(effective).trim();
}

export function marketStatusLabel(status: MarketState["status"]): string {
  const labels: Record<MarketState["status"], string> = {
    Open: "LIVE",
    Resolving: "RESOLVING",
    Settled: "SETTLED",
    Cancelled: "CANCELLED",
  };
  return labels[status];
}

export function yesPercent(
  market: Pick<MarketState, "revealedYesStake" | "revealedNoStake">
): number {
  const yes = market.revealedYesStake ?? 0;
  const no = market.revealedNoStake ?? 0;
  const total = yes + no;
  return total === 0 ? 50 : Math.round((yes / total) * 100);
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = a[i] ^ b[i % b.length];
  return out;
}

function bigintToBytes32(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let tmp = n;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(tmp & BigInt(0xff));
    tmp >>= BigInt(8);
  }
  return buf;
}
