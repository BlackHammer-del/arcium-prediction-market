import React from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { format } from "date-fns";
import Navbar from "../../components/Navbar";
import { MARKET_TOKEN_SYMBOL } from "../../lib/solana/config";
import { formatMinimumStakeLabel } from "../../lib/solana/token";
import { useMarketDetail } from "../../features/market-detail/useMarketDetail";

export default function MarketPage() {
  const router = useRouter();
  const { id } = router.query;
  const marketId = Number.parseInt(String(id), 10);
  const {
    choice,
    connected,
    encryptedPreview,
    error,
    handleSubmit,
    handleRefresh,
    loadError,
    loadingMarket,
    market,
    pendingMirrorSubmission,
    setChoice,
    setStakeInput,
    stakeInput,
    step,
    submissionMode,
    submissionModeNote,
    submissionRef,
  } = useMarketDetail(marketId, router.isReady);

  if (loadingMarket) {
    return (
      <>
        <Head>
          <title>Loading Market | Oracle</title>
        </Head>
        <Navbar />
        <main style={{ minHeight: "100vh", paddingTop: "72px" }}>
          <div className="flex min-h-[60vh] items-center justify-center font-mono text-slate-500">
            Loading market...
          </div>
        </main>
      </>
    );
  }

  if (!market) {
    return (
      <>
        <Head>
          <title>Market Unavailable | Oracle</title>
        </Head>
        <Navbar />
        <main style={{ minHeight: "100vh", paddingTop: "72px" }}>
          <div className="mx-auto max-w-2xl px-6 py-16">
            <div className="card p-8 text-center">
              <p className="font-mono text-sm text-rose-300">
                {loadError ?? "Market not found."}
              </p>
              <button
                onClick={() => router.push("/markets")}
                className="btn-secondary mt-6"
              >
                BACK TO MARKETS
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const isOpen = market.status === "Open";
  const isSettled = market.status === "Settled";
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
        <div className="max-w-3xl mx-auto px-6 py-12">
          <button
            onClick={() => router.push("/markets")}
            className="font-mono text-xs text-slate-500 hover:text-white mb-8 flex items-center gap-2 transition-colors"
          >
            {"<-"} ALL MARKETS
          </button>

          <div className="mb-4 flex items-center justify-between gap-4">
            {loadError ? (
              <p className="font-mono text-xs text-amber-300">{loadError}</p>
            ) : (
              <p className="font-mono text-xs text-emerald-300">
                {submissionMode === "onchain"
                  ? "Chain-backed market verified"
                  : "Live backend market data"}
              </p>
            )}
            <button
              onClick={() => void handleRefresh()}
              className="font-mono text-xs text-slate-400 transition-colors hover:text-white"
            >
              REFRESH
            </button>
          </div>

          <div className="card p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-white font-body font-medium text-xl leading-snug flex-1">
                {market.title}
              </h1>
              <div className="encrypted-tag flex-shrink-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-green-400 animate-pulse" : "bg-cyan-400"}`}
                />
                {market.status.toUpperCase()}
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">{market.description}</p>
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="font-mono text-xs text-slate-500">RESOLUTION</p>
                <p className="font-mono text-sm text-white">
                  {format(market.resolutionTimestamp, "PPP")}
                </p>
              </div>
              <div>
                <p className="font-mono text-xs text-slate-500">PARTICIPANTS</p>
                <p className="font-mono text-sm text-white">{market.totalParticipants}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-slate-500">PRIVACY</p>
                <p className="font-mono text-sm" style={{ color: "#22D3EE" }}>
                  ARCIUM MPC
                </p>
              </div>
            </div>
          </div>

          {isSettled ? (
            <div className="card p-6 mb-6">
              <p className="font-mono text-xs text-slate-500 mb-3">FINAL RESULT</p>
              <div className="flex justify-between mb-2">
                <span
                  className="font-mono text-sm"
                  style={{ color: market.outcome ? "#34D399" : "#64748b" }}
                >
                  YES {yesP}% {market.outcome && "<- WINNER"}
                </span>
                <span
                  className="font-mono text-sm"
                  style={{ color: !market.outcome ? "#F87171" : "#64748b" }}
                >
                  {!market.outcome && "WINNER ->"} NO {noP}%
                </span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                <div style={{ width: `${yesP}%`, background: "linear-gradient(90deg,#34D399,#059669)" }} />
                <div style={{ width: `${noP}%`, background: "linear-gradient(90deg,#F87171,#DC2626)" }} />
              </div>
              <p className="text-xs text-slate-500 mt-3 font-mono">
                Stakes decrypted by Arcium MPC at settlement block.
              </p>
            </div>
          ) : (
            <div className="card p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="encrypted-tag">
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                    <rect x="1" y="5" width="8" height="7" rx="1.5" stroke="#22D3EE" strokeWidth="1.2" />
                    <path d="M3 5V3.5a2 2 0 014 0V5" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  ODDS HIDDEN
                </div>
                <p className="text-slate-500 font-mono text-xs">
                  All stakes are encrypted, so real-time crowd sentiment stays hidden by design.
                </p>
              </div>
              <div
                className="flex h-2 rounded-full overflow-hidden opacity-20"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, #6B3FA0 0px, #6B3FA0 4px, transparent 4px, transparent 8px)",
                }}
              />
            </div>
          )}

          {isOpen && (
            <div className="card p-6">
              <h2 className="font-mono text-sm tracking-widest mb-5" style={{ color: "#C084FC" }}>
                SUBMIT ENCRYPTED POSITION
              </h2>

              {!connected ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 font-body text-sm mb-4">
                    Connect your Solana wallet to submit a private position.
                  </p>
                  <WalletMultiButton
                    style={{
                      background: "linear-gradient(135deg, #6B3FA0, #9B6FD0)",
                      borderRadius: "8px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "12px",
                    }}
                  />
                </div>
              ) : step === "confirmed" ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">LOCKED</div>
                  <p className="font-mono text-sm mb-2" style={{ color: "#34D399" }}>
                    POSITION ENCRYPTED AND SUBMITTED
                  </p>
                  <p className="text-slate-400 text-xs font-body mb-4">
                    {submissionMode === "onchain"
                      ? "Your stake and choice were encrypted client-side, committed on-chain, and then mirrored into the backend. Plaintext position data stays hidden from the normal app flow."
                      : "Your stake and choice were encrypted client-side and stored through the backend submission path. Plaintext position data stays hidden from the normal app flow."}
                  </p>
                  {submissionRef ? (
                    <p className="font-mono text-xs" style={{ color: "#22D3EE" }}>
                      {submissionMode === "onchain" ? "Transaction" : "Submission ref"}:{" "}
                      {submissionRef.slice(0, 24)}...
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <p className="font-mono text-xs text-slate-500 mb-3">YOUR PREDICTION</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setChoice("yes")}
                        className="flex-1 py-3 rounded-lg font-mono text-sm tracking-widest transition-all"
                        style={{
                          background: choice === "yes" ? "rgba(52,211,153,0.15)" : "transparent",
                          border: `1px solid ${choice === "yes" ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.1)"}`,
                          color: choice === "yes" ? "#34D399" : "#64748b",
                        }}
                      >
                        YES UP
                      </button>
                      <button
                        onClick={() => setChoice("no")}
                        className="flex-1 py-3 rounded-lg font-mono text-sm tracking-widest transition-all"
                        style={{
                          background: choice === "no" ? "rgba(248,113,113,0.15)" : "transparent",
                          border: `1px solid ${choice === "no" ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)"}`,
                          color: choice === "no" ? "#F87171" : "#64748b",
                        }}
                      >
                        NO DOWN
                      </button>
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="font-mono text-xs text-slate-500 mb-2">
                      STAKE AMOUNT ({MARKET_TOKEN_SYMBOL})
                    </p>
                    <div
                      className="flex gap-2 items-center"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                      }}
                    >
                      <input
                        type="number"
                        min="0.000001"
                        step="0.01"
                        placeholder="1.00"
                        value={stakeInput}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setStakeInput(event.target.value)}
                        className="flex-1 bg-transparent font-mono text-white text-sm outline-none"
                      />
                      <span className="font-mono text-xs text-slate-500">{MARKET_TOKEN_SYMBOL}</span>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-slate-500">
                      Program minimum: {formatMinimumStakeLabel()}
                    </p>
                  </div>

                  <div
                    className="mb-5 p-3 rounded-lg"
                    style={{
                      background: "rgba(34,211,238,0.05)",
                      border: "1px solid rgba(34,211,238,0.15)",
                    }}
                  >
                    <p className="font-mono text-xs text-slate-400 leading-relaxed">
                      Your position is encrypted with <span style={{ color: "#22D3EE" }}>Arcium ElGamal</span> before
                      submission. The frontend sends ciphertext and a commitment reference instead of a plaintext trade.
                    </p>
                    {submissionModeNote ? (
                      <p className="mt-2 font-mono text-xs text-slate-500">{submissionModeNote}</p>
                    ) : null}
                    {encryptedPreview && step === "submitting" ? (
                      <p className="font-mono text-xs mt-2" style={{ color: "#C084FC" }}>
                        Ciphertext preview: {encryptedPreview}
                      </p>
                    ) : null}
                  </div>

                  {error ? (
                    <p className="font-mono text-xs text-red-400 mb-4">{error}</p>
                  ) : null}

                  {pendingMirrorSubmission?.txSig ? (
                    <p className="font-mono text-xs text-amber-300 mb-4">
                      On-chain submission {pendingMirrorSubmission.txSig.slice(0, 18)}... is
                      confirmed. Clicking submit again retries only the backend mirror step.
                    </p>
                  ) : null}

                  <button
                    onClick={handleSubmit}
                    disabled={
                      (!pendingMirrorSubmission &&
                        (!choice || !stakeInput || submissionMode === "checking")) ||
                      step === "encrypting" ||
                      step === "submitting"
                    }
                    className="btn-primary w-full"
                    style={{
                      opacity:
                        !pendingMirrorSubmission &&
                        (!choice || !stakeInput || submissionMode === "checking")
                          ? 0.5
                          : 1,
                    }}
                  >
                    {step === "encrypting" && "ENCRYPTING..."}
                    {step === "submitting" && "SUBMITTING..."}
                    {(step === "idle" || step === "error") && "ENCRYPT AND SUBMIT POSITION"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
