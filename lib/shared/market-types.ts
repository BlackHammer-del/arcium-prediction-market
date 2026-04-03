// Shared market-facing types for UI, APIs, and server-side filters. The names
// stay stable during the refactor so we improve structure without forcing a
// risky whole-app rename.
export type MarketStatus =
  | "Open"
  | "SettledPending"
  | "Challenged"
  | "Settled"
  | "Invalid"
  | "Cancelled";

export type MarketCategory = "Crypto" | "Football" | "Politics" | "Macro" | "Tech";
export type ResolutionStepStatus = "completed" | "active" | "upcoming";
export type PositionVisibility = "public" | "encrypted";
export type PositionSide = "YES" | "NO" | "ENCRYPTED";

export const MARKET_CATEGORIES: MarketCategory[] = [
  "Crypto",
  "Football",
  "Politics",
  "Macro",
  "Tech",
];

export const CATEGORY_STYLES: Record<
  MarketCategory,
  { bg: string; border: string; text: string }
> = {
  Crypto: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)", text: "#34D399" },
  Football: { bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)", text: "#60A5FA" },
  Politics: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)", text: "#F87171" },
  Macro: { bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)", text: "#A78BFA" },
  Tech: { bg: "rgba(250,204,21,0.1)", border: "rgba(250,204,21,0.2)", text: "#FACC15" },
};

export interface ResolutionTimelineStep {
  id: string;
  label: string;
  note: string;
  timestamp: Date;
  status: ResolutionStepStatus;
}

export interface SettlementArtifacts {
  proofUri: string;
  proofHash: string;
  settlementHash: string;
  publishedAt: string;
  verifier: string;
}

export interface DemoMarket {
  id: number;
  category: MarketCategory;
  title: string;
  description: string;
  resolutionTimestamp: Date;
  status: MarketStatus;
  totalParticipants: number;
  revealedYesStake?: number;
  revealedNoStake?: number;
  outcome?: boolean;
  rules: string[];
  resolutionSource: string;
  timeline: ResolutionTimelineStep[];
  settlementArtifacts?: SettlementArtifacts;
  yesVotes?: number;
  noVotes?: number;
}

export interface DemoPosition {
  id: number;
  marketId: number;
  marketTitle: string;
  side: PositionSide;
  stakeSol?: number;
  entryOdds?: number;
  markOdds?: number;
  status: "Open" | "Won" | "Lost";
  visibility: PositionVisibility;
  submittedAt: Date;
  settledAt?: Date;
  payoutSol?: number;
  choice?: boolean;
}
