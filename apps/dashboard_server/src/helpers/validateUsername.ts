// Purpose: pure validation of a requested blog username/slug.
// Invariants: matches the `@username` slug convention (lowercase a-z, 0-9, _),
//             length 3-30, and is not a reserved route segment.
// Constraints: deterministic, zero side effects. Input is trimmed first.
type TValidateUsernameResult =
    | { ok: true; value: string }
    | { ok: false; reason: string };

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

const RESERVED_USERNAMES = new Set<string>([
    'admin',
    'api',
    'me',
    'write',
    'settings',
    'dashboard',
    'blog',
    'onboarding',
    'sign-in',
    'sign-up',
]);

export function validateUsername(raw: string): TValidateUsernameResult {
    const value = raw.trim();
    if (!USERNAME_PATTERN.test(value)) {
        return {
            ok: false,
            reason: 'username must be 3-30 characters of lowercase letters, numbers, or underscore',
        };
    }
    if (RESERVED_USERNAMES.has(value)) {
        return { ok: false, reason: 'username is reserved' };
    }
    return { ok: true, value };
}
