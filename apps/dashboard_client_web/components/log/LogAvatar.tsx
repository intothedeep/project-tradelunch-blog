// components/log/LogAvatar.tsx
// Purpose: small circular author avatar for the Log thread view (Threads-style).
//   Uses the author's avatar_url when present (usually null in this app), else a
//   colored initial. Deleted/masked nodes render a neutral placeholder.
// Constraints: presentational, no "use client". next/image per project convention.

import Image from 'next/image';
import { cn } from '@/lib/utils';

type Props = {
    name?: string; // display label — first letter is the fallback initial
    avatarUrl?: string;
    size?: number; // px, default 36
    deleted?: boolean; // masked tombstone → neutral dot, no image
    className?: string;
};

export function LogAvatar({
    name,
    avatarUrl,
    size = 36,
    deleted,
    className,
}: Props) {
    if (avatarUrl && !deleted) {
        return (
            <Image
                src={avatarUrl}
                alt={name ?? ''}
                width={size}
                height={size}
                className={cn('shrink-0 rounded-full object-cover', className)}
            />
        );
    }

    const initial = deleted ? '·' : (name?.trim()?.[0]?.toUpperCase() ?? '?');

    return (
        <span
            aria-hidden
            style={{
                width: size,
                height: size,
                fontSize: Math.round(size * 0.42),
            }}
            className={cn(
                'flex shrink-0 select-none items-center justify-center rounded-full',
                'bg-primary/10 font-semibold text-primary/60',
                className
            )}
        >
            {initial}
        </span>
    );
}
