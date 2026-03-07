import { randomBytes } from "crypto";

const DEFAULT_CHALLENGE_WINDOW_HOURS = 24;
const DEFAULT_SLASH_BPS = 500;
const MIN_SLASH_BPS = 50;
const MAX_SLASH_BPS = 2_000;
const MAX_STAKE_AT_RISK_SOL = 1_000_000;

export type DisputeStatus = "Open" | "Resolved" | "Rejected" | "Expired";
export type DisputeOutcome = "MarketInvalid" | "SettlementUpheld" | "MarketCancelled";
export type InvalidMarketReasonCode =
  | "INSUFFICIENT_RESOLUTION_DATA"
  | "AMBIGUOUS_MARKET_RULES"
  | "ORACLE_DATA_MISMATCH"
  | "SETTLEMENT_MANIPULATION"
  | "FORCE_MAJEURE_EVENT";

export interface DisputeEvidenceRecord {
  id: string;
  submittedBy: string;
  summary: string;
  uri?: string;
  createdAt: Date;
}

export interface DisputeResolutionRecord {
  outcome: DisputeOutcome;
  resolvedBy: string;
  resolutionNote: string;
  resolvedAt: Date;
}

export interface DisputeChallengeWindowRecord {
  openedAt: Date;
  deadlineAt: Date;
  closedAt?: Date;
}

export interface DisputeSlashingRecord {
  slashBps: number;
  slashAmountSol: number;
  slashedResolver: string;
  beneficiary: string;
  reason: string;
  appliedAt: Date;
}

export interface InvalidMarketResolutionRecord {
  reasonCode: InvalidMarketReasonCode;
  rationale: string;
  refundMode: "full_refund";
  decidedAt: Date;
}

export interface SettlementDisputeRecord {
  id: string;
  marketId: number;
  submittedBy: string;
  contestedResolver: string;
  reason: string;
  status: DisputeStatus;
  createdAt: Date;
  updatedAt: Date;
  settlementStakeAtRiskSol: number;
  challengeWindow: DisputeChallengeWindowRecord;
  evidence: DisputeEvidenceRecord[];
  resolution?: DisputeResolutionRecord;
  slashing?: DisputeSlashingRecord;
  invalidResolution?: InvalidMarketResolutionRecord;
}

export interface OpenDisputeInput {
  marketId: number;
  submittedBy: string;
  contestedResolver?: string;
  reason: string;
  settlementStakeAtRiskSol?: number;
  challengeWindowHours?: number;
  evidenceSummary?: string;
  evidenceUri?: string;
  now?: Date;
}

export interface AddEvidenceInput {
  disputeId: string;
  submittedBy: string;
  summary: string;
  uri?: string;
}

export interface ResolveDisputeInput {
  disputeId: string;
  resolvedBy: string;
  outcome: DisputeOutcome;
  resolutionNote: string;
  invalidReasonCode?: InvalidMarketReasonCode;
  slashBps?: number;
  now?: Date;
}

export class SettlementDisputeEngine {
  private disputes: SettlementDisputeRecord[] = [];
  private nextDisputeId = 1;

  listDisputes(marketId?: number): SettlementDisputeRecord[] {
    this.expireDisputes();
    const filtered =
      typeof marketId === "number"
        ? this.disputes.filter((dispute) => dispute.marketId === marketId)
        : this.disputes;
    return filtered.map(cloneDispute);
  }

  getDispute(disputeId: string): SettlementDisputeRecord | null {
    this.expireDisputes();
    const dispute = this.disputes.find((item) => item.id === disputeId);
    return dispute ? cloneDispute(dispute) : null;
  }

  openDispute(input: OpenDisputeInput): SettlementDisputeRecord {
    const now = input.now ? new Date(input.now) : new Date();
    const challengeWindowHours = clampInt(
      input.challengeWindowHours ?? DEFAULT_CHALLENGE_WINDOW_HOURS,
      1,
      168
    );
    const stakeAtRisk = clampNumber(input.settlementStakeAtRiskSol ?? 0, 0, MAX_STAKE_AT_RISK_SOL);
    const reason = input.reason.trim();
    if (reason.length < 12) {
      throw new Error("Dispute reason must be at least 12 characters.");
    }

    const dispute: SettlementDisputeRecord = {
      id: `disp_${String(this.nextDisputeId++).padStart(6, "0")}`,
      marketId: input.marketId,
      submittedBy: input.submittedBy,
      contestedResolver: input.contestedResolver?.trim() || "oracle-settlement-engine",
      reason,
      status: "Open",
      createdAt: now,
      updatedAt: now,
      settlementStakeAtRiskSol: stakeAtRisk,
      challengeWindow: {
        openedAt: now,
        deadlineAt: new Date(now.getTime() + challengeWindowHours * 60 * 60 * 1000),
      },
      evidence: [],
    };

    if (input.evidenceSummary) {
      dispute.evidence.push({
        id: randomId("ev"),
        submittedBy: input.submittedBy,
        summary: input.evidenceSummary,
        uri: input.evidenceUri,
        createdAt: now,
      });
    }

    this.disputes.unshift(dispute);
    return cloneDispute(dispute);
  }

  addEvidence(input: AddEvidenceInput): SettlementDisputeRecord {
    const dispute = this.disputes.find((item) => item.id === input.disputeId);
    if (!dispute) {
      throw new Error("Dispute not found.");
    }
    if (dispute.status !== "Open") {
      throw new Error("Dispute is no longer open.");
    }

    dispute.evidence.push({
      id: randomId("ev"),
      submittedBy: input.submittedBy,
      summary: input.summary,
      uri: input.uri,
      createdAt: new Date(),
    });
    dispute.updatedAt = new Date();

    return cloneDispute(dispute);
  }

  resolveDispute(input: ResolveDisputeInput): SettlementDisputeRecord {
    const now = input.now ? new Date(input.now) : new Date();
    this.expireDisputes(now);

    const dispute = this.disputes.find((item) => item.id === input.disputeId);
    if (!dispute) {
      throw new Error("Dispute not found.");
    }
    if (dispute.status === "Expired") {
      throw new Error("Challenge window has closed.");
    }
    if (dispute.status !== "Open") {
      throw new Error("Dispute is already resolved.");
    }

    if (dispute.challengeWindow.deadlineAt.getTime() < now.getTime()) {
      dispute.status = "Expired";
      dispute.challengeWindow.closedAt = now;
      dispute.updatedAt = now;
      throw new Error("Challenge window has closed.");
    }

    dispute.status = input.outcome === "SettlementUpheld" ? "Rejected" : "Resolved";
    dispute.resolution = {
      outcome: input.outcome,
      resolvedBy: input.resolvedBy,
      resolutionNote: input.resolutionNote,
      resolvedAt: now,
    };
    dispute.challengeWindow.closedAt = now;
    dispute.updatedAt = now;

    if (input.outcome !== "SettlementUpheld") {
      const slashBps = clampInt(input.slashBps ?? DEFAULT_SLASH_BPS, MIN_SLASH_BPS, MAX_SLASH_BPS);
      const slashAmountSol = roundToSix((dispute.settlementStakeAtRiskSol * slashBps) / 10_000);
      dispute.slashing = {
        slashBps,
        slashAmountSol,
        slashedResolver: dispute.contestedResolver,
        beneficiary: dispute.submittedBy,
        reason:
          input.outcome === "MarketCancelled"
            ? "Settlement cancelled after successful challenge."
            : "Settlement invalidated by challenge evidence.",
        appliedAt: now,
      };
      dispute.invalidResolution = {
        reasonCode: input.invalidReasonCode ?? "INSUFFICIENT_RESOLUTION_DATA",
        rationale: input.resolutionNote,
        refundMode: "full_refund",
        decidedAt: now,
      };
    }

    return cloneDispute(dispute);
  }

  expireDisputes(reference = new Date()): number {
    let expiredCount = 0;
    for (const dispute of this.disputes) {
      if (dispute.status !== "Open") continue;
      if (dispute.challengeWindow.deadlineAt.getTime() >= reference.getTime()) continue;
      dispute.status = "Expired";
      dispute.updatedAt = new Date(reference);
      dispute.challengeWindow.closedAt = new Date(reference);
      expiredCount += 1;
    }
    return expiredCount;
  }
}

function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function cloneDispute(dispute: SettlementDisputeRecord): SettlementDisputeRecord {
  return {
    ...dispute,
    createdAt: new Date(dispute.createdAt),
    updatedAt: new Date(dispute.updatedAt),
    challengeWindow: {
      openedAt: new Date(dispute.challengeWindow.openedAt),
      deadlineAt: new Date(dispute.challengeWindow.deadlineAt),
      closedAt: dispute.challengeWindow.closedAt
        ? new Date(dispute.challengeWindow.closedAt)
        : undefined,
    },
    evidence: dispute.evidence.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    })),
    slashing: dispute.slashing
      ? {
          ...dispute.slashing,
          appliedAt: new Date(dispute.slashing.appliedAt),
        }
      : undefined,
    invalidResolution: dispute.invalidResolution
      ? {
          ...dispute.invalidResolution,
          decidedAt: new Date(dispute.invalidResolution.decidedAt),
        }
      : undefined,
    resolution: dispute.resolution
      ? {
          ...dispute.resolution,
          resolvedAt: new Date(dispute.resolution.resolvedAt),
        }
      : undefined,
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundToSix(value: number): number {
  return Number(value.toFixed(6));
}
