// utils/reportError.util.ts
// Purpose: fire-and-forget client reporter for error-boundary failures. It posts
// the caught error to the Next ingest route (/api/log-error), which forwards it
// server-to-server to Express. WHY fire-and-forget + keepalive: a boundary may
// fire during navigation/unload, so the request must survive the page tearing
// down and must NEVER throw or reject into the boundary's render — every failure
// is swallowed.
type TReportableError = Error & { digest?: string };

export function reportError(error: TReportableError, path: string): void {
    const payload = {
        digest: error.digest,
        message: error.message,
        stack: error.stack,
        path,
        user_agent:
            typeof navigator !== 'undefined' ? navigator.userAgent : null,
        source: 'browser',
    };

    void fetch('/api/log-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
    }).catch(() => {});
}
