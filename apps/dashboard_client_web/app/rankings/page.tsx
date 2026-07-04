import type { Metadata } from 'next';
import { getRankings } from '@/app/actions/getRankings.action';
import RankingsTable from '@/components/rankings/RankingsTable';
import RankingsFilter from '@/components/rankings/RankingsFilter.client';
import type { RankingScope } from '@/types/rankings';

export const metadata: Metadata = {
    title: 'Marketcap Rankings | Taek Lim',
    description:
        'Weekly market-capitalization rankings — global leaders and within-sector leaders.',
    alternates: {
        canonical: '/rankings',
    },
};

// Render per-request — rankings are DB-backed and refreshed weekly by the
// collector. force-dynamic prevents build-time baking + stale edge cache.
export const dynamic = 'force-dynamic';

interface RankingsPageProps {
    searchParams: Promise<{ scope?: string; sector?: string; asOf?: string }>;
}

// /rankings — weekly market-cap ranking viewer. States:
//   backend error → explicit error block (no mock fallback)
//   data null      → empty state (migration unapplied / collector not run)
//   populated      → scope/sector filter + rankings table
export default async function RankingsPage({
    searchParams,
}: RankingsPageProps) {
    const sp = await searchParams;
    const scope: RankingScope = sp.scope === 'sector' ? 'sector' : 'global';

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
    const isSinglePeriod = availableWeeks.length <= 1;

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
                <RankingsFilter
                    scope={scope}
                    sector={sector}
                    sectors={sectors}
                    asOf={asOf}
                    availableWeeks={availableWeeks}
                />
                {isSinglePeriod && (
                    <p className="text-xs text-muted-foreground">
                        Time-series view unlocks as weekly snapshots accumulate.
                    </p>
                )}
            </div>

            <RankingsTable
                rows={rows}
                scope={scope}
            />
        </main>
    );
}
