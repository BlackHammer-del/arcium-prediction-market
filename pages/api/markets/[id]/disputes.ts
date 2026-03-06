import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeWallet, store } from "../../../../lib/server/store";

function parseMarketId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return Number.NaN;
  return Number.parseInt(raw, 10);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const marketId = parseMarketId(req.query.id);
  if (Number.isNaN(marketId)) {
    res.status(400).json({ error: "Invalid market id." });
    return;
  }

  if (req.method === "GET") {
    const disputes = store.listMarketDisputes(marketId).map((dispute) => ({
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
    }));

    res.status(200).json({ disputes });
    return;
  }

  if (req.method === "POST") {
    const wallet = normalizeWallet(req.body?.wallet);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const evidenceSummary =
      typeof req.body?.evidenceSummary === "string" ? req.body.evidenceSummary.trim() : "";
    const evidenceUri = typeof req.body?.evidenceUri === "string" ? req.body.evidenceUri.trim() : "";

    if (!reason || reason.length < 12) {
      res.status(400).json({ error: "Reason must be at least 12 characters." });
      return;
    }

    try {
      const dispute = store.openMarketDispute({
        marketId,
        submittedBy: wallet,
        reason,
        evidenceSummary: evidenceSummary || undefined,
        evidenceUri: evidenceUri || undefined,
      });

      res.status(201).json({
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
      return;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not open dispute.";
      res.status(409).json({ error: message });
      return;
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).json({ error: `Method ${req.method ?? "UNKNOWN"} Not Allowed` });
}
