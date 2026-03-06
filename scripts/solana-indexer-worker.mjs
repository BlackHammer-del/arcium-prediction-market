#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { Connection, PublicKey } from "@solana/web3.js";

const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const programId = process.env.PREDICTION_MARKET_PROGRAM_ID ?? "PredMkt1111111111111111111111111111111111111";
const pollMs = Number.parseInt(process.env.INDEXER_POLL_MS ?? "15000", 10);
const maxPerPoll = Number.parseInt(process.env.INDEXER_LIMIT ?? "25", 10);
const auditFile = path.resolve(process.cwd(), "data", "solana-audit-log.ndjson");

const connection = new Connection(rpcUrl, "confirmed");
const targetProgram = new PublicKey(programId);

let cursor;

async function ensureAuditFile() {
  await fs.mkdir(path.dirname(auditFile), { recursive: true });
  try {
    await fs.access(auditFile);
  } catch {
    await fs.writeFile(auditFile, "");
  }
}

async function appendAudit(entry) {
  await fs.appendFile(auditFile, `${JSON.stringify(entry)}\n`, "utf8");
}

async function poll() {
  const signatures = await connection.getSignaturesForAddress(
    targetProgram,
    { before: cursor, limit: maxPerPoll },
    "confirmed"
  );

  if (signatures.length === 0) return;

  const ordered = [...signatures].reverse();
  for (const item of ordered) {
    const tx = await connection.getParsedTransaction(item.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    const record = {
      timestamp: new Date().toISOString(),
      signature: item.signature,
      slot: item.slot,
      status: item.err ? "error" : "confirmed",
      programId: targetProgram.toBase58(),
      accountKeys: tx?.transaction.message.accountKeys.map((key) => key.pubkey.toBase58()) ?? [],
      logMessages: tx?.meta?.logMessages ?? [],
    };

    await appendAudit(record);
    console.log(`[indexer] slot=${record.slot} sig=${record.signature.slice(0, 16)}...`);
  }

  cursor = signatures[signatures.length - 1]?.signature;
}

async function main() {
  await ensureAuditFile();
  console.log(`[indexer] Oracle worker started`);
  console.log(`[indexer] RPC: ${rpcUrl}`);
  console.log(`[indexer] Program: ${targetProgram.toBase58()}`);
  console.log(`[indexer] Audit log: ${auditFile}`);

  await poll();
  setInterval(() => {
    poll().catch((error) => {
      console.error("[indexer] poll failed", error);
    });
  }, pollMs);
}

main().catch((error) => {
  console.error("[indexer] fatal", error);
  process.exit(1);
});
