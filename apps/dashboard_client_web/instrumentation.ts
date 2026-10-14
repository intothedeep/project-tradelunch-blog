// instrumentation.ts
// Purpose: capture FULL server-side error detail (real message + stack) from
// RSC/SSR/Server-Action failures and forward to Express error-logs. The client
// error boundary only receives a REDACTED message + digest in production — this
// hook receives the un-redacted error with the SAME digest, making it the only
// reliable server-side ingest point. Best-effort only: must NEVER throw.
// Node.js runtime only; edge runtime is out of scope (errors are RSC/SSR/action).

import type { Instrumentation } from 'next';

import { originKeyHeaders, serverRequest } from '@/apis/http.server';
import { logServerError } from '@/utils/serverLog.util';

// Signature from next/dist/server/instrumentation/types.d.ts
// (InstrumentationOnRequestError): `error` is `unknown`, so the digest is read
// defensively. It is the same digest Next prints in its `⨯` line.
export const onRequestError: Instrumentation.onRequestError = async (
    err,
    request,
    context
) => {
    const error = err as Error & { digest?: string };
    // One timestamped JSON line, written before the best-effort POST below.
    logServerError('request error', err, {
        digest: error?.digest,
        path: request.path,
        method: request.method,
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
    });
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
            headers: originKeyHeaders(),
            fallbackError: 'log-error failed',
        });
    } catch {
        // Swallow everything — a logging path must never mask the original error.
    }
};
