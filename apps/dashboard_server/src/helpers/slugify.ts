// Purpose: derive a URL-safe slug from a post title.
// Invariants: output matches /^[a-z0-9-]+$/ (or the fallback) with no leading,
//             trailing, or repeated dashes.
// Constraints: deterministic, zero side effects.
const FALLBACK_SLUG = 'post';

export function slugify(title: string): string {
    const slug = title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || FALLBACK_SLUG;
}
