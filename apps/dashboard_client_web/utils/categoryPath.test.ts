// utils/categoryPath.test.ts
// Purpose: lock the pure cascader helpers — string-id normalization, child
// selection (null = roots), and root→leaf path rebuild including cycle safety.

import { describe, it, expect } from 'vitest';
import {
    normalizeId,
    selectChildren,
    buildPath,
    type TCategoryItem,
} from '@/utils/categoryPath';

// invest(1) ▸ stocks(2) ▸ chips(3); life(4) sibling root.
const nodes: TCategoryItem[] = [
    { id: '1', parentId: null, title: 'invest' },
    { id: '2', parentId: '1', title: 'stocks' },
    { id: '3', parentId: '2', title: 'chips' },
    { id: '4', parentId: null, title: 'life' },
];

describe('normalizeId', () => {
    it('coerces numbers and strings to the same string key', () => {
        expect(normalizeId(1)).toBe('1');
        expect(normalizeId('1')).toBe('1');
    });
});

describe('selectChildren', () => {
    it('returns the roots when parentId is null', () => {
        expect(selectChildren(nodes, null).map((n) => n.id)).toEqual([
            '1',
            '4',
        ]);
    });

    it('returns direct children of a parent (string/number agnostic)', () => {
        expect(selectChildren(nodes, '1').map((n) => n.id)).toEqual(['2']);
        expect(selectChildren(nodes, '2').map((n) => n.id)).toEqual(['3']);
    });

    it('returns empty for a leaf with no children', () => {
        expect(selectChildren(nodes, '3')).toEqual([]);
    });
});

describe('buildPath', () => {
    it('returns empty for a null leaf', () => {
        expect(buildPath(nodes, null)).toEqual([]);
    });

    it('rebuilds the ordered root→leaf chain', () => {
        expect(buildPath(nodes, '3').map((n) => n.id)).toEqual(['1', '2', '3']);
        expect(buildPath(nodes, '1').map((n) => n.id)).toEqual(['1']);
    });

    it('returns empty when the leaf id is absent', () => {
        expect(buildPath(nodes, '999')).toEqual([]);
    });

    it('stops on an accidental cycle without looping forever', () => {
        const cyclic: TCategoryItem[] = [
            { id: 'a', parentId: 'b', title: 'a' },
            { id: 'b', parentId: 'a', title: 'b' },
        ];
        expect(buildPath(cyclic, 'a').length).toBeLessThanOrEqual(2);
    });
});
