'use client';

// components/log/LogReplyComposer.client.tsx
// Purpose: reply composer for the focus-view thread. Any logged-in user may reply.
//   500-char limit. IME-safe (Korean/Hangul). Redirects signed-out to /sign-in.
// Constraints: "use client". Optimistic insert via useCreateLog.

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useCreateLog } from '@/hooks/useCreateLog.query.client';
import { useComposition } from '@/hooks/useComposition.hook';
import { cn } from '@/lib/utils';

const MAX_CHARS = 500;

type Props = {
    username: string; // profile username for cache key
    logId: string; // parent log id for this reply
};

export function LogReplyComposer({ username, logId }: Props) {
    const { isLoaded, isSignedIn } = useAuth();
    const createLog = useCreateLog(username, logId);
    const composition = useComposition();
    const router = useRouter();
    const pathname = usePathname();
    const [body, setBody] = useState('');

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
        createLog.mutate({ parentId: logId, body: body.trim() });
        setBody('');
    };

    return (
        <div className="mt-4 border border-primary/20 p-3">
            <p className="mb-2 text-xs text-primary/60">Reply</p>
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
                placeholder="Add a reply…"
                aria-label="Reply to log entry"
                className={cn(
                    'min-h-[3rem] w-full resize-y',
                    'border border-primary/30 bg-transparent p-2 text-sm',
                    'outline-none focus:border-primary'
                )}
            />
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
                    {createLog.isPending ? 'Posting…' : 'Reply'}
                </button>
            </div>
        </div>
    );
}
