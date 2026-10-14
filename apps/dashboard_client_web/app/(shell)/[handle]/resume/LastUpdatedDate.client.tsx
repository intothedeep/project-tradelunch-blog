'use client';

import { useSyncExternalStore } from 'react';

// Today's date, read in the browser only: a render-time `new Date()` in the
// server page would make the route dynamic. The server snapshot is empty, so
// the markup is identical until hydration, then the real date shows.
const subscribe = () => () => {};
const getDate = () => new Date().toLocaleDateString();
const getServerDate = () => '';

export const LastUpdatedDate = () => {
    const date = useSyncExternalStore(subscribe, getDate, getServerDate);
    return <span>{date}</span>;
};

export default LastUpdatedDate;
