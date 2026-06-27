'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
    error,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
    }, [error]);

    return (
        <div>
            <h2>Something went wrong</h2>
            <h3>{error.message}</h3>
            <pre>{error.stack}</pre>
        </div>
    );
}
