import { ContentFrame } from '@/components/shell/ContentFrame.server';

// Owner-only page: same global left rail as every other screen (owner,
// 2026-10-14), no right rail. The owner check stays in the page (OwnerOnly),
// so anonymous requests still get a real 404.
export default function OwnerPageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ContentFrame main={children} />;
}
