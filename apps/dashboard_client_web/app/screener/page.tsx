// app/screener/page.tsx
// Purpose: 13F consensus candidate screener page (Phase P, STEP 3 / P10).
//   Reads latest period from the backend and renders candidates scored by
//   consensus strength + cap tier. Each row with a resolved ticker links to
//   /symbols/<ticker>. Empty-state notes that candidates populate once
//   security_map is seeded by the collector.
// Invariant: Server Component only (no client state / hooks needed).
//   force-dynamic because searchParams drive the screener filters.
// DEFERRED: momentum + lowVol terms (score max = 0.6 until price-history
//   joins are available). Score components are displayed explicitly as null.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getScreener } from '@/app/actions/getScreener.action';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Screener | Taek Lim',
    description:
        '13F consensus candidate screener — securities held by multiple active fund managers.',
};

interface ScreenerPageProps {
    searchParams: Promise<{
        minActiveHolders?: string;
        maxRank?: string;
        limit?: string;
    }>;
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
                    Score = 0.4 &times; consensus + 0.2 &times; cap tier
                    (max&nbsp;0.6). Momentum &amp; low-vol terms deferred until
                    security_map is seeded.
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
                                    Score
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {candidates.map((c) => (
                                <tr
                                    key={c.cusip}
                                    className="border-b last:border-0 hover:bg-muted/30"
                                >
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
                                        {c.rank !== null ? `#${c.rank}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {(c.components.consensus * 100).toFixed(
                                            0
                                        )}
                                        %
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {c.components.capTier === 1
                                            ? 'Top 20'
                                            : c.components.capTier === 0.5
                                              ? 'Top 100'
                                              : c.rank === null
                                                ? 'No data'
                                                : 'Other'}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                                        {c.score.toFixed(3)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}
