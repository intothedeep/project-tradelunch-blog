import 'server-only';

// apis/reportSsrError.server.ts
// Purpose: forward an SSR-side fetch failure to Express's error_log sink
//   (POST /v1/api/error-logs, source='ssr'). The Next SSR server has NO DB
//   access by design (see migration 0014) — Express is the sole Supabase owner.
// Invariant: NEVER throws. If the backend is the thing that's down, this POST
//   also fails and we simply drop the report — telemetry is best-effort.
// Side effects: one fire-and-forget network POST.

import { API_BASE } from '@/env.schema';

const ERROR_LOG_ENDPOINT = '/v1/api/error-logs';

export async function reportSsrError(
    message: string,
    path: string
): Promise<void> {
    // Capture the SSR call chain so source='ssr' rows carry a stack (they
    // otherwise hold only message+path). Not the original throw for parse
    // failures, but it pinpoints the failing action/render path.
    const stack = new Error(message).stack;
    try {
        await fetch(`${API_BASE}${ERROR_LOG_ENDPOINT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, path, stack, source: 'ssr' }),
            cache: 'no-store',
        });
    } catch {
        // swallow — best-effort, must never surface to the caller
    }
}
