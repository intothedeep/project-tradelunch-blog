import { notFound } from 'next/navigation';

import { getUserProfile } from '@/apis/getUserProfile.api';

// 404 gate for an unknown `/@u` user, as a Suspense leaf (cacheComponents).
// A layout cannot await uncached data above every Suspense boundary, so this
// check runs after the shell is sent: the view becomes the 404 page, but the
// HTTP status stays 200 (noindex is injected). Renders nothing for a known user.
// Backup defense only: proxy.ts existence gates (#97, #103) decide the real 404
// before render; this leaf matters when the proxy fails open.
export async function UserGate({ username }: { username: string }) {
    if (!(await getUserProfile(username))) notFound();
    return null;
}
