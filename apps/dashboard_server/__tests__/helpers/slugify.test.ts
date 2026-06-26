import { slugify } from '../../src/helpers/slugify';

describe('slugify', () => {
    it('lowercases and replaces spaces with dashes', () => {
        expect(slugify('Hello World')).toBe('hello-world');
    });

    it('strips non [a-z0-9-] characters', () => {
        expect(slugify('Café & Bar!!')).toBe('caf-bar');
    });

    it('collapses repeated dashes and trims edges', () => {
        expect(slugify('  --a   b--  ')).toBe('a-b');
    });

    it('falls back to "post" for empty/symbol-only input', () => {
        expect(slugify('')).toBe('post');
        expect(slugify('!!!')).toBe('post');
    });
});
