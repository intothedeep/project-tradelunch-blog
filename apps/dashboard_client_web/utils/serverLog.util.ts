// utils/serverLog.util.ts
// Purpose: one JSON line per server-side error, same shape as proxy.ts's request
// log (`time`, `severity`, `message`), so `pm2 logs` shows WHEN it happened and
// the Ops Agent parse_json lifts `severity` into Cloud Logging.
// Server-only: never import from a "use client" module.
// Not gated by LOG_REQUESTS: that switch silences request noise, not errors.

type TSeverity = 'ERROR' | 'WARNING';

type TErrorSummary = { name?: string; message: string; code?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

// Next/undici wrap the real network failure: `TypeError: fetch failed` carries
// `cause` (often an AggregateError with code ETIMEDOUT). The code is the part
// that tells timeouts from refusals, so it is lifted out of the cause.
function summarize(value: unknown): TErrorSummary {
    if (!isRecord(value)) return { message: String(value) };
    return {
        name: typeof value.name === 'string' ? value.name : undefined,
        message:
            typeof value.message === 'string' ? value.message : String(value),
        code: typeof value.code === 'string' ? value.code : undefined,
    };
}

export function toErrorLogLine(
    severity: TSeverity,
    message: string,
    err?: unknown,
    context: Record<string, unknown> = {}
) {
    return {
        // Fixed keys come last so a stray context key cannot overwrite them.
        ...context,
        time: new Date().toISOString(),
        severity,
        message,
        ...(err === undefined ? {} : { err: summarize(err) }),
        ...(isRecord(err) && err.cause !== undefined
            ? { cause: summarize(err.cause) }
            : {}),
    };
}

export function logServerError(
    message: string,
    err?: unknown,
    context?: Record<string, unknown>,
    severity: TSeverity = 'ERROR'
): void {
    try {
        console.error(
            JSON.stringify(toErrorLogLine(severity, message, err, context))
        );
    } catch {
        // Logging must never break a request.
    }
}
