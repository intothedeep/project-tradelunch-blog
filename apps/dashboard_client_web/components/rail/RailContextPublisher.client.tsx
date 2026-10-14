'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { hideRecentAtom } from '@/store/rail-context.atom';

// Renders nothing. Same shape as TocPublisher: effect sets, cleanup resets, so
// the signal also clears when the page is hidden or navigated away from.
export const RailContextPublisher = ({
    hideRecent = false,
}: {
    hideRecent?: boolean;
}) => {
    const setHideRecent = useSetAtom(hideRecentAtom);

    useEffect(() => {
        if (!hideRecent) return;
        setHideRecent(true);
        return () => setHideRecent(false);
    }, [hideRecent, setHideRecent]);

    return null;
};

export default RailContextPublisher;
