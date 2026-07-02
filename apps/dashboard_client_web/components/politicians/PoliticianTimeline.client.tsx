// components/politicians/PoliticianTimeline.client.tsx
// Purpose: Per-quarter grouped list of politician PTR transaction disclosures.
//   Consumes timeline[] from the politician detail endpoint.
//   Columns label: "disclosed trading activity per quarter" —
//   NOT quarter-end holdings or positions.
// Invariants:
//   - Empty timeline (pre-backfill, <2 distinct quarters) → renders nothing.
//   - Direction coloring: buy=green, sell=red, mixed=neutral (matches the
//     v_politician_filer_timeline 'buy'|'sell'|'mixed' vocabulary).
//     This conveys transaction direction, NOT portfolio quality.
//   - netValueBand is a coarse band string (e.g. "$50K–$250K"); never parsed.
//   - NEVER renders: held / own / position / portfolio language.
// Constraints: "use client" (client component for coloring); no fetch, no state.

'use client';

import type { PoliticianTimelineEntry } from '@/types/politician';

interface Props {
    timeline: PoliticianTimelineEntry[];
}

function directionColor(direction: string): string {
    if (direction === 'buy') return 'text-green-700 dark:text-green-400';
    if (direction === 'sell') return 'text-red-700 dark:text-red-400';
    return 'text-muted-foreground';
}

function directionLabel(direction: string): string {
    if (direction === 'buy') return 'buy';
    if (direction === 'sell') return 'sell';
    return 'mixed';
}

function quarterLabel(isoDate: string): string {
    // 'YYYY-MM-DD' → 'Q1 YYYY' style
    const month = parseInt(isoDate.slice(5, 7), 10);
    const year = isoDate.slice(0, 4);
    const q = Math.ceil(month / 3);
    return `Q${q} ${year}`;
}

export function PoliticianTimeline({ timeline }: Props) {
    if (timeline.length === 0) return null;

    // Group entries by quarter (preserving order — timeline is already ASC by quarter).
    const byQuarter = new Map<string, PoliticianTimelineEntry[]>();
    for (const entry of timeline) {
        const list = byQuarter.get(entry.quarter) ?? [];
        list.push(entry);
        byQuarter.set(entry.quarter, list);
    }

    return (
        <section aria-label="Disclosed trading activity per quarter">
            <p className="mb-3 text-xs text-muted-foreground">
                Disclosed trading activity per quarter &mdash; past PTR
                disclosures, not quarter-end positions.
            </p>
            <div className="space-y-4">
                {[...byQuarter.entries()].map(([quarter, entries]) => (
                    <div key={quarter}>
                        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {quarterLabel(quarter)}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {entries.map((e) => (
                                <span
                                    key={`${e.quarter}-${e.ticker}`}
                                    className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-1 text-xs"
                                >
                                    <span className="font-mono font-semibold">
                                        {e.ticker}
                                    </span>
                                    <span
                                        className={directionColor(e.direction)}
                                    >
                                        {directionLabel(e.direction)}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {e.netValueBand}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
