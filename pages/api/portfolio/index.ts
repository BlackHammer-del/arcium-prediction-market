import type { NextApiRequest, NextApiResponse } from "next";
import { serializePosition } from "../../../utils/api";
import { normalizeWallet, store } from "../../../lib/server/store";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: `Method ${req.method ?? "UNKNOWN"} Not Allowed` });
    return;
  }

  const walletInput = Array.isArray(req.query.wallet) ? req.query.wallet[0] : req.query.wallet;
  if (!walletInput) {
    res.status(401).json({ error: "Connect wallet to access portfolio." });
    return;
  }

  const wallet = normalizeWallet(walletInput);
  if (wallet === "demo_wallet") {
    res.status(401).json({ error: "Valid wallet required to access portfolio." });
    return;
  }

  const portfolio = store.getPortfolio(wallet);

  res.status(200).json({
    wallet,
    summary: portfolio.summary,
    positions: portfolio.positions.map((position) => serializePosition(position)),
  });
}
