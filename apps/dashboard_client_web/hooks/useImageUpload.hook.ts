// hooks/useImageUpload.hook.ts
// Purpose: sign + upload an editor image. Requests a Supabase signed-upload URL
// from our API, then PUTs the raw bytes directly to Supabase Storage (NOT
// through our API) and returns the resulting public URL.
// Constraints: client-only. A 503 from the sign step means the storage bucket
// is not configured (a per-user gate); upload is disabled gracefully in that
// case rather than thrown.

'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { signImageUpload } from '@/apis/signImageUpload.api';
import { ApiError } from '@/utils/apiError.util';

interface ImageUploadState {
    upload: (file: File) => Promise<string | null>;
    isUploading: boolean;
    isStorageDisabled: boolean;
    error: string | null;
}

export function useImageUpload(): ImageUploadState {
    const { getToken } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [isStorageDisabled, setIsStorageDisabled] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const upload = useCallback(
        async (file: File): Promise<string | null> => {
            setError(null);
            setIsUploading(true);
            try {
                const token = await getToken();
                if (!token) throw new Error('Not authenticated');

                const { signedUrl, publicUrl } = await signImageUpload(token, {
                    filename: file.name,
                    contentType: file.type,
                });

                const res = await fetch(signedUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': file.type },
                });
                if (!res.ok) {
                    throw new Error(`Upload failed: ${res.status}`);
                }

                return publicUrl;
            } catch (e) {
                if (e instanceof ApiError && e.status === 503) {
                    setIsStorageDisabled(true);
                    setError('이미지 저장소가 아직 설정되지 않았습니다.');
                    return null;
                }
                setError('이미지 업로드에 실패했습니다.');
                return null;
            } finally {
                setIsUploading(false);
            }
        },
        [getToken]
    );

    return { upload, isUploading, isStorageDisabled, error };
}
