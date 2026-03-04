import React from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Navbar() {
  const { connected, publicKey } = useWallet();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
         style={{ background: "rgba(3,3,8,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 no-underline">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-lg"
               style={{ background: "linear-gradient(135deg, #6B3FA0, #22D3EE)", opacity: 0.9 }} />
          <div className="absolute inset-0 flex items-center justify-center text-white font-display text-lg">
            Ψ
          </div>
        </div>
        <div>
          <span className="font-display text-xl tracking-widest text-white">CIPHER</span>
          <span className="font-display text-xl tracking-widest" style={{ color: "#C084FC" }}>BET</span>
        </div>
      </Link>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-8">
        <Link href="/" className="font-mono text-xs tracking-widest text-slate-400 hover:text-white transition-colors">
          MARKETS
        </Link>
        <Link href="/create" className="font-mono text-xs tracking-widest text-slate-400 hover:text-white transition-colors">
          CREATE
        </Link>
        <Link href="/how-it-works" className="font-mono text-xs tracking-widest text-slate-400 hover:text-white transition-colors">
          HOW IT WORKS
        </Link>
      </div>

      {/* Wallet + status */}
      <div className="flex items-center gap-4">
        {connected && (
          <div className="encrypted-tag hidden sm:flex">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
          </div>
        )}
        <WalletMultiButton style={{
          background: "linear-gradient(135deg, #6B3FA0, #9B6FD0)",
          borderRadius: "8px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          height: "38px",
          padding: "0 18px",
        }} />
      </div>
    </nav>
  );
}
