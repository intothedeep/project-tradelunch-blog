// utils/formatUsd.test.ts
// Purpose: lock the compact USD formatter against contract cases from the spec.

import { describe, it, expect } from 'vitest';
import { formatUsd } from '@/utils/formatUsd';

describe('formatUsd', () => {
    it('formats billions to 2 decimal places', () => {
        expect(formatUsd(1.23e9)).toBe('$1.23B');
    });

    it('formats millions to 1 decimal place', () => {
        expect(formatUsd(4.56e7)).toBe('$45.6M');
    });

    it('formats sub-million values with comma grouping', () => {
        expect(formatUsd(12345)).toBe('$12,345');
    });

    it('returns $0 for zero', () => {
        expect(formatUsd(0)).toBe('$0');
    });
});
