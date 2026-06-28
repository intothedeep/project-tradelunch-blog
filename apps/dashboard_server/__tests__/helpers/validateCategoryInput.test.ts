import { validateCategoryInput } from '../../src/helpers/validateCategoryInput';

describe('validateCategoryInput', () => {
    it('accepts a root category (no parentId) and lowercases/trims the title', () => {
        const result = validateCategoryInput({ title: '  Investing ' });
        expect(result).toEqual({
            ok: true,
            value: { title: 'investing', parentId: null },
        });
    });

    it('normalizes an explicit null parentId to null', () => {
        const result = validateCategoryInput({ title: 'tech', parentId: null });
        expect(result).toEqual({
            ok: true,
            value: { title: 'tech', parentId: null },
        });
    });

    it('accepts a numeric-string parentId', () => {
        const result = validateCategoryInput({ title: 'stocks', parentId: '42' });
        expect(result).toEqual({
            ok: true,
            value: { title: 'stocks', parentId: '42' },
        });
    });

    it('rejects a missing/non-string title', () => {
        expect(validateCategoryInput({}).ok).toBe(false);
        expect(validateCategoryInput({ title: 5 }).ok).toBe(false);
    });

    it('rejects an empty/whitespace title', () => {
        expect(validateCategoryInput({ title: '   ' })).toEqual({
            ok: false,
            reason: 'title is required',
        });
    });

    it('rejects a title longer than 100 characters', () => {
        const result = validateCategoryInput({ title: 'a'.repeat(101) });
        expect(result).toEqual({
            ok: false,
            reason: 'title must be 100 characters or fewer',
        });
    });

    it('accepts a title exactly 100 characters', () => {
        expect(validateCategoryInput({ title: 'a'.repeat(100) }).ok).toBe(true);
    });

    it('rejects a non-numeric-string parentId', () => {
        expect(validateCategoryInput({ title: 't', parentId: 'abc' })).toEqual({
            ok: false,
            reason: 'parentId must be a numeric string or null',
        });
        expect(validateCategoryInput({ title: 't', parentId: 42 }).ok).toBe(
            false,
        );
    });

    it('rejects a non-object body', () => {
        expect(validateCategoryInput('nope').ok).toBe(false);
        expect(validateCategoryInput(null).ok).toBe(false);
    });
});
