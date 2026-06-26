import { NextResponse, NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that require an authenticated user.
const isProtectedRoute = createRouteMatcher([
    '/write(.*)',
    '/settings(.*)',
    '/admin(.*)',
]);

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
