// apis/getPostById.api.ts
// Purpose: fetch a single post by id with the viewer's Clerk bearer token, so an
// owner's draft/private post returns its full row (INCLUDING `content`). The
// public slug route returns 404 for a non-public post to an anonymous viewer,
// which is what silently emptied the editor body — this owner-scoped by-id call
// is the correct hydration source for /write/<id>.
// Constraints: requires a bearer token; non-2xx (404 not-owner/not-found)
// surfaces as ApiError; pure I/O, no hidden state.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TPost } from '@/apis/blog.types';

// GET /v1/api/posts/:postid responds { success, data: post } — the row is
// snake_case, matching the read-side TPost shape.
type TPostByIdResponse = { success: boolean; data: TPost };

// The response interceptor unwraps `response.data`, so the resolved value is
// the JSON envelope; we return its `data` post row.
export async function getPostById(
    token: string,
    postId: number
): Promise<TPost> {
    try {
        const envelope = await axios_instance.get<unknown, TPostByIdResponse>(
            `/v1/api/posts/${postId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return envelope.data;
    } catch (error) {
        throw toApiError(error, 'Failed to load post');
    }
}
