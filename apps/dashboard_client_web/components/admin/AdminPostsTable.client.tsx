// components/admin/AdminPostsTable.client.tsx
// Purpose: admin moderation surface — paginated (load-more) list of all posts
// with per-row visibility/delete actions.
// Constraints: client-only. isAdmin guard here is UX only; the server
// requireAdmin check is the real authorization gate. All persistence is
// delegated to the query hooks (no direct fetching here).

'use client';

import { useMemo } from 'react';
import { useMe } from '@/hooks/useMe.query.client';
import { useAdminPosts } from '@/hooks/useAdminPosts.query.client';
import { useSetAdminPostStatus } from '@/hooks/useSetAdminPostStatus.query.client';
import { useDeleteAdminPost } from '@/hooks/useDeleteAdminPost.query.client';
import { cn } from '@/lib/utils';
import type { TAdminPostListItem } from '@repo/types';

function StatusBadge({ status }: { status: TAdminPostListItem['status'] }) {
    const tone =
        status === 'public'
            ? 'bg-green-100 text-green-800'
            : status === 'private'
              ? 'bg-zinc-200 text-zinc-700'
              : status === 'follower'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-amber-100 text-amber-800';
    return (
        <span
            className={cn(
                'inline-block rounded px-2 py-0.5 text-xs font-medium',
                tone
            )}
        >
            {status}
        </span>
    );
}

interface PostRowProps {
    post: TAdminPostListItem;
    onUnpublish: (id: string) => void;
    onRepublish: (id: string) => void;
    onDelete: (id: string) => void;
    isBusy: boolean;
}

function PostRow({
    post,
    onUnpublish,
    onRepublish,
    onDelete,
    isBusy,
}: PostRowProps) {
    return (
        <tr className="border-b border-zinc-100">
            <td className="px-3 py-2 text-sm text-zinc-600">
                {post.username ?? '—'}
            </td>
            <td className="px-3 py-2 text-sm font-medium text-zinc-900">
                {post.title}
            </td>
            <td className="px-3 py-2">
                <StatusBadge status={post.status} />
            </td>
            <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                    {post.status === 'public' ? (
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onUnpublish(post.id)}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                            Unpublish
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onRepublish(post.id)}
                            className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                            Re-publish
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onDelete(post.id)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    );
}

export function AdminPostsTable() {
    const me = useMe();
    const isAdmin = me.data?.isAdmin === true;

    const posts = useAdminPosts(isAdmin);
    const setStatus = useSetAdminPostStatus();
    const deletePost = useDeleteAdminPost();

    const items = useMemo<TAdminPostListItem[]>(
        () => posts.data?.pages.flatMap((page) => page.items) ?? [],
        [posts.data]
    );

    const isBusy = setStatus.isPending || deletePost.isPending;

    if (me.isLoading) {
        return <p className="p-6 text-sm text-zinc-500">Loading…</p>;
    }

    if (!isAdmin) {
        return (
            <p className="p-6 text-sm text-zinc-500">
                You do not have access to this page.
            </p>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-6">
            <h1 className="mb-4 text-xl font-semibold text-zinc-900">
                Post moderation
            </h1>

            {posts.isLoading ? (
                <p className="text-sm text-zinc-500">Loading posts…</p>
            ) : posts.isError ? (
                <p className="text-sm text-red-600">Failed to load posts.</p>
            ) : items.length === 0 ? (
                <p className="text-sm text-zinc-500">No posts.</p>
            ) : (
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-zinc-200 text-left">
                            <th className="px-3 py-2 text-xs font-medium uppercase text-zinc-500">
                                User
                            </th>
                            <th className="px-3 py-2 text-xs font-medium uppercase text-zinc-500">
                                Title
                            </th>
                            <th className="px-3 py-2 text-xs font-medium uppercase text-zinc-500">
                                Status
                            </th>
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((post) => (
                            <PostRow
                                key={post.id}
                                post={post}
                                isBusy={isBusy}
                                onUnpublish={(id) =>
                                    setStatus.mutate({
                                        postId: id,
                                        status: 'private',
                                    })
                                }
                                onRepublish={(id) =>
                                    setStatus.mutate({
                                        postId: id,
                                        status: 'public',
                                    })
                                }
                                onDelete={(id) => deletePost.mutate(id)}
                            />
                        ))}
                    </tbody>
                </table>
            )}

            {posts.hasNextPage && (
                <button
                    type="button"
                    disabled={posts.isFetchingNextPage}
                    onClick={() => posts.fetchNextPage()}
                    className="mt-4 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                    {posts.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
            )}
        </div>
    );
}
