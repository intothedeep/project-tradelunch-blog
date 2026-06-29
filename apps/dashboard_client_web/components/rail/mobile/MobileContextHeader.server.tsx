// Purpose: top-of-feed mobile context header (<lg). Async SERVER component that
// composes the author chip + the category/tag chip row for the current author.
// Owns the single author-profile read and passes it to MobileAuthorChip (no
// duplicate fetch). Degradation: chips empty → author chip only; author also null
// → renders nothing (never an empty shell, never breaks the shell). The section
// chrome only appears once at least one child has content. The BlogShell call site
// gates this with `lg:hidden`.
// Side effects: network reads delegated to children / this read (each isolated).

import { getUserProfile } from '@/apis/getUserProfile.api';
import type { TUserProfile } from '@repo/types';
import { MobileAuthorChip } from '@/components/rail/mobile/MobileAuthorChip.server';
import { MobileChipRow } from '@/components/rail/mobile/MobileChipRow.server';
import { getMobileChips } from '@/components/rail/mobile/getMobileChips.server';

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
    const [profile, chips] = await Promise.all([
        resolveProfile(username),
        getMobileChips(username),
    ]);

    // All data empty → render nothing (no empty shell).
    if (!profile && chips.length === 0) return null;

    return (
        <section className="flex flex-col gap-2 border-b border-border pb-3">
            <MobileAuthorChip profile={profile} />
            <MobileChipRow chips={chips} />
        </section>
    );
};

export default MobileContextHeader;
