// hooks/useDraftAutosave.hook.ts
// Purpose: debounce editor state (~2s) and persist it as a draft. The first
// save with no postId yet creates the post, replaces the URL with the new id,
// and routes subsequent saves through PATCH on that id.
// Constraints: client-only; guards the in-flight create so rapid edits never
// produce a duplicate post. Data-loss guard: PATCH never sends an empty
// `content` field — omitting it lets the server's COALESCE keep the stored body,
// so an unseeded/cleared editor can never overwrite a saved draft with ''. The
// caller additionally gates `enabled` on the editor having been seeded.

'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCreatePost } from '@/hooks/useCreatePost.query.client';
import { useUpdatePost } from '@/hooks/useUpdatePost.query.client';
import { debounce } from '@/utils/debounce.util';
import type { TPostInput } from '@repo/types';

const AUTOSAVE_DELAY_MS = 2000;

export type TAutosaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

const hasContent = (input: TPostInput): boolean =>
    Boolean(input.title?.trim() || input.content?.trim());

// PATCH payload builder: drop `content` when empty so the server's COALESCE
// preserves the stored body instead of clobbering it with ''.
const toUpdatePayload = (input: TPostInput): Partial<TPostInput> => {
    const { content, ...rest } = input;
    return content && content.trim() ? { ...rest, content } : rest;
};

// Pure status reducer: collapses the two mutation flags + local dirty/lastSavedAt
// into a single display status. No bespoke state machine — purely derived.
const deriveStatus = (params: {
    isSaving: boolean;
    isError: boolean;
    dirty: boolean;
    lastSavedAt: number | null;
}): TAutosaveStatus => {
    if (params.isSaving) return 'saving';
    if (params.isError) return 'error';
    if (params.dirty) return 'unsaved';
    if (params.lastSavedAt != null) return 'saved';
    return 'idle';
};

export function useDraftAutosave(
    postId: number | null,
    input: TPostInput,
    enabled: boolean
) {
    const router = useRouter();
    const createPost = useCreatePost();
    const updatePost = useUpdatePost();

    const inputRef = useRef<TPostInput>(input);
    inputRef.current = input;

    const postIdRef = useRef<number | null>(postId);
    postIdRef.current = postId;

    const creatingRef = useRef(false);

    // The only bespoke state: `dirty` tracks pending/debounced edits awaiting a
    // save; `lastSavedAt` stamps the most recent successful persist.
    const [dirty, setDirty] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

    // Mirror `dirty` into a ref so the unmount-only flush effect (empty deps)
    // can read the current value at cleanup time.
    const dirtyRef = useRef(false);
    dirtyRef.current = dirty;

    // Latest save routine, captured in a ref so the debounced wrapper stays
    // stable across renders while always invoking current closures.
    const runSaveRef = useRef<() => Promise<void>>(async () => {});
    runSaveRef.current = async () => {
        const id = postIdRef.current;
        const status =
            id == null
                ? (inputRef.current.status ?? 'draft')
                : inputRef.current.status;
        const current: TPostInput = { ...inputRef.current, status };
        if (!hasContent(current)) return;

        if (id == null) {
            // Brand-new post: create, then hand off to the by-id PATCH flow.
            if (creatingRef.current) return;
            creatingRef.current = true;
            try {
                const created = await createPost.mutateAsync(current);
                postIdRef.current = created.id;
                setLastSavedAt(Date.now());
                setDirty(false);
                router.replace(`/write/${created.id}`);
            } catch (error) {
                console.error('Draft autosave (create) failed:', error);
            } finally {
                creatingRef.current = false;
            }
            return;
        }

        try {
            await updatePost.mutateAsync({
                postId: id,
                input: toUpdatePayload(current),
            });
            setLastSavedAt(Date.now());
            setDirty(false);
        } catch (error) {
            console.error('Draft autosave (update) failed:', error);
        }
    };

    const debouncedSave = useMemo(
        () =>
            debounce(() => {
                void runSaveRef.current();
            }, AUTOSAVE_DELAY_MS),
        []
    );

    useEffect(() => {
        // `enabled` is the seed gate (caller passes isSeeded): never autosave an
        // existing post before its real body has hydrated.
        if (!enabled) return;
        if (!hasContent(input)) return;
        setDirty(true);
        debouncedSave();
        return () => debouncedSave.cancel();
    }, [input, enabled, debouncedSave]);

    // Flush-on-unmount: a user navigating away (SPA nav) within the debounce
    // window would otherwise lose the pending edit — `beforeunload` does not
    // fire on in-app navigation. Empty deps so the cleanup runs ONLY on final
    // unmount; refs supply the current values. Fire-and-forget is fine: the
    // TanStack mutation completes via the QueryClient after unmount.
    useEffect(() => {
        return () => {
            if (dirtyRef.current && hasContent(inputRef.current)) {
                void runSaveRef.current();
            }
        };
    }, []);

    const retry = useCallback(() => {
        void runSaveRef.current();
    }, []);

    const status = deriveStatus({
        isSaving: createPost.isPending || updatePost.isPending,
        isError: createPost.isError || updatePost.isError,
        dirty,
        lastSavedAt,
    });

    return { status, lastSavedAt, retry };
}
