import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Navbar from "../../components/Navbar";
import { useCreateMarket } from "../../features/create-market/useCreateMarket";
import type { MarketCategory } from "../../lib/shared/market-types";

export default function CreateMarket() {
  const router = useRouter();
  const {
    MARKET_CATEGORIES,
    MARKET_TOKEN_SYMBOL,
    category,
    canSubmit,
    chainCreateEnabled,
    connected,
    description,
    error,
    handleCreate,
    hasFallbackRule,
    hasMinimumRules,
    parsedRules,
    pendingChainMarket,
    resolutionDate,
    resolutionSource,
    rulesInput,
    setCategory,
    setDescription,
    setResolutionDate,
    setResolutionSource,
    setRulesInput,
    setTitle,
    step,
    title,
  } = useCreateMarket();

  return (
    <>
      <Head>
        <title>Create Market | Oracle</title>
      </Head>
      <Navbar />

      <main className="pink-grid-bg" style={{ minHeight: "100vh", paddingTop: "72px" }}>
        <div className="mx-auto max-w-2xl px-6 py-12">
          <button
            onClick={() => router.push("/")}
            className="mb-8 flex items-center gap-2 font-mono text-xs text-slate-500 transition-colors hover:text-white"
          >
            {"<"} BACK
          </button>

          <h1 className="mb-2 font-display text-4xl tracking-widest text-white">CREATE MARKET</h1>
          <p className="mb-8 font-mono text-xs tracking-widest text-slate-400">
            PRIVATE RESOLUTION CRITERIA WITH ARCIUM MPC
          </p>

          {!connected ? (
            <div className="card p-10 text-center">
              <p className="mb-4 font-body text-slate-400">Connect wallet to create a market.</p>
              <WalletMultiButton
                style={{
                  background: "linear-gradient(135deg, #6B3FA0, #9B6FD0)",
                  borderRadius: "8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12px",
                }}
              />
            </div>
          ) : step === "done" ? (
            <div className="card p-10 text-center">
              <p className="font-mono text-sm text-emerald-400">MARKET CREATED</p>
              <p className="mt-2 text-sm text-slate-400">Redirecting to market page...</p>
            </div>
          ) : (
            <div className="card flex flex-col gap-5 p-6">
              <div>
                <label className="mb-2 block font-mono text-xs text-slate-500">QUESTION / TITLE</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Will BTC exceed $150k before Jan 2027?"
                  maxLength={128}
                  className="w-full bg-transparent px-4 py-3 font-body text-sm text-white outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <p className="mt-1 font-mono text-xs text-slate-600">{title.length}/128</p>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-500">CATEGORY</label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as MarketCategory)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none"
                >
                  {MARKET_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-500">RESOLUTION CRITERIA</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe exact resolve conditions for YES and NO."
                  rows={4}
                  maxLength={512}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-body text-sm text-white outline-none"
                />
                <p className="mt-1 font-mono text-xs text-slate-600">{description.length}/512</p>
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-500">RESOLUTION SOURCE</label>
                <input
                  value={resolutionSource}
                  onChange={(event) => setResolutionSource(event.target.value)}
                  maxLength={160}
                  placeholder="Data source, e.g. Binance API, Senate roll call, EPL final table"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-body text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-500">RULES (REQUIRED)</label>
                <textarea
                  value={rulesInput}
                  onChange={(event) => setRulesInput(event.target.value)}
                  placeholder="One enforceable settlement rule per line."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-body text-sm text-white outline-none"
                />
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {parsedRules.length}/8 rules. Minimum 2 required.
                </p>
                <div className="mt-2 space-y-1">
                  <p className="font-mono text-[11px] text-slate-500">
                    {hasMinimumRules ? "PASS" : "MISSING"}: minimum rule count
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {hasFallbackRule ? "PASS" : "RECOMMENDED"}: fallback source rule
                  </p>
                </div>
                {parsedRules.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {parsedRules.map((rule, index) => (
                      <li key={`${index}-${rule}`} className="font-mono text-[11px] text-slate-400">
                        {index + 1}. {rule}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block font-mono text-xs text-slate-500">RESOLUTION DATE</label>
                <input
                  type="date"
                  value={resolutionDate}
                  onChange={(event) => setResolutionDate(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </div>

              <div
                className="rounded-lg p-4"
                style={{
                  background: "rgba(107,63,160,0.1)",
                  border: "1px solid rgba(107,63,160,0.2)",
                }}
              >
                <p className="font-mono text-xs leading-relaxed text-slate-400">
                  {chainCreateEnabled
                    ? `This cluster is configured for chain-backed market creation. New markets are created on Solana first, then mirrored into the backend. Trading uses the configured ${MARKET_TOKEN_SYMBOL} mint.`
                    : "Chain-backed create is disabled until NEXT_PUBLIC_MARKET_TOKEN_MINT is configured. The page will fall back to backend-only prototype creation."}
                </p>
              </div>

              {pendingChainMarket ? (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
                  <p className="font-mono text-xs leading-relaxed text-amber-200">
                    On-chain market {pendingChainMarket.marketId} is already confirmed with tx{" "}
                    {pendingChainMarket.txSig.slice(0, 18)}... Click create again to retry only
                    the backend mirror step.
                  </p>
                </div>
              ) : null}

              {error ? <p className="font-mono text-xs text-rose-400">{error}</p> : null}

              <button
                onClick={handleCreate}
                disabled={!canSubmit || step === "creating_chain" || step === "mirroring"}
                className="btn-primary"
                style={{ opacity: !canSubmit ? 0.5 : 1 }}
              >
                {step === "creating_chain" && "CREATING ON-CHAIN..."}
                {step === "mirroring" && "SYNCING BACKEND..."}
                {(step === "idle" || step === "error") && "CREATE MARKET"}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
