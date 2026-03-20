import type { WalletContextState } from "@solana/wallet-adapter-react";
import { buildWalletAuthMessage } from "./wallet-auth";

const SIGN_PROOF_TTL_MS = 2 * 60 * 1000;
const unlockProofByWallet = new Map<string, number>();
const encoder = new TextEncoder();

type WalletGuardInput = Pick<WalletContextState, "connected" | "publicKey" | "signMessage">;

function encodeBase64(value: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function generateNonce(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export async function ensureWalletUnlocked(wallet: WalletGuardInput, actionLabel: string): Promise<void> {
  if (!wallet.connected || !wallet.publicKey) {
    throw new Error("Connect your wallet first.");
  }
  if (!wallet.signMessage) {
    throw new Error("Selected wallet cannot sign messages. Use Phantom or Solflare.");
  }

  const walletAddress = wallet.publicKey.toBase58();
  const previousProofAt = unlockProofByWallet.get(walletAddress) ?? 0;
  const now = Date.now();
  if (now - previousProofAt <= SIGN_PROOF_TTL_MS) {
    return;
  }

  try {
    await wallet.signMessage(
      encoder.encode(`Oracle unlock check for ${actionLabel} @ ${new Date(now).toISOString()}`)
    );
    unlockProofByWallet.set(walletAddress, now);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Signature request failed.";
    if (/reject|decline|cancel/i.test(message)) {
      throw new Error("Signature request rejected. Unlock wallet and approve to continue.");
    }
    if (/lock|locked|not open|not connected/i.test(message)) {
      throw new Error("Wallet appears locked. Unlock it and retry.");
    }
    throw new Error(`Wallet must be unlocked to ${actionLabel}.`);
  }
}

export async function createWalletAuthPayload(
  wallet: WalletGuardInput,
  actionLabel: string
): Promise<{ message: string; signature: string; timestamp: string; nonce: string }> {
  if (!wallet.connected || !wallet.publicKey) {
    throw new Error("Connect your wallet first.");
  }
  if (!wallet.signMessage) {
    throw new Error("Selected wallet cannot sign messages. Use Phantom or Solflare.");
  }

  const timestamp = new Date().toISOString();
  const nonce = generateNonce();
  const message = buildWalletAuthMessage(actionLabel, wallet.publicKey.toBase58(), timestamp, nonce);
  const signatureBytes = await wallet.signMessage(encoder.encode(message));

  return {
    message,
    signature: encodeBase64(signatureBytes),
    timestamp,
    nonce,
  };
}
