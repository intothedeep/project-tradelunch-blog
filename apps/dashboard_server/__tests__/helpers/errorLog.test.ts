import {
    normalizeErrorLog,
    buildExpressErrorRow,
} from '../../src/helpers/errorLog';

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

describe('buildExpressErrorRow', () => {
    it('extracts message + stack from an Error and tags source=express', () => {
        const err = new Error('boom');
        err.stack = 'at handler()';
        const row = buildExpressErrorRow(err, '/v1/api/posts', 'jest-agent');
        expect(row).toEqual({
            digest: null,
            message: 'boom',
            stack: 'at handler()',
            path: '/v1/api/posts',
            userAgent: 'jest-agent',
            source: 'express',
        });
    });

    it('handles non-Error throws (string / object) with null stack', () => {
        expect(buildExpressErrorRow('plain string', undefined, undefined)).toMatchObject({
            message: 'plain string',
            stack: null,
            path: null,
            userAgent: null,
            source: 'express',
        });
        expect(buildExpressErrorRow({ code: 42 }, undefined, undefined)).toMatchObject({
            message: '{"code":42}',
            stack: null,
        });
    });

    it('truncates message and stack to the shared caps', () => {
        const err = new Error('m'.repeat(5000));
        err.stack = 's'.repeat(20000);
        const row = buildExpressErrorRow(err, undefined, undefined);
        expect(row.message).toHaveLength(2000);
        expect(row.stack).toHaveLength(8000);
    });
});
