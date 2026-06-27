// Comments.server.tsx — RSC entry for the post-detail comment thread.
// Purpose: fetch the FIRST PUBLIC comment page on the server (flat pre-order
//   array + cursor cursor metadata) and hand it to the client island as
//   initialData so the thread paints with the page; the island owns
//   interactivity (compose, reply, delete, "Load more", refetch).
// Constraints: server component (no "use client"); reads are public (no token).
//   ownerUsername (already @-stripped on the detail page) is passed so the
//   island can show the post-owner delete affordance.

import { getComments } from '@/apis/getComments.api';
import { CommentsSection } from '@/app/blog/components/comments/CommentsSection.client';
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
        initialPage = await getComments(postId, { limit: 50 });
    } catch {
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
