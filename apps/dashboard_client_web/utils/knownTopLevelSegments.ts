// Static top-level URL segments that have their own route under app/. Anything
// else that is not `@handle` falls into (shell)/[handle], renders under ISR and
// 500s on `notFound()` (cc.design.md section 18, recover candidate A). Kept free
// of imports so _scripts/cc/check-known-top-level.mjs can load it with plain
// node and compare it with the app/ folders on every CI run.
export const KNOWN_TOP_LEVEL_SEGMENTS = [
    'admin',
    'api',
    'onboarding',
    'sign-in',
    'sign-up',
    'tags',
    'write',
] as const;

// Real route shape per known segment, read from app/ (full-path depth counts the
// segment itself). A known segment at any other depth has no route, falls into
// (shell)/[handle] and 500s on `notFound()`, so the proxy answers 404 first.
// `second` limits the 2nd segment where only fixed children exist.
export type TRouteShape = {
    minDepth: number;
    maxDepth: number;
    second?: readonly string[];
};

export const TOP_LEVEL_ROUTE_SHAPES: Record<
    (typeof KNOWN_TOP_LEVEL_SEGMENTS)[number],
    TRouteShape
> = {
    admin: { minDepth: 2, maxDepth: 2, second: ['posts'] },
    api: { minDepth: 2, maxDepth: 2, second: ['log-error'] },
    onboarding: { minDepth: 1, maxDepth: 1 },
    // Clerk catch-all pages: any depth.
    'sign-in': { minDepth: 1, maxDepth: Infinity },
    'sign-up': { minDepth: 1, maxDepth: Infinity },
    tags: { minDepth: 2, maxDepth: 2 },
    write: { minDepth: 1, maxDepth: 2 },
};
