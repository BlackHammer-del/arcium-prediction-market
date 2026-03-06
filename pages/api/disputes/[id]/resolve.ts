import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeWallet, store } from "../../../../lib/server/store";
import type { DisputeOutcome } from "../../../../lib/server/services/dispute-engine";

const OUTCOMES: DisputeOutcome[] = ["MarketInvalid", "SettlementUpheld", "MarketCancelled"];

function parseDisputeId(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? "";
}

function parseOutcome(value: unknown): DisputeOutcome | null {
  if (typeof value !== "string") return null;
  return OUTCOMES.includes(value as DisputeOutcome) ? (value as DisputeOutcome) : null;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: `Method ${req.method ?? "UNKNOWN"} Not Allowed` });
    return;
  }

  const disputeId = parseDisputeId(req.query.id);
  const resolvedBy = normalizeWallet(req.body?.wallet);
  const outcome = parseOutcome(req.body?.outcome);
  const resolutionNote =
    typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.trim() : "";

  if (!disputeId) {
    res.status(400).json({ error: "Dispute id is required." });
    return;
  }
  if (!outcome) {
    res.status(400).json({ error: "Invalid dispute outcome." });
    return;
  }
  if (!resolutionNote || resolutionNote.length < 8) {
    res.status(400).json({ error: "Resolution note must be at least 8 characters." });
    return;
  }

  try {
    const dispute = store.resolveDispute({
      disputeId,
      resolvedBy,
      outcome,
      resolutionNote,
    });

    res.status(200).json({
      dispute: {
        ...dispute,
        createdAt: dispute.createdAt.toISOString(),
        updatedAt: dispute.updatedAt.toISOString(),
        evidence: dispute.evidence.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
        resolution: dispute.resolution
          ? {
              ...dispute.resolution,
              resolvedAt: dispute.resolution.resolvedAt.toISOString(),
            }
          : undefined,
      },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not resolve dispute.";
    res.status(409).json({ error: message });
  }
}
