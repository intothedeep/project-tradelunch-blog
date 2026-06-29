// Purpose: per-user right-rail author card (H5.5). Async SERVER component:
// fetches getUserProfile(username) and renders avatar (fallback = first letter
// of displayName/username), displayName (fallback username) and postCount.
// Zero-post empty state (P2.5): when postCount === 0 a muted "hasn't published
// yet" line replaces the count. Fetch failure / unknown user (null) degrades to
// rendering nothing — never breaks the shell.
// Side effects: one network read (isolated to this boundary).

import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { TUserProfile } from '@repo/types';
import { getUserProfile } from '@/apis/getUserProfile.api';

export const UserProfileCard = async ({ username }: { username: string }) => {
    const t = await getTranslations('blog');

    let profile: TUserProfile | null;
    try {
        profile = await getUserProfile(username);
    } catch {
        return null;
    }
    if (!profile) return null;

    const display = profile.displayName?.trim() || profile.username;
    const initial = (display || '?').charAt(0).toUpperCase();

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
                {profile.avatarUrl ? (
                    <Image
                        src={profile.avatarUrl}
                        alt={display}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                    />
                ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {initial}
                    </span>
                )}
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {display}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        @{profile.username}
                    </p>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                {profile.postCount === 0
                    ? t('profile.noPosts')
                    : t('profile.postCount', { count: profile.postCount })}
            </p>
        </div>
    );
};

export default UserProfileCard;
