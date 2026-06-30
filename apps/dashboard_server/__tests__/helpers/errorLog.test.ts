import { normalizeErrorLog } from '../../src/helpers/errorLog';

describe('normalizeErrorLog', () => {
    it('coerces a well-formed body and trims fields', () => {
        const row = normalizeErrorLog({
            digest: '  abc123  ',
            message: 'boom',
            stack: 'at foo()',
            path: '/dashboard',
            user_agent: 'jest',
            source: 'browser',
        });
        expect(row).toEqual({
            digest: 'abc123',
            message: 'boom',
            stack: 'at foo()',
            path: '/dashboard',
            userAgent: 'jest',
            source: 'browser',
        });
    });

    it('defaults source to "browser" and nulls absent/blank fields', () => {
        const row = normalizeErrorLog({ message: '   ' });
        expect(row).toEqual({
            digest: null,
            message: null,
            stack: null,
            path: null,
            userAgent: null,
            source: 'browser',
        });
    });

    it('returns an all-null default row for non-object bodies', () => {
        expect(normalizeErrorLog(null).source).toBe('browser');
        expect(normalizeErrorLog('oops').message).toBeNull();
        expect(normalizeErrorLog(42).stack).toBeNull();
    });

    it('drops unknown fields', () => {
        const row = normalizeErrorLog({ message: 'x', secret: 'leak' }) as Record<
            string,
            unknown
        >;
        expect(row.secret).toBeUndefined();
    });

    it('truncates message to 2000 and stack to 8000 chars', () => {
        const row = normalizeErrorLog({
            message: 'm'.repeat(5000),
            stack: 's'.repeat(20000),
        });
        expect(row.message).toHaveLength(2000);
        expect(row.stack).toHaveLength(8000);
    });
});
