// app/backtest/page.tsx
// Server Component — real data path.
// De-indexed like other finance surfaces (robots.ts + middleware.ts).

import type { Metadata } from 'next';
import { Suspense } from 'react';
import BacktestClient from '@/components/backtest/BacktestClient.client';

export const revalidate = 86400;

export const metadata: Metadata = {
    title: 'Asset Backtest | Taek Lim',
    description:
        'Lump-sum buy-and-hold backtest with DRIP, Monte Carlo projection, and income analysis.',
    robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
    },
    alternates: { canonical: '/backtest' },
};

export default function BacktestPage() {
    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                    Asset Backtest
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Lump-sum buy-and-hold · per-asset DRIP · Monte Carlo 10-year
                    projection
                </p>
            </header>
            <Suspense
                fallback={
                    <p className="text-sm text-muted-foreground">Loading…</p>
                }
            >
                <BacktestClient />
            </Suspense>
        </main>
    );
}
