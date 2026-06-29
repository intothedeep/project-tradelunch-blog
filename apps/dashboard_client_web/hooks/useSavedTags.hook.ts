'use client';

// Purpose: client hook owning the "saved tags" list, persisted to localStorage
// (key `ph:savedTags`). Mutations go through the PURE reducers (cap 50, tags
// canonicalized lowercase + de-duped case-insensitively).
// SSR-safety: state starts EMPTY so server and first client paint agree; the
// stored value is read in useEffect after mount.
// Side effects: localStorage read/write (client only).

import { useCallback, useEffect, useState } from 'react';
import {
    addSavedTag,
    removeSavedTag,
    isSavedTag,
} from '@/utils/savedTags.util';

const STORAGE_KEY = 'ph:savedTags';

const readStored = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((t): t is string => typeof t === 'string')
            : [];
    } catch {
        return [];
    }
};

const persist = (next: string[]): void => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // storage full / unavailable — degrade to in-memory only.
    }
};

export const useSavedTags = () => {
    const [savedTags, setSavedTags] = useState<string[]>([]);

    useEffect(() => {
        setSavedTags(readStored());
    }, []);

    const saveTag = useCallback((tag: string) => {
        setSavedTags((prev) => {
            const next = addSavedTag(prev, tag);
            persist(next);
            return next;
        });
    }, []);

    const unsaveTag = useCallback((tag: string) => {
        setSavedTags((prev) => {
            const next = removeSavedTag(prev, tag);
            persist(next);
            return next;
        });
    }, []);

    const isSaved = useCallback(
        (tag: string) => isSavedTag(savedTags, tag),
        [savedTags]
    );

    return { savedTags, saveTag, unsaveTag, isSaved };
};

export default useSavedTags;
