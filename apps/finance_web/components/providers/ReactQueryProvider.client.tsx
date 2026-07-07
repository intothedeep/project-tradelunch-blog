'use client';

// Placeholder ReactQueryProvider — full configuration (staleTime, retry,
// devtools) arrives in P3 when query hooks are wired to finance_api.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function ReactQueryProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [client] = useState(() => new QueryClient());
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
