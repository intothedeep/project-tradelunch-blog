// app/screener/page.tsx
// Purpose: 13F consensus candidate screener page (Phase P, STEP 3 / P10).
//   Reads latest period from the backend and renders candidates scored by
//   consensus strength + cap tier. Each row with a resolved ticker links to
//   /symbols/<ticker>. Empty-state notes that candidates populate once
//   security_map is seeded by the collector.
// Invariant: Server Component only (no client state / hooks needed).
//   force-dynamic because searchParams drive the screener filters.
// Score = 0.4*consensus + 0.3*momentum + 0.2*capTier + 0.1*lowVol. momentum/
//   lowVol are [0,1] price signals normalised across the candidate set; they
//   render as "—" for securities outside the tracked price universe (partial
//   score, max 0.6) and are omitted from that row's sum.

import type { Metadata } from 'next';
import { getScreener } from '@/app/actions/getScreener.action';
import { ScreenerTable } from '@/components/screener/ScreenerTable';

export const dynamic = 'force-dynamic';

interface ScreenerSearchParams {
    minActiveHolders?: string;
    maxRank?: string;
    limit?: string;
}

// noindex filter-variant URLs (thin-content); canonical always folds to /screener.
export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<ScreenerSearchParams>;
}): Promise<Metadata> {
    const sp = await searchParams;
    const hasFilters = Object.values(sp).some((v) => v != null);

    return {
        title: 'Screener | Taek Lim',
        description:
            '13F consensus candidate screener — securities held by multiple active fund managers.',
        alternates: {
            canonical: '/screener',
        },
        robots: hasFilters
            ? { index: false, follow: true }
            : { index: true, follow: true },
    };
}

interface ScreenerPageProps {
    searchParams: Promise<ScreenerSearchParams>;
}

export default async function ScreenerPage({
    searchParams,
}: ScreenerPageProps) {
    const sp = await searchParams;

    const minActiveHolders =
        sp.minActiveHolders != null ? Number(sp.minActiveHolders) : undefined;
    const maxRank = sp.maxRank != null ? Number(sp.maxRank) : undefined;
    const limit = sp.limit != null ? Number(sp.limit) : undefined;

    const result = await getScreener({ minActiveHolders, maxRank, limit });

    if (!result.ok) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">
                        Data is unavailable
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The backend could not be reached. Please try again
                        shortly.
                    </p>
                </div>
            </main>
        );
    }

    if (result.data === null) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">
                        Screener data not yet available
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The 13F analytics views (migrations 0019–0020) are not
                        yet applied, or no holdings have been ingested.
                    </p>
                </div>
            </main>
        );
    }

    const { periodOfReport, totalActiveFunds, candidates } = result.data;
    const effectiveMin = minActiveHolders ?? 2;

    // Two data-availability tiers (NOT a quality ranking): candidates with both
    // price signals first, consensus-only (outside the tracked price universe)
    // after. Backend already sorts within each tier; filter preserves order.
    const fullSignal = candidates.filter((c) => c.hasPriceSignals);
    const consensusOnly = candidates.filter((c) => !c.hasPriceSignals);

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <header className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                    Consensus Screener
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    13F period: {periodOfReport} &middot; Active fund managers
                    tracked: {totalActiveFunds}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Score = 0.4 &times; consensus + 0.3 &times; momentum + 0.2
                    &times; cap tier + 0.1 &times; low-vol. Momentum &amp;
                    low-vol are normalised across candidates;
                    &ldquo;&mdash;&rdquo; means the security is outside the
                    tracked price universe (partial score).
                </p>
            </header>

            {candidates.length === 0 ? (
                <div className="rounded-lg border p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        No candidates match the current filters
                        (minActiveHolders=
                        {effectiveMin}
                        {maxRank ? `, maxRank=${maxRank}` : ''}). Candidates
                        populate once the CUSIP&#8594;ticker mapping
                        (security_map) is seeded by the collector and at least{' '}
                        {effectiveMin} active fund
                        {effectiveMin > 1 ? 's' : ''} share a position.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {fullSignal.length > 0 && (
                        <section>
                            <div className="mb-2 flex items-baseline gap-2">
                                <h2 className="text-lg font-semibold">
                                    Price-signal candidates
                                </h2>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                                    {fullSignal.length}
                                </span>
                            </div>
                            <p className="mb-3 text-xs text-muted-foreground">
                                Momentum &amp; volatility measured (in the
                                tracked price universe) — scored on all four
                                terms.
                            </p>
                            <ScreenerTable candidates={fullSignal} />
                        </section>
                    )}

                    {consensusOnly.length > 0 && (
                        <section>
                            <div className="mb-2 flex items-baseline gap-2">
                                <h2 className="text-lg font-semibold">
                                    Consensus-only
                                </h2>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                                    {consensusOnly.length}
                                </span>
                            </div>
                            <p className="mb-3 text-xs text-muted-foreground">
                                Outside the tracked price universe — momentum
                                &amp; low-vol not yet measured
                                (&ldquo;&mdash;&rdquo;). Ranked on consensus +
                                cap tier; promotes to the section above as price
                                coverage grows.
                            </p>
                            <ScreenerTable candidates={consensusOnly} />
                        </section>
                    )}
                </div>
            )}
        </main>
    );
}
