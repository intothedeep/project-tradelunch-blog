// hooks/useDraftAutosave.test.ts
// Purpose: UX0 regression guard — autosave for an EXISTING public post must
// send status:'public' in the PATCH payload, never silently demote to 'draft'.
// Strategy: mock useCreatePost, useUpdatePost, next/navigation; use fake timers
// to deterministically fire the 5 s debounce without real I/O.

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TPostInput } from '@repo/types';

// ---------------------------------------------------------------------------
// Hoisted spies — must be created before vi.mock factories run (both are
// hoisted by vitest, but vi.hoisted is guaranteed to run first).
// ---------------------------------------------------------------------------
const { mockUpdateMutateAsync, mockCreateMutateAsync, mockReplace } =
    vi.hoisted(() => ({
        mockUpdateMutateAsync: vi.fn(),
        mockCreateMutateAsync: vi.fn(),
        mockReplace: vi.fn(),
    }));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/hooks/useCreatePost.query.client', () => ({
    useCreatePost: () => ({
        mutateAsync: mockCreateMutateAsync,
        isPending: false,
        isError: false,
    }),
}));

vi.mock('@/hooks/useUpdatePost.query.client', () => ({
    useUpdatePost: () => ({
        mutateAsync: mockUpdateMutateAsync,
        isPending: false,
        isError: false,
    }),
}));

// Import AFTER mocks are declared (vitest hoists vi.mock above imports, but
// explicit ordering makes the intent clear).
import { useDraftAutosave } from '@/hooks/useDraftAutosave.hook';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDraftAutosave — UX0 regression', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockUpdateMutateAsync.mockResolvedValue({ id: 1, title: 'Test' });
        mockCreateMutateAsync.mockResolvedValue({ id: 99, title: 'New post' });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // PRIMARY REGRESSION: existing post with status:'public' must not be
    // downgraded to 'draft' by the autosave PATCH.
    // -----------------------------------------------------------------------
    it('PATCH for an existing public post sends status:public — never demotes to draft', async () => {
        const input: TPostInput = {
            title: 'Existing post title',
            content: 'Body content of the post.',
            status: 'public',
        };

        // postId = '42'  →  existing post, triggers updatePost path
        const { rerender } = renderHook(
            ({ inp }: { inp: TPostInput }) => useDraftAutosave('42', inp, true),
            { initialProps: { inp: input } }
        );

        // Mounting an unchanged (seeded) post must NOT autosave — the snapshot
        // baseline suppresses redundant PATCHes.
        await act(async () => {
            vi.advanceTimersByTime(5100);
        });
        expect(mockUpdateMutateAsync).not.toHaveBeenCalled();

        // A real edit triggers the debounced PATCH.
        rerender({ inp: { ...input, content: 'Body content edited.' } });
        await act(async () => {
            vi.advanceTimersByTime(5100);
        });

        expect(mockUpdateMutateAsync).toHaveBeenCalledOnce();

        // Non-null assertion is safe: we just asserted the call exists above.
        const arg = mockUpdateMutateAsync.mock.calls[0]![0] as {
            postId: string;
            input: Partial<TPostInput>;
        };

        // Core regression assertion: status must be preserved as-is.
        expect(arg.input.status).toBe('public');
        expect(arg.input.status).not.toBe('draft');
        // Sanity: correct post targeted.
        expect(arg.postId).toBe('42');
    });

    // -----------------------------------------------------------------------
    // SECONDARY (cheap): new post with status omitted must default to 'draft'.
    // -----------------------------------------------------------------------
    it('CREATE for a new post (postId null, status omitted) defaults to status:draft', async () => {
        const input: TPostInput = {
            title: 'Brand new post',
            content: 'Initial content.',
            // status intentionally omitted — should default to draft
        };

        // postId = null  →  brand-new post, triggers createPost path
        renderHook(() => useDraftAutosave(null, input, true));

        await act(async () => {
            vi.advanceTimersByTime(5100);
        });

        expect(mockCreateMutateAsync).toHaveBeenCalledOnce();

        // Non-null assertion is safe: we just asserted the call exists above.
        const arg = mockCreateMutateAsync.mock.calls[0]![0] as TPostInput;
        expect(arg.status).toBe('draft');
    });
});
