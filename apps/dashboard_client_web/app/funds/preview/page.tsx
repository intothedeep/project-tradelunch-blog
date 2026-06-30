// app/funds/preview/page.tsx
// Purpose: fixture-backed preview of the /funds layout — renders the REAL
//   FundList + HoldingsTable components with mock data so the production
//   layout can be evaluated without a DB or running collector.
//   Mirrors the dashboard /dashboard/preview/table pattern exactly.
// No network calls, no DB access. Import mock data only.

import FundList from '@/components/funds/FundList';
import HoldingsTable from '@/components/funds/HoldingsTable';
import { MOCK_FUNDS, PREVIEW_HOLDINGS } from '@/apis/getFunds.mock.api';

// Show Berkshire by default in the preview.
const PREVIEW_CIK = '0001067983';

export default function FundsPreviewPage() {
    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
                Funds preview — fixture data
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
                Rendered with mock 13F filings. Layout is identical to
                production.
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
                            {PREVIEW_HOLDINGS.label}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Period of report: {PREVIEW_HOLDINGS.periodOfReport}{' '}
                            &middot;{' '}
                            {PREVIEW_HOLDINGS.holdings.length.toLocaleString()}{' '}
                            holdings
                        </p>
                    </header>
                    <HoldingsTable holdings={PREVIEW_HOLDINGS.holdings} />
                </section>
            </div>
        </main>
    );
}
