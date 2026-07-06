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

// The owner's personal finance surfaces — public to human browsers but
// de-indexed (robots.ts) and crawler-gated below. Blog routes are NOT here, so
// Googlebot keeps indexing posts.
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
    // Crawler gate: block bots from the de-indexed finance pages before any SSR
    // render, so bot traffic never reaches Express/Supabase. Humans pass.
    if (isFinanceRoute(req) && isCrawler(req)) {
        return new NextResponse('Not available to automated crawlers.', {
            status: 403,
        });
    }

    if (isProtectedRoute(req)) {
        await auth.protect();
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
