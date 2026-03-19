import React from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { type MarketCategory, type MarketStatus } from "../utils/program";

interface MarketCardProps {
  id: number;
  category: MarketCategory;
  title: string;
  description: string;
  resolutionTimestamp: Date;
  status: MarketStatus;
  totalParticipants: number;
  revealedYesStake?: number;
  revealedNoStake?: number;
  outcome?: boolean;
}

const STATUS_COLORS: Record<MarketStatus, string> = {
  Open: "#34D399",
  SettledPending: "#FACC15",
  Challenged: "#F97316",
  Settled: "#22D3EE",
  Cancelled: "#94A3B8",
  Invalid: "#F59E0B",
};

export default function MarketCard(props: MarketCardProps) {
  const {
    id,
    category,
    title,
    description,
    resolutionTimestamp,
    status,
    totalParticipants,
    revealedYesStake,
    revealedNoStake,
    outcome,
  } = props;

  const total = (revealedYesStake ?? 0) + (revealedNoStake ?? 0);
  const yesP = total === 0 ? 50 : Math.round(((revealedYesStake ?? 0) / total) * 100);
  const noP = 100 - yesP;
  const isSettled = status === "Settled";
  const isOpen = status === "Open";
  const statusLabel =
    status === "SettledPending"
      ? "SETTLEMENT WINDOW"
      : status === "Challenged"
        ? "CHALLENGED"
        : status.toUpperCase();

  return (
    <Link href={`/market/${id}`} style={{ textDecoration: "none" }}>
      <div className="card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-body text-sm font-medium leading-snug text-white">{title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{description}</p>
          </div>
          <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-xs text-slate-300">
            {category.toUpperCase()}
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-xs" style={{ color: STATUS_COLORS[status] }}>
            {statusLabel}
          </span>
          <span className="font-mono text-xs text-slate-500">{totalParticipants} participants</span>
        </div>

        {isSettled ? (
          <div className="mb-3">
            <p className="mb-1 font-mono text-xs text-slate-400">
              YES {yesP}% {outcome === true ? "WIN" : ""} | NO {noP}% {outcome === false ? "WIN" : ""}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div style={{ width: `${yesP}%`, height: "100%", background: "#34D399" }} />
            </div>
          </div>
        ) : (
          <p className="mb-3 font-mono text-xs text-slate-500">Odds hidden until settlement</p>
        )}

        <p className="font-mono text-xs text-slate-500">
          {isOpen
            ? `Closes ${formatDistanceToNow(resolutionTimestamp, { addSuffix: true })}`
            : format(resolutionTimestamp, "MMM d, yyyy")}
        </p>
      </div>
    </Link>
  );
}
