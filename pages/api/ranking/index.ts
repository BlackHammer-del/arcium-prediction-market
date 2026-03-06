import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeWallet, store } from "../../../lib/server/store";

function parseLimit(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 50;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(parsed, 200));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: `Method ${req.method ?? "UNKNOWN"} Not Allowed` });
    return;
  }

  const walletInput = Array.isArray(req.query.wallet) ? req.query.wallet[0] : req.query.wallet;
  if (!walletInput) {
    res.status(401).json({ error: "Connect wallet to access ranking." });
    return;
  }
  const wallet = normalizeWallet(walletInput);
  if (wallet === "demo_wallet") {
    res.status(401).json({ error: "Valid wallet required to access ranking." });
    return;
  }

  const limit = parseLimit(req.query.limit);
  const leaderboard = store.getLeaderboard(limit).map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  res.status(200).json({
    leaderboard,
    metric: "points = count of settled correct predictions",
  });
}
