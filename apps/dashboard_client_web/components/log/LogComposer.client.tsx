'use client';

// components/log/LogComposer.client.tsx
// Purpose: composer for top-level log entries (OWNER-ONLY). Renders only when
//   viewerUsername === profileUsername. 500-char limit with counter. Optimistic
//   prepend via useCreateLog. IME-safe (Korean/Hangul Enter gating).
// Constraints: "use client". Redirects signed-out users to /sign-in.

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useMe } from '@/hooks/useMe.query.client';
import { useCreateLog } from '@/hooks/useCreateLog.query.client';
import { useComposition } from '@/hooks/useComposition.hook';
import { cn } from '@/lib/utils';

const MAX_CHARS = 500;

type Props = {
    username: string; // profile username (without @)
};

export function LogComposer({ username }: Props) {
    const { isLoaded, isSignedIn } = useAuth();
    const { data: me } = useMe();
    const createLog = useCreateLog(username);
    const composition = useComposition();
    const router = useRouter();
    const pathname = usePathname();
    const [body, setBody] = useState('');

    // Owner check: only render if viewer username === profile username.
    const isOwner = isLoaded && isSignedIn && me?.username === username;

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
        createLog.mutate({ parentId: null, body: body.trim() });
        setBody('');
    };

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
