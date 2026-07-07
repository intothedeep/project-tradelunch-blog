import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSymbolDetail } from '@/app/actions/getSymbolDetail.action';
import { buildDatasetLd, buildBreadcrumbLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/seo/JsonLd.server';
import { PriceChart } from '@/components/symbols/PriceChart';
import { PoliticianActivity } from '@/components/symbols/PoliticianActivity.client';
import { PoliticianHolders } from '@/components/symbols/PoliticianHolders.client';

export const revalidate = 3600; // ISR 1h — data is daily-refreshed; caps repeat-hit Supabase egress

interface SymbolDetailPageProps {
    params: Promise<{ ticker: string }>;
}

export async function generateMetadata({
    params,
}: SymbolDetailPageProps): Promise<Metadata> {
    const { ticker } = await params;
    const symbol = ticker.toUpperCase();
    return {
        title: `${symbol} | Taek Lim`,
        description: `Marketcap ranking history and institutional holders for ${symbol}.`,
        alternates: { canonical: `/symbols/${ticker}` },
    };
}

// Format weight percentage for display, e.g. "12.34%"
function fmtPct(v: number | null): string {
    return v !== null ? `${v.toFixed(2)}%` : '—';
}

// Format delta weight with ▲/▼ prefix, e.g. "▲ 1.20%" or "▼ 0.50%"
function fmtDelta(v: number | null): { label: string; color: string } | null {
    if (v === null) return null;
    const isUp = v >= 0;
    return {
        label: `${isUp ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}%`,
        color: isUp ? '#16a34a' : '#dc2626',
    };
}

// /symbols/[ticker] — per-ticker detail: marketcap rank history + institutional holders + price sparkline.
// States:
//   backend error              → explicit error block
//   data:null (unknown/absent) → notFound() (real 404)
//   populated                  → rank table + holders table + sparkline
export default async function SymbolDetailPage({
    params,
}: SymbolDetailPageProps) {
    const { ticker } = await params;
    const result = await getSymbolDetail(ticker);

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

    // Unknown ticker — backend explicitly returns null. Emit a real 404.
    if (result.data === null) {
        notFound();
    }

    const {
        rankingHistory,
        holders,
        periodOfReport,
        sector,
        priceHistory,
        politicianActivity,
        politicianHolders,
        secDerivatives,
    } = result.data;

    const symbol = ticker.toUpperCase();
    const description = `Marketcap rank history, institutional holders, and congressional trading data for ${symbol}.`;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <JsonLd
                data={[
                    buildDatasetLd({
                        name: `${symbol} market data`,
                        description,
                        url: `/symbols/${ticker}`,
                    }),
                    buildBreadcrumbLd([
                        { name: 'Home', url: '/' },
                        { name: symbol, url: `/symbols/${ticker}` },
                    ]),
                ]}
            />
            <header className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                    {ticker.toUpperCase()}
                </h1>
                {sector && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sector: {sector}
                    </p>
                )}
            </header>

            {/* Price chart */}
            <section className="mb-8 max-w-2xl">
                <h2 className="mb-3 text-xl font-semibold">Price (1Y)</h2>
                {priceHistory.length > 0 ? (
                    <PriceChart points={priceHistory} />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Price history not tracked for this symbol.
                    </p>
                )}
            </section>

            {/* Politician activity (migration 0022 — presence-guarded) */}
            {politicianActivity != null && politicianActivity.count90d > 0 && (
                <section className="mb-8 max-w-2xl">
                    <h2 className="mb-3 text-xl font-semibold">
                        Congressional Trading
                    </h2>
                    <PoliticianActivity
                        politicianActivity={politicianActivity}
                    />
                </section>
            )}

            {/* Politician transaction disclosures (migration 0023 — presence-guarded) */}
            {politicianHolders != null && politicianHolders.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-3 text-xl font-semibold">
                        Disclosed Transactions by Politicians
                    </h2>
                    <p className="mb-3 text-xs text-muted-foreground">
                        Past PTR transaction disclosures — not current
                        positions.
                    </p>
                    <PoliticianHolders politicianHolders={politicianHolders} />
                </section>
            )}

            <div className="grid gap-8 md:grid-cols-2">
                {/* Marketcap rank history */}
                <section>
                    <h2 className="mb-3 text-xl font-semibold">
                        Marketcap Rank History
                    </h2>
                    {rankingHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No ranking data available for this ticker.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="pb-2 text-left font-medium">
                                            Date
                                        </th>
                                        <th className="pb-2 text-right font-medium">
                                            Rank
                                        </th>
                                        <th className="pb-2 text-right font-medium">
                                            Mkt Cap
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingHistory.map((entry) => (
                                        <tr
                                            key={entry.asOf}
                                            className="border-b last:border-0"
                                        >
                                            <td className="py-2 tabular-nums">
                                                {entry.asOf}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                #{entry.rank}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                {entry.marketCap !== null
                                                    ? `$${(entry.marketCap / 1e9).toFixed(1)}B`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Institutional holders */}
                <section>
                    <h2 className="mb-3 text-xl font-semibold">
                        Institutional Holders
                    </h2>
                    {periodOfReport && (
                        <p className="mb-2 text-xs text-muted-foreground">
                            As of {periodOfReport} (latest 13F period)
                        </p>
                    )}
                    {holders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No institutional holders on record yet. This section
                            populates once the CUSIP&#8594;ticker mapping
                            (security_map) is seeded by the collector.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="pb-2 text-left font-medium">
                                            Fund
                                        </th>
                                        <th className="pb-2 text-right font-medium">
                                            Value (USD)
                                        </th>
                                        <th className="pb-2 text-right font-medium">
                                            Weight
                                        </th>
                                        <th className="pb-2 text-right font-medium">
                                            Δ Weight
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holders.map((h) => {
                                        const delta = fmtDelta(
                                            h.deltaWeightPct
                                        );
                                        return (
                                            <tr
                                                key={h.cik}
                                                className="border-b last:border-0"
                                            >
                                                <td className="py-2">
                                                    <span>{h.label}</span>
                                                    {h.isActiveManager && (
                                                        <span className="ml-2 inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                    {h.isNew && (
                                                        <span className="ml-1 inline-flex items-center rounded-sm bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                                                            NEW
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 text-right tabular-nums">
                                                    $
                                                    {(h.valueUsd / 1e6).toFixed(
                                                        0
                                                    )}
                                                    M
                                                </td>
                                                <td className="py-2 text-right tabular-nums text-muted-foreground">
                                                    {fmtPct(h.weightPct)}
                                                </td>
                                                <td className="py-2 text-right tabular-nums">
                                                    {delta ? (
                                                        <span
                                                            style={{
                                                                color: delta.color,
                                                            }}
                                                        >
                                                            {delta.label}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* 13F options exposure (migration 0027 — presence-guarded).
                    Quarterly, coarse derivatives sentiment — NOT gamma/GEX. */}
                {secDerivatives != null && (
                    <section>
                        <h2 className="mb-3 text-xl font-semibold">
                            Options Exposure (13F)
                        </h2>
                        <p className="mb-2 text-xs text-muted-foreground">
                            As of {secDerivatives.periodOfReport} ·{' '}
                            {secDerivatives.holderCount} filer
                            {secDerivatives.holderCount !== 1 ? 's' : ''} ·
                            disclosed option notional, not gamma exposure
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="rounded-md border px-3 py-2">
                                <div className="text-xs text-muted-foreground">
                                    Calls
                                </div>
                                <div className="tabular-nums font-semibold text-emerald-600">
                                    $
                                    {(
                                        secDerivatives.callValueUsd / 1e6
                                    ).toFixed(0)}
                                    M
                                </div>
                            </div>
                            <div className="rounded-md border px-3 py-2">
                                <div className="text-xs text-muted-foreground">
                                    Puts
                                </div>
                                <div className="tabular-nums font-semibold text-rose-600">
                                    $
                                    {(secDerivatives.putValueUsd / 1e6).toFixed(
                                        0
                                    )}
                                    M
                                </div>
                            </div>
                            <div className="rounded-md border px-3 py-2">
                                <div className="text-xs text-muted-foreground">
                                    Skew
                                </div>
                                <div className="font-semibold capitalize">
                                    {secDerivatives.netSkew.replace('_', ' ')}
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
