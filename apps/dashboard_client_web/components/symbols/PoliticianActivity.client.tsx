// components/symbols/PoliticianActivity.client.tsx
// Purpose: Display politician trading activity (STOCK Act disclosures) for a
//   single ticker over the 90-day disclosure window from v_politician_activity
//   (migration 0022). Renders ONLY when politicianActivity is non-null and
//   count90d > 0.
// Invariants:
//   - No "held"/"own"/"portfolio"/"weight" language — these are TRADE disclosures,
//     not position snapshots.
//   - Party affiliation chips are neutral-styled (grey/outline) — never red/green
//     good/bad association.
//   - Disclaimer and coverage footnote are always visible, not tooltip-only.
//   - Freshness band computed from latestDisclosure: <=14d=Fresh, 15–45d=Recent,
//     46–90d=Aging. Absolute date shown on hover via title attribute.
//   - clusterFlag: shown when 3+ members traded the same direction.
// Constraints: "use client" for date computation (uses Date.now()); no fetch/state.

'use client';

import type { SymbolPoliticianActivity } from '@/types/symbolDetail';

interface Props {
    politicianActivity: SymbolPoliticianActivity;
}

type FreshnessBand = 'Fresh disclosure' | 'Recent' | 'Aging';

function getFreshnessBand(latestDisclosure: string): FreshnessBand {
    const discDate = new Date(latestDisclosure);
    const now = new Date();
    const diffDays = Math.floor(
        (now.getTime() - discDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 14) return 'Fresh disclosure';
    if (diffDays <= 45) return 'Recent';
    return 'Aging';
}

function directionLabel(
    netDirection: SymbolPoliticianActivity['netDirection']
): string {
    if (netDirection === 'buy_skew') return 'Buy-skewed';
    if (netDirection === 'sell_skew') return 'Sell-skewed';
    return 'Mixed';
}

export function PoliticianActivity({ politicianActivity }: Props) {
    const {
        count90d,
        buyMembers,
        sellMembers,
        netDirection,
        latestDisclosure,
        clusterFlag,
    } = politicianActivity;

    if (count90d === 0) return null;

    const freshness = getFreshnessBand(latestDisclosure);

    return (
        <section
            aria-label="Politician trading disclosures"
            className="rounded-lg border border-border bg-card p-4 text-sm"
        >
            {/* Header badge */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold">
                    Traded by {count90d} politician{count90d !== 1 ? 's' : ''}{' '}
                    &middot; 90d
                </span>

                {/* Freshness chip */}
                <span
                    title={`Latest disclosure: ${latestDisclosure}`}
                    className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                    {freshness}
                </span>

                {/* Cluster flag */}
                {clusterFlag && (
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Cluster signal
                    </span>
                )}
            </div>

            {/* Direction chip */}
            <p className="mt-3 text-muted-foreground">
                <span className="font-medium text-foreground">
                    {directionLabel(netDirection)}
                </span>
                {' — '}
                {buyMembers} buy{buyMembers !== 1 ? 's' : ''} &middot;{' '}
                {sellMembers} sell{sellMembers !== 1 ? 's' : ''}
            </p>

            {/* Always-visible disclaimer */}
            <p className="mt-4 rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                Disclosed under the STOCK Act. Trades are reported 30&ndash;90+
                days after they occur &mdash; these are past disclosures, not
                current positions or live trades. Amounts are broad ranges.
                Shown for transparency &mdash; not investment advice, and not a
                claim these trades outperform.
            </p>

            {/* Coverage footnote */}
            <p className="mt-2 text-xs text-muted-foreground">
                U.S. House + Senate + executive-branch (OGE&nbsp;278-T) filers.
                Diversified mutual funds, U.S. Treasuries, and real estate are
                disclosure-exempt.
            </p>
        </section>
    );
}
