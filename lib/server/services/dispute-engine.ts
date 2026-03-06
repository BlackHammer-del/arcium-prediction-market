import { randomBytes } from "crypto";

export type DisputeStatus = "Open" | "Resolved" | "Rejected";
export type DisputeOutcome = "MarketInvalid" | "SettlementUpheld" | "MarketCancelled";

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

export interface SettlementDisputeRecord {
  id: string;
  marketId: number;
  submittedBy: string;
  reason: string;
  status: DisputeStatus;
  createdAt: Date;
  updatedAt: Date;
  evidence: DisputeEvidenceRecord[];
  resolution?: DisputeResolutionRecord;
}

export interface OpenDisputeInput {
  marketId: number;
  submittedBy: string;
  reason: string;
  evidenceSummary?: string;
  evidenceUri?: string;
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
}

export class SettlementDisputeEngine {
  private disputes: SettlementDisputeRecord[] = [];
  private nextDisputeId = 1;

  listDisputes(marketId?: number): SettlementDisputeRecord[] {
    const filtered =
      typeof marketId === "number"
        ? this.disputes.filter((dispute) => dispute.marketId === marketId)
        : this.disputes;
    return filtered.map(cloneDispute);
  }

  getDispute(disputeId: string): SettlementDisputeRecord | null {
    const dispute = this.disputes.find((item) => item.id === disputeId);
    return dispute ? cloneDispute(dispute) : null;
  }

  openDispute(input: OpenDisputeInput): SettlementDisputeRecord {
    const now = new Date();
    const dispute: SettlementDisputeRecord = {
      id: `disp_${String(this.nextDisputeId++).padStart(6, "0")}`,
      marketId: input.marketId,
      submittedBy: input.submittedBy,
      reason: input.reason,
      status: "Open",
      createdAt: now,
      updatedAt: now,
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
    const dispute = this.disputes.find((item) => item.id === input.disputeId);
    if (!dispute) {
      throw new Error("Dispute not found.");
    }
    if (dispute.status !== "Open") {
      throw new Error("Dispute is already resolved.");
    }

    const now = new Date();
    dispute.status = input.outcome === "SettlementUpheld" ? "Rejected" : "Resolved";
    dispute.resolution = {
      outcome: input.outcome,
      resolvedBy: input.resolvedBy,
      resolutionNote: input.resolutionNote,
      resolvedAt: now,
    };
    dispute.updatedAt = now;

    return cloneDispute(dispute);
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
    evidence: dispute.evidence.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    })),
    resolution: dispute.resolution
      ? {
          ...dispute.resolution,
          resolvedAt: new Date(dispute.resolution.resolvedAt),
        }
      : undefined,
  };
}
