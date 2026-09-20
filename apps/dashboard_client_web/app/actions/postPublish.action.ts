'use server';

// app/actions/postPublish.action.ts
// Purpose: publish-class post mutations (status flip, delete, admin moderation)
// proxied server-side to Express. Feed freshness is now owned by Cloudflare
// (Cache-Control headers from Express), not Next tag revalidation.
// Invariant: only status-changing transitions belong here; draft content edits
// + autosave stay on the client→axios path.
// Constraints: server-only ('use server'); token resolved here (Clerk), never
// passed by the client.

import { auth } from '@clerk/nextjs/server';
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

// _username is kept in the signature so callers (which pass positionally) do
// not break. ESLint correctly flags it as unused — suppress at file scope
// rather than sprinkling four inline disables.
/* eslint-disable @typescript-eslint/no-unused-vars */

export async function setPostStatusAction(
    postId: string,
    status: TPostStatus,
    _username: string
): Promise<void> {
    const token = await requireToken();
    await serverRequest<void>({
        path: `/v1/api/posts/${postId}`,
        method: 'PATCH',
        body: { status },
        token,
        fallbackError: 'Failed to update post',
    });
}

export async function deletePostAction(
    postId: string,
    _username: string
): Promise<void> {
    const token = await requireToken();
    await serverRequest<void>({
        path: `/v1/api/posts/${postId}`,
        method: 'DELETE',
        token,
        fallbackError: 'Failed to delete post',
    });
}

export async function setAdminPostStatusAction(
    postId: string,
    status: TPostStatus,
    _username: string
): Promise<void> {
    const token = await requireToken();
    const body: TAdminPostStatusInput = { status };
    await serverRequest<void>({
        path: `/v1/api/admin/posts/${postId}/status`,
        method: 'PATCH',
        body,
        token,
        fallbackError: 'Failed to update post status',
    });
}

export async function deleteAdminPostAction(
    postId: string,
    _username: string
): Promise<void> {
    const token = await requireToken();
    await serverRequest<void>({
        path: `/v1/api/admin/posts/${postId}`,
        method: 'DELETE',
        token,
        fallbackError: 'Failed to delete post',
    });
}

/* eslint-enable @typescript-eslint/no-unused-vars */
