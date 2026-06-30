import { Metadata } from 'next';
import { getDashboardSnapshot } from '@/app/actions/getDashboardSnapshot.action';
import { MOCK_DASHBOARD_SNAPSHOT } from '@/apis/getDashboardSnapshot.mock.api';
import ChartVariantLayout from '@/components/dashboard/ChartVariantLayout.client';

export const metadata: Metadata = {
    title: 'Dashboard | Taek Lim',
    description:
        'Financial markets dashboard — interactive candlestick charts across FX, crypto, indices, rates and stocks.',
};

// Render per-request, never statically prerender. The watchlist snapshot is
// live DB data (collector refreshes it daily) — without this the route gets
// baked at build time, so it would serve a stale snapshot (e.g. pre-cleanup
// seed labels) from the Vercel edge cache until the next deploy.
export const dynamic = 'force-dynamic';

// Cycle 3 (page conversion): /dashboard renders the adopted Variant C trading
// dashboard. The snapshot is sourced through getDashboardSnapshot — gated by
// DASHBOARD_DATA_SOURCE (default 'mock'), so flipping to 'backend' switches the
// data with no code change. On any error we fall back to the mock snapshot so
// the page always renders. History is now lazy, backend-sourced per selected
// label, and gated by DASHBOARD_DATA_SOURCE via useDashboardHistory.
export default async function DashboardPage() {
    const result = await getDashboardSnapshot();
    const snapshot = result.ok ? result.data : MOCK_DASHBOARD_SNAPSHOT;

    return <ChartVariantLayout snapshot={snapshot} />;
}
