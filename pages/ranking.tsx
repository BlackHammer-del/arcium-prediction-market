import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Navbar from "../components/Navbar";

interface LeaderboardItem {
  rank: number;
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

function formatSigned(value: number): string {
  const rounded = Math.abs(value).toFixed(2);
  return `${value >= 0 ? "+" : "-"}${rounded} SOL`;
}

export default function RankingPage() {
  const { connected, publicKey } = useWallet();
  const wallet = publicKey?.toBase58();

  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !wallet) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRanking() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/ranking?limit=100&wallet=${encodeURIComponent(wallet)}`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Could not load ranking.");
        }

        if (!cancelled) {
          const leaderboard = Array.isArray(payload?.leaderboard)
            ? (payload.leaderboard as LeaderboardItem[])
            : [];
          setItems(leaderboard);
        }
      } catch (caught) {
        if (!cancelled) {
          const message = caught instanceof Error ? caught.message : "Unknown API error.";
          setError(message);
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRanking();
    return () => {
      cancelled = true;
    };
  }, [connected, wallet]);

  const topThree = useMemo(() => items.slice(0, 3), [items]);
  const others = useMemo(() => items.slice(3), [items]);

  return (
    <>
      <Head>
        <title>Ranking | Oracle</title>
      </Head>
      <Navbar />

      <main style={{ minHeight: "100vh", paddingTop: "72px" }}>
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-4xl tracking-widest text-white">RANKING</h1>
              <p className="font-mono text-xs tracking-wider text-slate-500">
                Points are earned from correct settled predictions.
              </p>
            </div>
            <Link href="/" className="btn-secondary">
              BACK TO MARKETS
            </Link>
          </div>

          {!connected ? (
            <div className="card p-10 text-center">
              <p className="mb-4 font-body text-slate-400">Connect wallet to view ranking data.</p>
              <WalletMultiButton />
            </div>
          ) : (
            <>
              <div className="mb-6">
                {loading ? (
                  <p className="font-mono text-xs text-slate-500">Loading leaderboard...</p>
                ) : error ? (
                  <p className="font-mono text-xs text-rose-300">{error}</p>
                ) : (
                  <p className="font-mono text-xs text-emerald-300">{items.length} ranked users</p>
                )}
              </div>

              <div className="mb-8 grid gap-4 md:grid-cols-3">
                {topThree.map((item) => (
                  <div key={item.wallet} className="card p-5">
                    <p className="font-mono text-xs text-slate-500">RANK #{item.rank}</p>
                    <p className="mt-2 font-mono text-lg text-white">{item.label}</p>
                    <p className="mt-2 font-mono text-2xl text-cyan-300">{item.points} pts</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {item.correctPredictions}/{item.settledPredictions} correct (
                      {item.accuracy.toFixed(1)}%)
                    </p>
                  </div>
                ))}
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <div
                    className="grid px-4 py-3 font-mono text-xs tracking-wider text-slate-500"
                    style={{
                      gridTemplateColumns: "0.5fr 1fr 0.6fr 0.9fr 0.7fr 0.7fr 0.8fr",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      minWidth: "860px",
                    }}
                  >
                    <span>RANK</span>
                    <span>USER</span>
                    <span>POINTS</span>
                    <span>CORRECT</span>
                    <span>ACCURACY</span>
                    <span>VOLUME</span>
                    <span>REALIZED</span>
                  </div>
                  {others.map((item) => (
                    <div
                      key={`${item.wallet}-${item.rank}`}
                      className="grid px-4 py-3 text-sm"
                      style={{
                        gridTemplateColumns: "0.5fr 1fr 0.6fr 0.9fr 0.7fr 0.7fr 0.8fr",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        minWidth: "860px",
                      }}
                    >
                      <span className="font-mono text-slate-200">#{item.rank}</span>
                      <span className="font-mono text-slate-200">{item.label}</span>
                      <span className="font-mono text-cyan-300">{item.points}</span>
                      <span className="font-mono text-slate-300">
                        {item.correctPredictions}/{item.settledPredictions}
                      </span>
                      <span className="font-mono text-slate-300">{item.accuracy.toFixed(1)}%</span>
                      <span className="font-mono text-slate-300">{item.volumeSol.toFixed(2)} SOL</span>
                      <span
                        className="font-mono"
                        style={{ color: item.realizedPnl >= 0 ? "#34D399" : "#F87171" }}
                      >
                        {formatSigned(item.realizedPnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
