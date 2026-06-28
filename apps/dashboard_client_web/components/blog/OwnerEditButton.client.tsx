'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useMe } from '@/hooks/useMe.query.client';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
    postId: string;
    ownerUsername: string; // already `@`-stripped
};

// Owner-only Edit affordance for the public post detail page.
// Renders the editor link only when the signed-in user owns the post (or is
// admin). Uses the DB-backed identity from useMe() — the same source the
// comments edit/delete gate uses — so it stays consistent even when Clerk's
// own `username` field is null. Anonymous viewers and non-owners get nothing.
export const OwnerEditButton = ({ postId, ownerUsername }: Props) => {
    const { data: me } = useMe();
    const t = useTranslations('write');

    const isOwner =
        !!me &&
        !!ownerUsername &&
        ((me.username !== null && me.username === ownerUsername) || me.isAdmin);

    if (!isOwner) return null;

    return (
        <Link
            href={`/write/${postId}`}
            className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'relative z-10'
            )}
        >
            <Pencil />
            {t('ownerEdit.edit')}
        </Link>
    );
};

export default OwnerEditButton;
