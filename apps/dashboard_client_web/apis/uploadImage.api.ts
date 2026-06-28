// apis/uploadImage.api.ts
// Purpose: upload an editor image as multipart/form-data to the Express proxy,
// which resizes/re-validates and persists to Supabase Storage, returning the
// absolute public URL.
// Constraints: requires a Clerk bearer token. Returns ApiError on non-2xx; a
// 503 status specifically signals "storage not configured" so callers degrade
// gracefully. Browser-only (FormData needs the browser to set the multipart
// boundary). Supersedes signImageUpload.api.ts.

import axios_instance from '@/apis/axios_instance';
import { toApiError } from '@/utils/apiError.util';
import type { TImageUploadResponse } from '@repo/types';

export async function uploadImage(
    token: string,
    file: File
): Promise<TImageUploadResponse> {
    const form = new FormData();
    form.append('file', file);

    try {
        // The instance default Content-Type is application/json, which would
        // make axios serialize the FormData to JSON. Setting multipart/form-data
        // here keeps the body as FormData; axios' browser adapter then strips
        // it and lets the browser set the boundary. Never set a boundary by hand.
        return await axios_instance.post<unknown, TImageUploadResponse>(
            '/v1/api/posts/images',
            form,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    } catch (error) {
        throw toApiError(error, 'Failed to upload image');
    }
}
