import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';

// The editor relies on TanStack Query mutation/query hooks; provide a client
// query context for the whole /write subtree.
export default function WriteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
