// _scripts/perf/clerk-session.mjs
// Purpose: a signed-in session for the perf script WITHOUT the owner's browser.
// Flow (Clerk production instance, read the key from the app env file):
//   1. Backend API   POST /v1/sign_in_tokens    one-use ticket for the owner user
//   2. Frontend API  POST /v1/client/sign_ins   strategy=ticket -> new session + __client cookie
//   3. Frontend API  POST /v1/client/sessions/<sid>/tokens   -> session JWT (lives 60 s)
// The JWT is re-minted when older than 40 s. close() revokes the session the
// script created (and only that one) so no stray session stays in Clerk.
// Secrets: CLERK_SECRET_KEY is read here and sent only to api.clerk.com. It is
// never printed or written. The JWT and cookies stay in memory. Errors print the
// HTTP status and Clerk error codes only.
import { readFileSync } from 'node:fs';

const REFRESH_MS = 40_000;

function readEnvFile(path) {
    const env = {};
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
}

function fail(step, res, body) {
    const codes = (body?.errors ?? []).map((e) => e.code).join(',');
    throw new Error(`clerk ${step}: HTTP ${res.status} ${codes}`);
}

// Parse Set-Cookie names/values we need (name=value only; attributes dropped).
function cookiePairs(res) {
    const jar = {};
    for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const i = pair.indexOf('=');
        jar[pair.slice(0, i)] = pair.slice(i + 1);
    }
    return jar;
}

export async function openClerkSession({ envFile, username, origin }) {
    const env = readEnvFile(envFile);
    const secret = env.CLERK_SECRET_KEY;
    const publishable = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (!secret?.startsWith('sk_live_') || !publishable?.startsWith('pk_live_')) {
        throw new Error(`need live Clerk keys in ${envFile}`);
    }
    // pk_live_<base64(frontend-api-host + '$')>
    const fapi = `https://${Buffer.from(publishable.split('_')[2], 'base64')
        .toString()
        .replace('$', '')}`;
    const backend = { Authorization: `Bearer ${secret}` };
    const json = { 'Content-Type': 'application/json' };
    const form = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin, // becomes the token's `azp`; the API allow-list must contain it
        'User-Agent': 'Mozilla/5.0 (compatible; cc-perf-measure/1)',
    };

    let res = await fetch(
        `https://api.clerk.com/v1/users?username=${encodeURIComponent(username)}`,
        { headers: backend }
    );
    const users = await res.json();
    if (!res.ok) fail('users', res, users);
    if (users.length !== 1) throw new Error(`clerk users: ${users.length} match "${username}"`);

    res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
        method: 'POST',
        headers: { ...backend, ...json },
        body: JSON.stringify({ user_id: users[0].id, expires_in_seconds: 300 }),
    });
    const ticket = await res.json();
    if (!res.ok) fail('sign_in_tokens', res, ticket);

    res = await fetch(`${fapi}/v1/client/sign_ins`, {
        method: 'POST',
        headers: form,
        body: new URLSearchParams({ strategy: 'ticket', ticket: ticket.token }),
    });
    const signIn = await res.json();
    if (!res.ok) fail('sign_ins', res, signIn);
    const sessionId = signIn.client.sessions[0].id;
    const jar = cookiePairs(res);
    const suffix = Object.keys(jar)
        .find((k) => k.startsWith('__client_uat_'))
        ?.slice('__client_uat_'.length);

    let jwt = null;
    let mintedAt = 0;
    async function cookieHeader() {
        if (!jwt || Date.now() - mintedAt > REFRESH_MS) {
            const r = await fetch(`${fapi}/v1/client/sessions/${sessionId}/tokens`, {
                method: 'POST',
                headers: { ...form, Cookie: `__client=${jar.__client}` },
            });
            const body = await r.json();
            if (!r.ok) fail('tokens', r, body);
            jwt = body.jwt;
            mintedAt = Date.now();
        }
        // Plain and suffixed names: the Clerk SDK reads the suffixed one first.
        const pairs = [`__session=${jwt}`, `__client_uat=${jar.__client_uat}`];
        if (suffix) {
            pairs.push(`__session_${suffix}=${jwt}`, `__client_uat_${suffix}=${jar.__client_uat}`);
        }
        return pairs.join('; ');
    }

    async function close() {
        const r = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}/revoke`, {
            method: 'POST',
            headers: backend,
        });
        return r.status;
    }

    return { cookieHeader, close };
}
