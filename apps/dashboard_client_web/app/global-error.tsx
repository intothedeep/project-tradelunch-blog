'use client'; // Error components must be Client Components

// global-error.tsx is the ROOT boundary: it replaces the whole document when the
// root layout itself throws, so (per Next.js) it MUST render its own
// <html>/<body>. Minimal by design — it only needs to stay alive long enough to
// report and offer a retry; the per-segment app/error.tsx handles everything below.
import { useEffect } from 'react';
import { reportError } from '@/utils/reportError.util';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        reportError(error, window.location.pathname);
    }, [error]);

    return (
        <html>
            <body>
                <div className="mx-auto max-w-2xl p-6 font-mono">
                    <h2 className="text-lg font-semibold">
                        Something went wrong
                    </h2>
                    {error.digest ? (
                        <p className="mt-2 text-sm">
                            digest: <code>{error.digest}</code>
                        </p>
                    ) : null}
                    <button
                        type="button"
                        onClick={reset}
                        className="mt-4 rounded-md border px-3 py-1 text-sm"
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
