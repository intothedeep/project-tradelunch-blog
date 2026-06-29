// utils/blog-author.ts
// Purpose: single source of truth for the site's default blog author.
// Used when no per-route / signed-in username is available.

export const DEFAULT_BLOG_AUTHOR = 'taeklim';

// TEMPORARY single-user home switch. While the site has one author, the root
// `/` feed focuses on this author's blog instead of the all-authors aggregate
// (which moves to `/blog`). This is the ONLY change needed to revert: set it to
// '' to restore the multi-user aggregate home — `/` and the feed layout both
// branch on its truthiness.
export const HOME_FEED_AUTHOR = DEFAULT_BLOG_AUTHOR;

// Strip a single leading '@' from a route username segment.
export const stripUsernameAt = (raw: string): string =>
    raw.startsWith('@') ? raw.slice(1) : raw;
