'use client';

// CommentComposer.client.tsx — IME-safe plain-text comment/reply/edit composer.
// Purpose: a bare textarea wired to useComposition so Enter-to-submit is gated
//   on IME composition (Korean/Japanese): pressing Enter to COMMIT a Hangul
//   syllable must NOT submit a half-composed comment. Shift+Enter = newline.
//   Edit mode (initialBody provided) seeds the field and does NOT auto-clear on
//   submit — the caller closes the editor.
// Constraints: signed-out submit → /sign-in?redirect_url=<path>. Body is PLAIN
//   TEXT (never markdown). Submit is disabled while empty/whitespace or pending.

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useComposition } from '@/hooks/useComposition.hook';
import { cn } from '@/lib/utils';

type Props = {
    onSubmit: (body: string) => void;
    isPending: boolean;
    placeholder: string;
    replyingTo?: string;
    onCancel?: () => void;
    autoFocus?: boolean;
    initialBody?: string;
    submitLabel?: string;
};

export const CommentComposer: React.FC<Props> = ({
    onSubmit,
    isPending,
    placeholder,
    replyingTo,
    onCancel,
    autoFocus,
    initialBody,
    submitLabel,
}) => {
    const t = useTranslations('blog');
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const composition = useComposition();
    const ref = useRef<HTMLTextAreaElement>(null);
    const isEdit = initialBody !== undefined;
    const [body, setBody] = useState(initialBody ?? '');

    const canSubmit = body.trim().length > 0 && !isPending;

    const submit = () => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push(
                `/sign-in?redirect_url=${encodeURIComponent(pathname)}`
            );
            return;
        }
        if (!canSubmit) return;
        onSubmit(body.trim());
        if (!isEdit) setBody('');
    };

    return (
        <div className="flex flex-col gap-2">
            {replyingTo ? (
                <p className="text-xs text-primary/70">
                    {t('comments.replyingTo', { name: replyingTo })}
                </p>
            ) : null}
            <textarea
                ref={ref}
                value={body}
                autoFocus={autoFocus}
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
                aria-label={t('comments.composerLabel')}
                placeholder={placeholder}
                className={cn(
                    'min-h-[5rem] w-full resize-y',
                    'border-2 border-primary/50 bg-transparent p-3 text-sm',
                    'outline-none focus:border-primary'
                )}
            />
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className={cn(
                        'border border-primary px-3 py-1.5 text-xs font-semibold',
                        'transition-colors hover:bg-primary hover:text-primary-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {isPending
                        ? isEdit
                            ? t('comments.saving')
                            : t('comments.posting')
                        : (submitLabel ?? t('comments.post'))}
                </button>
                {onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs text-primary/70 hover:text-primary"
                    >
                        {t('comments.cancel')}
                    </button>
                ) : null}
            </div>
        </div>
    );
};
