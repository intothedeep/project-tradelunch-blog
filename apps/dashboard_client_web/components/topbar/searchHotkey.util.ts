// Purpose: pure helpers for the ⌘K / Ctrl+K search shortcut.

export const isSearchHotkey = (event: KeyboardEvent): boolean =>
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    event.key.toLowerCase() === 'k';

// Typing a literal "k" with a modifier inside a field must not be hijacked.
export const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
    );
};

export const isMacPlatform = (): boolean =>
    /Mac|iPhone|iPad/i.test(navigator.platform);
