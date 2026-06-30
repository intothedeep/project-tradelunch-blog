// app/funds/preview/page.tsx
// Purpose: fixture-backed preview of the /funds layout — renders the REAL
//   FundList + RankFlowTable components with mock data so the production
//   layout can be evaluated without a DB or running collector.
//   Mirrors the dashboard /dashboard/preview/table pattern exactly.
// No network calls, no DB access. Import mock data only.

import FundList from '@/components/funds/FundList';
import RankFlowTable from '@/components/funds/RankFlowTable';
import { MOCK_FUNDS, MOCK_RANK_FLOW } from '@/apis/getFunds.mock.api';

// Show Berkshire by default in the preview.
const PREVIEW_CIK = '0001067983';

const latestPeriod = MOCK_RANK_FLOW.periods[0]?.periodOfReport ?? '';

export default function FundsPreviewPage() {
    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
                Funds preview — fixture data
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
                Rendered with mock 13F rank-flow filings (2 quarters). Layout is
                identical to production.
            </p>

            <div className="flex gap-8">
                <aside className="w-64 shrink-0">
                    <FundList
                        funds={MOCK_FUNDS}
                        activeCik={PREVIEW_CIK}
                    />
                </aside>
                <section className="flex-1 min-w-0">
                    <header className="mb-4">
                        <h2 className="text-xl font-semibold">
                            Berkshire Hathaway Inc.
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Latest period: {latestPeriod} &middot;{' '}
                            {MOCK_RANK_FLOW.rows.length} tracked &middot;{' '}
                            {MOCK_RANK_FLOW.periods.length} quarters
                        </p>
                    </header>
                    <RankFlowTable data={MOCK_RANK_FLOW} />
                </section>
            </div>
        </main>
    );
}
