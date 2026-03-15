#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { Connection, PublicKey } from "@solana/web3.js";

// [RELIABILITY UPGRADE] - Structured Logging
function log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  console.log(JSON.stringify(entry));
}

const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const programId = process.env.PREDICTION_MARKET_PROGRAM_ID ?? "PredMkt1111111111111111111111111111111111111";
const pollMs = Number.parseInt(process.env.INDEXER_POLL_MS ?? "15000", 10);
const maxPerPoll = Number.parseInt(process.env.INDEXER_LIMIT ?? "25", 10);
const stateFile = path.resolve(process.cwd(), "data", "indexer-state.json");
const auditFile = path.resolve(process.cwd(), "data", "solana-audit-log.ndjson");

// [RELIABILITY UPGRADE] - Use 'finalized' commitment to avoid reorgs
const connection = new Connection(rpcUrl, "finalized");
const targetProgram = new PublicKey(programId);

let cursor = null;

async function loadState() {
  try {
    const data = await fs.readFile(stateFile, "utf8");
    const parsed = JSON.parse(data);
    cursor = parsed.lastSignature;
    log("INFO", "Loaded indexer state", { cursor });
  } catch {
    log("INFO", "No previous state found, starting fresh");
  }
}

async function saveState() {
  const data = JSON.stringify({ lastSignature: cursor, updatedAt: new Date().toISOString() });
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, data, "utf8");
}

async function appendAudit(entry) {
  await fs.mkdir(path.dirname(auditFile), { recursive: true });
  await fs.appendFile(auditFile, `${JSON.stringify(entry)}\n`, "utf8");
}

// [RELIABILITY UPGRADE] - Exponential Backoff Retry
async function withRetry(fn, label, maxRetries = 5) {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      log("WARN", `Retrying ${label}`, { attempt: i + 1, delay, error: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

async function poll() {
  try {
    const signatures = await withRetry(async () => {
      return await connection.getSignaturesForAddress(
        targetProgram,
        { before: cursor, limit: maxPerPoll },
        "finalized"
      );
    }, "getSignaturesForAddress");

    if (!signatures || signatures.length === 0) return;

    const ordered = [...signatures].reverse();
    for (const item of ordered) {
      const tx = await withRetry(async () => {
        return await connection.getParsedTransaction(item.signature, {
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        });
      }, `getParsedTransaction(${item.signature})`);

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
      log("INFO", "Processed transaction", { slot: record.slot, sig: record.signature });
    }

    cursor = signatures[signatures.length - 1]?.signature;
    await saveState();
  } catch (error) {
    log("ERROR", "Poll failed", { error: error.message });
  }
}

async function main() {
  log("INFO", "Indexer worker starting", { 
    rpc: rpcUrl, 
    program: targetProgram.toBase58(),
    pollInterval: pollMs
  });

  await loadState();
  
  // Initial poll
  await poll();

  // Schedule regular polling
  const interval = setInterval(() => {
    poll().catch((error) => {
      log("ERROR", "Scheduled poll fatal error", { error: error.message });
    });
  }, pollMs);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    clearInterval(interval);
    log("INFO", "Shutdown requested, saving state...");
    await saveState();
    process.exit(0);
  });
}

main().catch((error) => {
  log("CRITICAL", "Fatal crash", { error: error.message, stack: error.stack });
  process.exit(1);
});
