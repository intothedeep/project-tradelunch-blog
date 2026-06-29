// components/rail/RailSection.test.tsx
// Purpose: lock the rail disclosure behaviour — the header button reflects the
// open/closed state via aria-expanded and toggles it on click, and the content
// region is wired to the header via aria-controls.

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { RailSection } from '@/components/rail/RailSection.client';

afterEach(cleanup);

describe('RailSection', () => {
    it('starts open and toggles aria-expanded on click', () => {
        render(
            <RailSection title="Popular tags">
                <span>chip</span>
            </RailSection>
        );

        const header = screen.getByRole('button', { name: /popular tags/i });
        expect(header.getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(header);
        expect(header.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(header);
        expect(header.getAttribute('aria-expanded')).toBe('true');
    });

    it('wires the content region to the header via aria-controls', () => {
        render(
            <RailSection title="Popular tags">
                <span>chip</span>
            </RailSection>
        );

        const header = screen.getByRole('button', { name: /popular tags/i });
        const controls = header.getAttribute('aria-controls');
        expect(controls).toBeTruthy();
        expect(document.getElementById(controls!)).not.toBeNull();
    });
});
