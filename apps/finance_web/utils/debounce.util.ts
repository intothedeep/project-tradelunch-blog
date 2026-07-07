// utils/debounce.util.ts
// Purpose: trailing-edge debounce. Returns a callable that defers invoking `fn`
// until `delayMs` has elapsed since the last call; exposes `.cancel()` so React
// effects can clear a pending timer on unmount.
// Constraints: deterministic; the only state is the closed-over timer handle.

export interface DebouncedFn<A extends unknown[]> {
    (...args: A): void;
    cancel: () => void;
}

export function debounce<A extends unknown[]>(
    fn: (...args: A) => void,
    delayMs: number
): DebouncedFn<A> {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const debounced = (...args: A): void => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn(...args);
        }, delayMs);
    };

    debounced.cancel = (): void => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    return debounced;
}
