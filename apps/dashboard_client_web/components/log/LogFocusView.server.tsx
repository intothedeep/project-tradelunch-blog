// components/log/LogFocusView.server.tsx
// Purpose: SSR shell for the focus-node thread view.
//   Renders ancestor chain, focus card, reply composer, and children list
//   (seeded from SSR). The initialData is passed to client islands.
// Constraints: Server Component. Children list + reply composer are client islands.

import { LogAncestorChain } from '@/components/log/LogAncestorChain';
import { LogFocusCard } from '@/components/log/LogFocusCard';
import { LogChildrenList } from '@/components/log/LogChildrenList.client';
import { LogReplyComposer } from '@/components/log/LogReplyComposer.client';
import type { TLogThreadResponse } from '@repo/types';

type Props = {
    username: string;
    logId: string;
    data: TLogThreadResponse;
};

export function LogFocusView({ username, logId, data }: Props) {
    return (
        <div className="space-y-4">
            <LogAncestorChain ancestors={data.ancestors} />
            <LogFocusCard log={data.focus} />
            <LogReplyComposer
                username={username}
                logId={logId}
            />
            <LogChildrenList
                username={username}
                logId={logId}
                initialData={data}
            />
        </div>
    );
}
