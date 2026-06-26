import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';

// The admin moderation table relies on TanStack Query infinite/mutation hooks;
// provide a client query context for the whole /admin subtree.
export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
