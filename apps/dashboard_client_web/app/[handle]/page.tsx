import { permanentRedirect } from 'next/navigation';

import { stripUsernameAt } from '@/utils/blog-author';

type Props = { params: Promise<{ handle: string }> };

// `/@u` has no page of its own: 308 to the author's post list.
export default async function HandlePage({ params }: Props) {
    const { handle } = await params;
    const username = stripUsernameAt(decodeURIComponent(handle));
    permanentRedirect(`/@${encodeURIComponent(username)}/posts`);
}
