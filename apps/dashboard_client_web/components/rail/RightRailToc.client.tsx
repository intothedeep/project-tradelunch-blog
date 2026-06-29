'use client';

import { useAtomValue } from 'jotai';
import { tocItemsAtom } from '@/store/toc.atom';
import { TableOfContents } from '@/components/blog/TableOfContents.client';

// Right-rail Table of Contents (between the profile card and the category
// section). Reads the post TOC published by TocPublisher; TableOfContents renders
// null when the list is empty, so nothing shows on the author feed / non-post
// routes. Hidden with the rest of the right rail below lg (still reachable via the
// <lg UserContextSheet, which renders the same UserContextRail).
export const RightRailToc = () => {
    const items = useAtomValue(tocItemsAtom);
    return (
        <TableOfContents
            items={items}
            className="my-0"
        />
    );
};

export default RightRailToc;
