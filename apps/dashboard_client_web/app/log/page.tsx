// app/log/page.tsx
// Purpose: SSR entry for the GLOBAL log feed (/log) — the default Log surface.
//   Y-M2: tabs "전체 | 팔로잉" added — Following tab visible only to signed-in
//   viewers. LogComposer lets any signed-in user post. SSR seeds the All tab.
// Constraints: Server Component. force-dynamic (feed is always fresh).

export const dynamic = 'force-dynamic';

import { getLogGlobalStream } from '@/apis/get-log-global.api';
import { LogFeedTabs } from '@/components/log/LogFeedTabs.client';
import { LogComposer } from '@/components/log/LogComposer.client';
import type { TLogStreamResponse } from '@repo/types';

export default async function LogFeedPage() {
    let initialData: TLogStreamResponse | undefined;
    try {
        initialData = await getLogGlobalStream({ limit: 20 });
    } catch {
        // Degrade gracefully — the client hook will refetch.
        initialData = undefined;
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            <h1 className="mb-4 text-lg font-semibold">Log</h1>
            <LogComposer />
            <LogFeedTabs initialData={initialData} />
        </div>
    );
}
