// apis/existence.proxy.ts
// Purpose: existence probe for the proxy 404 gate (cc.design.md §18).
// Runs in proxy.ts, before render. Deliberately not built on http.server.ts
// (`server-only`, React cache(), SSR fetch log). Fail-open: only a 404 is
// 'missing'; any other status, error or timeout is 'unknown' and the request
// passes. Never logs or returns the token.

import { API_BASE } from '@/env.schema';
import { isLogId, type TGatePath } from '@/utils/notFoundGate';

export type TExistence = 'found' | 'missing' | 'unknown';

const TIMEOUT_MS = 1500;

function buildPath(gate: Exclude<TGatePath, { kind: 'ownerOnly' }>): string {
    const u = encodeURIComponent(gate.username);
    if (gate.kind === 'user') return `/v1/api/posts/users/${u}/profile`;
    if (gate.kind === 'project')
        return `/v1/api/posts/users/${u}/projects/${encodeURIComponent(gate.project)}`;
    if (gate.kind === 'log')
        return `/v1/api/log/thread/${encodeURIComponent(gate.logId)}?limit=1`;
    return `/v1/api/posts/slug/${encodeURIComponent(gate.slug)}`;
}

async function fetchApi(
    path: string,
    token: string | null
): Promise<Response | null> {
    // Runtime-only secret read; same header serverRequest sends (http.server.ts).
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const originKey = process.env.ORIGIN_KEY;
    try {
        return await fetch(`${API_BASE}${path}`, {
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(originKey ? { 'x-origin-key': originKey } : {}),
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        return null;
    }
}

function toExistence(res: Response | null): TExistence {
    if (!res) return 'unknown';
    if (res.status === 404) return 'missing';
    return res.ok ? 'found' : 'unknown';
}

// `/@u/me` and `/@u/saved`: anonymous never exists (no network). Signed-in
// compares the token's username to the handle, as OwnerOnly does.
async function checkOwnerOnly(
    username: string,
    token: string | null
): Promise<TExistence> {
    if (!token) return 'missing';
    const res = await fetchApi('/v1/api/users/me', token);
    if (!res || !res.ok) return 'unknown';
    try {
        const body = (await res.json()) as {
            data?: { username?: string | null };
        };
        const own = body.data?.username;
        if (typeof own !== 'string') return 'unknown';
        return own === username ? 'found' : 'missing';
    } catch {
        return 'unknown';
    }
}

// `/@u/logs/<id>`: a malformed id is missing with no network. Otherwise the log
// must exist and belong to the handle (the page redirects a foreign handle to
// the author's URL; the gate answers 404 instead, #115). A deleted log has a
// masked authorUsername (null): the page renders its tombstone, so it is found.
async function checkLog(
    gate: Extract<TGatePath, { kind: 'log' }>,
    token: string | null
): Promise<TExistence> {
    if (!isLogId(gate.logId)) return 'missing';
    const res = await fetchApi(buildPath(gate), token);
    const existence = toExistence(res);
    if (existence !== 'found' || !res) return existence;
    try {
        const body = (await res.json()) as {
            data?: { focus?: { authorUsername?: string | null } };
        };
        const author = body.data?.focus?.authorUsername;
        if (author === null) return 'found';
        if (typeof author !== 'string') return 'unknown';
        return author === gate.username ? 'found' : 'missing';
    } catch {
        return 'unknown';
    }
}

export async function checkExists(
    gate: TGatePath,
    token: string | null
): Promise<TExistence> {
    if (gate.kind === 'ownerOnly') return checkOwnerOnly(gate.username, token);
    if (gate.kind === 'log') return checkLog(gate, token);
    // Dev-only switch: mock project names do not exist in the real API, so the
    // gate would 404 them. 'unknown' lets the request through (fail-open).
    if (
        gate.kind === 'project' &&
        process.env.PROJECTS_DATA_SOURCE === 'mock'
    ) {
        return 'unknown';
    }
    return toExistence(await fetchApi(buildPath(gate), token));
}
