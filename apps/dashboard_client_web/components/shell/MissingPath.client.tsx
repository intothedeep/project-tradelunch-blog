'use client';

import { usePathname } from 'next/navigation';

// not-found.tsx gets no params, so the requested path is read on the client.
export function MissingPath() {
    const pathname = usePathname();
    return <span className="break-all">{pathname ?? '/'}</span>;
}
