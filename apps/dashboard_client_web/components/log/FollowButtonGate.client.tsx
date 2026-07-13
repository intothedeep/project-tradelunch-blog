'use client';

// components/log/FollowButtonGate.client.tsx
// Purpose: renders FollowButton only when the signed-in viewer is NOT the
//   profile owner. On one's own stream: nothing rendered.
//   On another user's stream: FollowButton (signed-in) or nothing (signed-out).
// Constraints: "use client". Uses useMe to determine ownership.

import { useMe } from '@/hooks/useMe.query.client';
import { FollowButton } from '@/components/log/FollowButton.client';

type Props = {
    /** The username of the profile being viewed. */
    username: string;
};

export function FollowButtonGate({ username }: Props) {
    const { data: me } = useMe();

    // Own stream: no follow button.
    if (me?.username === username) return null;

    // Not yet loaded or signed out: no button.
    if (!me) return null;

    return (
        <FollowButton
            targetUsername={username}
            initialFollowing={false}
            initialFollowerCount={0}
        />
    );
}
