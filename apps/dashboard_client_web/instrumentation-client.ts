// instrumentation-client.ts
// Purpose: Phase CC U0a client navigation timing (cc.design.md §5.4). Prints
// `[nav] <from> <to> <ms>` to the console for each push/replace navigation.
// Off unless `localStorage.navTiming === '1'` (set it in DevTools, reload), so
// ordinary visitors run nothing. No data leaves the browser.
// Method: onRouterTransitionStart gives the start. The App Router commits a
// finished push/replace by calling history.pushState/replaceState, so the first
// such call after the start is the commit. Traverse (back/forward) has no
// history call to observe: it is not timed here (W2 counts `_rsc` requests).

type TPending = { from: string; to: string; startedAt: number };

let pending: TPending | null = null;

function isEnabled(): boolean {
    try {
        return localStorage.getItem('navTiming') === '1';
    } catch {
        return false;
    }
}

function commit(): void {
    if (!pending) return;
    const { from, to, startedAt } = pending;
    pending = null;
    console.info('[nav]', from, to, Math.round(performance.now() - startedAt));
}

if (isEnabled()) {
    for (const method of ['pushState', 'replaceState'] as const) {
        const original = history[method].bind(history);
        history[method] = (...args: Parameters<History['pushState']>) => {
            original(...args);
            commit();
        };
    }
}

export function onRouterTransitionStart(
    url: string,
    navigationType: 'push' | 'replace' | 'traverse'
) {
    if (!isEnabled() || navigationType === 'traverse') return;
    pending = {
        from: location.pathname,
        to: url,
        startedAt: performance.now(),
    };
}
