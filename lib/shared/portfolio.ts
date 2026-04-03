import type { DemoPosition } from "./market-types";

export function calculatePositionPnl(position: DemoPosition): number {
  if (position.visibility === "encrypted") return 0;
  const stake = position.stakeSol ?? 0;
  const entry = position.entryOdds ?? 0;
  const mark = position.markOdds ?? 0;
  if (position.status === "Open") {
    return (mark - entry) * stake;
  }
  return (position.payoutSol ?? 0) - stake;
}

export function getPortfolioSummary(positions: DemoPosition[]) {
  const visible = positions.filter((position) => position.visibility === "public");
  const open = visible.filter((position) => position.status === "Open");
  const settled = visible.filter((position) => position.status !== "Open");
  const winners = visible.filter((position) => position.status === "Won");

  const realizedPnl = settled.reduce(
    (total, position) => total + calculatePositionPnl(position),
    0
  );
  const unrealizedPnl = open.reduce(
    (total, position) => total + calculatePositionPnl(position),
    0
  );
  const totalStaked = visible.reduce((total, position) => total + (position.stakeSol ?? 0), 0);
  const winRate = settled.length === 0 ? 0 : (winners.length / settled.length) * 100;

  return {
    openCount: open.length,
    settledCount: settled.length,
    totalStaked,
    realizedPnl,
    unrealizedPnl,
    winRate,
  };
}
