import type { Metadata } from 'next';
import { getFunds } from '@/app/actions/getFunds.action';
import FundList from '@/components/funds/FundList';
import FundsEmptyState from '@/components/funds/FundsEmptyState';

export const metadata: Metadata = {
    title: 'Funds | Taek Lim',
    description:
        'SEC 13F institutional holdings viewer — quarterly snapshots of major fund managers.',
};

// Render per-request — 13F data is DB-backed and updated monthly by the
// collector. Without force-dynamic this route is baked at build time and
// serves stale (or absent) data from the Vercel edge cache until next deploy.
export const dynamic = 'force-dynamic';

// /funds — top-level fund list. States:
//   backend error → explicit error block (no mock fallback)
//   empty list     → FundsEmptyState (migration unapplied / collector not run)
//   populated      → FundList + hint to pick a fund
export default async function FundsPage() {
    const result = await getFunds();

    if (!result.ok) {
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

    if (result.data.length === 0) {
        return (
            <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
                <h1 className="text-2xl font-bold tracking-tight mb-6">
                    13F Holdings
                </h1>
                <FundsEmptyState />
            </main>
        );
    }

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-6">
                13F Holdings
            </h1>
            <div className="w-full max-w-sm">
                <FundList funds={result.data} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
                Select a fund to view its holdings.
            </p>
        </main>
    );
}
