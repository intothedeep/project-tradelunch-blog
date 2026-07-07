'use client';

import { useEffect, useState } from 'react';

const getMatches = (query: string) => {
    if (typeof window !== 'undefined') {
        return window.matchMedia(query).matches;
    }

    return false;
};

/**
 *
 * @param query
 * @returns matches
 *
 *     const { matches } = useMediaQuery('(prefers-color-scheme: dark)');
 */
export const useMediaQuery = (query: string) => {
    // const [matches, setMatches] = useState<boolean>(() => getMatches(query));
    const [matches, setMatches] = useState<boolean>(getMatches(query));

    useEffect(() => {
        const matchMedia = window.matchMedia(query);

        const handleMatchChange = () => {
            const flag = getMatches(query);
            setMatches(flag);
        };

        try {
            matchMedia.addEventListener('change', handleMatchChange);
        } catch (e) {
            // for old browser
            console.log('old browser: ', e);
            matchMedia.addListener(handleMatchChange);
        }

        return () => {
            try {
                matchMedia.removeEventListener('change', handleMatchChange);
            } catch (e) {
                console.log('old browser: ', e);
                // for old browser
                matchMedia.removeListener(handleMatchChange);
            }
        };
    }, [query]);

    return {
        matches,
    };
};
