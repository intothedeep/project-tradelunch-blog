// components/screener/ScreenerTable.tsx
// Purpose: Presentational table for a list of screener candidates.
//   Shared by both /screener tiers (price-signal-complete + consensus-only);
//   the "—" cells render naturally for absent momentum/lowVol.
// Invariant: pure presentational Server Component — no hooks, no side effects.

import Link from 'next/link';
import type { ScreenerCandidate } from '@/types/screener';

interface Props {
    candidates: ScreenerCandidate[];
}

function capTierLabel(c: ScreenerCandidate): string {
    if (c.components.capTier === 1) return 'Top 20';
    if (c.components.capTier === 0.5) return 'Top 100';
    return c.rank === null ? 'No data' : 'Other';
}

function pctOrDash(v: number | null): string {
    return v !== null ? `${(v * 100).toFixed(0)}%` : '—';
}

export function ScreenerTable({ candidates }: Props) {
    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">
                            Security
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                            Ticker
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Active&nbsp;/ Total
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Cap Rank
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Consensus
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Cap Tier
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Momentum
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Low&#8209;Vol
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Score
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {candidates.map((c) => (
                        <tr
                            key={c.cusip}
                            className="border-b last:border-0 hover:bg-muted/30"
                        >
                            <td className="px-4 py-3">
                                <span className="font-medium">{c.name}</span>
                                <span className="ml-2 font-mono text-xs text-muted-foreground">
                                    {c.cusip}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                {c.ticker !== null ? (
                                    <Link
                                        href={`/symbols/${c.ticker}`}
                                        className="font-mono font-semibold text-primary underline-offset-4 hover:underline"
                                    >
                                        {c.ticker}
                                    </Link>
                                ) : (
                                    <span className="text-muted-foreground">
                                        —
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                                {c.holderCountActive}&nbsp;/&nbsp;
                                {c.holderCountTotal}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                                {c.rank !== null ? `#${c.rank}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                                {(c.components.consensus * 100).toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-right">
                                {capTierLabel(c)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                                {pctOrDash(c.components.momentum)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                                {pctOrDash(c.components.lowVol)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold">
                                {c.score.toFixed(3)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
