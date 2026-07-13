'use client';

// components/log/LogTodoTabsOwnerGate.client.tsx
// Purpose: renders LogTodoTabs ONLY when the viewer is the profile owner.
//   Gating is done client-side via useMe so the Server Component page stays
//   server-renderable. Non-owners see null.
// Constraints: "use client". Thin gate only — no business logic.

import { useMe } from '@/hooks/useMe.query.client';
import { LogTodoTabs } from '@/components/log/LogTodoTabs.client';

type Props = {
    username: string;
};

export function LogTodoTabsOwnerGate({ username }: Props) {
    const { data: me } = useMe();

    if (!me?.username || me.username !== username) return null;

    return <LogTodoTabs username={username} />;
}
