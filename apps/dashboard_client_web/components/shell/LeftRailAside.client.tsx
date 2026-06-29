'use client';

// Purpose: the left-rail OUTER container (the width-bearing <aside>). A CLIENT
// component that subscribes to `isLeftRailCollapsedAtom` so the rail WIDTH
// (w-64 expanded / w-14 collapsed) tracks the collapse toggle live — the toggle
// only flips a Jotai atom, and a server-rendered <aside> width would never
// re-evaluate without a refresh.
//
// Hydration correctness: seeded with `initialCollapsed` (read from the
// `railCollapsed` cookie by the server BlogShell) via useHydrateAtoms so the
// SSR width and the first client paint agree — no width flash. The inner
// LeftRail hydrates the same atom with the same value (idempotent).
// Side effects: none (read-only atom subscription).

import { useHydrateAtoms } from 'jotai/utils';
import { useAtomValue } from 'jotai';
import { isLeftRailCollapsedAtom } from '@/store/layout.atom';
import { cn } from '@/lib/utils';

export const LeftRailAside = ({
    initialCollapsed = false,
    children,
}: {
    initialCollapsed?: boolean;
    children: React.ReactNode;
}) => {
    useHydrateAtoms([[isLeftRailCollapsedAtom, initialCollapsed]]);
    const isCollapsed = useAtomValue(isLeftRailCollapsedAtom);

    return (
        <aside
            className={cn(
                'hidden shrink-0 border-r border-border transition-[width] duration-200 md:block',
                isCollapsed ? 'w-14' : 'w-64'
            )}
        >
            {children}
        </aside>
    );
};

export default LeftRailAside;
