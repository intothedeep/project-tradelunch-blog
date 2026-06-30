// instrumentation.ts
// Purpose: capture FULL server-side error detail (real message + stack) from
// RSC/SSR/Server-Action failures and forward to Express error-logs. The client
// error boundary only receives a REDACTED message + digest in production — this
// hook receives the un-redacted error with the SAME digest, making it the only
// reliable server-side ingest point. Best-effort only: must NEVER throw.
// Node.js runtime only; edge runtime is out of scope (errors are RSC/SSR/action).

import { serverRequest } from '@/apis/http.server';

type NextInstrumentationRequest = {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
};

export async function onRequestError(
    error: Error & { digest?: string },
    request: NextInstrumentationRequest
): Promise<void> {
    try {
        const payload = {
            digest: error.digest ?? null,
            message: error.message,
            stack: error.stack,
            path: request.path,
            user_agent:
                (request.headers['user-agent'] as string | undefined) ?? null,
            source: 'ssr',
        };

        await serverRequest<void>({
            path: '/v1/api/error-logs',
            method: 'POST',
            body: payload,
            cache: 'no-store',
            fallbackError: 'log-error failed',
        });
    } catch {
        // Swallow everything — a logging path must never mask the original error.
    }
}
