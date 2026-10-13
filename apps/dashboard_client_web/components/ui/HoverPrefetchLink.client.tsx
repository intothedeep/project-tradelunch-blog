'use client';

// Purpose: <Link> that prefetches on hover/focus only, never on viewport entry.
// Why: viewport prefetch on every infinite-feed card trips the Cloudflare rate
//   limit (50 req / 10 s per IP, decision #70). `prefetch={false}` disables
//   hover prefetch too, so it is re-enabled (null = default) once pointed at.

import { useState } from 'react';
import Link from 'next/link';

export const HoverPrefetchLink: React.FC<React.ComponentProps<typeof Link>> = ({
    onMouseEnter,
    onFocus,
    ...props
}) => {
    const [isActive, setIsActive] = useState(false);

    return (
        <Link
            {...props}
            prefetch={isActive ? null : false}
            onMouseEnter={(e) => {
                setIsActive(true);
                onMouseEnter?.(e);
            }}
            onFocus={(e) => {
                setIsActive(true);
                onFocus?.(e);
            }}
        />
    );
};
