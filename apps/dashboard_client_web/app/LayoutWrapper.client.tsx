'use client';

import clsx from 'clsx';
import React from 'react';

type Props = {
    children: React.ReactNode;
    locale: string;
};

export const LayoutWrapper = ({ children, locale }: Props) => {
    return (
        <html
            lang={locale}
            className={
                clsx()
                // geist.variable,
                // ibmPlexSans.variable,
                // ibmPlexMono.variable
            }
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
                {children}
            </body>
        </html>
    );
};

export default LayoutWrapper;
