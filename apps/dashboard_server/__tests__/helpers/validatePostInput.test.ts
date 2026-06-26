import { validatePostInput } from '../../src/helpers/validatePostInput';

describe('validatePostInput', () => {
    it('accepts a minimal valid body (title only)', () => {
        const result = validatePostInput({ title: 'My Post' });
        expect(result).toEqual({ ok: true, value: { title: 'My Post' } });
    });

    it('accepts a full valid body', () => {
        const result = validatePostInput({
            title: 'T',
            content: 'body',
            description: 'desc',
            categoryId: 3,
            status: 'draft',
            slug: 'my-slug',
        });
        expect(result.ok).toBe(true);
    });

    it('accepts categoryId null', () => {
        const result = validatePostInput({ title: 'T', categoryId: null });
        expect(result.ok).toBe(true);
    });

    it('accepts a draft with an empty title (stored as "")', () => {
        const result = validatePostInput({ title: '   ', status: 'draft' });
        expect(result).toEqual({
            ok: true,
            value: { title: '', status: 'draft' },
        });
    });

    it('accepts a draft with an absent title (absent status treated as draft)', () => {
        expect(validatePostInput({}).ok).toBe(true);
        expect(validatePostInput({ content: 'body-first draft' }).ok).toBe(true);
    });

    it('rejects an empty/whitespace title when publishing (non-draft)', () => {
        expect(validatePostInput({ title: '   ', status: 'public' })).toEqual({
            ok: false,
            reason: 'title is required',
        });
        expect(validatePostInput({ status: 'public' }).ok).toBe(false);
    });

    it('rejects a title longer than 255 characters regardless of status', () => {
        expect(validatePostInput({ title: 'a'.repeat(256) }).ok).toBe(false);
        expect(
            validatePostInput({ title: 'a'.repeat(256), status: 'draft' }).ok,
        ).toBe(false);
        expect(
            validatePostInput({ title: 'a'.repeat(256), status: 'public' }).ok,
        ).toBe(false);
    });

    it('rejects an unknown status', () => {
        const result = validatePostInput({ title: 'T', status: 'archived' });
        expect(result).toEqual({ ok: false, reason: 'status is invalid' });
    });

    it('rejects a non-string content', () => {
        expect(validatePostInput({ title: 'T', content: 5 }).ok).toBe(false);
    });

    it('rejects a non-object body', () => {
        expect(validatePostInput('nope').ok).toBe(false);
        expect(validatePostInput(null).ok).toBe(false);
    });
});
