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
