'use client';

// components/log/LogComposer.client.tsx
// Purpose: composer for top-level log entries. Two modes:
//   * per-user page (username prop set): OWNER-ONLY — renders only when
//     viewerUsername === profileUsername.
//   * global feed (username omitted): SELF-POST — any signed-in provisioned
//     user composes to their OWN stream (the post also surfaces in /log).
//   500-char limit with counter. Optimistic prepend via useCreateLog. IME-safe
//   (Korean/Hangul Enter gating).
//   Y-TD addition: optional "mark as todo + due date" control (owner-only, no-op
//   on create — the backend sets due_at via PATCH after creation; the UI sets the
//   intent before POST and fires the PATCH immediately after on success).
// Constraints: "use client". Redirects signed-out users to /sign-in.

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useMe } from '@/hooks/useMe.query.client';
import { useCreateLog } from '@/hooks/useCreateLog.query.client';
import { useUpdateLogTodo } from '@/hooks/useUpdateLogTodo.query.client';
import { useComposition } from '@/hooks/useComposition.hook';
import { cn } from '@/lib/utils';

const MAX_CHARS = 500;

type Props = {
    username?: string; // profile username (without @); omit for global self-post
};

export function LogComposer({ username }: Props) {
    const { isLoaded, isSignedIn } = useAuth();
    const { data: me } = useMe();
    // Owner of the target stream: the profile owner on a per-user page, else the
    // signed-in user themselves (self-post on the global feed).
    const ownerUsername = username ?? me?.username ?? '';
    const createLog = useCreateLog(ownerUsername);
    const updateTodo = useUpdateLogTodo(ownerUsername);
    const composition = useComposition();
    const router = useRouter();
    const pathname = usePathname();
    const [body, setBody] = useState('');
    const [todoDate, setTodoDate] = useState(''); // YYYY-MM-DD or ''

    // Render gate: per-user page → viewer must be the profile owner; global feed
    // (no username) → any signed-in provisioned user (must have a username).
    const isOwner =
        isLoaded &&
        isSignedIn &&
        !!me?.username &&
        (username === undefined || me.username === username);

    if (!isOwner) return null;

    const remaining = MAX_CHARS - body.length;
    const canSubmit =
        body.trim().length > 0 && remaining >= 0 && !createLog.isPending;

    const submit = () => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push(
                `/sign-in?redirect_url=${encodeURIComponent(pathname)}`
            );
            return;
        }
        if (!canSubmit) return;

        createLog.mutate(
            { parentId: null, body: body.trim() },
            {
                onSuccess: (created) => {
                    // If a due date was set in the composer, fire the PATCH after creation.
                    if (todoDate) {
                        updateTodo.mutate({
                            logId: created.id,
                            update: { dueAt: `${todoDate}T23:59:59.000Z` },
                        });
                    }
                },
            }
        );
        setBody('');
        setTodoDate('');
    };

    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="mb-4 border border-primary/20 p-3">
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onCompositionStart={composition.onCompositionStart}
                onCompositionEnd={composition.onCompositionEnd}
                onKeyDown={(e) => {
                    if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !composition.isComposingRef.current
                    ) {
                        e.preventDefault();
                        submit();
                    }
                }}
                maxLength={MAX_CHARS}
                placeholder="What's on your mind?"
                aria-label="New log entry"
                className={cn(
                    'min-h-[4rem] w-full resize-y',
                    'border border-primary/30 bg-transparent p-2 text-sm',
                    'outline-none focus:border-primary'
                )}
            />

            {/* Todo control row — owner only; graceful even without migration 0023 */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-primary/60">
                    <input
                        type="date"
                        value={todoDate}
                        min={today}
                        onChange={(e) => setTodoDate(e.target.value)}
                        className={cn(
                            'rounded border border-primary/20 bg-transparent px-1 py-0.5',
                            'text-xs text-primary outline-none focus:border-primary',
                            'disabled:opacity-40'
                        )}
                        aria-label="Set due date (optional — marks this entry as a todo)"
                    />
                    {todoDate ? (
                        <button
                            type="button"
                            onClick={() => setTodoDate('')}
                            className="ml-0.5 text-primary/40 hover:text-primary/70"
                            aria-label="Clear due date"
                        >
                            ✕
                        </button>
                    ) : (
                        <span className="text-primary/40">Due date (todo)</span>
                    )}
                </label>
            </div>

            <div className="mt-1 flex items-center justify-between">
                <span
                    className={cn(
                        'text-xs',
                        remaining < 20 ? 'text-destructive' : 'text-primary/40'
                    )}
                >
                    {remaining}
                </span>
                <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className={cn(
                        'border border-primary px-3 py-1 text-xs font-semibold',
                        'transition-colors hover:bg-primary hover:text-primary-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-40'
                    )}
                >
                    {createLog.isPending ? 'Posting…' : 'Post'}
                </button>
            </div>
        </div>
    );
}
