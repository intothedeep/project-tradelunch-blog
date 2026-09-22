import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that require an authenticated user.
const isProtectedRoute = createRouteMatcher([
    '/onboarding(.*)',
    '/write(.*)',
    '/me(.*)',
    '/settings(.*)',
    '/admin(.*)',
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
export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) {
        await auth.protect();
    }
});

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
