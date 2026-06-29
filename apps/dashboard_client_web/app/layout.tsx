import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import clsx from 'clsx';
import { ClerkProvider } from '@clerk/nextjs';

import { ThemeProvider } from '@/components/theme-provider';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider.client';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import '@/styles/globals.css';
import CustomNavigation from '@/components/navigation-desktop';
import { ScrollToTopButton } from '@/app/ScrollToTop';
import { SITE_URL } from '@/env.schema';

const ibmPlexMono = IBM_Plex_Mono({
    weight: ['400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-ibm-plex-mono',
});

// const ibmPlexSans = IBM_Plex_Sans({
//     subsets: ['latin'],
//     variable: '--font-ibm-plex-sans',
// });

export const metadata: Metadata = {
    // Base for resolving relative metadata URLs (canonical, og) to absolute
    // production URLs. Matches the sitemap/robots site-url convention.
    metadataBase: new URL(SITE_URL),
    title: 'Taek Lim | Software Engineer & Fintech Developer',
    description:
        'Portfolio of Taek Lim — Software engineer specializing in fintech, databases, and full-stack development. Explore projects in trading systems, web apps, and data engineering.',
    other: {
        'google-site-verification':
            process.env.NEXT_PUBLIC_GOOGLE_SEARCH_ENGINE ?? '',
        'google-adsense-account': process.env.NEXT_PUBLIC_GOOGLE_ADSENSE ?? '',
    },
    // TODO: add more metadata
    openGraph: {
        title: 'Taek Lim | Software Engineer & Fintech Developer',
        description:
            'Portfolio of Taek Lim — Software engineer specializing in fintech, databases, and full-stack development. Explore projects in trading systems, web apps, and data engineering.',
        url: 'https://my.prettylog.com',
        siteName: 'Taek Lim',
        images: [
            {
                url: 'https://my.prettylog.com/og-image.png',
                width: 1200,
                height: 630,
                alt: 'Taek Lim | Software Engineer & Fintech Developer',
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Taek Lim | Software Engineer & Fintech Developer',
        description:
            'Portfolio of Taek Lim — Software engineer specializing in fintech, databases, and full-stack development. Explore projects in trading systems, web apps, and data engineering.',
        images: ['https://my.prettylog.com/og-image.png'],
    },
    icons: {
        icon: [
            { url: '/favicon/favicon.ico', sizes: 'any' },
            {
                url: '/favicon/favicon-32x32.png',
                sizes: '32x32',
                type: 'image/png',
            },
            {
                url: '/favicon/favicon-16x16.png',
                sizes: '16x16',
                type: 'image/png',
            },
        ],
        apple: '/favicon/apple-touch-icon.png',
        other: [
            {
                rel: 'android-chrome-192x192',
                url: '/favicon/android-chrome-192x192.png',
            },
            {
                rel: 'android-chrome-512x512',
                url: '/favicon/android-chrome-512x512.png',
            },
        ],
    },
    manifest: '/favicon/site.webmanifest',
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const locale = await getLocale(); // SSR 시점에서 locale 추출
    const messages = await getMessages(); // getRequestConfig 결과 자동 적용됨

    return (
        <ClerkProvider>
            <html
                lang={locale}
                suppressHydrationWarning
                className={clsx(
                    // geist.variable,
                    // ibmPlexSans.variable,
                    ibmPlexMono.variable
                )}
            >
                <body
                    className={clsx(
                        // geist.className,
                        // ibmPlexSans.className,
                        'flex min-h-screen flex-col',
                        'bg-background text-foreground antialiased'
                        // ibmPlexMono.className
                    )}
                >
                    <NextIntlClientProvider
                        locale={locale}
                        messages={messages}
                    >
                        <ThemeProvider
                            // attribute="data-theme"
                            attribute="class"
                            defaultTheme="system"
                            enableSystem
                            disableTransitionOnChange
                        >
                            <ReactQueryProvider>
                                <CustomNavigation />
                                {/* <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background">
                                    <div className="mx-auto max-w-[95vw] px-2"></div>
                                </header> */}

                                {/* <header className={clsx('flex')}>
                                    <NavigationMenuDemo />
                                </header> */}

                                <div className="flex-1">{children}</div>

                                {/* Global scroll-to-top affordance: appears on
                                    every route once scrolled past the threshold
                                    (self-hides on short pages). */}
                                <ScrollToTopButton />

                                {/* <footer>Main footer</footer> */}
                                {/* <ClientTrailCursorCanvas /> */}
                                {/* <ClientTrailCursorDom /> */}
                            </ReactQueryProvider>
                        </ThemeProvider>
                    </NextIntlClientProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
