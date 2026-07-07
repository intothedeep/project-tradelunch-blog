// components/rankings/RankingsViewToggle.client.tsx
// Purpose: Snapshot | Flow view toggle for /rankings.
//   Flow is gated behind MIN_WEEKS_FOR_FLOW — when fewer weeks exist, the
//   Flow button is disabled with an "N/M weeks" hint.
//   Navigation is URL-driven; existing scope/sector/asOf params are preserved.
// Constraints: client component — navigation intent only, no data.
// Side effects: router.push (URL change).

'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface RankingsViewToggleProps {
    view: 'snapshot' | 'flow';
    weeksCount: number;
    minWeeks: number;
    // Existing URL state to preserve when switching view.
    scope: string;
    sector: string | null;
    asOf: string; // resolved current week
    latestWeek: string; // used to decide whether to pin asOf in the URL
}

const TOGGLE_BASE = 'px-4 py-2 font-mono text-sm border transition-colors';
const TOGGLE_ACTIVE = 'bg-primary text-primary-foreground border-primary';
const TOGGLE_IDLE =
    'border-border text-muted-foreground hover:border-primary hover:text-foreground';

export default function RankingsViewToggle({
    view,
    weeksCount,
    minWeeks,
    scope,
    sector,
    asOf,
    latestWeek,
}: RankingsViewToggleProps) {
    const router = useRouter();
    const canFlow = weeksCount >= minWeeks;

    // Build a /rankings href preserving scope/sector/asOf and switching view.
    // Pin asOf only when it is not the latest week (keeps latest live).
    function buildHref(v: 'snapshot' | 'flow'): string {
        const params = new URLSearchParams();
        if (scope === 'sector') {
            params.set('scope', 'sector');
            if (sector) params.set('sector', sector);
        }
        if (asOf && asOf !== latestWeek) params.set('asOf', asOf);
        if (v === 'flow') params.set('view', 'flow');
        const qs = params.toString();
        return qs ? `/rankings?${qs}` : '/rankings';
    }

    return (
        <div className="flex">
            <button
                type="button"
                onClick={() => router.push(buildHref('snapshot'))}
                className={cn(
                    TOGGLE_BASE,
                    'rounded-l',
                    view === 'snapshot' ? TOGGLE_ACTIVE : TOGGLE_IDLE
                )}
                aria-pressed={view === 'snapshot'}
            >
                Snapshot
            </button>
            <button
                type="button"
                disabled={!canFlow}
                onClick={() => {
                    if (canFlow) router.push(buildHref('flow'));
                }}
                className={cn(
                    TOGGLE_BASE,
                    '-ml-px rounded-r',
                    view === 'flow' && canFlow ? TOGGLE_ACTIVE : TOGGLE_IDLE,
                    !canFlow &&
                        'opacity-40 cursor-not-allowed hover:border-border hover:text-muted-foreground'
                )}
                aria-pressed={view === 'flow' && canFlow}
                title={
                    !canFlow
                        ? `Flow unlocks after ${minWeeks} weeks (${weeksCount}/${minWeeks})`
                        : undefined
                }
            >
                Flow
                {!canFlow && (
                    <span className="ml-1 text-[10px] opacity-70">
                        {weeksCount}/{minWeeks}
                    </span>
                )}
            </button>
        </div>
    );
}
