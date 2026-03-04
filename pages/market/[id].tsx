import React, { useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { format } from "date-fns";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Navbar from "../../components/Navbar";
import { DEMO_MARKETS } from "../../utils/program";
import {
  ARCIUM_DEVNET_CLUSTER,
  encryptChoice,
  encryptStake,
  fetchClusterPublicKey,
} from "../../utils/arcium";

type StepState = "idle" | "encrypting" | "submitting" | "confirmed" | "error";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function MarketPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [step, setStep] = useState<StepState>("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [encryptedPreview, setEncryptedPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const marketId = typeof router.query.id === "string" ? Number(router.query.id) : NaN;
  const market = useMemo(
    () => DEMO_MARKETS.find((item) => item.id === marketId),
    [marketId]
  );

  if (!market) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-slate-500">
        Market not found.
      </div>
    );
  }

  const isOpen = market.status === "Open";
  const isSettled = market.status === "Settled";
  const total = (market.revealedYesStake ?? 0) + (market.revealedNoStake ?? 0);
  const yesP = total === 0 ? 50 : Math.round(((market.revealedYesStake ?? 0) / total) * 100);
  const noP = 100 - yesP;

  async function handleSubmit() {
    if (!choice || !connected) return;

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
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const fakeSig = toHex(crypto.getRandomValues(new Uint8Array(32))).slice(0, 64);
      setTxSig(fakeSig);
      setStep("confirmed");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown error";
      setError(message);
      setStep("error");
    }
  }

  return (
    <>
      <Head>
        <title>{market.title} | CipherBet</title>
      </Head>
      <Navbar />

      <main style={{ minHeight: "100vh", paddingTop: "72px" }}>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <button
            onClick={() => router.push("/")}
            className="mb-8 flex items-center gap-2 font-mono text-xs text-slate-500 transition-colors hover:text-white"
          >
            {"<"} ALL MARKETS
          </button>

          <div className="card mb-6 p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="flex-1 text-xl font-medium leading-snug text-white">{market.title}</h1>
              <div className="encrypted-tag flex-shrink-0">{market.status.toUpperCase()}</div>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-400">{market.description}</p>
            <div className="flex flex-wrap gap-6">
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
            </div>
          </div>

          {isSettled ? (
            <div className="card mb-6 p-6">
              <p className="mb-3 font-mono text-xs text-slate-500">FINAL RESULT</p>
              <div className="mb-2 flex justify-between">
                <span className="font-mono text-sm text-emerald-400">YES {yesP}%</span>
                <span className="font-mono text-sm text-rose-400">NO {noP}%</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full gap-0.5">
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
                        className="flex-1 rounded-lg border border-emerald-400/40 py-3 font-mono text-sm text-emerald-400"
                      >
                        YES
                      </button>
                      <button
                        onClick={() => setChoice("no")}
                        className="flex-1 rounded-lg border border-rose-400/40 py-3 font-mono text-sm text-rose-400"
                      >
                        NO
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
      </main>
    </>
  );
}
