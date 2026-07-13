// app/log/[username]/page.tsx
// Purpose: SSR entry for the per-user log stream (/log/[username]).
//   Fetches the first page server-side so the list paints immediately.
//   Passes seed to LogStream (infinite scroll) and renders LogComposer
//   (owner-only, determined client-side via useMe).
//   Y-TD: LogTodoTabs rendered below the stream — gated owner-side (the
//   component reads auth via useAuth so it renders nothing for non-owners).
//   Y-M2: FollowButtonGate renders follow button for non-owner signed-in viewers.
// Constraints: Server Component. username is @-stripped. force-dynamic because
//   the stream is always fresh (newest-first).

export const dynamic = 'force-dynamic';

import { stripUsernameAt } from '@/utils/blog-author';
import { getLogStream } from '@/apis/get-log-stream.api';
import { LogStream } from '@/components/log/LogStream.client';
import { LogComposer } from '@/components/log/LogComposer.client';
import { LogTodoTabsOwnerGate } from '@/components/log/LogTodoTabsOwnerGate.client';
import { FollowButtonGate } from '@/components/log/FollowButtonGate.client';
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
            <div className="mb-4 flex items-start justify-between gap-3">
                <h1 className="text-lg font-semibold">@{username}</h1>
                <FollowButtonGate username={username} />
            </div>
            <LogComposer username={username} />
            <LogStream
                username={username}
                initialData={initialData}
            />
            <LogTodoTabsOwnerGate username={username} />
        </div>
    );
}
