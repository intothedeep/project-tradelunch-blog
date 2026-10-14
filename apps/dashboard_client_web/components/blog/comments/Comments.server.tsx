// Comments.server.tsx — RSC entry for the post-detail comment thread.
// Purpose: fetch the FIRST PUBLIC comment page on the server (flat pre-order
//   array + cursor cursor metadata) and hand it to the client island as
//   initialData so the thread paints with the page; the island owns
//   interactivity (compose, reply, delete, "Load more", refetch).
// Constraints: server component (no "use client"); reads are public (no token).
//   ownerUsername (already @-stripped on the detail page) is passed so the
//   island can show the post-owner delete affordance.

import { getCommentsFirstPage } from '@/apis/getCommentsFirstPage.api';
import { unstable_rethrow } from 'next/navigation';
import { CommentsSection } from '@/components/blog/comments/CommentsSection.client';
import type { TCommentListResponse } from '@repo/types';

export const Comments = async ({
    postId,
    ownerUsername,
}: {
    postId: string;
    ownerUsername: string;
}) => {
    let initialPage: TCommentListResponse | undefined;
    try {
        initialPage = await getCommentsFirstPage(postId);
    } catch (error) {
        unstable_rethrow(error);
        // The island refetches client-side; a server fetch failure must not
        // break the post page. Render the section with no seed.
        initialPage = undefined;
    }

    return (
        <CommentsSection
            postId={postId}
            ownerUsername={ownerUsername}
            initialPage={initialPage}
        />
    );
};

export default Comments;
