import Link from 'next/link';

import { DelistedChart } from '@/components/shell/DelistedChart';
import { MissingPath } from '@/components/shell/MissingPath.client';

export const metadata = {
    title: 'Page Not Found',
    robots: { index: false },
};

const SUGGESTIONS = [
    { cmd: 'cd ~', href: '/', note: 'home' },
    { cmd: 'ls /blog', href: '/blog', note: 'posts' },
    { cmd: 'ls /log', href: '/log', note: 'short notes' },
] as const;

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-8 px-4 py-12 font-mono">
            <DelistedChart />

            <div className="w-full max-w-md rounded-md border border-border bg-card/50 p-4 text-sm">
                <p>
                    <span className="text-primary">$</span> open <MissingPath />
                </p>
                <p className="mt-1 text-destructive">
                    error 404: this page was delisted (or never went public)
                </p>
                <p className="mt-3 text-muted-foreground"># try one of these</p>
                <ul className="mt-1 space-y-1">
                    {SUGGESTIONS.map((s) => (
                        <li key={s.href}>
                            <Link
                                href={s.href}
                                prefetch={false}
                                className="group inline-flex gap-2 hover:text-primary"
                            >
                                <span className="text-primary">$</span>
                                <span className="underline-offset-4 group-hover:underline">
                                    {s.cmd}
                                </span>
                                <span className="text-muted-foreground">
                                    # {s.note}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <Link
                href="/"
                prefetch={false}
                className="rounded-md border border-primary px-4 py-2 text-sm text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
                ← return home
            </Link>
        </main>
    );
}
