'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// next-themes renders an inline <script> that sets the theme class before
// paint. The server copy is the one that runs; when React renders it again in
// the browser (theme change, client re-render) React 19 warns "Encountered a
// script tag". A non-JS type on the client keeps the server script working and
// silences the warning (next-themes issues #385, #387).
const clientScriptProps =
    typeof window === 'undefined'
        ? undefined
        : ({ type: 'application/json' } as const);

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider
            scriptProps={clientScriptProps}
            {...props}
        >
            {children}
        </NextThemesProvider>
    );
}
