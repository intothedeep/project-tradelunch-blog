// app/log/[username]/[logId]/page.tsx
// Purpose: focus-view route for a single log node (/log/[username]/[logId]).
//   SSR: fetches the full thread (ancestors + focus + first children page).
//   Canonical check: if the URL username doesn't match the focus author's username,
//   redirect to the canonical URL (/log/[authorUsername]/[logId]).
//   404 when the logId does not exist.
// Constraints: Server Component. force-dynamic (thread content is always fresh).

export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { stripUsernameAt } from '@/utils/blog-author';
import { getLogThread } from '@/apis/get-log-thread.api';
import { LogFocusView } from '@/components/log/LogFocusView.server';
import { ApiError } from '@/utils/apiError.util';

type Props = {
    params: Promise<{ username: string; logId: string }>;
};

export default async function LogFocusPage({ params }: Props) {
    const { username: rawUsername, logId } = await params;
    const username = stripUsernameAt(decodeURIComponent(rawUsername));

    let data;
    try {
        data = await getLogThread(logId, { limit: 20 });
    } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
            notFound();
        }
        // Re-throw other errors to the error boundary.
        throw err;
    }

    // Canonical check: if URL username doesn't match the focus author, redirect.
    // When the focus node is deleted, authorName is masked to null (by the DB
    // projection) and TLog carries no separate stable author identifier without
    // an additional query. In that case we intentionally skip the redirect —
    // a deleted focus has no canonical username to enforce, and the page still
    // renders the masked tombstone correctly regardless of the URL username.
    if (data.focus.authorName && data.focus.authorName !== username) {
        redirect(`/log/${encodeURIComponent(data.focus.authorName)}/${logId}`);
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <nav
                aria-label="Back to log"
                className="mb-4"
            >
                <a
                    href={`/log/${encodeURIComponent(username)}`}
                    className="text-xs text-primary/60 hover:text-primary"
                >
                    ← @{username}
                </a>
            </nav>
            <LogFocusView
                username={username}
                logId={logId}
                data={data}
            />
        </div>
    );
}
