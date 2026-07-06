// app/backtest/preview/page.tsx
// Server Component — mock data preview path.
// Calls getMockPriceSeries() server-side and passes the fixture as a prop
// so the preview renders with zero backend dependency.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getMockPriceSeries } from '@/apis/getPriceSeries.mock.api';
import BacktestClient from '@/components/backtest/BacktestClient.client';

export const revalidate = 86400;

export const metadata: Metadata = {
    title: 'Backtest Preview | Taek Lim',
    robots: { index: false, follow: false },
};

export default function BacktestPreviewPage() {
    const mockedSeries = getMockPriceSeries();

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">
                    Asset Backtest
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Preview mode — using mock price series (JEPQ / QQQ / QLD
                    fixture).
                </p>
            </header>
            <Suspense
                fallback={
                    <p className="text-sm text-muted-foreground">Loading…</p>
                }
            >
                <BacktestClient mockedSeries={mockedSeries} />
            </Suspense>
        </main>
    );
}
