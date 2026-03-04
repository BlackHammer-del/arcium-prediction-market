import React, { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";

interface MarketCardProps {
  id: number;
  title: string;
  description: string;
  resolutionTimestamp: Date;
  status: "Open" | "Resolving" | "Settled" | "Cancelled";
  totalParticipants: number;
  revealedYesStake?: number;
  revealedNoStake?: number;
  outcome?: boolean;
}

const STATUS_COLORS: Record<MarketCardProps["status"], { dot: string; text: string; bg: string; border: string }> = {
  Open:      { dot: "#34D399", text: "#34D399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)" },
  Resolving: { dot: "#C084FC", text: "#C084FC", bg: "rgba(192,132,252,0.1)", border: "rgba(192,132,252,0.25)" },
  Settled:   { dot: "#22D3EE", text: "#22D3EE", bg: "rgba(34,211,238,0.1)",  border: "rgba(34,211,238,0.25)" },
  Cancelled: { dot: "#94A3B8", text: "#94A3B8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)" },
};

export default function MarketCard(props: MarketCardProps) {
  const { id, title, description, resolutionTimestamp, status, totalParticipants,
          revealedYesStake, revealedNoStake, outcome } = props;
  const [hovered, setHovered] = useState(false);

  const col = STATUS_COLORS[status];

  const total = (revealedYesStake ?? 0) + (revealedNoStake ?? 0);
  const yesP = total === 0 ? 50 : Math.round(((revealedYesStake ?? 0) / total) * 100);
  const noP = 100 - yesP;

  const isSettled = status === "Settled";
  const isOpen = status === "Open";

  return (
    <Link href={`/market/${id}`} style={{ textDecoration: "none" }}>
      <div
        className="card p-5 flex flex-col gap-4 cursor-pointer"
        style={{
          borderColor: hovered ? "rgba(192,132,252,0.35)" : "rgba(255,255,255,0.08)",
          background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
          boxShadow: hovered ? "0 0 40px rgba(107,63,160,0.12)" : "none",
          transition: "all 0.25s ease",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-white font-body font-medium text-sm leading-snug mb-1">
              {title}
            </p>
            <p className="text-slate-500 text-xs line-clamp-2 font-body leading-relaxed">
              {description}
            </p>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0"
               style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: "20px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: col.dot }} />
            <span className="font-mono text-xs" style={{ color: col.text }}>{status.toUpperCase()}</span>
          </div>
        </div>

        {/* Odds bar */}
        {isSettled ? (
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="font-mono text-xs" style={{ color: outcome ? "#34D399" : "#94A3B8" }}>
                YES {yesP}% {outcome === true && "✓"}
              </span>
              <span className="font-mono text-xs" style={{ color: !outcome ? "#F87171" : "#94A3B8" }}>
                {outcome === false && "✓"} NO {noP}%
              </span>
            </div>
            <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
              <div style={{ width: `${yesP}%`, background: "linear-gradient(90deg,#34D399,#059669)", borderRadius: "3px 0 0 3px" }} />
              <div style={{ width: `${noP}%`, background: "linear-gradient(90deg,#F87171,#DC2626)", borderRadius: "0 3px 3px 0" }} />
            </div>
          </div>
        ) : (
          <div className="encrypted-tag" style={{ alignSelf: "flex-start" }}>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <rect x="1" y="5" width="8" height="7" rx="1.5" stroke="#22D3EE" strokeWidth="1.2"/>
              <path d="M3 5V3.5a2 2 0 014 0V5" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            ODDS HIDDEN · ARCIUM MPC
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="4" r="2" stroke="#64748b" strokeWidth="1.2"/>
              <path d="M1 11c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="font-mono text-xs text-slate-500">{totalParticipants} participants</span>
          </div>
          <span className="font-mono text-xs text-slate-500">
            {isOpen
              ? `Closes ${formatDistanceToNow(resolutionTimestamp, { addSuffix: true })}`
              : format(resolutionTimestamp, "MMM d, yyyy")}
          </span>
        </div>
      </div>
    </Link>
  );
}
