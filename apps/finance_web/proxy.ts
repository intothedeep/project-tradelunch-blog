import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

// finance_web is owner-only tooling — EVERY route requires:
//   1. An authenticated Clerk session.
//   2. An admin session claim (sessionClaims.metadata.isAdmin === true).
//
// To activate the admin claim gate:
//   a. Clerk dashboard → set publicMetadata `{ "isAdmin": true }` on owner.
//   b. Clerk dashboard → Sessions → customize token to emit
//      `"metadata": { "isAdmin": "{{user.public_metadata.isAdmin}}" }`.
//
// Without step (a/b) every authed user is bounced; complete them before deploy.

function isAdminClaim(sessionClaims: unknown): boolean {
    const metadata = (sessionClaims as { metadata?: { isAdmin?: unknown } })
        ?.metadata;
    return metadata?.isAdmin === true;
}

export default clerkMiddleware(async (auth, req) => {
    // Require any authenticated session (stops anonymous requests before SSR).
    await auth.protect();

    // Require admin session claim — finance is owner-only.
    const { sessionClaims } = await auth();
    if (!isAdminClaim(sessionClaims)) {
        // Non-admin authed users get a 403 rather than a redirect loop.
        return new NextResponse('Forbidden', { status: 403 });
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
