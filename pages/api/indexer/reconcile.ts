import type { NextApiRequest, NextApiResponse } from "next";
import { store } from "../../../lib/server/store";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ error: `Method ${req.method ?? "UNKNOWN"} Not Allowed` });
    return;
  }

  const report = store.reconcileIndexerState();
  res.status(200).json({
    report: {
      ...report,
      generatedAt: report.generatedAt.toISOString(),
    },
  });
}
