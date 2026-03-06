import { PublicKey } from "@solana/web3.js";

const DEFAULT_PROGRAM_ID = "9xQeWvG816bUx9EPfM5f6K4M6R4xM3aMcMBXNte1qNbf";

function parsePublicKey(value: string | undefined, fallback: string): PublicKey {
  try {
    return new PublicKey(value ?? fallback);
  } catch {
    return new PublicKey(fallback);
  }
}

export const PROGRAM_ID = parsePublicKey(
  process.env.NEXT_PUBLIC_PREDICTION_MARKET_PROGRAM_ID,
  DEFAULT_PROGRAM_ID
);

export const MARKET_SEED = Buffer.from("market");
export const VAULT_SEED = Buffer.from("vault");
export const POSITION_SEED = Buffer.from("position");
export const REGISTRY_SEED = Buffer.from("registry");

export type MarketStatus = "Open" | "Resolving" | "Settled" | "Cancelled" | "Invalid";
export type MarketCategory = "Crypto" | "Football" | "Politics" | "Macro" | "Tech";
export type ResolutionStepStatus = "completed" | "active" | "upcoming";

export const MARKET_CATEGORIES: MarketCategory[] = [
  "Crypto",
  "Football",
  "Politics",
  "Macro",
  "Tech",
];

export const CATEGORY_STYLES: Record<
  MarketCategory,
  { text: string; bg: string; border: string }
> = {
  Crypto: {
    text: "#22D3EE",
    bg: "rgba(34,211,238,0.12)",
    border: "rgba(34,211,238,0.35)",
  },
  Football: {
    text: "#34D399",
    bg: "rgba(52,211,153,0.12)",
    border: "rgba(52,211,153,0.35)",
  },
  Politics: {
    text: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
  },
  Macro: {
    text: "#60A5FA",
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.35)",
  },
  Tech: {
    text: "#C084FC",
    bg: "rgba(192,132,252,0.12)",
    border: "rgba(192,132,252,0.35)",
  },
};

export interface ResolutionTimelineStep {
  id: string;
  label: string;
  note: string;
  timestamp: Date;
  status: ResolutionStepStatus;
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
}

export interface DemoPosition {
  id: number;
  marketId: number;
  marketTitle: string;
  side: "YES" | "NO";
  stakeSol: number;
  entryOdds: number;
  markOdds: number;
  status: "Open" | "Won" | "Lost";
  submittedAt: Date;
  settledAt?: Date;
  payoutSol?: number;
}

export function getRegistryPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([REGISTRY_SEED], PROGRAM_ID);
}

export function getMarketPDA(marketId: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(marketId));
  return PublicKey.findProgramAddressSync([MARKET_SEED, idBuf], PROGRAM_ID);
}

export function getVaultPDA(marketId: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(marketId));
  return PublicKey.findProgramAddressSync([VAULT_SEED, idBuf], PROGRAM_ID);
}

export function getPositionPDA(
  marketPubkey: PublicKey,
  userPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POSITION_SEED, marketPubkey.toBuffer(), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

export function calculatePositionPnl(position: DemoPosition): number {
  if (position.status === "Open") {
    return (position.markOdds - position.entryOdds) * position.stakeSol;
  }
  return (position.payoutSol ?? 0) - position.stakeSol;
}

export function getPortfolioSummary(positions: DemoPosition[]) {
  const open = positions.filter((position) => position.status === "Open");
  const settled = positions.filter((position) => position.status !== "Open");
  const winners = positions.filter((position) => position.status === "Won");

  const realizedPnl = settled.reduce(
    (total, position) => total + calculatePositionPnl(position),
    0
  );
  const unrealizedPnl = open.reduce(
    (total, position) => total + calculatePositionPnl(position),
    0
  );
  const totalStaked = positions.reduce((total, position) => total + position.stakeSol, 0);
  const winRate = settled.length === 0 ? 0 : (winners.length / settled.length) * 100;

  return {
    openCount: open.length,
    settledCount: settled.length,
    totalStaked,
    realizedPnl,
    unrealizedPnl,
    winRate,
  };
}

export const DEMO_MARKETS: DemoMarket[] = [
  {
    id: 0,
    category: "Crypto",
    title: "Will BTC exceed $100k before Q4 2026?",
    description:
      "Resolves YES if Bitcoin spot price on Binance exceeds $100,000 before October 1, 2026.",
    resolutionTimestamp: new Date("2026-10-01"),
    status: "Open",
    totalParticipants: 312,
    rules: [
      "Primary data source is Binance BTC/USDT spot chart.",
      "If Binance data is unavailable for more than 6 hours, Coinbase BTC/USD is fallback.",
      "The first verified price print above $100,000 triggers YES resolution.",
    ],
    resolutionSource: "Binance API with Coinbase fallback",
    timeline: [
      {
        id: "m0_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2026-02-15T12:00:00Z"),
        status: "completed",
      },
      {
        id: "m0_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2026-03-01T00:00:00Z"),
        status: "active",
      },
      {
        id: "m0_settle",
        label: "MPC settlement",
        note: "Arcium threshold decryption and final outcome publication.",
        timestamp: new Date("2026-10-01T00:00:00Z"),
        status: "upcoming",
      },
    ],
  },
  {
    id: 1,
    category: "Football",
    title: "Will Arsenal finish top 2 in EPL 2026/27?",
    description:
      "Resolves YES if Arsenal finishes 1st or 2nd in the official Premier League table for the 2026/27 season.",
    resolutionTimestamp: new Date("2027-05-24"),
    status: "Open",
    totalParticipants: 244,
    rules: [
      "Official EPL final standings are the source of truth.",
      "Deductions/appeals are honored only if finalized by league publication date.",
      "Any post-season disciplinary updates after final table publication are ignored.",
    ],
    resolutionSource: "PremierLeague.com final standings",
    timeline: [
      {
        id: "m1_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2026-07-15T09:00:00Z"),
        status: "completed",
      },
      {
        id: "m1_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2026-08-01T00:00:00Z"),
        status: "active",
      },
      {
        id: "m1_settle",
        label: "MPC settlement",
        note: "Arcium threshold decryption after season completion.",
        timestamp: new Date("2027-05-24T00:00:00Z"),
        status: "upcoming",
      },
    ],
  },
  {
    id: 2,
    category: "Politics",
    title: "Will a U.S. crypto market bill pass Senate by Dec 2026?",
    description:
      "Resolves YES if the U.S. Senate passes a standalone federal crypto market-structure bill by December 31, 2026.",
    resolutionTimestamp: new Date("2026-12-31"),
    status: "Open",
    totalParticipants: 167,
    rules: [
      "Senate.gov roll call result is authoritative.",
      "Only final passage vote qualifies; committee passage does not.",
      "Merged omnibus passage counts only if explicit crypto market structure text is included.",
    ],
    resolutionSource: "U.S. Senate roll call records",
    timeline: [
      {
        id: "m2_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2026-02-10T11:00:00Z"),
        status: "completed",
      },
      {
        id: "m2_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2026-02-15T00:00:00Z"),
        status: "active",
      },
      {
        id: "m2_settle",
        label: "MPC settlement",
        note: "Arcium threshold decryption and final outcome publication.",
        timestamp: new Date("2027-01-02T00:00:00Z"),
        status: "upcoming",
      },
    ],
  },
  {
    id: 3,
    category: "Crypto",
    title: "Ethereum ETF net inflows > $5B in 2025?",
    description:
      "Resolves YES if spot Ethereum ETFs record cumulative net inflows above $5 billion by December 31, 2025.",
    resolutionTimestamp: new Date("2025-12-31"),
    status: "Settled",
    totalParticipants: 521,
    revealedYesStake: 12_400_000_000,
    revealedNoStake: 8_100_000_000,
    outcome: true,
    rules: [
      "Inflows are calculated from approved ETF issuers' official daily reports.",
      "Net inflows are cumulative over the full year window.",
      "Final tally anchored to public filings and indexer snapshots.",
    ],
    resolutionSource: "Issuer reports + Arcium-verified ingest pipeline",
    timeline: [
      {
        id: "m3_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2025-01-03T08:00:00Z"),
        status: "completed",
      },
      {
        id: "m3_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2025-01-10T00:00:00Z"),
        status: "completed",
      },
      {
        id: "m3_settle",
        label: "MPC settlement",
        note: "Outcome published and claims opened.",
        timestamp: new Date("2026-01-02T14:00:00Z"),
        status: "completed",
      },
    ],
  },
  {
    id: 4,
    category: "Football",
    title: "Will Real Madrid win UCL 2026/27?",
    description:
      "Resolves YES if Real Madrid is the official UEFA Champions League winner for the 2026/27 season.",
    resolutionTimestamp: new Date("2027-06-01"),
    status: "Open",
    totalParticipants: 199,
    rules: [
      "UEFA official winner announcement is decisive.",
      "If final is postponed, settlement follows the new official final date.",
      "Match forfeits count according to UEFA official records.",
    ],
    resolutionSource: "UEFA official competition records",
    timeline: [
      {
        id: "m4_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2026-09-01T09:30:00Z"),
        status: "completed",
      },
      {
        id: "m4_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2026-09-02T00:00:00Z"),
        status: "active",
      },
      {
        id: "m4_settle",
        label: "MPC settlement",
        note: "Arcium threshold decryption after UEFA final.",
        timestamp: new Date("2027-06-01T00:00:00Z"),
        status: "upcoming",
      },
    ],
  },
  {
    id: 5,
    category: "Politics",
    title: "Will Nigeria inflation print below 20% by Q4 2026?",
    description:
      "Resolves YES if Nigeria's official year-on-year inflation rate is below 20.0% in any release from Oct-Dec 2026.",
    resolutionTimestamp: new Date("2026-12-31"),
    status: "Open",
    totalParticipants: 143,
    rules: [
      "NBS official CPI release is authoritative.",
      "Only published headline annual inflation is used.",
      "Revisions replace prior values if officially restated before settlement.",
    ],
    resolutionSource: "Nigeria Bureau of Statistics CPI releases",
    timeline: [
      {
        id: "m5_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2026-03-03T13:00:00Z"),
        status: "completed",
      },
      {
        id: "m5_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2026-03-04T00:00:00Z"),
        status: "active",
      },
      {
        id: "m5_settle",
        label: "MPC settlement",
        note: "Arcium threshold decryption after final Q4 publication.",
        timestamp: new Date("2027-01-05T00:00:00Z"),
        status: "upcoming",
      },
    ],
  },
  {
    id: 6,
    category: "Macro",
    title: "Will Fed cut rates at least twice in 2026?",
    description:
      "Resolves YES if the Federal Reserve announces at least two target rate cuts across 2026 FOMC decisions.",
    resolutionTimestamp: new Date("2026-12-31"),
    status: "Open",
    totalParticipants: 201,
    rules: [
      "FOMC official statement and target range table are authoritative.",
      "Emergency unscheduled decisions count if officially published by the Fed.",
      "Magnitude of cuts is irrelevant; count of cut events determines outcome.",
    ],
    resolutionSource: "Federal Reserve FOMC statements",
    timeline: [
      {
        id: "m6_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2026-01-07T07:00:00Z"),
        status: "completed",
      },
      {
        id: "m6_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2026-01-08T00:00:00Z"),
        status: "active",
      },
      {
        id: "m6_settle",
        label: "MPC settlement",
        note: "Arcium threshold decryption after final 2026 FOMC decision.",
        timestamp: new Date("2027-01-02T00:00:00Z"),
        status: "upcoming",
      },
    ],
  },
  {
    id: 7,
    category: "Tech",
    title: "Will an open-source AI model beat GPT-5 on MMLU by Q2 2027?",
    description:
      "Resolves YES if a publicly released open-source model scores higher than GPT-5 on the same published MMLU benchmark configuration by June 30, 2027.",
    resolutionTimestamp: new Date("2027-06-30"),
    status: "Open",
    totalParticipants: 177,
    rules: [
      "Benchmark must be reproducible and accompanied by public methodology.",
      "Model weights and evaluation scripts must be publicly available.",
      "Comparisons must use equivalent MMLU setup and reported confidence.",
    ],
    resolutionSource: "Public benchmark reports + independent reproductions",
    timeline: [
      {
        id: "m7_created",
        label: "Market created",
        note: "Question and criteria locked on-chain.",
        timestamp: new Date("2026-04-01T15:00:00Z"),
        status: "completed",
      },
      {
        id: "m7_open",
        label: "Positioning window",
        note: "Encrypted positions accepted.",
        timestamp: new Date("2026-04-02T00:00:00Z"),
        status: "active",
      },
      {
        id: "m7_settle",
        label: "MPC settlement",
        note: "Arcium threshold decryption and final publication.",
        timestamp: new Date("2027-07-01T00:00:00Z"),
        status: "upcoming",
      },
    ],
  },
];

export const DEMO_POSITIONS: DemoPosition[] = [
  {
    id: 1001,
    marketId: 0,
    marketTitle: "Will BTC exceed $100k before Q4 2026?",
    side: "YES",
    stakeSol: 2.8,
    entryOdds: 0.47,
    markOdds: 0.55,
    status: "Open",
    submittedAt: new Date("2026-03-02T09:45:00Z"),
  },
  {
    id: 1002,
    marketId: 1,
    marketTitle: "Will Arsenal finish top 2 in EPL 2026/27?",
    side: "NO",
    stakeSol: 1.75,
    entryOdds: 0.36,
    markOdds: 0.34,
    status: "Open",
    submittedAt: new Date("2026-03-01T20:10:00Z"),
  },
  {
    id: 1003,
    marketId: 3,
    marketTitle: "Ethereum ETF net inflows > $5B in 2025?",
    side: "YES",
    stakeSol: 3.2,
    entryOdds: 0.52,
    markOdds: 1,
    status: "Won",
    payoutSol: 5.84,
    submittedAt: new Date("2025-11-06T13:00:00Z"),
    settledAt: new Date("2026-01-02T14:00:00Z"),
  },
  {
    id: 1004,
    marketId: 3,
    marketTitle: "Ethereum ETF net inflows > $5B in 2025?",
    side: "NO",
    stakeSol: 1.25,
    entryOdds: 0.48,
    markOdds: 0,
    status: "Lost",
    payoutSol: 0,
    submittedAt: new Date("2025-10-18T10:05:00Z"),
    settledAt: new Date("2026-01-02T14:00:00Z"),
  },
  {
    id: 1005,
    marketId: 2,
    marketTitle: "Will a U.S. crypto market bill pass Senate by Dec 2026?",
    side: "YES",
    stakeSol: 0.9,
    entryOdds: 0.41,
    markOdds: 0.44,
    status: "Open",
    submittedAt: new Date("2026-03-03T07:20:00Z"),
  },
];
