'use client';

// CommentDeleteDialog.client.tsx — focus-trapped delete confirm (a11y v1).
// Purpose: a Dialog (Esc + focus-trap) gating the destructive soft-delete so an
//   accidental tap can't tombstone a comment. Shown only when the viewer is the
//   comment author, the post owner, or an admin (gated by the caller).
// Constraints: confirm calls onConfirm (the delete mutation); the Dialog closes
//   on either action. Plain-text copy via the blog.comments namespace.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Props = {
    onConfirm: () => void;
    triggerLabel: string;
};

export const CommentDeleteDialog: React.FC<Props> = ({
    onConfirm,
    triggerLabel,
}) => {
    const t = useTranslations('blog');
    const [open, setOpen] = useState(false);

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
            <DialogTrigger asChild>
                <button
                    type="button"
                    aria-label={triggerLabel}
                    className="text-xs text-destructive hover:underline"
                >
                    {t('comments.delete')}
                </button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('comments.deleteConfirmTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('comments.deleteConfirmBody')}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="px-3 py-1.5 text-xs text-primary/70 hover:text-primary"
                    >
                        {t('comments.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm();
                            setOpen(false);
                        }}
                        className={cn(
                            'border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive',
                            'transition-colors hover:bg-destructive hover:text-destructive-foreground'
                        )}
                    >
                        {t('comments.delete')}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
