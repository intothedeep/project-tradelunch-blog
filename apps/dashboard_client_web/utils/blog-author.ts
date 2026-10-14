// utils/blog-author.ts
// Purpose: single source of truth for the site's default blog author.
// Used when no per-route / signed-in username is available.
// Env-driven (NEXT_PUBLIC_DEFAULT_BLOG_AUTHOR, default 'taeklim') so the owner
// username can change per deploy without a code edit.

import { DEFAULT_BLOG_AUTHOR as ENV_DEFAULT_BLOG_AUTHOR } from '@/env.schema';

export const DEFAULT_BLOG_AUTHOR = ENV_DEFAULT_BLOG_AUTHOR;

// Menu owner handle (Projects, About, Resume in useNavLinks, owner pages). `/` is
// the all-authors feed (#81) and no longer reads this.
export const HOME_FEED_AUTHOR = DEFAULT_BLOG_AUTHOR;

// Strip a single leading '@' from a route username segment.
export const stripUsernameAt = (raw: string): string =>
    raw.startsWith('@') ? raw.slice(1) : raw;

// Build the canonical @-prefixed username URL segment (e.g. "@taeklim"). The '@'
// stays LITERAL (a valid path character, RFC 3986 pchar) — only the username is
// percent-encoded — so URLs read /@taeklim/logs/1, not /%40taeklim/logs/1. Accepts
// a raw username with or without a leading '@'.
export const toUsernameSegment = (username: string): string =>
    `@${encodeURIComponent(stripUsernameAt(username))}`;
