// Comments.server.tsx — RSC entry for the post-detail comment thread.
// Purpose: fetch the PUBLIC comment tree on the server (flat pre-order array)
//   and hand it to the client island as initialData so the thread paints with
//   the page; the island owns interactivity (compose, reply, delete, refetch).
// Constraints: server component (no "use client"); reads are public (no token).
//   ownerUsername (already @-stripped on the detail page) is passed so the
//   island can show the post-owner delete affordance.

import { getComments } from '@/apis/getComments.api';
import { CommentsSection } from '@/app/blog/components/comments/CommentsSection.client';

export const Comments = async ({
    postId,
    ownerUsername,
}: {
    postId: string;
    ownerUsername: string;
}) => {
    let initialComments;
    try {
        const { comments } = await getComments(postId);
        initialComments = comments;
    } catch {
        // The island refetches client-side; a server fetch failure must not
        // break the post page. Render the section with no seed.
        initialComments = undefined;
    }

    return (
        <CommentsSection
            postId={postId}
            ownerUsername={ownerUsername}
            initialComments={initialComments}
        />
    );
};

export default Comments;
