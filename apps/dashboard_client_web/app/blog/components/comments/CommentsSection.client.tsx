'use client';

// CommentsSection.client.tsx — the post-detail comment thread island.
// Purpose: render the public comment tree (seeded by the RSC, paginated 50 roots
//   per page) as a flat pre-order walk indented by depth, with render-collapse
//   beyond N visible levels (N=4 desktop, N=2 mobile); a top-level composer +
//   per-row reply composers (optimistic); inline edit (author/owner/admin);
//   delete via a focus-trapped Dialog; a bottom "Load more" control for the next
//   page. Body is PLAIN TEXT (escaped + line breaks preserved, NO markdown).
//   Tombstones render "[deleted]".
// Constraints: reads are public; writes require auth (composer redirects
//   signed-out). The client edit/delete gate (author/owner/admin) is UX only —
//   the server is authoritative. ids stay STRINGS.

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useComments } from '@/hooks/useComments.query.client';
import { useCreateComment } from '@/hooks/useCreateComment.query.client';
import { useDeleteComment } from '@/hooks/useDeleteComment.query.client';
import { useUpdateComment } from '@/hooks/useUpdateComment.query.client';
import { useMe } from '@/hooks/useMe.query.client';
import { useIsMobile } from '@/hooks/useIsMobile.hook';
import { buildRenderRows } from '@/utils/commentTree.util';
import { CommentComposer } from '@/app/blog/components/comments/CommentComposer.client';
import { CommentRow } from '@/app/blog/components/comments/CommentRow.client';
import { CommentsPagination } from '@/app/blog/components/comments/CommentsPagination.client';
import type { TComment, TCommentListResponse } from '@repo/types';

type Props = {
    postId: string;
    ownerUsername: string;
    initialPage?: TCommentListResponse;
};

export const CommentsSection: React.FC<Props> = ({
    postId,
    ownerUsername,
    initialPage,
}) => {
    const t = useTranslations('blog');
    const isMobile = useIsMobile();
    const maxDepth = isMobile ? 2 : 4;

    const {
        comments,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useComments(postId, initialPage);
    const { data: me } = useMe();
    const createComment = useCreateComment(postId);
    const deleteComment = useDeleteComment(postId);
    const updateComment = useUpdateComment(postId);

    const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
    const [editOpenId, setEditOpenId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(
        () => new Set()
    );

    const list = useMemo(() => comments, [comments]);

    // Parent lookup for the "@parent" reply prefix — every reply's parent is in
    // the loaded tree (pre-order, so the parent precedes the child).
    const byId = useMemo(() => {
        const m = new Map<string, TComment>();
        for (const c of list) m.set(c.id, c);
        return m;
    }, [list]);
    const parentHandle = (comment: TComment): string | undefined =>
        comment.parentId ? byId.get(comment.parentId)?.authorName : undefined;

    const rows = useMemo(
        () => buildRenderRows(list, maxDepth, expanded),
        [list, maxDepth, expanded]
    );

    // Edit/delete share one gate: comment author OR post owner OR admin.
    const canModify = (comment: TComment): boolean => {
        if (!me) return false;
        if (me.isAdmin) return true;
        if (me.username !== null && me.username === ownerUsername) return true;
        return (
            comment.authorName !== undefined &&
            me.username !== null &&
            comment.authorName === me.username
        );
    };

    const continueThread = (id: string) =>
        setExpanded((prev) => new Set(prev).add(id));

    return (
        <section
            aria-labelledby="comments-heading"
            className="mt-6 border-t border-primary/30 pt-4"
        >
            <h2
                id="comments-heading"
                className="mb-3 text-sm font-semibold"
            >
                {t('comments.heading', { count: list.length })}
            </h2>

            <div className="mb-4">
                <CommentComposer
                    onSubmit={(body) => createComment.mutate({ body })}
                    isPending={createComment.isPending}
                    placeholder={t('comments.composerPlaceholder')}
                />
            </div>

            {isError ? (
                <p
                    role="alert"
                    className="text-sm text-destructive"
                >
                    {t('comments.loadError')}
                </p>
            ) : list.length === 0 ? (
                <p className="text-sm text-primary/60">{t('comments.empty')}</p>
            ) : (
                <>
                    <ul role="list">
                        {rows.map((row) => (
                            <CommentRow
                                key={row.comment.id}
                                comment={row.comment}
                                replyingTo={parentHandle(row.comment)}
                                indent={row.indent}
                                hasHiddenChildren={row.hasHiddenChildren}
                                canDelete={canModify(row.comment)}
                                canEdit={canModify(row.comment)}
                                isReplyOpen={replyOpenId === row.comment.id}
                                isReplyPending={createComment.isPending}
                                isEditOpen={editOpenId === row.comment.id}
                                onToggleReply={() =>
                                    setReplyOpenId((prev) =>
                                        prev === row.comment.id
                                            ? null
                                            : row.comment.id
                                    )
                                }
                                onSubmitReply={(body) => {
                                    createComment.mutate({
                                        body,
                                        parentId: row.comment.id,
                                    });
                                    setReplyOpenId(null);
                                }}
                                onToggleEdit={() =>
                                    setEditOpenId((prev) =>
                                        prev === row.comment.id
                                            ? null
                                            : row.comment.id
                                    )
                                }
                                onSubmitEdit={(body) => {
                                    updateComment.mutate({
                                        commentId: row.comment.id,
                                        body,
                                    });
                                    setEditOpenId(null);
                                }}
                                onDelete={() =>
                                    deleteComment.mutate({
                                        commentId: row.comment.id,
                                    })
                                }
                                onContinueThread={() =>
                                    continueThread(row.comment.id)
                                }
                            />
                        ))}
                    </ul>

                    <CommentsPagination
                        hasNextPage={hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={() => void fetchNextPage()}
                    />
                </>
            )}
        </section>
    );
};
