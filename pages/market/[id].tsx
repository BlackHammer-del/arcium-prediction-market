import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { format } from "date-fns";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Navbar from "../../components/Navbar";
import {
  CATEGORY_STYLES,
  DEMO_MARKETS,
  DEMO_POSITIONS,
  calculatePositionPnl,
  type DemoMarket,
  type DemoPosition,
} from "../../utils/program";
import {
  ARCIUM_DEVNET_CLUSTER,
  encryptChoice,
  encryptStake,
  fetchClusterPublicKey,
  serializeCiphertext,
} from "../../utils/arcium";
import {
  deserializeMarket,
  deserializePosition,
  type ApiMarket,
  type ApiPosition,
} from "../../utils/api";

type StepState = "idle" | "encrypting" | "submitting" | "confirmed" | "error";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatSigned(value: number): string {
  const rounded = Math.abs(value).toFixed(2);
  return `${value >= 0 ? "+" : "-"}${rounded} SOL`;
}

export default function MarketPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [step, setStep] = useState<StepState>("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [encryptedPreview, setEncryptedPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<DemoMarket | null>(null);
  const [history, setHistory] = useState<DemoPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const marketId = useMemo(() => {
    if (typeof router.query.id !== "string") return Number.NaN;
    return Number.parseInt(router.query.id, 10);
  }, [router.query.id]);

  useEffect(() => {
    if (!router.isReady || Number.isNaN(marketId)) return;

    let cancelled = false;

    async function loadMarket() {
      setLoading(true);
      setLoadError(null);

      try {
        const wallet = publicKey?.toBase58();
        const suffix = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
        const response = await fetch(`/api/markets/${marketId}${suffix}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Could not load market.");
        }

        if (!cancelled) {
          const marketItem = payload?.market as ApiMarket;
          const historyItems = Array.isArray(payload?.history)
            ? (payload.history as ApiPosition[]).map((item) => deserializePosition(item))
            : [];
          setMarket(deserializeMarket(marketItem));
          setHistory(historyItems);
        }
      } catch (caught) {
        if (!cancelled) {
          const fallbackMarket = DEMO_MARKETS.find((item) => item.id === marketId) ?? null;
          const fallbackHistory = DEMO_POSITIONS.filter((item) => item.marketId === marketId).sort(
            (left, right) => right.submittedAt.getTime() - left.submittedAt.getTime()
          );
          setMarket(fallbackMarket);
          setHistory(fallbackHistory);
          const message = caught instanceof Error ? caught.message : "Unknown API error.";
          setLoadError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMarket();
    return () => {
      cancelled = true;
    };
  }, [marketId, publicKey, router.isReady]);

  async function handleSubmit() {
    if (!market || !choice || !connected) return;
    const stakeSOL = Number.parseFloat(stakeInput);
    if (Number.isNaN(stakeSOL) || stakeSOL <= 0) return;

    setError(null);
    setStep("encrypting");

    try {
      const clusterKey = await fetchClusterPublicKey(ARCIUM_DEVNET_CLUSTER);
      const stakeLamports = BigInt(Math.floor(stakeSOL * 1e9));
      const encStake = encryptStake(stakeLamports, clusterKey);
      const encChoice = encryptChoice(choice === "yes", clusterKey);
      const preview = `stake:0x${toHex(encStake.c1.slice(0, 8))}... choice:0x${toHex(
        encChoice.c1.slice(0, 4)
      )}...`;
      setEncryptedPreview(preview);

      setStep("submitting");

      const response = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          side: choice.toUpperCase(),
          stakeSol: stakeSOL,
          wallet: publicKey?.toBase58(),
          encryptedStake: serializeCiphertext(encStake),
          encryptedChoice: serializeCiphertext(encChoice),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not submit encrypted position.");
      }

      const newPosition = deserializePosition(payload.position as ApiPosition);
      setHistory((current) =>
        [newPosition, ...current].sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())
      );
      setMarket((current) =>
        current ? { ...current, totalParticipants: current.totalParticipants + 1 } : current
      );

      setTxSig(typeof payload?.txSig === "string" ? payload.txSig : null);
      setStep("confirmed");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown error";
      setError(message);
      setStep("error");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-slate-500">
        Loading market...
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-slate-500">
        Market not found.
      </div>
    );
  }

  const isOpen = market.status === "Open";
  const isSettled = market.status === "Settled";
  const categoryStyle = CATEGORY_STYLES[market.category];
  const total = (market.revealedYesStake ?? 0) + (market.revealedNoStake ?? 0);
  const yesP = total === 0 ? 50 : Math.round(((market.revealedYesStake ?? 0) / total) * 100);
  const noP = 100 - yesP;

  return (
    <>
      <Head>
        <title>{market.title} | Oracle</title>
      </Head>
      <Navbar />

      <main style={{ minHeight: "100vh", paddingTop: "72px" }}>
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-8 flex items-center gap-2 font-mono text-xs text-slate-500 transition-colors hover:text-white"
            >
              {"<"} ALL MARKETS
            </button>

            {loadError ? (
              <p className="mb-4 font-mono text-xs text-amber-300">
                Backend unavailable, showing fallback data: {loadError}
              </p>
            ) : null}

            <div className="card mb-6 p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h1 className="flex-1 text-xl font-medium leading-snug text-white">{market.title}</h1>
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <div
                    className="font-mono text-xs"
                    style={{
                      background: categoryStyle.bg,
                      border: `1px solid ${categoryStyle.border}`,
                      borderRadius: "999px",
                      color: categoryStyle.text,
                      padding: "4px 10px",
                    }}
                  >
                    {market.category.toUpperCase()}
                  </div>
                  <div className="encrypted-tag">{market.status.toUpperCase()}</div>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-slate-400">{market.description}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-xs text-slate-500">RESOLUTION DATE</p>
                  <p className="font-mono text-sm text-white">{format(market.resolutionTimestamp, "PPP p")}</p>
                </div>
                <div>
                  <p className="font-mono text-xs text-slate-500">RESOLUTION SOURCE</p>
                  <p className="font-mono text-sm text-cyan-300">{market.resolutionSource}</p>
                </div>
              </div>
            </div>

            <div className="card mb-6 p-6">
              <h2 className="mb-4 font-mono text-xs tracking-widest text-violet-300">RESOLUTION TIMELINE</h2>
              <div className="space-y-4">
                {market.timeline.map((timelineStep) => (
                  <div key={timelineStep.id} className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        background:
                          timelineStep.status === "completed"
                            ? "#34D399"
                            : timelineStep.status === "active"
                              ? "#C084FC"
                              : "#64748B",
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs tracking-wider text-white">
                          {timelineStep.label.toUpperCase()}
                        </p>
                        <p className="font-mono text-xs text-slate-500">
                          {format(timelineStep.timestamp, "MMM d, yyyy")}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{timelineStep.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card mb-6 p-6">
              <h2 className="mb-4 font-mono text-xs tracking-widest text-violet-300">CLEAR RULES</h2>
              <ul className="space-y-2 text-sm text-slate-300">
                {market.rules.map((rule, index) => (
                  <li key={`${market.id}-rule-${index}`} className="flex gap-2">
                    <span className="font-mono text-cyan-300">{index + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {history.length > 0 ? (
              <div className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-xs tracking-widest text-violet-300">POSITION HISTORY</h2>
                  <Link href="/portfolio" className="font-mono text-xs text-cyan-400">
                    VIEW ALL
                  </Link>
                </div>
                <div className="space-y-3">
                  {history.map((position) => {
                    const pnl = calculatePositionPnl(position);
                    return (
                      <div
                        key={position.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="font-mono text-xs"
                            style={{ color: position.side === "YES" ? "#34D399" : "#F87171" }}
                          >
                            {position.side}
                          </span>
                          <span className="font-mono text-xs text-slate-300">
                            {position.stakeSol.toFixed(2)} SOL
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {format(position.submittedAt, "MMM d, yyyy")}
                          </span>
                        </div>
                        <span className="font-mono text-xs" style={{ color: pnl >= 0 ? "#34D399" : "#F87171" }}>
                          {formatSigned(pnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            {isSettled ? (
              <div className="card mb-6 p-6">
                <p className="mb-3 font-mono text-xs text-slate-500">FINAL RESULT</p>
                <div className="mb-2 flex justify-between">
                  <span className="font-mono text-sm text-emerald-400">YES {yesP}%</span>
                  <span className="font-mono text-sm text-rose-400">NO {noP}%</span>
                </div>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                  <div style={{ width: `${yesP}%`, background: "linear-gradient(90deg,#34D399,#059669)" }} />
                  <div style={{ width: `${noP}%`, background: "linear-gradient(90deg,#F87171,#DC2626)" }} />
                </div>
              </div>
            ) : null}

            {isOpen ? (
              <div className="card p-6">
                <h2 className="mb-5 font-mono text-sm tracking-widest text-violet-300">
                  SUBMIT ENCRYPTED POSITION
                </h2>

                {!connected ? (
                  <div className="py-8 text-center">
                    <p className="mb-4 text-sm text-slate-400">
                      Connect your Solana wallet to submit a private position.
                    </p>
                    <WalletMultiButton />
                  </div>
                ) : step === "confirmed" ? (
                  <div className="py-8 text-center">
                    <p className="mb-2 font-mono text-sm text-emerald-400">
                      POSITION ENCRYPTED AND SUBMITTED
                    </p>
                    {txSig ? (
                      <a
                        href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-cyan-400"
                      >
                        View tx: {txSig.slice(0, 16)}...
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="mb-5">
                      <p className="mb-3 font-mono text-xs text-slate-500">YOUR PREDICTION</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setChoice("yes")}
                          data-side="yes"
                          data-selected={choice === "yes"}
                          className="prediction-choice"
                        >
                          <span>YES</span>
                          {choice === "yes" ? <span className="choice-indicator">SELECTED</span> : null}
                        </button>
                        <button
                          onClick={() => setChoice("no")}
                          data-side="no"
                          data-selected={choice === "no"}
                          className="prediction-choice"
                        >
                          <span>NO</span>
                          {choice === "no" ? <span className="choice-indicator">SELECTED</span> : null}
                        </button>
                      </div>
                    </div>

                    <div className="mb-5">
                      <p className="mb-2 font-mono text-xs text-slate-500">STAKE AMOUNT (SOL)</p>
                      <input
                        type="number"
                        min="0.001"
                        step="0.01"
                        value={stakeInput}
                        onChange={(event) => setStakeInput(event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none"
                        placeholder="0.10"
                      />
                    </div>

                    {encryptedPreview ? (
                      <p className="mb-4 font-mono text-xs text-violet-300">Ciphertext: {encryptedPreview}</p>
                    ) : null}
                    {error ? <p className="mb-4 font-mono text-xs text-rose-400">{error}</p> : null}

                    <button
                      onClick={handleSubmit}
                      disabled={!choice || !stakeInput || step === "encrypting" || step === "submitting"}
                      className="btn-primary w-full"
                    >
                      {step === "encrypting" && "ENCRYPTING..."}
                      {step === "submitting" && "SUBMITTING..."}
                      {(step === "idle" || step === "error") && "ENCRYPT AND SUBMIT"}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
