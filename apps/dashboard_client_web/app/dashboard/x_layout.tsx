import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
