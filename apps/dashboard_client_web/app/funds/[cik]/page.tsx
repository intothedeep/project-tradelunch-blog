import type { Metadata } from 'next';
import { getFunds } from '@/app/actions/getFunds.action';
import { getFundRankFlow } from '@/app/actions/getFundRankFlow.action';
import FundList from '@/components/funds/FundList';
import PageMenuRegistrar from '@/components/PageMenuRegistrar.client';
import RankFlowTable from '@/components/funds/RankFlowTable';
import FundsEmptyState from '@/components/funds/FundsEmptyState';

export const metadata: Metadata = {
    title: 'Fund Holdings | Taek Lim',
    description:
        'SEC 13F holdings rank-flow detail for a specific institutional filer.',
};

// Render per-request — holdings are DB-backed and updated monthly.
export const dynamic = 'force-dynamic';

interface FundDetailPageProps {
    params: Promise<{ cik: string }>;
}

// /funds/[cik] — fund detail view with rank-flow holdings grid.
// States:
//   backend error on funds list → explicit error block
//   backend error on rankflow   → explicit error block
//   rankflow data:null          → FundsEmptyState (unknown CIK)
//   periods empty               → FundsEmptyState (no quarters yet)
//   populated                   → FundList(activeCik) + RankFlowTable
export default async function FundDetailPage({ params }: FundDetailPageProps) {
    const { cik } = await params;

    const [fundsResult, rankFlowResult] = await Promise.all([
        getFunds(),
        getFundRankFlow(cik),
    ]);

    if (!fundsResult.ok) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">
                        Funds data is unavailable
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The backend could not be reached. Please try again
                        shortly.
                    </p>
                </div>
            </main>
        );
    }

    if (!rankFlowResult.ok) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">
                        Holdings data is unavailable
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The backend could not be reached. Please try again
                        shortly.
                    </p>
                </div>
            </main>
        );
    }

    if (
        rankFlowResult.data === null ||
        rankFlowResult.data.periods.length === 0
    ) {
        return (
            <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
                <div className="md:flex md:gap-8">
                    <aside className="hidden md:block w-64 shrink-0">
                        <FundList
                            funds={fundsResult.data}
                            activeCik={cik}
                        />
                    </aside>
                    <div className="flex-1 min-w-0">
                        {/* Mobile: contribute the fund list to the hamburger chooser. */}
                        <PageMenuRegistrar label="Funds">
                            <FundList
                                funds={fundsResult.data}
                                activeCik={cik}
                            />
                        </PageMenuRegistrar>
                        <div className="flex min-h-[40vh] items-center justify-center">
                            <FundsEmptyState />
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    const { cik: fundCik, periods, rows } = rankFlowResult.data;
    // periods.length > 0 is guaranteed by the guard above; safe to use ?. with fallback.
    const latestPeriodOfReport = periods[0]?.periodOfReport ?? '';
    const fundLabel =
        fundsResult.data.find((f) => f.cik === fundCik)?.label ?? fundCik;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <div className="md:flex md:gap-8">
                <aside className="hidden md:block w-64 shrink-0">
                    <FundList
                        funds={fundsResult.data}
                        activeCik={cik}
                    />
                </aside>
                <section className="flex-1 min-w-0">
                    {/* Mobile: contribute the fund list to the hamburger chooser. */}
                    <PageMenuRegistrar label="Funds">
                        <FundList
                            funds={fundsResult.data}
                            activeCik={cik}
                        />
                    </PageMenuRegistrar>
                    <header className="mb-4">
                        <h1 className="text-2xl font-bold tracking-tight">
                            {fundLabel}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Latest period: {latestPeriodOfReport} &middot;{' '}
                            {rows.length} tracked &middot; {periods.length}{' '}
                            quarter
                            {periods.length !== 1 ? 's' : ''}
                        </p>
                    </header>
                    <RankFlowTable data={rankFlowResult.data} />
                </section>
            </div>
        </main>
    );
}
