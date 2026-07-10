// utils/blog-author.ts
// Purpose: single source of truth for the site's default blog author.
// Used when no per-route / signed-in username is available.
// Env-driven (NEXT_PUBLIC_DEFAULT_BLOG_AUTHOR, default 'taeklim') so the owner
// username can change per deploy without a code edit.

import { DEFAULT_BLOG_AUTHOR as ENV_DEFAULT_BLOG_AUTHOR } from '@/env.schema';

export const DEFAULT_BLOG_AUTHOR = ENV_DEFAULT_BLOG_AUTHOR;

// TEMPORARY single-user home switch. While the site has one author, the root
// `/` feed focuses on this author's blog instead of the all-authors aggregate
// (which moves to `/blog`). To revert, set NEXT_PUBLIC_DEFAULT_BLOG_AUTHOR=''
// (empty) — `/` and the feed layout both branch on its truthiness.
export const HOME_FEED_AUTHOR = DEFAULT_BLOG_AUTHOR;

// Strip a single leading '@' from a route username segment.
export const stripUsernameAt = (raw: string): string =>
    raw.startsWith('@') ? raw.slice(1) : raw;
