// app/politicians/[filerId]/page.tsx
// Purpose: Per-politician profile: disclosed transactions per ticker + quarterly
//   timeline. Q6.3 route.
// Invariants:
//   - All USD amounts displayed as bands — never exact dollars (PTR contract).
//   - Party/chamber/state chips are neutral (grey/outline), never red/green.
//   - NEVER renders: held / own / position / portfolio language.
//   - Totals labeled "as reported by source" — these are source aggregates.
//   - data:null (unknown filerId / tables absent) → graceful not-found state.
//   - PoliticianDisclaimer + coverage footnote always visible.
//   - timeline empty (pre-backfill) → timeline section hidden entirely.
//   - committees absent/empty → committee section hidden entirely.
//   - committeeRelevant badge shown only when true; based on CURRENT membership.
// Side effects: one Server Action fetch per render.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getPolitician } from '@/app/actions/getPolitician.action';
import { PoliticianDisclaimer } from '@/components/symbols/PoliticianDisclaimer';
import { PoliticianTimeline } from '@/components/politicians/PoliticianTimeline.client';
import type { PoliticianTicker } from '@/types/politician';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ filerId: string }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { filerId } = await params;
    return {
        title: `Politician ${filerId} | Taek Lim`,
        description: `PTR transaction disclosures for ${filerId}.`,
    };
}

function NeutralChip({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {label}
        </span>
    );
}

function directionLabel(d: PoliticianTicker['netDirection']): string {
    if (d === 'buy_skew') return 'buy-skew';
    if (d === 'sell_skew') return 'sell-skew';
    return 'mixed';
}

const COMMITTEE_BADGE_TOOLTIP =
    'This filer currently sits on a committee whose jurisdiction covers ' +
    "this stock's sector. Based on CURRENT committee membership only — " +
    'historical assignments are not available. Not investment advice.';

export default async function PoliticianPage({ params }: PageProps) {
    const { filerId } = await params;
    const result = await getPolitician(filerId);

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
                        Politician not found
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        No disclosure data found for this filer.
                    </p>
                </div>
            </main>
        );
    }

    const { filer, tickers, timeline } = result.data;
    const hasCommittees =
        filer.committees !== undefined && filer.committees.length > 0;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            {/* Header */}
            <header className="mb-8 flex items-start gap-4">
                {filer.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={filer.photoUrl}
                        alt={filer.filerName}
                        className="h-20 w-20 rounded-full border border-border object-cover"
                    />
                )}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {filer.filerName}
                    </h1>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {filer.party && <NeutralChip label={filer.party} />}
                        {filer.chamber && <NeutralChip label={filer.chamber} />}
                        {filer.state && <NeutralChip label={filer.state} />}
                        {filer.office && <NeutralChip label={filer.office} />}
                    </div>

                    {/* Committee chips — current membership only (Phase Q) */}
                    {hasCommittees && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {filer.committees!.map((c) => (
                                <span
                                    key={c.thomasId}
                                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                    title="Current committee membership (historical not available)"
                                >
                                    {c.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Source-aggregate totals — labeled as-reported */}
                    <p className="mt-3 text-xs text-muted-foreground">
                        As reported by source &mdash;{' '}
                        {filer.tradeCount !== null && (
                            <span>{filer.tradeCount} transactions</span>
                        )}
                        {filer.purchases !== null && (
                            <span>
                                {' '}
                                &middot; {filer.purchases} purchase
                                {filer.purchases !== 1 ? 's' : ''}
                            </span>
                        )}
                        {filer.sales !== null && (
                            <span>
                                {' '}
                                &middot; {filer.sales} sale
                                {filer.sales !== 1 ? 's' : ''}
                            </span>
                        )}
                        {filer.lateFilings !== null &&
                            filer.lateFilings > 0 && (
                                <span>
                                    {' '}
                                    &middot; {filer.lateFilings} late filing
                                    {filer.lateFilings !== 1 ? 's' : ''}
                                </span>
                            )}
                        {filer.estVolumeBand !== '—' && (
                            <span>
                                {' '}
                                &middot; est.&nbsp;volume&nbsp;
                                {filer.estVolumeBand}
                            </span>
                        )}
                    </p>
                </div>
            </header>

            {/* Tickers table */}
            {tickers.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-3 text-xl font-semibold">
                        Disclosed Transactions by Ticker
                    </h2>
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50 text-muted-foreground">
                                    <th className="px-4 py-3 text-left font-medium">
                                        Ticker
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Disclosed&nbsp;amount
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        % of
                                        disclosed&nbsp;transaction&nbsp;volume
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Rank
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Direction
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Latest&nbsp;disclosure
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Trades
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickers.map((t) => (
                                    <tr
                                        key={t.ticker}
                                        className="border-b last:border-0 hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/symbols/${t.ticker}`}
                                                    className="font-mono font-semibold text-primary underline-offset-4 hover:underline"
                                                >
                                                    {t.ticker}
                                                </Link>
                                                {t.committeeRelevant && (
                                                    <span
                                                        className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                                        title={
                                                            COMMITTEE_BADGE_TOOLTIP
                                                        }
                                                    >
                                                        committee
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {t.disclosedValueBand}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {t.sharePctOfFilerVolume !== null
                                                ? `${t.sharePctOfFilerVolume.toFixed(1)}%`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {t.rankInFilerVolume !== null &&
                                            t.totalTickerCount !== null
                                                ? `#${t.rankInFilerVolume} of ${t.totalTickerCount}`
                                                : t.rankInFilerVolume !== null
                                                  ? `#${t.rankInFilerVolume}`
                                                  : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                {directionLabel(t.netDirection)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                            {t.latestDisclosure}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {t.tradeCount}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Quarterly timeline (Q12 — hidden when empty/pre-backfill) */}
            {timeline.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-3 text-xl font-semibold">
                        Quarterly Transaction Activity
                    </h2>
                    <PoliticianTimeline timeline={timeline} />
                </section>
            )}

            {/* Always-visible disclaimer */}
            <div className="mt-4">
                <PoliticianDisclaimer />
            </div>
        </main>
    );
}
