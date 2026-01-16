import type { Metadata } from 'next';
import { IBM_Plex_Mono, Geist, IBM_Plex_Sans } from 'next/font/google';
import clsx from 'clsx';
import { ClientTrailCursorCanvas } from '../components/ClientTrailCursorCanvas';
import { ClientTrailCursorDom } from '../components/ClientTrailCursorDom';

import { ThemeProvider } from '@/components/theme-provider';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import '@repo/ui/styles.css';
import '@/styles/globals.css';

import CustomNavigation from '@/components/navigation-desktop';

const geist = Geist({
    subsets: ['latin'],
    variable: '--font-geist',
});

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
    title: 'Taek Lim | Software Engineer & Fintech Developer',
    description:
        'Portfolio of Taek Lim — Software engineer specializing in fintech, databases, and full-stack development. Explore projects in trading systems, web apps, and data engineering.',
    other: {
        'google-site-verification':
            'vgnCaEjx8h0VBVFvMM43zWpoo2uc1gKlhBzFKLAkKkA',
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
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const locale = await getLocale(); // SSR 시점에서 locale 추출
    const messages = await getMessages(); // getRequestConfig 결과 자동 적용됨

    return (
        <html
            lang={locale}
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
                        <CustomNavigation />
                        {/* <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background">
                            <div className="mx-auto max-w-[95vw] px-2"></div>
                        </header> */}

                        {/* <header className={clsx('flex')}>
                            <NavigationMenuDemo />
                        </header> */}

                        <div className="flex-1">{children}</div>

                        {/* <footer>Main footer</footer> */}
                        {/* <ClientTrailCursorCanvas /> */}
                        {/* <ClientTrailCursorDom /> */}
                    </ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
