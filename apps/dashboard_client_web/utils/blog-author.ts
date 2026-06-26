// utils/blog-author.ts
// Purpose: single source of truth for the site's default blog author.
// Used when no per-route / signed-in username is available.

export const DEFAULT_BLOG_AUTHOR = 'taeklim';

// Strip a single leading '@' from a route username segment.
export const stripUsernameAt = (raw: string): string =>
    raw.startsWith('@') ? raw.slice(1) : raw;
