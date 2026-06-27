// components/write/ThumbnailPicker.test.tsx
// Purpose: UX12b regression guard — the thumbnail control renders a preview when
// a URL is set, exposes a clear action that fires onClear, and hides both the
// preview and the clear button when no thumbnail is set.
// Strategy: render with RTL; stub next-intl so labels are deterministic keys.

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Stub next-intl: t(key) returns the key verbatim so assertions are stable and
// independent of the en/ko message values.
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

import { ThumbnailPicker } from '@/components/write/ThumbnailPicker.client';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const baseProps = {
    onPick: vi.fn(),
    onClear: vi.fn(),
    isUploading: false,
    isStorageDisabled: false,
    error: null,
};

describe('ThumbnailPicker — UX12b', () => {
    it('renders a preview image and a clear button when a thumbnail URL is set', () => {
        render(
            <ThumbnailPicker
                {...baseProps}
                thumbnailUrl="https://cdn.example/blog.prettylog/thumb.png"
            />
        );

        const img = screen.getByRole('img', { name: 'a11y.thumbnailPreview' });
        expect(img).toBeDefined();
        expect(img.getAttribute('src')).toBe(
            'https://cdn.example/blog.prettylog/thumb.png'
        );
        // Replace + clear are both present.
        expect(screen.getByText('settings.thumbnailReplace')).toBeDefined();
        expect(screen.getByText('settings.thumbnailClear')).toBeDefined();
    });

    it('clear button invokes onClear', () => {
        const onClear = vi.fn();
        render(
            <ThumbnailPicker
                {...baseProps}
                onClear={onClear}
                thumbnailUrl="https://cdn.example/thumb.png"
            />
        );

        fireEvent.click(screen.getByText('settings.thumbnailClear'));
        expect(onClear).toHaveBeenCalledOnce();
    });

    it('shows the pick label and no preview/clear when no thumbnail is set', () => {
        render(
            <ThumbnailPicker
                {...baseProps}
                thumbnailUrl={null}
            />
        );

        expect(screen.getByText('settings.thumbnailPick')).toBeDefined();
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.queryByText('settings.thumbnailClear')).toBeNull();
    });
});
