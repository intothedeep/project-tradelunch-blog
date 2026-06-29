// Purpose: compact author identity chip for the mobile context header. SERVER
// component: renders avatar (fallback = first letter of displayName/username),
// display name and `@username`, linking to the author root (`/blog/@<username>`).
// A null profile (unknown user / fetch failure upstream) degrades to rendering
// nothing — never breaks the shell. The avatar + initial fallback pattern mirrors
// UserProfileCard (copied, not imported — different layout: inline pill vs. card).
// The profile is fetched once by MobileContextHeader and passed in (single read,
// no duplicate network call).
// Side effects: none (data passed in).

import Image from 'next/image';
import Link from 'next/link';
import type { TUserProfile } from '@repo/types';

export const MobileAuthorChip = ({
    profile,
}: {
    profile: TUserProfile | null;
}) => {
    if (!profile) return null;

    const display = profile.displayName?.trim() || profile.username;
    const initial = (display || '?').charAt(0).toUpperCase();

    return (
        <Link
            href={`/blog/@${profile.username}`}
            className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border px-2 py-1 transition-colors hover:bg-accent/50"
        >
            {profile.avatarUrl ? (
                <Image
                    src={profile.avatarUrl}
                    alt={display}
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
            ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {initial}
                </span>
            )}
            <span className="min-w-0">
                <span className="block max-w-[40vw] truncate text-sm font-semibold text-foreground">
                    {display}
                </span>
                <span className="block max-w-[40vw] truncate text-xs text-muted-foreground">
                    @{profile.username}
                </span>
            </span>
        </Link>
    );
};

export default MobileAuthorChip;
