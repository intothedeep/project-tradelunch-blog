// components/screener/ScreenerTable.tsx
// Purpose: Presentational table for a list of screener candidates.
//   Shared by both /screener tiers (price-signal-complete + consensus-only);
//   the "—" cells render naturally for absent momentum/lowVol.
//   "Traded by (90d)" column shows politician trade count + net-direction chip
//   when migration 0022 data is present; rows without data show an empty cell.
//   Q6.4: expand sub-row shows politicianTopFilers (migration 0023) as
//   "Traded by: {names}" with links to /politicians/[filerId].
//   When politicianTopFilers is absent or empty, no sub-row is rendered.
// Invariant: pure presentational Server Component — no hooks, no side effects.

import { Fragment } from 'react';
import Link from 'next/link';
import type { ScreenerCandidate } from '@/types/screener';
import { PoliticianDisclaimer } from '@/components/symbols/PoliticianDisclaimer';

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

function netDirectionChip(
    direction: string | null | undefined
): React.ReactNode {
    if (!direction) return null;
    const label =
        direction === 'buy_skew'
            ? 'buy-skew'
            : direction === 'sell_skew'
              ? 'sell-skew'
              : 'mixed';
    return (
        <span className="ml-1 inline-flex items-center rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground">
            {label}
        </span>
    );
}

// Whether any candidate in the set carries politician data — drives the column header.
function hasPoliticianColumn(candidates: ScreenerCandidate[]): boolean {
    return candidates.some((c) => c.politicianCount90d !== undefined);
}

// Whether any candidate carries politicalInterestScore data (migration 0022).
function hasPoliticalInterestCol(candidates: ScreenerCandidate[]): boolean {
    return candidates.some((c) => c.politicalInterestScore !== undefined);
}

// Whether any candidate has top-filers data (migration 0023).
function hasTopFilersData(candidates: ScreenerCandidate[]): boolean {
    return candidates.some(
        (c) =>
            c.politicianTopFilers !== undefined &&
            c.politicianTopFilers.length > 0
    );
}

export function ScreenerTable({ candidates }: Props) {
    const showPoliticianCol = hasPoliticianColumn(candidates);
    const showPoliticalInterestCol = hasPoliticalInterestCol(candidates);
    const showTopFilersSection = hasTopFilersData(candidates);
    // Base columns: Security, Ticker, Active/Total, Cap Rank, Consensus,
    //               Cap Tier, Momentum, Low-Vol, Score = 9
    // + 1 when politician "Traded by" column present
    // + 1 when political-interest score column present
    const colCount =
        9 + (showPoliticianCol ? 1 : 0) + (showPoliticalInterestCol ? 1 : 0);

    return (
        <div className="space-y-2">
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
                            {showPoliticianCol && (
                                <th className="px-4 py-3 text-right font-medium">
                                    Traded by&nbsp;(90d)
                                </th>
                            )}
                            {showPoliticalInterestCol && (
                                <th
                                    className="px-4 py-3 text-right font-medium"
                                    title="Breadth + directional consensus of DISCLOSED politician transactions (last 90 days). Transparency lens only — NOT a buy/sell signal or portfolio holdings indicator."
                                >
                                    Political&nbsp;Interest
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {candidates.map((c) => {
                            const topFilers = c.politicianTopFilers ?? [];
                            const hasTopFilers = topFilers.length > 0;

                            return (
                                <Fragment key={c.cusip}>
                                    <tr className="border-b hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <span className="font-medium">
                                                {c.name}
                                            </span>
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
                                            {c.rank !== null
                                                ? `#${c.rank}`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {(
                                                c.components.consensus * 100
                                            ).toFixed(0)}
                                            %
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
                                        {showPoliticianCol && (
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {c.politicianCount90d != null &&
                                                c.politicianCount90d > 0 ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        {c.politicianCount90d}
                                                        {netDirectionChip(
                                                            c.politicianNetDirection
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                        {showPoliticalInterestCol && (
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {c.politicalInterestScore !=
                                                null ? (
                                                    <span className="inline-flex flex-col items-end gap-0.5">
                                                        <span>
                                                            {(
                                                                c.politicalInterestScore *
                                                                100
                                                            ).toFixed(0)}
                                                            %
                                                        </span>
                                                        <span
                                                            className="h-1 rounded-full bg-primary/40"
                                                            style={{
                                                                width: `${Math.round(
                                                                    c.politicalInterestScore *
                                                                        48
                                                                )}px`,
                                                            }}
                                                        />
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>

                                    {/* Q6.4: top filers accordion sub-row (migration 0023) */}
                                    {hasTopFilers && (
                                        <tr
                                            key={`${c.cusip}-filers`}
                                            className="border-b bg-muted/20 last:border-0"
                                        >
                                            <td
                                                colSpan={colCount}
                                                className="px-4 py-1.5"
                                            >
                                                <details className="text-xs">
                                                    <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                                                        Traded by:{' '}
                                                        {topFilers
                                                            .map(
                                                                (f) =>
                                                                    f.filerName
                                                            )
                                                            .join(', ')}
                                                    </summary>
                                                    <div className="mt-1.5 flex flex-wrap gap-2 pl-2">
                                                        {topFilers.map((f) => (
                                                            <Link
                                                                key={f.filerId}
                                                                href={`/politicians/${f.filerId}`}
                                                                className="underline-offset-4 hover:underline"
                                                            >
                                                                {f.filerName}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </details>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Disclaimer always visible when politician column or top-filers data present */}
            {(showPoliticianCol || showTopFilersSection) && (
                <PoliticianDisclaimer />
            )}
        </div>
    );
}
