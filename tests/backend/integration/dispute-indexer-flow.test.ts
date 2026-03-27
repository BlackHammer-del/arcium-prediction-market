import assert from "node:assert/strict";
import test from "node:test";
import { SettlementDisputeEngine } from "../../../lib/server/services/dispute-engine.ts";
import { SolanaIndexerWorkerService } from "../../../lib/server/services/indexer.ts";

const TEST_WALLET = "Vote111111111111111111111111111111111111111";

function recordEvent(
  indexer: SolanaIndexerWorkerService,
  input: {
    marketId: number;
    type:
      | "DISPUTE_OPENED"
      | "DISPUTE_EVIDENCE_ADDED"
      | "DISPUTE_RESOLVED"
      | "DISPUTE_SLASHED";
    actor: string;
    details: string;
    slot: number;
    timestamp?: Date;
  }
) {
  return indexer.consumeEvent({
    ...input,
    signature: `sig_${input.marketId}_${input.slot}_${input.type.toLowerCase()}`,
  });
}

test("integration: invalid challenge resolution is reflected in audit and reconcile state", () => {
  const engine = new SettlementDisputeEngine();
  const indexer = new SolanaIndexerWorkerService();
  const marketId = 7;

  const dispute = engine.openDispute({
    marketId,
    submittedBy: TEST_WALLET,
    reason: "Settlement source hashes diverge between primary and fallback feeds.",
    settlementStakeAtRiskSol: 180,
    evidenceSummary: "Included signed snapshots from both sources.",
    now: new Date("2026-03-07T09:00:00.000Z"),
  });
  recordEvent(indexer, {
    marketId,
    type: "DISPUTE_OPENED",
    actor: TEST_WALLET,
    details: "Dispute opened",
    slot: 701,
    timestamp: dispute.createdAt,
  });

  const withEvidence = engine.addEvidence({
    disputeId: dispute.id,
    submittedBy: TEST_WALLET,
    summary: "Fallback source final candle timestamp differs by 2 minutes.",
  });
  recordEvent(indexer, {
    marketId,
    type: "DISPUTE_EVIDENCE_ADDED",
    actor: TEST_WALLET,
    details: `Evidence count ${withEvidence.evidence.length}`,
    slot: 702,
  });

  const resolved = engine.resolveDispute({
    disputeId: dispute.id,
    resolvedBy: TEST_WALLET,
    outcome: "MarketInvalid",
    invalidReasonCode: "ORACLE_DATA_MISMATCH",
    resolutionNote: "Mismatch reproduced by independent observer nodes.",
    slashBps: 500,
    now: new Date("2026-03-07T10:00:00.000Z"),
  });
  const resolvedEvent = recordEvent(indexer, {
    marketId,
    type: "DISPUTE_RESOLVED",
    actor: TEST_WALLET,
    details: resolved.resolution?.outcome ?? "unknown",
    slot: 703,
    timestamp: resolved.resolution?.resolvedAt,
  });
  if (resolved.slashing) {
    recordEvent(indexer, {
      marketId,
      type: "DISPUTE_SLASHED",
      actor: TEST_WALLET,
      details: `${resolved.slashing.slashBps}bps`,
      slot: 704,
      timestamp: resolved.slashing.appliedAt,
    });
  }

  const report = indexer.reconcileState();
  const audit = indexer.listAuditLog(20);

  assert.equal(resolved.status, "Resolved");
  assert.ok((resolved.slashing?.slashAmountSol ?? 0) > 0);
  assert.equal(report.totalEvents, 4);
  assert.equal(report.lastSlot, 704);
  assert.equal(report.integrityVerified, true);
  assert.equal(audit[1]?.slot, resolvedEvent.slot);
  assert.ok(audit.some((entry) => entry.type === "DISPUTE_SLASHED"));
});

test("integration: upheld challenge keeps integrity and no slashing event", () => {
  const engine = new SettlementDisputeEngine();
  const indexer = new SolanaIndexerWorkerService();
  const marketId = 12;

  const dispute = engine.openDispute({
    marketId,
    submittedBy: TEST_WALLET,
    reason: "Challenge raised for review but evidence quality is weak.",
    now: new Date("2026-03-07T09:00:00.000Z"),
  });

  const resolved = engine.resolveDispute({
    disputeId: dispute.id,
    resolvedBy: TEST_WALLET,
    outcome: "SettlementUpheld",
    resolutionNote: "Evidence does not invalidate settlement artifacts.",
    now: new Date("2026-03-07T09:30:00.000Z"),
  });

  const resolvedEvent = recordEvent(indexer, {
    marketId,
    type: "DISPUTE_RESOLVED",
    actor: TEST_WALLET,
    details: resolved.resolution?.outcome ?? "unknown",
    slot: 1201,
  });

  const report = indexer.reconcileState();
  const audit = indexer.listAuditLog(20);

  assert.equal(resolved.status, "Rejected");
  assert.equal(resolved.slashing, undefined);
  assert.equal(report.totalEvents, 1);
  assert.equal(report.lastSlot, resolvedEvent.slot);
  assert.equal(report.integrityVerified, true);
  assert.ok(!audit.some((entry) => entry.type === "DISPUTE_SLASHED"));
});
