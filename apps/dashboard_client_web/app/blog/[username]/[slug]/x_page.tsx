import { permanentRedirect } from 'next/navigation';

import { stripUsernameAt } from '@/utils/blog-author';

type Props = { params: Promise<{ username: string; slug: string }> };

// Moved to `/@u/<slug>` (Phase PJ). next.config `redirects()` takes the
// `/blog/@u/<slug>` form first; this stub catches `%40u` and no-`@` forms.
export default async function LegacyBlogPostPage({ params }: Props) {
    const { username, slug } = await params;
    const author = stripUsernameAt(decodeURIComponent(username));
    permanentRedirect(`/@${encodeURIComponent(author)}/${slug}`);
}
