import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { savedPath } from '@/utils/routes';

// Old saved-posts URL: 307 to the viewer's `/@<username>/saved` (PJ-2-02). The
// '/me(.*)' middleware matcher still guards this route, so a signed-out visitor
// is sent to sign-in first. A user without a username has no author URL: home.
export default async function SavedRedirectPage() {
    const user = await currentUser();
    redirect(user?.username ? savedPath(user.username) : '/');
}
