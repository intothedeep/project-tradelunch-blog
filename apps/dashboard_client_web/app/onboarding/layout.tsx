import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
