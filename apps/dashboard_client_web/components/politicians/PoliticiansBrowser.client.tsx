// components/politicians/PoliticiansBrowser.client.tsx
// Purpose: Client-side browse UI over the full politician roster — name/state
//   search + party/chamber filter chips + incremental "load more". Each row
//   links to /politicians/[filerId]. Filter options are derived from the data
//   itself (no hardcoded party/chamber vocabulary).
// Invariants:
//   - Party/chamber/state chips are NEUTRAL (grey/outline) — never red/green
//     (matches the per-politician page's PTR-neutrality contract).
//   - Counts are "as reported by source"; no dollar amounts rendered here.
//   - Rows arrive pre-sorted by tradeCount DESC from the backend; order kept.
//   - Nothing here mutates data or hits the network — pure presentational state.

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PoliticianListItem } from '@/app/actions/getPoliticians.schema';

const PAGE_SIZE = 60;

function NeutralChip({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {label}
        </span>
    );
}

/** Distinct, non-null values for a field, in first-seen (trade-rank) order. */
function distinctValues(
    items: PoliticianListItem[],
    pick: (i: PoliticianListItem) => string | null
): string[] {
    const seen = new Set<string>();
    for (const it of items) {
        const v = pick(it);
        if (v) seen.add(v);
    }
    return Array.from(seen);
}

export function PoliticiansBrowser({ items }: { items: PoliticianListItem[] }) {
    const [query, setQuery] = useState('');
    const [party, setParty] = useState<string | null>(null);
    const [chamber, setChamber] = useState<string | null>(null);
    const [visible, setVisible] = useState(PAGE_SIZE);

    const parties = useMemo(
        () => distinctValues(items, (i) => i.party),
        [items]
    );
    const chambers = useMemo(
        () => distinctValues(items, (i) => i.chamber),
        [items]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((it) => {
            if (party && it.party !== party) return false;
            if (chamber && it.chamber !== chamber) return false;
            if (!q) return true;
            return (
                it.filerName.toLowerCase().includes(q) ||
                (it.state ?? '').toLowerCase().includes(q) ||
                it.filerId.toLowerCase().includes(q)
            );
        });
    }, [items, query, party, chamber]);

    const shown = filtered.slice(0, visible);

    function resetVisible() {
        setVisible(PAGE_SIZE);
    }

    return (
        <div>
            {/* Search + filters */}
            <div className="mb-4 flex flex-col gap-3">
                <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        resetVisible();
                    }}
                    placeholder="Search by name or state…"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Search politicians"
                />
                <div className="flex flex-wrap gap-2">
                    <FilterRow
                        label="Party"
                        options={parties}
                        active={party}
                        onPick={(v) => {
                            setParty(v);
                            resetVisible();
                        }}
                    />
                    <FilterRow
                        label="Chamber"
                        options={chambers}
                        active={chamber}
                        onPick={(v) => {
                            setChamber(v);
                            resetVisible();
                        }}
                    />
                </div>
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
                {filtered.length} of {items.length} filers
                {' · counts as reported by source'}
            </p>

            {/* Rows */}
            <ul className="divide-y divide-border rounded border border-border">
                {shown.map((it) => (
                    <li key={it.filerId}>
                        <Link
                            href={`/politicians/${it.filerId}`}
                            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                    {it.filerName}
                                </span>
                                <span className="mt-1 flex flex-wrap gap-1">
                                    {it.party && (
                                        <NeutralChip label={it.party} />
                                    )}
                                    {it.chamber && (
                                        <NeutralChip label={it.chamber} />
                                    )}
                                    {it.state && (
                                        <NeutralChip label={it.state} />
                                    )}
                                </span>
                            </span>
                            <span className="shrink-0 text-right text-xs text-muted-foreground">
                                <span className="block tabular-nums text-foreground">
                                    {it.tradeCount ?? 0} trades
                                </span>
                                {(it.purchases !== null ||
                                    it.sales !== null) && (
                                    <span className="block tabular-nums">
                                        {it.purchases ?? 0} buy ·{' '}
                                        {it.sales ?? 0} sell
                                    </span>
                                )}
                            </span>
                        </Link>
                    </li>
                ))}
                {shown.length === 0 && (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No politicians match your filters.
                    </li>
                )}
            </ul>

            {visible < filtered.length && (
                <div className="mt-4 text-center">
                    <button
                        type="button"
                        onClick={() => setVisible((v) => v + PAGE_SIZE)}
                        className="rounded border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40"
                    >
                        Show more ({filtered.length - visible} remaining)
                    </button>
                </div>
            )}
        </div>
    );
}

function FilterRow({
    label,
    options,
    active,
    onPick,
}: {
    label: string;
    options: string[];
    active: string | null;
    onPick: (v: string | null) => void;
}) {
    if (options.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">{label}:</span>
            <ChipButton
                label="All"
                selected={active === null}
                onClick={() => onPick(null)}
            />
            {options.map((opt) => (
                <ChipButton
                    key={opt}
                    label={opt}
                    selected={active === opt}
                    onClick={() => onPick(opt)}
                />
            ))}
        </div>
    );
}

function ChipButton({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={
                'rounded border px-2 py-0.5 text-xs transition-colors ' +
                (selected
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:bg-muted/40')
            }
        >
            {label}
        </button>
    );
}
