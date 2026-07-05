// components/politicians/PoliticianTimeline.client.tsx
// Purpose: 13F-style quarterly pivot of a politician's PTR transaction
//   disclosures. Rows = tickers, columns = quarters (newest-first). Each cell is
//   colour-coded by net direction (buy=green, sell=red, mixed=amber) and shows
//   the disclosed BUY / SELL value bands for that ticker-quarter.
// Invariants:
//   - Empty timeline (pre-backfill, <2 distinct quarters) → renders nothing.
//   - Cell colour conveys transaction DIRECTION, never portfolio quality.
//   - Bands are coarse PTR ranges (e.g. "$50K–$250K"); '—' = that side had no
//     trades that quarter. Never parsed, never summed into a "position".
//   - NEVER renders: held / own / position / portfolio / holdings language.
//     PTR discloses TRADES, not quarter-end holdings — the note says so.
// Constraints: "use client" (colour + horizontal scroll); no fetch, no state.

'use client';

import Link from 'next/link';
import type { PoliticianTimelineEntry } from '@/types/politician';

interface Props {
    timeline: PoliticianTimelineEntry[];
}

type Direction = 'buy' | 'sell' | 'mixed';

function cellTint(direction: string): string {
    if (direction === 'buy')
        return 'bg-green-50 dark:bg-green-950/40 border-green-200/60 dark:border-green-900/50';
    if (direction === 'sell')
        return 'bg-red-50 dark:bg-red-950/40 border-red-200/60 dark:border-red-900/50';
    return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40';
}

function quarterLabel(isoDate: string): string {
    // 'YYYY-MM-DD' (quarter start) → 'Q# YYYY'
    const month = parseInt(isoDate.slice(5, 7), 10);
    const year = isoDate.slice(0, 4);
    return `Q${Math.ceil(month / 3)} ${year}`;
}

/** Distinct quarters, newest-first — timeline arrives ASC, so reverse it. */
function orderedQuarters(timeline: PoliticianTimelineEntry[]): string[] {
    const seen: string[] = [];
    const set = new Set<string>();
    for (const e of timeline) {
        if (!set.has(e.quarter)) {
            set.add(e.quarter);
            seen.push(e.quarter);
        }
    }
    return seen.reverse();
}

/** Tickers ordered by activity: most active quarters first, then alphabetical. */
function orderedTickers(timeline: PoliticianTimelineEntry[]): string[] {
    const counts = new Map<string, number>();
    for (const e of timeline)
        counts.set(e.ticker, (counts.get(e.ticker) ?? 0) + 1);
    return [...counts.keys()].sort((a, b) => {
        const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
        return diff !== 0 ? diff : a.localeCompare(b);
    });
}

function LegendSwatch({ tint, label }: { tint: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1">
            <span
                className={`inline-block h-3 w-3 rounded-sm border ${tint}`}
            />
            {label}
        </span>
    );
}

function Cell({ entry }: { entry: PoliticianTimelineEntry | undefined }) {
    if (!entry) {
        return <td className="border border-border/40 px-2 py-1.5" />;
    }
    const dir = entry.direction as Direction;
    return (
        <td
            className={`border px-2 py-1.5 text-center align-middle ${cellTint(dir)}`}
            title={`${entry.ticker} · ${quarterLabel(entry.quarter)} · net ${entry.netValueBand} (${dir})`}
        >
            <span className="flex flex-col gap-0.5 text-[11px] leading-tight">
                {entry.buyValueBand !== '—' && (
                    <span className="whitespace-nowrap text-green-700 dark:text-green-400">
                        ▲ {entry.buyValueBand}
                    </span>
                )}
                {entry.sellValueBand !== '—' && (
                    <span className="whitespace-nowrap text-red-700 dark:text-red-400">
                        ▼ {entry.sellValueBand}
                    </span>
                )}
            </span>
        </td>
    );
}

export function PoliticianTimeline({ timeline }: Props) {
    if (timeline.length === 0) return null;

    const quarters = orderedQuarters(timeline);
    const tickers = orderedTickers(timeline);
    const byCell = new Map<string, PoliticianTimelineEntry>();
    for (const e of timeline) byCell.set(`${e.ticker}|${e.quarter}`, e);

    return (
        <section aria-label="Quarterly transaction activity">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <LegendSwatch
                    tint={cellTint('buy')}
                    label="net buy"
                />
                <LegendSwatch
                    tint={cellTint('sell')}
                    label="net sell"
                />
                <LegendSwatch
                    tint={cellTint('mixed')}
                    label="mixed"
                />
                <span>▲ bought · ▼ sold (disclosed value band)</span>
            </div>

            <div className="overflow-x-auto rounded border border-border">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-10 border border-border bg-muted/60 px-2 py-1.5 text-left font-semibold">
                                Ticker
                            </th>
                            {quarters.map((q) => (
                                <th
                                    key={q}
                                    className="whitespace-nowrap border border-border bg-muted/60 px-2 py-1.5 text-center font-semibold"
                                >
                                    {quarterLabel(q)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tickers.map((ticker) => (
                            <tr key={ticker}>
                                <th className="sticky left-0 z-10 border border-border bg-background px-2 py-1.5 text-left font-mono font-semibold">
                                    <Link
                                        href={`/symbols/${ticker}`}
                                        className="hover:underline"
                                    >
                                        {ticker}
                                    </Link>
                                </th>
                                {quarters.map((q) => (
                                    <Cell
                                        key={`${ticker}|${q}`}
                                        entry={byCell.get(`${ticker}|${q}`)}
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
                Disclosed trading activity per quarter &mdash; past PTR
                disclosures, not quarter-end holdings. Values are coarse
                statutory bands, not exact amounts.
            </p>
        </section>
    );
}
