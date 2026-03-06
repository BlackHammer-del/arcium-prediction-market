import type { NextApiRequest, NextApiResponse } from "next";
import { store } from "../../../lib/server/store";

function parseLimit(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 200;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.max(1, Math.min(parsed, 500));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: `Method ${req.method ?? "UNKNOWN"} Not Allowed` });
    return;
  }

  const limit = parseLimit(req.query.limit);
  const entries = store.getAuditLog(limit).map((entry) => ({
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  }));

  res.status(200).json({
    entries,
    mode: "append-only",
  });
}
