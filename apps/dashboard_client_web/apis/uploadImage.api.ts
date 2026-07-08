// apis/uploadImage.api.ts
// Purpose: upload an editor image as multipart/form-data to the Express proxy,
// which resizes/re-validates and persists to Supabase Storage, returning the
// absolute public URL.
// Constraints: requires a Clerk bearer token. Returns ApiError on non-2xx; a
// 503 status specifically signals "storage not configured" so callers degrade
// gracefully. Browser-only (FormData needs the browser to set the multipart
// boundary). Supersedes signImageUpload.api.ts.
// Express POST /v1/api/posts/images returns { success, data: TImageUploadResponse }.
// Content-Type must NOT be set manually — the wrapper omits it for FormData so
// the browser sets the correct multipart boundary.

import { clientRequest } from '@/apis/http.client';
import type { TImageUploadResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TImageUploadResponse;
}

export async function uploadImage(
    token: string,
    file: File
): Promise<TImageUploadResponse> {
    const form = new FormData();
    form.append('file', file);

    const envelope = await clientRequest<TEnvelope>({
        path: '/v1/api/posts/images',
        method: 'POST',
        body: form,
        token,
        fallbackError: 'Failed to upload image',
    });
    return envelope.data;
}
