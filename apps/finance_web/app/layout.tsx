import type { Metadata } from 'next';
import Link from 'next/link';
import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';
import '@/styles/globals.css';

export const metadata: Metadata = {
    title: 'Finance Dashboard',
    description: 'Private finance dashboard — owner tooling.',
    robots: {
        index: false,
        follow: false,
    },
};

// Finance nav links — mirrors the buildNavLinks() pure function from
// useNavLinks.hook.ts. Inlined here because the hook file carries 'use client'
// (for usePrimaryNavLinks/useUser) and cannot be imported in a Server Component.
const FINANCE_NAV = [
    { title: 'dashboard', href: '/dashboard' },
    { title: 'SEC 13F funds', href: '/funds' },
    { title: 'marketcap rankings', href: '/rankings' },
    { title: 'screener', href: '/screener' },
    { title: 'politicians', href: '/politicians' },
    { title: 'backtest', href: '/backtest' },
] as const;

function FinanceNav() {
    return (
        <nav className="border-b border-border bg-background px-4 py-2">
            <div className="mx-auto flex max-w-7xl items-center gap-6">
                <span className="text-sm font-semibold text-foreground">
                    MARKETS
                </span>
                <div className="flex items-center gap-4">
                    {FINANCE_NAV.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {link.title}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <ClerkProvider>
            <html lang={locale} suppressHydrationWarning>
                <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
                    <NextIntlClientProvider locale={locale} messages={messages}>
                        <ReactQueryProvider>
                            <FinanceNav />
                            <main className="flex-1">{children}</main>
                        </ReactQueryProvider>
                    </NextIntlClientProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
