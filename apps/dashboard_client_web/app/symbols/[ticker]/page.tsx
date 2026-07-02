import type { Metadata } from 'next';
import { getSymbolDetail } from '@/app/actions/getSymbolDetail.action';

export const dynamic = 'force-dynamic';

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
    };
}

// /symbols/[ticker] — per-ticker detail: marketcap rank history + institutional holders.
// States:
//   backend error           → explicit error block
//   data:null (unknown/absent) → not-found block
//   populated               → rank table + holders table
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

    if (result.data === null) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">
                        {ticker.toUpperCase()} not found
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        No ranking history or institutional data is available
                        for this ticker.
                    </p>
                </div>
            </main>
        );
    }

    const { rankingHistory, holders, periodOfReport, sector } = result.data;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {holders.map((h) => (
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
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                ${(h.valueUsd / 1e6).toFixed(0)}
                                                M
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
