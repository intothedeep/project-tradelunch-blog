'use client';

// Purpose: record-on-view side effect for a post detail page. Mounted (invisibly)
// inside the server PostContentCard with a minimal post summary; on mount it
// pushes that summary into the recently-viewed localStorage list (H5.2). Renders
// nothing. Re-records only when the post id changes.
// Side effects: localStorage write (via useRecents), once per post id on mount.

import { useEffect } from 'react';
import type { TRecentPost } from '@/apis/blog.types';
import { useRecents } from '@/hooks/useRecents.hook';

export const RecordRecentView = ({ post }: { post: TRecentPost }) => {
    const { recordRecent } = useRecents();

    useEffect(() => {
        recordRecent(post);
        // Re-run only on a different post (id is the stable identity).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [post.id]);

    return null;
};

export default RecordRecentView;
