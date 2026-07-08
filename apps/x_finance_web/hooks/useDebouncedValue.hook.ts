// hooks/useDebouncedValue.hook.ts
// Purpose: return a debounced copy of a fast-changing value, settling only after
//   `delay` ms of quiet. Used to defer the saved-posts search query so a fresh
//   paginated stream starts once per term, not once per keystroke.
// Constraints: client-only (uses useState/useEffect/timer). Deterministic given
//   value + delay; the timer is the only side effect and is always cleared.

'use client';

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}
