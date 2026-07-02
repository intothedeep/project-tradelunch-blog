// components/PageMenuRegistrar.client.tsx
// Purpose: lets a page contribute a secondary menu into the global hamburger
//   drawer. On mount it registers { label, content } into pageMenuAtom so the
//   drawer offers a chooser (site menu vs this page's menu); clears on unmount.
// Constraints: client component. `content` is server-rendered and passed as
//   children so the page menu itself stays a Server Component. Renders nothing.
// Side effects: writes pageMenuAtom (reset to null on unmount).

'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { pageMenuAtom } from '@/store/menu.atom';

interface PageMenuRegistrarProps {
    // Label shown on the chooser button and as the sub-view title.
    label: string;
    // Server-rendered menu content (e.g. FundList).
    children: React.ReactNode;
}

export default function PageMenuRegistrar({
    label,
    children,
}: PageMenuRegistrarProps) {
    const setPageMenu = useSetAtom(pageMenuAtom);

    useEffect(() => {
        setPageMenu({ label, content: children });
        return () => setPageMenu(null);
    }, [label, children, setPageMenu]);

    return null;
}
