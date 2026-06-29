// Purpose: PURE array transform for the "recently viewed" localStorage list.
// Invariant: post ids are full-precision Snowflake STRINGs — compared as STRINGs,
// NEVER Number()/parseInt. De-dupe by id, move-to-front (newest first), cap.
// Constraints: deterministic, no side effects (storage I/O lives in the hook).

import type { TRecentPost } from '@/apis/blog.types';

export const RECENTS_CAP = 20;

// Insert `post` at the front, removing any existing entry with the same id
// (string comparison), then cap the list length.
export const addRecent = (
    list: readonly TRecentPost[],
    post: TRecentPost,
    cap: number = RECENTS_CAP
): TRecentPost[] => {
    const id = String(post.id);
    const withoutDup = list.filter((entry) => String(entry.id) !== id);
    return [post, ...withoutDup].slice(0, cap);
};
