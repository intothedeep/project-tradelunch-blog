import { NextResponse, NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that require an authenticated user.
const isProtectedRoute = createRouteMatcher([
    '/onboarding(.*)',
    '/write(.*)',
    '/me(.*)',
    '/settings(.*)',
    '/admin(.*)',
]);

// The owner's personal finance surfaces. Now AUTH-GATED (auth.protect below):
// anonymous requests are bounced to sign-in before any SSR render → no Express
// call → no Supabase query. This is the egress control (a browser-UA-faking
// scraper campaign on 07-03..05 drove Supabase egress + Vercel Fluid CPU past
// their free limits; the UA regex alone could not stop a spoofed UA — requiring
// a session does). De-indexed (robots.ts). Blog routes are NOT here, so
// Googlebot keeps indexing posts. NOTE: this requires ANY authenticated user;
// true owner-only (block authed non-admins) needs is_admin in Clerk
// sessionClaims — a follow-up (is_admin currently lives only in the DB).
const isFinanceRoute = createRouteMatcher([
    '/dashboard(.*)',
    '/rankings(.*)',
    '/funds(.*)',
    '/screener(.*)',
    '/symbols(.*)',
    '/politicians(.*)',
    '/backtest(.*)',
]);

// Search + AI + SEO crawlers. A bot hitting a finance PAGE is 403'd here before
// any SSR render → no Express call → no Supabase query (egress control). UA is
// spoofable, so this stops honest bots (the bulk), not a browser-faking
// scraper; response caching is the backstop for the residual. Empty UA passes
// (too broad a signal to block).
const BOT_UA_RE =
    /bot\b|crawler|spider|crawling|slurp|googlebot|bingbot|duckduckbot|baiduspider|yandex|sogou|gptbot|chatgpt|ccbot|claudebot|anthropic|bytespider|perplexity|amazonbot|applebot|meta-externalagent|facebookexternalhit|semrush|ahrefs|mj12bot|dotbot|dataforseo|scrapy/i;

function isCrawler(req: NextRequest): boolean {
    const ua = req.headers.get('user-agent') ?? '';
    return ua !== '' && BOT_UA_RE.test(ua);
}

// Owner-only escalation for finance routes. Decoupled from code deploy via an
// env flag so enabling it can't lock the owner out before Clerk is configured:
//   OFF (default) → finance requires ANY authenticated session (stops anonymous
//                   scrapers, the egress driver — sufficient for the un-pause).
//   ON            → additionally require an admin session claim, so authed
//                   non-admins (e.g. blog commenters) are bounced too.
// `is_admin` lives only in the DB (Express resolveAuth), NOT in the Clerk token,
// so the edge cannot read it directly. To turn this ON:
//   1. Clerk dashboard → set publicMetadata `{ "isAdmin": true }` on the owner.
//   2. Clerk dashboard → Sessions → customize the session token to emit
//      `"metadata": { "isAdmin": "{{user.public_metadata.isAdmin}}" }`.
//   3. Set env `FINANCE_ADMIN_ONLY=true` (only AFTER 1+2, or the owner locks out).
const FINANCE_ADMIN_ONLY = process.env.FINANCE_ADMIN_ONLY === 'true';

// Reads the admin flag from the session token's custom `metadata` claim (see
// step 2 above). Absent/false → not admin. Cast is defensive: the claim shape is
// only known once the Clerk session-token template is configured.
function isAdminClaim(sessionClaims: unknown): boolean {
    const metadata = (sessionClaims as { metadata?: { isAdmin?: unknown } })
        ?.metadata;
    return metadata?.isAdmin === true;
}

// Pure locale resolution + cookie persistence. Mutates the given response and
// returns it. Kept identical in behavior to the previous standalone middleware.
function applyLocale(req: NextRequest, res: NextResponse): NextResponse {
    const { cookies, headers } = req;

    // 이미 locale 쿠키가 있으면 그대로 유지
    const savedLocale = cookies.get('locale')?.value;
    if (savedLocale) {
        res.cookies.set('locale', savedLocale, { path: '/' });
        return res;
    }

    // 브라우저 언어 감지
    const acceptLang = headers.get('accept-language') || '';
    const detectedRaw = acceptLang.split(',')[0]?.split('-')[0]; // ex. en-US -> en
    const detected = typeof detectedRaw === 'string' ? detectedRaw : '';

    const locale: string = ['en', 'ko'].includes(detected) ? detected : 'en';

    // 쿠키에 저장 (SSR 전역 접근 가능)
    res.cookies.set('locale', locale, { path: '/' });
    return res;
}

export default clerkMiddleware(async (auth, req) => {
    // Crawler gate: honest bots get a cheap 403 (no sign-in redirect chain)
    // before any SSR render. Finance is also auth-gated below, so a spoofed-UA
    // scraper that slips past this regex still can't reach Express/Supabase.
    if (isFinanceRoute(req) && isCrawler(req)) {
        return new NextResponse('Not available to automated crawlers.', {
            status: 403,
        });
    }

    if (isProtectedRoute(req)) {
        await auth.protect();
    }

    // Finance surfaces are owner tooling → require a session. Anonymous scrapers
    // (the egress driver) are bounced to sign-in before any render/DB read. When
    // FINANCE_ADMIN_ONLY is on, authed non-admins are bounced home too.
    if (isFinanceRoute(req)) {
        await auth.protect();
        if (FINANCE_ADMIN_ONLY) {
            const { sessionClaims } = await auth();
            if (!isAdminClaim(sessionClaims)) {
                return NextResponse.redirect(new URL('/', req.url));
            }
        }
    }

    const res = NextResponse.next();
    return applyLocale(req, res);
});

export const config = {
    matcher: [
        // Locale detection on page routes (skip _next, api, static files) —
        // preserves the previous middleware's reach.
        '/((?!_next|api|.*\\..*).*)',
        // Clerk's recommended matcher: always run on API/trpc routes.
        '/(api|trpc)(.*)',
    ],
};
