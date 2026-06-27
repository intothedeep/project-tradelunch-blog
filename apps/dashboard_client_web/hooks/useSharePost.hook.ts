'use client';

// Purpose: share a blog post via the Web Share API with a clipboard fallback.
// Invariants: builds the canonical absolute post URL from NEXT_PUBLIC_SITE_URL.
// Constraints: no navigation, no throwing; user-cancel (AbortError) and any
//   unsupported/denied path fail silently (no COPIED feedback on failure).
// Side effects: navigator.share / navigator.clipboard.writeText + a transient
//   `isCopied` flag that auto-resets.

import { useCallback, useEffect, useRef, useState } from 'react';

const COPIED_RESET_MS = 1500;
const SITE_URL_FALLBACK = 'https://my.prettylog.com';

type ShareInput = {
    username?: string;
    slug?: string;
    title?: string;
};

type ShareApi = {
    share: () => Promise<void>;
    isCopied: boolean;
    canShare: boolean;
};

const buildPostUrl = (username: string, slug: string): string => {
    const base = (
        process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_FALLBACK
    ).replace(/\/+$/, '');
    return `${base}/blog/@${username}/${slug}`;
};

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

export const useSharePost = ({
    username,
    slug,
    title,
}: ShareInput): ShareApi => {
    const [isCopied, setIsCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const canShare = Boolean(username && slug);

    useEffect(
        () => () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        },
        []
    );

    const flashCopied = useCallback(() => {
        setIsCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(
            () => setIsCopied(false),
            COPIED_RESET_MS
        );
    }, []);

    const share = useCallback(async () => {
        if (!username || !slug) return;
        if (typeof navigator === 'undefined') return;

        const url = buildPostUrl(username, slug);

        if (navigator.share) {
            try {
                await navigator.share({ title, url });
            } catch (error) {
                if (isAbortError(error)) return; // user cancelled — silent
            }
            return;
        }

        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(url);
                flashCopied();
            } catch {
                // unsupported / denied / insecure context — silent fail
            }
        }
    }, [username, slug, title, flashCopied]);

    return { share, isCopied, canShare };
};
