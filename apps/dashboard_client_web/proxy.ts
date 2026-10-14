import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
    NextResponse,
    type NextFetchEvent,
    type NextRequest,
} from 'next/server';
import { DEFAULT_BLOG_AUTHOR } from '@/env.schema';
import { legacyRedirectPath } from '@/utils/legacyRedirect';

// Routes that require an authenticated user.
const isProtectedRoute = createRouteMatcher([
    '/onboarding(.*)',
    '/write(.*)',
    '/me(.*)',
    '/settings(.*)',
    '/admin(.*)',
    // `/@u/saved` (also `%40u`): the viewer's own list (PJ-2-02). A RegExp
    // because path-to-regexp strings treat '@' and '*' awkwardly. Keep the
    // Cloudflare bypass expression in step (deploy/traffic/README.md, PJ-2-04).
    /^\/(@|%40)[^/]+\/saved\/?$/i,
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
    }
    return clerk(req, event);
}

export const config = {
    matcher: [
        // Page routes (skip _next, api, static files). Kept at this reach even
        // though locale detection is gone: narrowing it to protected routes
        // breaks the root ClerkProvider and any public RSC calling `auth()`,
        // which throw when the middleware has not run (CF2-0b, rejected).
        '/((?!_next|api|.*\\..*).*)',
        // Clerk's recommended matcher: always run on API/trpc routes.
        '/(api|trpc)(.*)',
    ],
};
