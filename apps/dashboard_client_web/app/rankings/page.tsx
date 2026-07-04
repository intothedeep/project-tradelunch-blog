import type { Metadata } from 'next';
import { getRankings } from '@/app/actions/getRankings.action';
import { getRankingsFlow } from '@/app/actions/getRankingsFlow.action';
import RankingsTable from '@/components/rankings/RankingsTable';
import RankingsFilter from '@/components/rankings/RankingsFilter.client';
import RankingsViewToggle from '@/components/rankings/RankingsViewToggle.client';
import RankingsFlowTable from '@/components/rankings/RankingsFlowTable.client';
import type { RankingScope } from '@/types/rankings';

export const metadata: Metadata = {
    title: 'Marketcap Rankings | Taek Lim',
    description:
        'Weekly market-capitalization rankings — global leaders and within-sector leaders.',
    alternates: {
        canonical: '/rankings',
    },
};

export const dynamic = 'force-dynamic';

// Minimum weekly snapshots required to unlock the Flow view.
const MIN_WEEKS_FOR_FLOW = 8;

interface RankingsPageProps {
    searchParams: Promise<{
        scope?: string;
        sector?: string;
        asOf?: string;
        view?: string;
    }>;
}

// /rankings — weekly market-cap ranking viewer.
// States:
//   backend error  → explicit error block (no mock fallback)
//   data null      → empty state (migration unapplied / collector not run)
//   view=snapshot  → scope/sector filter + rankings table (default)
//   view=flow      → rank-flow timeline (gated behind MIN_WEEKS_FOR_FLOW)
export default async function RankingsPage({
    searchParams,
}: RankingsPageProps) {
    const sp = await searchParams;
    const scope: RankingScope = sp.scope === 'sector' ? 'sector' : 'global';
    const view: 'snapshot' | 'flow' = sp.view === 'flow' ? 'flow' : 'snapshot';

    const result = await getRankings({
        scope,
        sector: sp.sector,
        asOf: sp.asOf,
        limit: 100,
    });

    if (!result.ok) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">
                        Rankings data is unavailable
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The backend could not be reached. Please try again
                        shortly.
                    </p>
                </div>
            </main>
        );
    }

    if (result.data === null || result.data.rows.length === 0) {
        return (
            <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
                <h1 className="text-2xl font-bold tracking-tight mb-6">
                    Marketcap Rankings
                </h1>
                <div className="flex min-h-[40vh] items-center justify-center rounded-md border border-dashed">
                    <p className="text-sm text-muted-foreground">
                        No rankings yet — the weekly screen has not produced
                        data for this view.
                    </p>
                </div>
            </main>
        );
    }

    const { asOf, sector, sectors, availableWeeks, rows } = result.data;
    const weeksCount = availableWeeks.length;
    const canFlow = weeksCount >= MIN_WEEKS_FOR_FLOW;
    const latestWeek = availableWeeks[0] ?? asOf;
    // Pin only a non-latest week — matches RankingsFilter convention.
    const pinnedAsOf = asOf !== latestWeek ? asOf : null;

    // Fetch flow data only when the user explicitly requests it AND enough data exists.
    const flowResult =
        view === 'flow' && canFlow
            ? await getRankingsFlow('week', Math.min(weeksCount, 26))
            : null;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <header className="mb-4">
                <h1 className="text-2xl font-bold tracking-tight">
                    Marketcap Rankings
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Week of {asOf} &middot;{' '}
                    {scope === 'sector'
                        ? `${sector ?? 'sector'} · top ${rows.length}`
                        : `global · top ${rows.length}`}
                </p>
            </header>

            <div className="mb-6 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                    <RankingsFilter
                        scope={scope}
                        sector={sector}
                        sectors={sectors}
                        asOf={asOf}
                        availableWeeks={availableWeeks}
                    />
                    <RankingsViewToggle
                        view={view}
                        weeksCount={weeksCount}
                        minWeeks={MIN_WEEKS_FOR_FLOW}
                        scope={scope}
                        sector={sector}
                        asOf={asOf}
                        latestWeek={latestWeek}
                    />
                </div>
                {!canFlow && (
                    <p className="text-xs text-muted-foreground">
                        Flow view unlocks after {MIN_WEEKS_FOR_FLOW} weekly
                        snapshots ({weeksCount}/{MIN_WEEKS_FOR_FLOW} weeks).
                    </p>
                )}
                {pinnedAsOf === null && weeksCount <= 1 && (
                    <p className="text-xs text-muted-foreground">
                        Time-series view unlocks as weekly snapshots accumulate.
                    </p>
                )}
            </div>

            {view === 'flow' && canFlow ? (
                flowResult?.ok && flowResult.data ? (
                    <RankingsFlowTable data={flowResult.data} />
                ) : (
                    <div className="flex min-h-[40vh] items-center justify-center rounded-md border border-dashed">
                        <p className="text-sm text-muted-foreground">
                            Flow data is temporarily unavailable.
                        </p>
                    </div>
                )
            ) : (
                <RankingsTable
                    rows={rows}
                    scope={scope}
                />
            )}
        </main>
    );
}
