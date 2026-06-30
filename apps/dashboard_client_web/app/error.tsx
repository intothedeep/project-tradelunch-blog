'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { reportError } from '@/utils/reportError.util';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // TEMP debug visibility (until the error_log table feature lands). In
        // prod, server-render error message/stack are REDACTED — `digest` is the
        // key to find the real error in the server (Vercel) logs.
        console.error('[error-boundary] digest:', error.digest);
        console.error('[error-boundary] message:', error.message);
        console.error('[error-boundary] stack:', error.stack);
        // Persist to the error_log sink (best-effort, never throws).
        reportError(error, window.location.pathname);
    }, [error]);

    return (
        <div className="mx-auto max-w-2xl p-6 font-mono">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            {error.digest ? (
                <p className="mt-2 text-sm text-muted-foreground">
                    digest: <code>{error.digest}</code>
                </p>
            ) : null}
            <h3 className="mt-2 text-sm">{error.message}</h3>
            {error.stack ? (
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
                    {error.stack}
                </pre>
            ) : null}
            <button
                type="button"
                onClick={reset}
                className="mt-4 rounded-md border border-border px-3 py-1 text-sm transition-colors hover:bg-accent/50"
            >
                Try again
            </button>
        </div>
    );
}
