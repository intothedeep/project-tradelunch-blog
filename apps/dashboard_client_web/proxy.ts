import {
    clerkMiddleware,
    createRouteMatcher,
    type ClerkMiddlewareAuth,
} from '@clerk/nextjs/server';
import {
    NextResponse,
    type NextFetchEvent,
    type NextRequest,
} from 'next/server';
import { DEFAULT_BLOG_AUTHOR } from '@/env.schema';
import { checkExists } from '@/apis/existence.proxy';
import { legacyRedirectPath } from '@/utils/legacyRedirect';
import {
    classifyGatePath,
    isDottedPath,
    isUnknownPath,
    NOT_FOUND_PATH,
    shouldCheck,
} from '@/utils/notFoundGate';
import { isOwnerHandle } from '@/utils/owner-handle';
import { PUBLIC_PATHS } from '@/utils/publicPaths.generated';

// Dotted paths that are real files: public/ (generated) and the two metadata routes.
const SERVED_FILES = new Set<string>([
    ...PUBLIC_PATHS,
    '/robots.txt',
    '/sitemap.xml',
]);

// Routes that require an authenticated user.
const isProtectedRoute = createRouteMatcher([
    '/onboarding(.*)',
    '/write(.*)',
    '/settings(.*)',
    '/admin(.*)',
    // `/@u/me` and `/@u/saved` are NOT listed: OwnerOnly 404s non-owners
    // (owner, 2026-10-14), so no sign-in redirect. The Cloudflare bypass
    // expression must still cover both (deploy/traffic/README.md).
]);

// CF2-0a (2026-09-22): the `locale` cookie and its Accept-Language detection
// were removed from here. They were WRITE-ONLY — `'locale'` appeared nowhere
// else in the app, and i18n/request.ts resolves from the getRequestConfig
// callback arg, which is always undefined without next-intl routing or a
// [locale] segment, so every visitor already rendered as 'en'. The cookie's
// only real effect was stamping `Set-Cookie` on every matched response
// (including the OG image route), which makes them uncacheable at any CDN —
// the outage this repo is recovering from. Korean stays available in
// messages/ko/*; reviving it needs an explicit switch UI, a new cookie name,
// and a matching Cloudflare bypass rule. Do not reintroduce silent
// Accept-Language detection: Cloudflare does not key the cache on `Vary`, so
// one visitor's language would be served to everyone.
//
// Request log (decision #58, traffic analysis): one JSON line per request on
// stdout, shipped by the Ops Agent. Cloudflare-cached hits never reach the
// origin, so these lines are MISSes only; static files outside the matcher are
// not logged. The IP is logged in full on purpose (owner, #58). Only the named
// fields are read: never Authorization or Cookie values (`signedIn` is just
// whether the Clerk `__session` cookie exists).
function toRequestLogLine(req: NextRequest) {
    const headers = req.headers;
    return {
        severity: 'INFO',
        // `message` matches blog-api's pino messageKey; Cloud Logging shows it as the summary.
        message: 'request',
        time: new Date().toISOString(),
        method: req.method,
        // nextUrl.host is the internal host behind the tunnel; the Host header is the public one.
        host: headers.get('host'),
        path: req.nextUrl.pathname,
        query: req.nextUrl.search,
        ip:
            headers.get('cf-connecting-ip') ??
            headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            null,
        country: headers.get('cf-ipcountry'),
        ray: headers.get('cf-ray'),
        ua: headers.get('user-agent'),
        referer: headers.get('referer'),
        // RSC navigation fetches vs full page loads.
        rsc: headers.get('rsc') === '1',
        signedIn: req.cookies.has('__session'),
    };
}

function rewriteToNotFound(req: NextRequest) {
    const url = req.nextUrl.clone();
    url.pathname = NOT_FOUND_PATH;
    return NextResponse.rewrite(url);
}

// Real 404 for unknown pages (cc.design.md §18). Under cacheComponents the page
// gates are Suspense leaves and can only answer 200 plus a not-found view, so
// the status is decided here, before render. A missing page is rewritten to a
// path that matches no route. Fail-open: API error or timeout passes the request
// through to the leaf gate. One JSON line per checked request; no token/cookie.
async function gateNotFound(auth: ClerkMiddlewareAuth, req: NextRequest) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return null;
    const gate = classifyGatePath(req.nextUrl.pathname);
    if (!gate) return null;
    const { userId, getToken } = await auth();
    const signedIn = Boolean(userId);
    const isRsc = req.headers.get('rsc') === '1';
    if (!shouldCheck({ signedIn, isRsc })) return null;

    const started = Date.now();
    const token = signedIn ? await getToken() : null;
    // Signed in but no token: cannot judge (would look anonymous). Pass through.
    const result =
        signedIn && !token ? 'unknown' : await checkExists(gate, token);
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.LOG_REQUESTS !== 'false') {
        console.log(
            JSON.stringify({
                severity: 'INFO',
                message: 'gate',
                kind: gate.kind,
                result,
                ms: Date.now() - started,
                signedIn,
                rsc: isRsc,
            })
        );
    }
    return result === 'missing' ? rewriteToNotFound(req) : null;
}

const clerk = clerkMiddleware(async (auth, req) => {
    // On in every environment like blog-api's pino; LOG_REQUESTS=false silences a noisy local session.
    // Runtime-only switch: it does not change build output, so it stays out of turbo.json.
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.LOG_REQUESTS !== 'false') {
        try {
            console.log(JSON.stringify(toRequestLogLine(req)));
        } catch {
            // Logging must never break a request.
        }
    }
    // Pure path check first: an unknown top-level path or a non-owner /@u/about
    // would otherwise render under ISR and 500 (cc.design.md section 18).
    if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        isUnknownPath(req.nextUrl.pathname, isOwnerHandle)
    )
        return rewriteToNotFound(req);
    const missing = await gateNotFound(auth, req);
    if (missing) return missing;
    if (isProtectedRoute(req)) {
        await auth.protect();
    }
});

// Legacy URLs 308 BEFORE Clerk, so the response carries no Set-Cookie or Clerk
// headers and Cloudflare may store it. The s-maxage matches the HTML edge TTL
// (deploy/traffic/README.md "web cache"). Query string kept; not request-logged.
export default function proxy(req: NextRequest, event: NextFetchEvent) {
    if (req.method === 'GET' || req.method === 'HEAD') {
        const to = legacyRedirectPath(
            req.nextUrl.pathname,
            DEFAULT_BLOG_AUTHOR
        );
        if (to) {
            const url = req.nextUrl.clone();
            url.pathname = to;
            const res = NextResponse.redirect(url, 308);
            res.headers.set('Cache-Control', 'public, s-maxage=86400');
            return res;
        }
        // Dotted path: a real file passes untouched (no Clerk, no cookies); any
        // other one is a 404 decided here, before it can reach [handle] (A2).
        if (isDottedPath(req.nextUrl.pathname))
            return SERVED_FILES.has(req.nextUrl.pathname)
                ? NextResponse.next()
                : rewriteToNotFound(req);
    }
    return clerk(req, event);
}

export const config = {
    matcher: [
        // Page routes (skip _next, api, trpc, favicon/). Dotted paths now reach the
        // proxy, which passes real files and 404s the rest (A2). Kept at this reach even
        // though locale detection is gone: narrowing it to protected routes
        // breaks the root ClerkProvider and any public RSC calling `auth()`,
        // which throw when the middleware has not run (CF2-0b, rejected).
        '/((?!_next|api|trpc|favicon/).*)',
        // Clerk's recommended matcher: always run on API/trpc routes.
        '/(api|trpc)(.*)',
    ],
};
