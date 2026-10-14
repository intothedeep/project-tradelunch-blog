import { permanentRedirect } from 'next/navigation';

import { stripUsernameAt } from '@/utils/blog-author';

type Props = {
    params: Promise<{ username: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Moved to `/@u/posts` (Phase PJ). next.config `redirects()` takes the `/blog/@u`
// form first; this stub catches the forms its pattern misses (`%40u`, no `@`).
export default async function LegacyBlogUserPage({
    params,
    searchParams,
}: Props) {
    const { username } = await params;
    const sp = await searchParams;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
        for (const v of [value ?? []].flat()) query.append(key, v);
    }
    const qs = query.size > 0 ? `?${query.toString()}` : '';
    const author = stripUsernameAt(decodeURIComponent(username));
    permanentRedirect(`/@${encodeURIComponent(author)}/posts${qs}`);
}
