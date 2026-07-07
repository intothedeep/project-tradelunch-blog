// components/funds/ConsensusPanel.client.tsx
// Purpose: cross-fund consensus for the currently-selected cusip (P8-3). Lazy —
//   fetches only when a cusip is selected in the rank-flow table (one call per
//   selection, never one-per-row upfront).
// Constraints: "use client" — local fetch state keyed by cusip. Unknown cusip /
//   absent views → the panel renders nothing (graceful, matches null contract).
// Side effects: one server-action call per distinct selected cusip.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSecurityConsensus } from '@/app/actions/getSecurityConsensus.action';
import type { SecurityConsensus } from '@/types/consensus';
import { formatUsd } from '@/utils/formatUsd';

interface ConsensusPanelProps {
    cusip: string | null;
}

export function ConsensusPanel({ cusip }: ConsensusPanelProps) {
    const [data, setData] = useState<SecurityConsensus | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!cusip) {
            setData(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        getSecurityConsensus(cusip)
            .then((res) => {
                if (cancelled) return;
                setData(res.ok ? res.data : null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [cusip]);

    if (!cusip) return null;

    return (
        <div className="mt-4 rounded-lg border border-border bg-card p-3">
            <h3 className="text-sm font-semibold">
                Cross-fund consensus
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {cusip}
                </span>
            </h3>

            {loading && (
                <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
            )}

            {!loading && data === null && (
                <p className="mt-2 text-xs text-muted-foreground">
                    No consensus data for this security yet.
                </p>
            )}

            {!loading && data !== null && (
                <>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {data.name}
                        {data.mappedTicker && (
                            <>
                                {' · '}
                                <Link
                                    href={`/symbols/${data.mappedTicker}`}
                                    className="font-medium text-primary hover:underline"
                                >
                                    {data.mappedTicker}
                                </Link>
                            </>
                        )}{' '}
                        · {data.periodOfReport}
                    </p>
                    <p className="mt-2 text-sm">
                        <span className="font-semibold text-primary">
                            {data.holderCountActive}
                        </span>{' '}
                        active {data.holderCountActive === 1 ? 'fund' : 'funds'}{' '}
                        <span className="text-muted-foreground">
                            ({data.holderCountTotal} total) hold this
                        </span>
                    </p>
                    <ul className="mt-2 space-y-1">
                        {data.holders.map((h) => (
                            <li
                                key={h.cik}
                                className="flex items-center justify-between gap-2 text-xs"
                            >
                                <span className="truncate">
                                    {h.label}
                                    {h.isActiveManager && (
                                        <span className="ml-1 rounded-sm bg-primary/15 px-1 text-[9px] font-medium text-primary">
                                            ACTIVE
                                        </span>
                                    )}
                                    {h.isNew && (
                                        <span className="ml-1 rounded-sm bg-green-500/20 px-1 text-[9px] font-bold text-green-700 dark:text-green-400">
                                            NEW
                                        </span>
                                    )}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {formatUsd(h.valueUsd)}
                                    {h.deltaWeightPct !== null &&
                                        h.deltaWeightPct !== 0 && (
                                            <span
                                                className={
                                                    h.deltaWeightPct > 0
                                                        ? 'ml-1 text-green-600 dark:text-green-400'
                                                        : 'ml-1 text-red-600 dark:text-red-400'
                                                }
                                            >
                                                {h.deltaWeightPct > 0
                                                    ? '▲'
                                                    : '▼'}
                                                {Math.abs(
                                                    h.deltaWeightPct
                                                ).toFixed(1)}
                                                %
                                            </span>
                                        )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
