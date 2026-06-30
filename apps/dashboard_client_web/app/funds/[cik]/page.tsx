import type { Metadata } from 'next';
import { getFunds } from '@/app/actions/getFunds.action';
import { getFundHoldings } from '@/app/actions/getFundHoldings.action';
import FundList from '@/components/funds/FundList';
import HoldingsTable from '@/components/funds/HoldingsTable';

export const metadata: Metadata = {
    title: 'Fund Holdings | Taek Lim',
    description: 'SEC 13F holdings detail for a specific institutional filer.',
};

// Render per-request — holdings are DB-backed and updated monthly.
export const dynamic = 'force-dynamic';

interface FundDetailPageProps {
    params: Promise<{ cik: string }>;
}

// /funds/[cik] — fund detail view with a fund rail and holdings table.
// States:
//   backend error on funds list → explicit error block
//   backend error on holdings   → explicit error block
//   holdings data:null          → "Fund not found" state
//   populated                   → FundList(activeCik) + HoldingsTable
export default async function FundDetailPage({ params }: FundDetailPageProps) {
    const { cik } = await params;

    const [fundsResult, holdingsResult] = await Promise.all([
        getFunds(),
        getFundHoldings(cik),
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

    if (!holdingsResult.ok) {
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

    if (holdingsResult.data === null) {
        return (
            <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
                <div className="flex gap-8">
                    <aside className="w-64 shrink-0">
                        <FundList
                            funds={fundsResult.data}
                            activeCik={cik}
                        />
                    </aside>
                    <div className="flex min-h-[40vh] flex-1 items-center justify-center">
                        <div className="text-center">
                            <h1 className="text-lg font-semibold">
                                Fund not found
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                CIK {cik} is not in the holdings database.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    const { label, periodOfReport, holdings } = holdingsResult.data;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <div className="flex gap-8">
                <aside className="w-64 shrink-0">
                    <FundList
                        funds={fundsResult.data}
                        activeCik={cik}
                    />
                </aside>
                <section className="flex-1 min-w-0">
                    <header className="mb-4">
                        <h1 className="text-2xl font-bold tracking-tight">
                            {label}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Period of report: {periodOfReport} &middot;{' '}
                            {holdings.length.toLocaleString()} holdings
                        </p>
                    </header>
                    <HoldingsTable holdings={holdings} />
                </section>
            </div>
        </main>
    );
}
