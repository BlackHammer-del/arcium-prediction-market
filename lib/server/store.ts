import { randomBytes } from "crypto";
import {
  calculatePositionPnl,
  DEMO_MARKETS,
  DEMO_POSITIONS,
  getPortfolioSummary,
  type DemoMarket,
  type DemoPosition,
  type MarketCategory,
  type MarketStatus,
} from "../../utils/program";

const DEMO_WALLET = "demo_wallet";
const WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SEEDED_WALLETS = [
  "9xQeWvG816bUx9EPfM5f6K4M6R4xM3aMcMBXNte1qNbf",
  "Vote111111111111111111111111111111111111111",
  "Stake11111111111111111111111111111111111111",
  "SysvarRent111111111111111111111111111111111",
];

interface StoredPosition extends DemoPosition {
  wallet: string;
  encryptedStake?: { c1: number[]; c2: number[] };
  encryptedChoice?: { c1: number[]; c2: number[] };
  txSig?: string;
}

export interface ListMarketFilters {
  status?: MarketStatus;
  category?: MarketCategory;
  search?: string;
}

export interface CreateMarketInput {
  title: string;
  description: string;
  resolutionTimestamp: Date;
  category: MarketCategory;
  resolutionSource: string;
  rules: string[];
  creatorWallet: string;
}

export interface ListPositionFilters {
  marketId?: number;
  wallet?: string;
}

export interface SubmitPositionInput {
  marketId: number;
  wallet: string;
  side: "YES" | "NO";
  stakeSol: number;
  encryptedStake?: { c1: number[]; c2: number[] };
  encryptedChoice?: { c1: number[]; c2: number[] };
}

export interface LeaderboardEntry {
  wallet: string;
  label: string;
  points: number;
  correctPredictions: number;
  settledPredictions: number;
  totalPredictions: number;
  accuracy: number;
  volumeSol: number;
  realizedPnl: number;
}

export class OracleStore {
  private markets: DemoMarket[];
  private positions: StoredPosition[];
  private nextMarketId: number;
  private nextPositionId: number;

  constructor() {
    this.markets = DEMO_MARKETS.map(cloneMarket);
    this.positions = DEMO_POSITIONS.map((position, index) => ({
      ...clonePosition(position),
      wallet: SEEDED_WALLETS[index % SEEDED_WALLETS.length] ?? DEMO_WALLET,
    }));
    this.nextMarketId = this.markets.reduce((max, market) => Math.max(max, market.id), -1) + 1;
    this.nextPositionId =
      this.positions.reduce((max, position) => Math.max(max, position.id), 1000) + 1;
  }

  listMarkets(filters: ListMarketFilters = {}): DemoMarket[] {
    const { status, category, search } = filters;
    const normalizedSearch = search?.trim().toLowerCase();
    return this.markets
      .filter((market) => {
        if (status && market.status !== status) return false;
        if (category && market.category !== category) return false;
        if (normalizedSearch) {
          const haystack =
            `${market.title} ${market.description} ${market.resolutionSource}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        }
        return true;
      })
      .sort(
        (left, right) => left.resolutionTimestamp.getTime() - right.resolutionTimestamp.getTime()
      )
      .map(cloneMarket);
  }

  getMarketById(id: number): DemoMarket | null {
    const market = this.markets.find((item) => item.id === id);
    return market ? cloneMarket(market) : null;
  }

  createMarket(input: CreateMarketInput): DemoMarket {
    const id = this.nextMarketId++;
    const now = new Date();
    const market: DemoMarket = {
      id,
      category: input.category,
      title: input.title,
      description: input.description,
      resolutionTimestamp: new Date(input.resolutionTimestamp),
      status: "Open",
      totalParticipants: 0,
      rules: input.rules,
      resolutionSource: input.resolutionSource,
      timeline: [
        {
          id: `m${id}_created`,
          label: "Market created",
          note: `Created by ${truncateWallet(input.creatorWallet)} and criteria locked for settlement.`,
          timestamp: now,
          status: "completed",
        },
        {
          id: `m${id}_open`,
          label: "Positioning window",
          note: "Encrypted stakes and votes accepted by Oracle.",
          timestamp: now,
          status: "active",
        },
        {
          id: `m${id}_settle`,
          label: "MPC settlement",
          note: "Arcium threshold decryption publishes final market outcome.",
          timestamp: new Date(input.resolutionTimestamp),
          status: "upcoming",
        },
      ],
    };

    this.markets.unshift(market);
    return cloneMarket(market);
  }

  listPositions(filters: ListPositionFilters = {}): DemoPosition[] {
    const { marketId, wallet } = filters;
    const normalizedWallet = wallet ? normalizeWallet(wallet) : undefined;

    return this.positions
      .filter((position) => {
        if (typeof marketId === "number" && position.marketId !== marketId) return false;
        if (normalizedWallet && position.wallet !== normalizedWallet) return false;
        return true;
      })
      .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())
      .map(clonePosition);
  }

  submitPosition(input: SubmitPositionInput): { position: DemoPosition; txSig: string } {
    const market = this.markets.find((item) => item.id === input.marketId);
    if (!market) {
      throw new Error("Market not found.");
    }
    if (market.status !== "Open") {
      throw new Error("Market is not open for new positions.");
    }
    if (market.resolutionTimestamp.getTime() <= Date.now()) {
      throw new Error("Market has passed its resolution date.");
    }

    const id = this.nextPositionId++;
    const normalizedWallet = normalizeWallet(input.wallet);
    const now = new Date();
    const entryOdds = this.estimateEntryOdds(input.marketId, input.side);
    const markOdds = clamp(entryOdds + (input.side === "YES" ? 0.02 : -0.02), 0.05, 0.95);
    const txSig = randomBytes(32).toString("hex");

    const position: StoredPosition = {
      id,
      marketId: market.id,
      marketTitle: market.title,
      side: input.side,
      stakeSol: input.stakeSol,
      entryOdds,
      markOdds,
      status: "Open",
      submittedAt: now,
      wallet: normalizedWallet,
      encryptedStake: input.encryptedStake,
      encryptedChoice: input.encryptedChoice,
      txSig,
    };

    this.positions.unshift(position);
    market.totalParticipants = market.totalParticipants + 1;

    return {
      position: clonePosition(position),
      txSig,
    };
  }

  getPortfolio(wallet: string): {
    positions: DemoPosition[];
    summary: ReturnType<typeof getPortfolioSummary>;
  } {
    const normalizedWallet = normalizeWallet(wallet);
    const positions = this.positions
      .filter((position) => position.wallet === normalizedWallet)
      .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())
      .map(clonePosition);

    return {
      positions,
      summary: getPortfolioSummary(positions),
    };
  }

  getLeaderboard(limit = 50): LeaderboardEntry[] {
    const scoreboard = new Map<string, LeaderboardEntry>();

    for (const position of this.positions) {
      const existing = scoreboard.get(position.wallet) ?? {
        wallet: position.wallet,
        label: prettyWallet(position.wallet),
        points: 0,
        correctPredictions: 0,
        settledPredictions: 0,
        totalPredictions: 0,
        accuracy: 0,
        volumeSol: 0,
        realizedPnl: 0,
      };

      existing.totalPredictions += 1;
      existing.volumeSol += position.stakeSol;

      if (position.status !== "Open") {
        existing.settledPredictions += 1;
        existing.realizedPnl += calculatePositionPnl(position);
      }

      if (position.status === "Won") {
        existing.correctPredictions += 1;
        existing.points += 1;
      }

      scoreboard.set(position.wallet, existing);
    }

    const entries = Array.from(scoreboard.values())
      .map((entry) => ({
        ...entry,
        accuracy:
          entry.settledPredictions > 0
            ? (entry.correctPredictions / entry.settledPredictions) * 100
            : 0,
      }))
      .sort((left, right) => {
        if (right.points !== left.points) return right.points - left.points;
        if (right.accuracy !== left.accuracy) return right.accuracy - left.accuracy;
        return right.volumeSol - left.volumeSol;
      });

    return entries.slice(0, Math.max(1, limit));
  }

  private estimateEntryOdds(marketId: number, side: "YES" | "NO"): number {
    const marketPositions = this.positions.filter((position) => position.marketId === marketId);
    if (marketPositions.length === 0) return 0.5;

    const yesStake = marketPositions
      .filter((position) => position.side === "YES")
      .reduce((sum, position) => sum + position.stakeSol, 0);
    const noStake = marketPositions
      .filter((position) => position.side === "NO")
      .reduce((sum, position) => sum + position.stakeSol, 0);
    const total = yesStake + noStake;
    if (total === 0) return 0.5;

    const impliedYes = yesStake / total;
    const base = side === "YES" ? impliedYes : 1 - impliedYes;
    const jitter = ((this.nextPositionId % 5) - 2) * 0.01;
    return clamp(Number((base + jitter).toFixed(2)), 0.05, 0.95);
  }
}

export function normalizeWallet(wallet: string | string[] | undefined): string {
  const value = Array.isArray(wallet) ? wallet[0] : wallet;
  if (!value) return DEMO_WALLET;
  const trimmed = value.trim();
  return WALLET_PATTERN.test(trimmed) ? trimmed : DEMO_WALLET;
}

function truncateWallet(wallet: string): string {
  if (wallet === DEMO_WALLET) return "demo wallet";
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function prettyWallet(wallet: string): string {
  if (wallet === DEMO_WALLET) return "Demo Trader";
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cloneMarket(market: DemoMarket): DemoMarket {
  return {
    ...market,
    resolutionTimestamp: new Date(market.resolutionTimestamp),
    timeline: market.timeline.map((step) => ({
      ...step,
      timestamp: new Date(step.timestamp),
    })),
  };
}

function clonePosition(position: DemoPosition): DemoPosition {
  return {
    ...position,
    submittedAt: new Date(position.submittedAt),
    settledAt: position.settledAt ? new Date(position.settledAt) : undefined,
  };
}

type GlobalWithStore = typeof globalThis & {
  __oracleStore?: OracleStore;
};

const globalWithStore = globalThis as GlobalWithStore;

export const store =
  globalWithStore.__oracleStore ?? (globalWithStore.__oracleStore = new OracleStore());
