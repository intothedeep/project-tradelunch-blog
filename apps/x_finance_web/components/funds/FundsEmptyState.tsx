// components/funds/FundsEmptyState.tsx
// Purpose: server-rendered empty state shown when no 13F filings have been
//   collected yet (e.g. migration unapplied or collector not yet run).
//   Provides a link to /funds/preview so the layout can be evaluated without data.
// Constraints: server component — no client hooks.
// Side effects: none.

import Link from 'next/link';

export default function FundsEmptyState() {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 max-w-md">
                <h2 className="text-base font-semibold text-foreground">
                    No 13F filings collected yet
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    SEC 13F institutional holdings will appear here once the
                    monthly collector has run and the migration has been
                    applied.
                </p>
                <Link
                    href="/funds/preview"
                    className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    View preview with fixture data
                </Link>
            </div>
        </div>
    );
}
