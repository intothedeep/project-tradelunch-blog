import { MyPostsList } from '@/components/me/MyPostsList.client';

// Per-user drafts route: must never be statically prerendered (the client list
// uses TanStack Query, which has no QueryClient during static export → build
// error). Render dynamically, matching app/blog/[username]/page.tsx.
export const dynamic = 'force-dynamic';

// Drafts list route. Thin Server Component shell → client list (no data here).
export default function MyPostsPage() {
    return <MyPostsList />;
}
