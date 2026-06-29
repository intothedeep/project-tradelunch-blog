// Purpose: top-of-feed mobile context header (<lg). Async SERVER component that
// renders the author chip for the current author. Owns the single author-profile
// read and passes it to MobileAuthorChip. Degradation: author null → renders
// nothing (never an empty shell, never breaks the shell). The category/tag chip
// rows that previously lived here are SUPERSEDED by the Phase 2-filter mobile
// FilterChipRows rendered by the author page itself (the old nav MobileChipRow +
// getMobileChips are soft-retired as x_*). The BlogShell call site gates this
// with `lg:hidden`.
// Side effects: one isolated network read.

import { getUserProfile } from '@/apis/getUserProfile.api';
import type { TUserProfile } from '@repo/types';
import { MobileAuthorChip } from '@/components/rail/mobile/MobileAuthorChip.server';

const resolveProfile = async (
    username: string
): Promise<TUserProfile | null> => {
    try {
        return await getUserProfile(username);
    } catch {
        return null;
    }
};

export const MobileContextHeader = async ({
    username,
}: {
    username: string;
}) => {
    const profile = await resolveProfile(username);

    // No author → render nothing (no empty shell).
    if (!profile) return null;

    return (
        <section className="flex flex-col gap-2 border-b border-border pb-3">
            <MobileAuthorChip profile={profile} />
        </section>
    );
};

export default MobileContextHeader;
