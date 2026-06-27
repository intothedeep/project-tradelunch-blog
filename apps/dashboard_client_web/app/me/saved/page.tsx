import { SavedPostsList } from '@/components/me/SavedPostsList.client';

// Per-user saved-posts route: must never be statically prerendered (the client
// list uses TanStack Query, which has no QueryClient during static export →
// build error). Render dynamically, matching app/me/page.tsx. Auth is inherited
// from the '/me(.*)' middleware matcher (no matcher edit).
export const dynamic = 'force-dynamic';

// Saved-posts list route. Thin Server Component shell → client list (no data here).
export default function SavedPostsPage() {
    return <SavedPostsList />;
}
