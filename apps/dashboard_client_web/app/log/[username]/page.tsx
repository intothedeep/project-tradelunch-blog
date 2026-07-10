// app/log/[username]/page.tsx
// Purpose: SSR entry for the per-user log stream (/log/[username]).
//   Fetches the first page server-side so the list paints immediately.
//   Passes seed to LogStream (infinite scroll) and renders LogComposer
//   (owner-only, determined client-side via useMe).
// Constraints: Server Component. username is @-stripped. force-dynamic because
//   the stream is always fresh (newest-first).

export const dynamic = 'force-dynamic';

import { stripUsernameAt } from '@/utils/blog-author';
import { getLogStream } from '@/apis/get-log-stream.api';
import { LogStream } from '@/components/log/LogStream.client';
import { LogComposer } from '@/components/log/LogComposer.client';
import type { TLogStreamResponse } from '@repo/types';

type Props = {
    params: Promise<{ username: string }>;
};

export default async function LogStreamPage({ params }: Props) {
    const { username: raw } = await params;
    const username = stripUsernameAt(decodeURIComponent(raw));

    let initialData: TLogStreamResponse | undefined;
    try {
        initialData = await getLogStream(username, { limit: 20 });
    } catch {
        // Degrade gracefully — client will refetch.
        initialData = undefined;
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <h1 className="mb-4 text-lg font-semibold">@{username}</h1>
            <LogComposer username={username} />
            <LogStream
                username={username}
                initialData={initialData}
            />
        </div>
    );
}
