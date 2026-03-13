import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { xorBytesWasm } from "./stealth-wasm";

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
  status: "Open" | "Resolving" | "SettledPending" | "Settled" | "Cancelled" | "Invalid";
  totalParticipants: number;
  outcome?: boolean;
  revealedYesStake?: number;
  revealedNoStake?: number;
}

export interface EncryptedPositionPayload {
  encryptedStake: Ciphertext;
  encryptedChoice: Ciphertext;
  commitment: string;
  sealedAt: string;
  version: "v1";
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

async function xorBytesStealth(a: Uint8Array, b: Uint8Array): Promise<Uint8Array> {
  try {
    return await xorBytesWasm(a, b);
  } catch {
    return xorBytes(a, b);
  }
}

export async function encryptStake(
  amountLamports: bigint,
  clusterPublicKey: Uint8Array
): Promise<Ciphertext> {
  const r = nacl.randomBytes(32);
  const stakeBytes = bigintToBytes32(amountLamports);
  const c1 = await xorBytesStealth(r, clusterPublicKey);
  const c2 = await xorBytesStealth(stakeBytes, r);
  zeroize(stakeBytes);
  zeroize(r);
  return { c1, c2 };
}

export async function encryptChoice(
  choice: boolean,
  clusterPublicKey: Uint8Array
): Promise<Ciphertext> {
  const r = nacl.randomBytes(32);
  const choiceBytes = new Uint8Array(32);
  choiceBytes[0] = choice ? 1 : 0;
  const c1 = await xorBytesStealth(r, clusterPublicKey);
  const c2 = await xorBytesStealth(choiceBytes, r);
  zeroize(choiceBytes);
  zeroize(r);
  return { c1, c2 };
}

export function serializeCiphertext(e: Ciphertext): { c1: number[]; c2: number[] } {
  return { c1: Array.from(e.c1), c2: Array.from(e.c2) };
}

export async function encryptPositionPayload(params: {
  amountLamports: bigint;
  choice: boolean;
  clusterPublicKey: Uint8Array;
  wallet?: string;
}): Promise<EncryptedPositionPayload> {
  const sealedAt = new Date().toISOString();
  const encryptedStake = await encryptStake(params.amountLamports, params.clusterPublicKey);
  const encryptedChoice = await encryptChoice(params.choice, params.clusterPublicKey);
  const commitmentPayload = {
    version: "v1",
    sealedAt,
    wallet: params.wallet ?? "",
    encryptedStake: serializeCiphertext(encryptedStake),
    encryptedChoice: serializeCiphertext(encryptedChoice),
  };
  const commitment = await sha256Hex(jsonBytes(commitmentPayload));

  return {
    encryptedStake,
    encryptedChoice,
    commitment,
    sealedAt,
    version: "v1",
  };
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
    SettledPending: "SETTLEMENT WINDOW",
    Settled: "SETTLED",
    Cancelled: "CANCELLED",
    Invalid: "INVALID",
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

function zeroize(bytes: Uint8Array): void {
  bytes.fill(0);
}

function jsonBytes(payload: unknown): Uint8Array {
  const json = JSON.stringify(payload);
  return new TextEncoder().encode(json);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const copy = new Uint8Array(bytes);
    const digest = await window.crypto.subtle.digest("SHA-256", copy.buffer);
    return bufferToHex(new Uint8Array(digest));
  }

  const { createHash } = await import("crypto");
  return createHash("sha256").update(bytes).digest("hex");
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
