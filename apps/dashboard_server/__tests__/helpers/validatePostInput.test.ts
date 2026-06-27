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

    it('accepts a string thumbnailUrl and threads it into value', () => {
        const url =
            'https://assets.prettylog.com/blog.prettylog/42/x-1.png';
        const result = validatePostInput({ title: 'T', thumbnailUrl: url });
        expect(result).toEqual({
            ok: true,
            value: { title: 'T', thumbnailUrl: url },
        });
    });

    it('accepts a null thumbnailUrl (clear) and keeps it in value', () => {
        const result = validatePostInput({ title: 'T', thumbnailUrl: null });
        expect(result).toEqual({
            ok: true,
            value: { title: 'T', thumbnailUrl: null },
        });
    });

    it('omits thumbnailUrl from value when absent (untouched)', () => {
        const result = validatePostInput({ title: 'T' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect('thumbnailUrl' in result.value).toBe(false);
        }
    });

    it('rejects a non-string, non-null thumbnailUrl', () => {
        const result = validatePostInput({ title: 'T', thumbnailUrl: 123 });
        expect(result).toEqual({
            ok: false,
            reason: 'thumbnailUrl must be a string or null',
        });
    });
});
