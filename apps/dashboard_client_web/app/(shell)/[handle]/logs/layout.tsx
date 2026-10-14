import { ContentFrame } from '@/components/shell/ContentFrame.server';

// Per-user log stream and focus view: global left rail from `(shell)`, no right
// rail. The pages bring their own max-w-2xl column inside the frame.
export default function LogsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ContentFrame main={children} />;
}
