import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';

// The /me subtree relies on TanStack Query query/mutation hooks
// (MyPostsList → useMyDrafts); provide a client query context.
export default function MeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
