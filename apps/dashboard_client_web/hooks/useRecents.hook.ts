'use client';

// Purpose: client hook owning the "recently viewed" posts list, persisted to
// localStorage (key `ph:recents`). Mutations go through the PURE addRecent
// reducer (cap 20, STRING-id move-to-front de-dupe).
// SSR-safety: state starts EMPTY so the server paint and first client paint
// agree (no hydration mismatch); the stored value is read in useEffect after
// mount. Side effects: localStorage read/write (client only).

import { useCallback, useEffect, useState } from 'react';
import type { TRecentPost } from '@/apis/blog.types';
import { addRecent } from '@/utils/recents.util';

const STORAGE_KEY = 'ph:recents';

const readStored = (): TRecentPost[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as TRecentPost[]) : [];
    } catch {
        return [];
    }
};

export const useRecents = () => {
    const [recents, setRecents] = useState<TRecentPost[]>([]);

    // Hydrate from storage after mount (never during render/SSR).
    useEffect(() => {
        setRecents(readStored());
    }, []);

    const recordRecent = useCallback((post: TRecentPost) => {
        setRecents((prev) => {
            const next = addRecent(prev, post);
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // storage full / unavailable — degrade to in-memory only.
            }
            return next;
        });
    }, []);

    return { recents, recordRecent };
};

export default useRecents;
