'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
    error,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div>
            <h2>
                Something went wrong fetching the cateories!{' '}
                {error.message.toString()}
                {error.name}
            </h2>
        </div>
    );
}
