'use client';

// Purpose: show the server-rendered author profile card only on /@u/posts
// (Q15). The card arrives as a prop so the server keeps rendering it; this
// component only decides visibility from the pathname. No state.
// Side effects: none.

import { usePathname } from 'next/navigation';
import { isPostsPath } from '@/utils/rail-visibility';

export const PostsProfileSlot = ({ card }: { card: React.ReactNode }) => {
    const pathname = usePathname();
    return isPostsPath(pathname) ? card : null;
};

export default PostsProfileSlot;
