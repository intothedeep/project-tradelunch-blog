// hooks/useUnsavedGuard.hook.ts
// Purpose: warn on hard unload (tab close / refresh) while the editor holds
// unsaved edits, so the browser shows its native "leave?" prompt.
// Constraints: client-only. `beforeunload` does NOT fire on SPA navigation —
// in-app nav loss is closed by flush-on-unmount in useDraftAutosave, not here.
// Side effects: registers/removes a window `beforeunload` listener.

'use client';

import { useEffect } from 'react';

export function useUnsavedGuard(isDirty: boolean): void {
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            // Legacy browsers require a returnValue to trigger the prompt.
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
}
