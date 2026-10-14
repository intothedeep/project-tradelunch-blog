'use client';

import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="prose max-w-2xl mx-auto p-4 text-center">
            <h2>Something went wrong!</h2>
            <p>Failed to load the blog post.</p>
            <Button onClick={() => reset()}>Try again</Button>
        </div>
    );
}
