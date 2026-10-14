'use client';

// Purpose: the left-rail body (client) — owns the collapse toggle and decides
// what renders at each width. EXPANDED: PrimaryNav + a "Popular tags" RailSection
// wrapping the server-rendered TagCloud passed as a child. COLLAPSED (w-14 icon
// rail): icon-only PrimaryNav, no tag section. Both states share ONE markup;
// CSS off `<html data-rail>` hides what collapsed does not show.
//
// Hydration correctness: every first-paint difference between collapsed and
// expanded is CSS off `<html data-rail>` (set before paint by the root-layout
// script), so the React tree is identical for both states and nothing moves when
// the atom syncs after mount. The atom only drives behavior (toggle, aria-expanded).
// Side effects: toggling the atom persists the cookie (client-only, in the atom).

import { useAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { isLeftRailCollapsedAtom } from '@/store/layout.atom';
import { PrimaryNav } from '@/components/rail/PrimaryNav.client';
import { RailSection } from '@/components/rail/RailSection.client';
import { RecentVisited } from '@/components/rail/RecentVisited.client';
import { SavedTags } from '@/components/rail/SavedTags.client';

export const LeftRail = ({
    tagCloud,
    showRecentVisited = true,
}: {
    tagCloud?: React.ReactNode;
    // false on the projects screens (#79); every other page keeps the widget.
    showRecentVisited?: boolean;
}) => {
    const [isCollapsed, setIsCollapsed] = useAtom(isLeftRailCollapsedAtom);
    const t = useTranslations('blog');

    return (
        <div className="flex h-full flex-col gap-2 p-2">
            {/* Same row shape as a PrimaryNav item, so the toggle icon sits in
                the menu icons' column whether the rail is open or collapsed. */}
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? t('rail.expand') : t('rail.collapse')}
                className="flex w-full items-center gap-3 rounded-none px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground in-data-[rail=collapsed]:justify-center"
            >
                <PanelLeftClose className="h-5 w-5 shrink-0 in-data-[rail=collapsed]:hidden" />
                <PanelLeftOpen className="hidden h-5 w-5 shrink-0 in-data-[rail=collapsed]:block" />
                {/* A rule instead of a label: the row reads as the rail header. */}
                <span
                    aria-hidden
                    className="h-px flex-1 bg-border in-data-[rail=collapsed]:hidden"
                />
            </button>

            <PrimaryNav />

            {tagCloud ? (
                <div className="contents in-data-[rail=collapsed]:hidden">
                    <RailSection title={t('rail.popularTagsGlobal')}>
                        {tagCloud}
                    </RailSection>
                </div>
            ) : null}

            {/* localStorage-backed widgets (H5.4) — expanded rail only; shared
                identically across `/` and `/@[handle]/posts`. */}
            <div className="contents in-data-[rail=collapsed]:hidden">
                {showRecentVisited ? <RecentVisited /> : null}
                <SavedTags />
            </div>
        </div>
    );
};

export default LeftRail;
