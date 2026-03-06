import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "../components/Navbar";
import MarketCard from "../components/MarketCard";
import {
  DEMO_MARKETS,
  DEMO_POSITIONS,
  MARKET_CATEGORIES,
  getPortfolioSummary,
  type DemoMarket,
  type DemoPosition,
  type MarketCategory,
} from "../utils/program";
import {
  deserializeMarket,
  deserializePosition,
  type ApiMarket,
  type ApiPosition,
} from "../utils/api";

type StatusFilter = "all" | "open" | "settled";
type CategoryFilter = "all" | MarketCategory;

function formatSigned(value: number): string {
  const rounded = Math.abs(value).toFixed(2);
  return `${value >= 0 ? "+" : "-"}${rounded} SOL`;
}

export default function Home() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? "demo_wallet";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [markets, setMarkets] = useState<DemoMarket[]>(DEMO_MARKETS);
  const [positions, setPositions] = useState<DemoPosition[]>(DEMO_POSITIONS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFromApi() {
      setLoading(true);
      setLoadError(null);

      try {
        const [marketsResponse, portfolioResponse] = await Promise.all([
          fetch("/api/markets"),
          fetch(`/api/portfolio?wallet=${encodeURIComponent(wallet)}`),
        ]);

        const marketsPayload = await marketsResponse.json();
        const portfolioPayload = await portfolioResponse.json();

        if (!marketsResponse.ok) {
          throw new Error(marketsPayload?.error ?? "Could not load markets.");
        }
        if (!portfolioResponse.ok) {
          throw new Error(portfolioPayload?.error ?? "Could not load portfolio.");
        }

        if (!cancelled) {
          const marketItems = Array.isArray(marketsPayload?.markets)
            ? (marketsPayload.markets as ApiMarket[]).map((item) => deserializeMarket(item))
            : DEMO_MARKETS;
          const positionItems = Array.isArray(portfolioPayload?.positions)
            ? (portfolioPayload.positions as ApiPosition[]).map((item) => deserializePosition(item))
            : DEMO_POSITIONS;

          setMarkets(marketItems);
          setPositions(positionItems);
        }
      } catch (caught) {
        if (!cancelled) {
          const message = caught instanceof Error ? caught.message : "Unknown API error.";
          setLoadError(message);
          setMarkets(DEMO_MARKETS);
          setPositions(DEMO_POSITIONS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFromApi();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const filteredMarkets = useMemo(
    () =>
      markets.filter((market) => {
        if (statusFilter === "open" && market.status !== "Open") return false;
        if (statusFilter === "settled" && market.status !== "Settled") return false;
        if (categoryFilter !== "all" && market.category !== categoryFilter) return false;
        return true;
      }),
    [markets, statusFilter, categoryFilter]
  );

  const summary = useMemo(() => getPortfolioSummary(positions), [positions]);

  return (
    <>
      <Head>
        <title>Oracle | Private Prediction Markets</title>
        <meta
          name="description"
          content="Encrypted prediction markets where stakes and votes remain private until settlement."
        />
      </Head>

      <Navbar />

      <main style={{ minHeight: "100vh", paddingTop: "72px" }}>
        <div className="mx-auto max-w-6xl px-6 py-12">
          <section className="mb-10">
            <h1 className="font-display text-5xl tracking-widest text-white">ORACLE</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Private prediction markets on Solana. Stake size and vote direction remain encrypted
              until settlement.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/create" className="btn-primary">
                CREATE MARKET
              </Link>
              <Link href="/ranking" className="btn-secondary">
                VIEW RANKING
              </Link>
              <Link href="/portfolio" className="btn-secondary">
                OPEN PORTFOLIO
              </Link>
            </div>
          </section>

          <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <p className="font-mono text-xs text-slate-500">TOTAL STAKED</p>
              <p className="mt-2 font-mono text-xl text-white">{summary.totalStaked.toFixed(2)} SOL</p>
            </div>
            <div className="card p-5">
              <p className="font-mono text-xs text-slate-500">REALIZED PNL</p>
              <p
                className="mt-2 font-mono text-xl"
                style={{ color: summary.realizedPnl >= 0 ? "#34D399" : "#F87171" }}
              >
                {formatSigned(summary.realizedPnl)}
              </p>
            </div>
            <div className="card p-5">
              <p className="font-mono text-xs text-slate-500">WIN RATE</p>
              <p className="mt-2 font-mono text-xl text-white">{summary.winRate.toFixed(1)}%</p>
            </div>
            <div className="card p-5">
              <p className="font-mono text-xs text-slate-500">OPEN POSITIONS</p>
              <p className="mt-2 font-mono text-xl text-white">{summary.openCount}</p>
            </div>
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-3xl tracking-widest text-white">MARKETS</h2>
              {loading ? (
                <p className="font-mono text-xs text-slate-500">Loading data...</p>
              ) : loadError ? (
                <p className="font-mono text-xs text-amber-300">Fallback data: {loadError}</p>
              ) : (
                <p className="font-mono text-xs text-emerald-300">Live backend data</p>
              )}
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 font-mono text-xs tracking-widest text-slate-500">CATEGORY</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className="rounded-lg border border-white/10 px-4 py-2 font-mono text-xs text-slate-300"
                    style={{
                      background: categoryFilter === "all" ? "rgba(107,63,160,0.25)" : "transparent",
                    }}
                  >
                    ALL
                  </button>
                  {MARKET_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => setCategoryFilter(category)}
                      className="rounded-lg border border-white/10 px-4 py-2 font-mono text-xs text-slate-300"
                      style={{
                        background:
                          categoryFilter === category ? "rgba(107,63,160,0.25)" : "transparent",
                      }}
                    >
                      {category.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-xs tracking-widest text-slate-500">STATUS</p>
                <div className="flex flex-wrap gap-2">
                  {(["all", "open", "settled"] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setStatusFilter(value)}
                      className="rounded-lg border border-white/10 px-4 py-2 font-mono text-xs text-slate-300"
                      style={{
                        background: statusFilter === value ? "rgba(107,63,160,0.25)" : "transparent",
                      }}
                    >
                      {value.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredMarkets.length === 0 ? (
              <div className="py-10 font-mono text-sm text-slate-500">No markets found.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredMarkets.map((market) => (
                  <MarketCard key={market.id} {...market} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
