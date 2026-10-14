import { notFound } from 'next/navigation';

import { HOME_FEED_AUTHOR, toUsernameSegment } from '@/utils/blog-author';

// Author namespace: only `/@<username>/...` lives here. The segment is decoded
// first so `%40taeklim` and `@taeklim` are the same handle. Anything else (a
// mistyped top-level path, `/apple-touch-icon.png`) is a plain 404. No shell
// here: each child segment picks its own chrome.
// cacheComponents (CC-U4): one sample handle lets every `/@u/...` shell
// prerender with known params. Other handles render on first request.
export function generateStaticParams() {
    return [{ handle: toUsernameSegment(HOME_FEED_AUTHOR) }];
}

type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string }>;
};

export default async function HandleLayout({ children, params }: Props) {
    const { handle } = await params;
    if (!decodeURIComponent(handle).startsWith('@')) notFound();
    return <>{children}</>;
}
