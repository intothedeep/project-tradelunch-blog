'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { TTocItem } from '@/utils/markdown/toc.types';
import { tocItemsAtom } from '@/store/toc.atom';

// Publishes the server-extracted post TOC into tocItemsAtom so the right rail
// (RightRailToc) can render it between the profile card and the category section.
// Renders nothing; clears the atom on unmount (e.g. navigating back to the feed).
export const TocPublisher = ({ items }: { items: TTocItem[] }) => {
    const setToc = useSetAtom(tocItemsAtom);

    useEffect(() => {
        setToc(items);
        return () => setToc([]);
    }, [items, setToc]);

    return null;
};

export default TocPublisher;
