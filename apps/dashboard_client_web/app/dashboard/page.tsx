import { Metadata } from 'next';
import { getDashboardSnapshot } from '@/app/actions/getDashboardSnapshot.action';
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
// dashboard, sourced live from Express via getDashboardSnapshot (next.revalidate
// 30min, in phase with the backend s-maxage). There is NO mock fallback — a
// backend failure is forwarded to error_log (source='ssr') inside the action and
// surfaced here as an explicit error state, so a broken backend stays visible
// instead of being masked by stale mock data. History is lazy + backend-sourced
// per selected label via useDashboardHistory.
export default async function DashboardPage() {
    const result = await getDashboardSnapshot();

    if (!result.ok) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-lg font-semibold">
                        Dashboard data is unavailable
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The market backend could not be reached. Please try
                        again shortly.
                    </p>
                </div>
            </main>
        );
    }

    return <ChartVariantLayout snapshot={result.data} />;
}
