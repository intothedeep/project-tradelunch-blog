// app/politicians/page.tsx
// Purpose: Browsable politician roster (Q6.4 route). Lists every filer with
//   search + party/chamber filters; each row links to /politicians/[filerId].
//   Previously the only way to reach a politician page was clicking through
//   from a symbol page — this is the missing index/browse entry point.
// Invariants:
//   - !ok (backend unreachable) → inline "unavailable" state, never a crash.
//   - data: [] (registry absent / pre-backfill) → friendly empty state.
//   - PoliticianDisclaimer always visible (PTR honesty contract).
//   - No dollar amounts; party/chamber/state chips neutral (handled in browser).
// Side effects: one Server Action fetch (24h-revalidated) per render.

import type { Metadata } from 'next';
import { getPoliticians } from '@/app/actions/getPoliticians.action';
import { buildBreadcrumbLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/seo/JsonLd.server';
import { PoliticianDisclaimer } from '@/components/symbols/PoliticianDisclaimer';
import { PoliticiansBrowser } from '@/components/politicians/PoliticiansBrowser.client';

export const metadata: Metadata = {
    title: 'Congressional Stock Trade Disclosures — Politician Directory',
    description:
        'Browse U.S. politicians by their disclosed stock trades (STOCK Act PTRs). Search by name or state, filter by party and chamber, and open any filer for their ticker breakdown and quarterly activity.',
    alternates: { canonical: '/politicians' },
};

export default async function PoliticiansIndexPage() {
    const result = await getPoliticians();

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <JsonLd
                data={[
                    buildBreadcrumbLd([
                        { name: 'Home', url: '/' },
                        { name: 'Politicians', url: '/politicians' },
                    ]),
                ]}
            />

            <header className="mb-6">
                <h1 className="text-xl font-semibold">Politician Directory</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Every filer with disclosed congressional stock trades.
                    Select one to see their ticker breakdown and quarterly
                    activity.
                </p>
            </header>

            {!result.ok ? (
                <div className="rounded border border-border p-8 text-center">
                    <h2 className="text-lg font-semibold">
                        Data is unavailable
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The backend could not be reached. Please try again
                        shortly.
                    </p>
                </div>
            ) : result.data.length === 0 ? (
                <div className="rounded border border-border p-8 text-center text-sm text-muted-foreground">
                    No politician disclosures are available yet.
                </div>
            ) : (
                <PoliticiansBrowser items={result.data} />
            )}

            <div className="mt-8">
                <PoliticianDisclaimer />
            </div>
        </main>
    );
}
