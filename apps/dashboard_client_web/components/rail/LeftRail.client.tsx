'use client';

// Purpose: the left-rail body (client) — owns the collapse toggle and decides
// what renders at each width. EXPANDED: PrimaryNav + a "Popular tags" RailSection
// wrapping the server-rendered TagCloud passed as a child. COLLAPSED (w-14 icon
// rail): icon-only PrimaryNav, no tag section.
//
// Hydration correctness: the server (BlogShell/LeftRailContainer) already knows
// the collapsed value from the `railCollapsed` cookie. We seed the Jotai atom
// with `initialCollapsed` via useHydrateAtoms so SSR and the first client paint
// agree on the rail CONTENT — no flash/mismatch.
// Side effects: toggling the atom persists the cookie (client-only, in the atom).

import { useHydrateAtoms } from 'jotai/utils';
import { useAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { isLeftRailCollapsedAtom } from '@/store/layout.atom';
import { cn } from '@/lib/utils';
import { PrimaryNav } from '@/components/rail/PrimaryNav.client';
import { RailSection } from '@/components/rail/RailSection.client';
import { RecentVisited } from '@/components/rail/RecentVisited.client';
import { SavedTags } from '@/components/rail/SavedTags.client';

export const LeftRail = ({
    initialCollapsed = false,
    tagCloud,
}: {
    initialCollapsed?: boolean;
    tagCloud?: React.ReactNode;
}) => {
    useHydrateAtoms([[isLeftRailCollapsedAtom, initialCollapsed]]);
    const [isCollapsed, setIsCollapsed] = useAtom(isLeftRailCollapsedAtom);
    const t = useTranslations('blog');

    return (
        <div className="flex h-full flex-col gap-2 p-2">
            <div
                className={cn(
                    'flex',
                    isCollapsed ? 'justify-center' : 'justify-end'
                )}
            >
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    aria-expanded={!isCollapsed}
                    aria-label={
                        isCollapsed ? t('rail.expand') : t('rail.collapse')
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                    {isCollapsed ? (
                        <PanelLeftOpen className="h-5 w-5" />
                    ) : (
                        <PanelLeftClose className="h-5 w-5" />
                    )}
                </button>
            </div>

            <PrimaryNav collapsed={isCollapsed} />

            {!isCollapsed && tagCloud ? (
                <RailSection title={t('rail.popularTagsGlobal')}>
                    {tagCloud}
                </RailSection>
            ) : null}

            {/* localStorage-backed widgets (H5.4) — expanded rail only; shared
                identically across `/` and `/blog/[username]`. */}
            {!isCollapsed ? (
                <>
                    <RecentVisited />
                    <SavedTags />
                </>
            ) : null}
        </div>
    );
};

export default LeftRail;
