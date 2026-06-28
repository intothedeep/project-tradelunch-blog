// hooks/useImageUpload.hook.ts
// Purpose: upload an editor image. Resizes the file in the browser, then POSTs
// it (multipart) to the Express proxy, which persists to Supabase Storage and
// returns the public URL.
// Constraints: client-only. A 503 from the upload means the storage bucket is
// not configured (a per-user gate); upload is disabled gracefully in that case
// rather than thrown.

'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { uploadImage } from '@/apis/uploadImage.api';
import { resizeImage } from '@/utils/resizeImage';
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

                const resized = await resizeImage(file);
                const { publicUrl } = await uploadImage(token, resized);

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
