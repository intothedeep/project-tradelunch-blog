// Purpose: deterministically render a post's calendar date as `yyyy-MM-dd`.
//
// WHY not date-fns `format`: it formats in the *runtime's* local timezone. Post
// dates come from the API as ISO-UTC strings (Postgres `TIMESTAMP` serialized
// with a trailing `Z`). On Vercel the SSR runtime is UTC while the browser is
// the visitor's local TZ (e.g. KST, +9). Around midnight the two produce a
// different `yyyy-MM-dd`, so server- and client-rendered text disagree →
// React hydration mismatch (error #418).
//
// Pure string slice = identical output on server and client, and it surfaces
// the canonical stored (UTC) calendar date.

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

export function formatPostDate(iso: string | undefined): string {
    if (!iso) return '';
    return ISO_DATE_PREFIX.test(iso) ? iso.slice(0, 10) : '';
}
