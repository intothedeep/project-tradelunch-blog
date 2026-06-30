// app/api/log-error/route.ts
// Purpose: browser-side error-boundary ingest. The Next SSR server has NO DB
// access by design, so this handler is a thin forwarder: it relays the reported
// error payload server-to-server to Express (POST /v1/api/error-logs, the sole
// Supabase owner) WITHOUT a token (the Express endpoint is public). It is
// best-effort logging — it must NEVER surface a new error to the caller, so it
// always answers 204, even when JSON parsing or the forward fails.
import { serverRequest } from '@/apis/http.server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        await serverRequest<void>({
            path: '/v1/api/error-logs',
            method: 'POST',
            body,
            cache: 'no-store',
            fallbackError: 'failed to forward error log',
        });
    } catch {
        // Swallow everything (bad JSON, Express down, timeout). A logging path
        // must not itself become a source of errors.
    }
    return new Response(null, { status: 204 });
}
