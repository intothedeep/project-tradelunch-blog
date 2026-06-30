'use server';

// app/actions/postPublish.action.ts
// Purpose: publish-class post mutations (status flip, delete, admin moderation)
// proxied server-side to Express, then feed tags revalidated so the cached
// anonymous feed refreshes immediately (read-your-writes via updateTag).
// Invariant: only status-changing transitions belong here; draft content edits
// + autosave stay on the client→axios path (no revalidation needed).
// Constraints: server-only ('use server'); token resolved here (Clerk), never
// passed by the client. updateTag is Server-Actions-only.

import { auth } from '@clerk/nextjs/server';
import { updateTag } from 'next/cache';
import { serverRequest } from '@/apis/http.server';
import type { TPostStatus, TAdminPostStatusInput } from '@repo/types';

// Resolve the caller's Clerk token; throw when absent (these are owner/admin
// mutations and must never run anonymously).
async function requireToken(): Promise<string> {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return token;
}

// Revalidate both the global feed and the author's feed so the cached
// anonymous SSR feed reflects the new status on the next read.
function revalidateFeed(username: string): void {
    for (const tag of ['feed:global', `feed:${username}`]) {
        updateTag(tag);
    }
}

export async function setPostStatusAction(
    postId: string,
    status: TPostStatus,
    username: string
): Promise<void> {
    const token = await requireToken();
    await serverRequest<void>({
        path: `/v1/api/posts/${postId}`,
        method: 'PATCH',
        body: { status },
        token,
        cache: 'no-store',
        fallbackError: 'Failed to update post',
    });
    revalidateFeed(username);
}

export async function deletePostAction(
    postId: string,
    username: string
): Promise<void> {
    const token = await requireToken();
    await serverRequest<void>({
        path: `/v1/api/posts/${postId}`,
        method: 'DELETE',
        token,
        cache: 'no-store',
        fallbackError: 'Failed to delete post',
    });
    revalidateFeed(username);
}

export async function setAdminPostStatusAction(
    postId: string,
    status: TPostStatus,
    username: string
): Promise<void> {
    const token = await requireToken();
    const body: TAdminPostStatusInput = { status };
    await serverRequest<void>({
        path: `/v1/api/admin/posts/${postId}/status`,
        method: 'PATCH',
        body,
        token,
        cache: 'no-store',
        fallbackError: 'Failed to update post status',
    });
    revalidateFeed(username);
}

export async function deleteAdminPostAction(
    postId: string,
    username: string
): Promise<void> {
    const token = await requireToken();
    await serverRequest<void>({
        path: `/v1/api/admin/posts/${postId}`,
        method: 'DELETE',
        token,
        cache: 'no-store',
        fallbackError: 'Failed to delete post',
    });
    revalidateFeed(username);
}
