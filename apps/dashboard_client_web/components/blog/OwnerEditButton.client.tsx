'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
    postId: string;
    ownerUsername: string; // already `@`-stripped
};

// Owner-only Edit affordance for the public post detail page.
// Renders the editor link only when the signed-in Clerk user owns the post.
// Anonymous viewers and non-owners get nothing (returns null).
export const OwnerEditButton = ({ postId, ownerUsername }: Props) => {
    const { user } = useUser();

    if (!ownerUsername || user?.username !== ownerUsername) return null;

    return (
        <Link
            href={`/write/${postId}`}
            className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'relative z-10 ml-auto'
            )}
        >
            <Pencil />
            Edit
        </Link>
    );
};

export default OwnerEditButton;
