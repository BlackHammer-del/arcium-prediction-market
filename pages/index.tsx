import React, { useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "../components/Navbar";

export default function Home() {
  const { connected } = useWallet();
  const destination = useMemo(() => (connected ? "/markets" : "/markets"), [connected]);

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

      <main className="pink-grid-bg" style={{ minHeight: "100vh", paddingTop: "72px" }}>
        <div className="mx-auto max-w-6xl px-6 py-16">
          <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="encrypted-tag w-fit">PRIVATE PREDICTION MARKETS</div>
              <h1 className="font-display text-5xl tracking-widest text-white">
                ORACLE
                <span className="block text-sm font-mono tracking-[0.4em] text-slate-400">
                  ENCRYPTED SIGNALS
                </span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                Oracle combines Solana throughput with Arcium MPC to keep stake size and vote
                direction encrypted until settlement. Markets settle with transparent artifacts,
                while participant intent stays private.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={destination} className="btn-primary">
                  GET STARTED
                </Link>
                <Link href="/how-it-works" className="btn-secondary">
                  HOW IT WORKS
                </Link>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: "Encrypted positions",
                    detail: "Client-side encryption ensures no plaintext stake or side is stored.",
                  },
                  {
                    title: "MPC settlement",
                    detail: "Multi-oracle + Arcium relays publish verifiable outcomes.",
                  },
                  {
                    title: "Dispute guardrails",
                    detail: "Challenge bonds and resolution steps keep outcomes honest.",
                  },
                  {
                    title: "Private activity",
                    detail: "Feeds stay redacted so users can’t infer who bet what.",
                  },
                ].map((item) => (
                  <div key={item.title} className="card p-4">
                    <p className="font-mono text-xs tracking-widest text-cyan-300">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-400">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card flex h-full flex-col justify-between gap-6 p-6">
              <div>
                <p className="font-mono text-xs tracking-widest text-slate-400">PRIVATE ACCESS</p>
                <h2 className="mt-3 font-display text-3xl tracking-widest text-white">
                  MARKET ACCESS
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  Connect your wallet to unlock private position history, dispute controls, and
                  settlement artifacts. You can still browse markets without connecting.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-xs text-slate-400">STATUS</p>
                  <p className="mt-2 font-mono text-sm text-emerald-300">
                    {connected ? "WALLET CONNECTED" : "WALLET NOT CONNECTED"}
                  </p>
                </div>
                <Link href={destination} className="btn-primary w-full text-center">
                  {connected ? "GO TO MARKETS" : "ENTER AS GUEST"}
                </Link>
                <p className="text-center text-xs text-slate-500">
                  First time? Start with the guest view, then connect to trade.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
