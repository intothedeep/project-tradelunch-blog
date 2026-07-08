import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes — the Clerk sign-in/up flows. Must bypass auth.protect() below,
// or redirecting an unauthenticated user to /sign-in would loop.
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

// finance_web is owner-only tooling — EVERY route requires an authenticated
// Clerk session. When FINANCE_ADMIN_ONLY is on (the default), it ALSO requires
// an admin session claim (sessionClaims.metadata.isAdmin === true).
//
// To activate the admin claim gate (needed for production owner-only):
//   a. Clerk dashboard → set publicMetadata `{ "isAdmin": true }` on owner.
//   b. Clerk dashboard → Sessions → customize token to emit
//      `"metadata": { "isAdmin": "{{user.public_metadata.isAdmin}}" }`.
//
// LOCAL DEV: set `FINANCE_ADMIN_ONLY=false` in .env.local BEFORE steps (a/b) are
// done, so any signed-in Clerk user (e.g. you) can reach the app without the
// claim. Leave it unset/true in production.
const FINANCE_ADMIN_ONLY = process.env.FINANCE_ADMIN_ONLY !== 'false';

function isAdminClaim(sessionClaims: unknown): boolean {
    const metadata = (sessionClaims as { metadata?: { isAdmin?: unknown } })
        ?.metadata;
    return metadata?.isAdmin === true;
}

export default clerkMiddleware(async (auth, req) => {
    // Sign-in/up pages are public — skip the gate to avoid a redirect loop.
    if (isPublicRoute(req)) {
        return NextResponse.next();
    }

    // Require any authenticated session (stops anonymous requests before SSR).
    await auth.protect();

    // Owner-only escalation — admin session claim required unless relaxed for local.
    if (FINANCE_ADMIN_ONLY) {
        const { sessionClaims } = await auth();
        if (!isAdminClaim(sessionClaims)) {
            // Non-admin authed users get a 403 rather than a redirect loop.
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        // Run on all page routes; skip _next internals and static files.
        '/((?!_next|.*\\..*).*)',
        // Always run on API/trpc routes.
        '/(api|trpc)(.*)',
    ],
};
