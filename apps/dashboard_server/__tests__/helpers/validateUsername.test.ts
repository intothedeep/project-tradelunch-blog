import { validateUsername } from '../../src/helpers/validateUsername';

describe('validateUsername', () => {
    it('accepts a valid lowercase slug', () => {
        const result = validateUsername('john_doe1');
        expect(result).toEqual({ ok: true, value: 'john_doe1' });
    });

    it('trims surrounding whitespace before validating', () => {
        const result = validateUsername('  alice  ');
        expect(result).toEqual({ ok: true, value: 'alice' });
    });

    it('rejects names shorter than 3 characters', () => {
        const result = validateUsername('ab');
        expect(result.ok).toBe(false);
    });

    it('rejects uppercase characters', () => {
        const result = validateUsername('JohnDoe');
        expect(result.ok).toBe(false);
    });

    it('rejects reserved words', () => {
        const result = validateUsername('admin');
        expect(result).toEqual({ ok: false, reason: 'username is reserved' });
    });

    it('rejects names longer than 30 characters', () => {
        const result = validateUsername('a'.repeat(31));
        expect(result.ok).toBe(false);
    });
});
