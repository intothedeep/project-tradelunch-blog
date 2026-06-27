'use client';

// CommentRow.client.tsx — a single comment row in the flat-rendered thread.
// Purpose: render one comment indented by its clamped level; plain-text body
//   (escaped by React + line breaks preserved via whitespace-pre-wrap, NO
//   markdown); tombstones show "[deleted]" styling with no affordances; live
//   rows show Reply (any signed-in viewer) + Delete (author/owner/admin) and a
//   "continue thread →" toggle when the subtree is collapsed.
// Constraints: presentational + event callbacks only; auth/mutation live in the
//   parent island. ids stay STRINGS.

import { useTranslations } from 'next-intl';
import type { TComment } from '@repo/types';
import { CommentComposer } from '@/app/blog/components/comments/CommentComposer.client';
import { CommentDeleteDialog } from '@/app/blog/components/comments/CommentDeleteDialog.client';
import { cn } from '@/lib/utils';

type Props = {
    comment: TComment;
    indent: number;
    hasHiddenChildren: boolean;
    canDelete: boolean;
    isReplyOpen: boolean;
    isReplyPending: boolean;
    onToggleReply: () => void;
    onSubmitReply: (body: string) => void;
    onDelete: () => void;
    onContinueThread: () => void;
};

// Per-level left margin (clamped upstream). Mobile shrinks via responsive class.
const INDENT_CLASS = [
    '',
    'ml-3 sm:ml-6',
    'ml-6 sm:ml-12',
    'ml-9 sm:ml-[4.5rem]',
];

export const CommentRow: React.FC<Props> = ({
    comment,
    indent,
    hasHiddenChildren,
    canDelete,
    isReplyOpen,
    isReplyPending,
    onToggleReply,
    onSubmitReply,
    onDelete,
    onContinueThread,
}) => {
    const t = useTranslations('blog');
    const author = comment.authorName ?? '';

    return (
        <li
            className={cn(
                INDENT_CLASS[indent] ?? INDENT_CLASS[3],
                indent > 0 && 'border-l-2 border-primary/20 pl-3 sm:pl-4'
            )}
        >
            <div className="flex flex-col gap-1 py-2">
                <div className="flex items-center gap-2 text-xs text-primary/70">
                    <span className="font-semibold">
                        {comment.isDeleted ? t('comments.deleted') : author}
                    </span>
                </div>
                <p
                    className={cn(
                        'whitespace-pre-wrap break-words text-sm',
                        comment.isDeleted && 'italic text-primary/40'
                    )}
                >
                    {comment.body}
                </p>

                {!comment.isDeleted ? (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onToggleReply}
                            aria-expanded={isReplyOpen}
                            className="text-xs text-primary/70 hover:text-primary"
                        >
                            {t('comments.reply')}
                        </button>
                        {canDelete ? (
                            <CommentDeleteDialog
                                onConfirm={onDelete}
                                triggerLabel={`${t('comments.delete')} — ${author}`}
                            />
                        ) : null}
                    </div>
                ) : null}

                {isReplyOpen ? (
                    <div className="pt-2">
                        <CommentComposer
                            onSubmit={onSubmitReply}
                            isPending={isReplyPending}
                            placeholder={t('comments.replyPlaceholder')}
                            replyingTo={author}
                            onCancel={onToggleReply}
                            autoFocus
                        />
                    </div>
                ) : null}

                {hasHiddenChildren ? (
                    <button
                        type="button"
                        onClick={onContinueThread}
                        className="pt-1 text-left text-xs font-semibold text-primary hover:underline"
                    >
                        {t('comments.continueThread')}
                    </button>
                ) : null}
            </div>
        </li>
    );
};
