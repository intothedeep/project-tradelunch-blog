// utils/ssrFetchLog.util.ts
// Purpose: one JSON line per Next-server fetch to the Express API (Phase CC U0a,
// cc.design.md §5.4). Counting these lines in a render's time window gives
// "server fetches per MISS render" (QW1 metric); `ms` is the fetch-side time.
// Same shape as proxy.ts's request log so the Ops Agent ships it unchanged.
// Logged: pathname (no query string), method, status, ms, whether a token was
// sent. Never the token, cookies, headers or body.
// Browser calls pass straight through: only the Next server runtime logs.
// Silenced by LOG_REQUESTS=false like the request log (decision #58).

type TSsrFetchMeta = { path: string; method: string; hasToken: boolean };

function writeLine(meta: TSsrFetchMeta, status: number, ms: number): void {
    try {
        console.log(
            JSON.stringify({
                severity: 'INFO',
                message: 'ssr_fetch',
                time: new Date().toISOString(),
                method: meta.method,
                path: meta.path.split('?')[0],
                status,
                ms,
                auth: meta.hasToken,
            })
        );
    } catch {
        // Logging must never break a request.
    }
}

export async function withSsrFetchLog(
    meta: TSsrFetchMeta,
    run: () => Promise<Response>
): Promise<Response> {
    // Runtime-only switch: it does not change build output, so it stays out of turbo.json.
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (typeof window !== 'undefined' || process.env.LOG_REQUESTS === 'false') {
        return run();
    }
    const start = performance.now();
    let status = 0; // 0 = no response (timeout, refused)
    try {
        const res = await run();
        status = res.status;
        return res;
    } finally {
        writeLine(meta, status, Math.round(performance.now() - start));
    }
}
