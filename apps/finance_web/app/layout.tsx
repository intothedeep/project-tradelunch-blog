import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';
import '@/styles/globals.css';

// finance_web root layout — SKELETON.
// Real navigation, theme provider, and sidebar arrive in P3. i18n is wired now
// (next-intl): messages under messages/{en,ko}/common.json via i18n/request.ts.

export const metadata: Metadata = {
    title: 'Finance Dashboard',
    description: 'Private finance dashboard — owner tooling.',
    robots: {
        index: false,
        follow: false,
    },
};

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
                    {/* P3: ThemeProvider + nav shell */}
                    <NextIntlClientProvider locale={locale} messages={messages}>
                        <ReactQueryProvider>
                            <main className="flex-1">{children}</main>
                        </ReactQueryProvider>
                    </NextIntlClientProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
