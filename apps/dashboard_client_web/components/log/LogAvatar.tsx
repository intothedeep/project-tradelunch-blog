// components/log/LogAvatar.tsx
// Purpose: small circular author avatar for the Log thread view (Threads-style),
//   built on the shadcn/radix Avatar. Shows the author's avatar_url when present
//   (usually null in this app; radix falls back automatically if it fails to
//   load), else a colored initial. Deleted/masked nodes render a neutral dot.
// Constraints: presentational. No next/image (radix handles arbitrary hosts +
//   graceful fallback, so no remotePatterns config needed).

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
    const initial = deleted ? '·' : (name?.trim()?.[0]?.toUpperCase() ?? '?');

    return (
        <Avatar
            style={{ width: size, height: size }}
            className={cn('shrink-0', className)}
        >
            {avatarUrl && !deleted ? (
                <AvatarImage
                    src={avatarUrl}
                    alt={name ?? ''}
                    className="object-cover"
                />
            ) : null}
            <AvatarFallback
                style={{ fontSize: Math.round(size * 0.42) }}
                className="select-none bg-primary/10 font-semibold text-primary/60"
            >
                {initial}
            </AvatarFallback>
        </Avatar>
    );
}
