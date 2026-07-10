// Unit tests for helpers/log/write.ts (Phase Y — Y-T12).
//
// Covers:
//   (a) Reply-to-a-reply → createLog returns a TLog with depth ≥ 2 (recursive,
//       no depth guard).
//   (e) BIGINT id integrity: an id > 2^53 round-trips with no precision loss
//       (stays string, never Number()).
//   (f) Blog-surface isolation guard: every SQL text passed to the mocked
//       query function touches only `log`/`users`, never `posts`/`comments`.
//
// All DB calls are mocked — no live Postgres required.
//
// Mock strategy:
//   * createLog/softDeleteLog call pool.connect() to get a PoolClient.
//   * We build a fake pool whose connect() returns a client with a jest.fn() .query.
//   * Each test supplies its own client so call sequences are isolated.

import {
    createLog,
    softDeleteLog,
    assertLogMutable,
    LogParentError,
    LogForbiddenError,
    LogNotFoundError,
} from '../../../src/helpers/log';

// ---------------------------------------------------------------------------
// Fake client + pool factories
// ---------------------------------------------------------------------------

// Creates a fake PoolClient with a jest.fn() as .query.
function makeClientWithMock() {
    const query = jest.fn();
    const client = {
        query,
        release: jest.fn(),
    };
    return client;
}

// Wraps a client in a pool-shaped object whose .connect() resolves it.
function poolFrom(client: ReturnType<typeof makeClientWithMock>) {
    return {
        connect: () => Promise.resolve(client),
    } as never;
}

// Helper: make a minimal TLogRow DB projection result
function makeLogRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '42',
        user_id: '1',
        parent_id: null,
        path: ['42'],
        depth: '0',
        body: 'hello',
        is_deleted: false,
        author_name: 'alice',
        created_at: '2026-07-10T00:00:00Z',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// (a) Reply-to-a-reply → depth ≥ 2 (recursive, no depth guard)
// ---------------------------------------------------------------------------
describe('createLog — reply-to-a-reply (a)', () => {
    it('returns a depth-2 TLog when parent is depth-1 (recursive, no depth guard)', async () => {
        const client = makeClientWithMock();

        // Call sequence for createLog with a non-null parentId:
        //   0: BEGIN
        //   1: SELECT parent (findLog)
        //   2: INSERT RETURNING id
        //   3: UPDATE path + SELECT projection
        //   4: COMMIT
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: '200',
                        user_id: '5',
                        path: ['100', '200'],
                        deleted_at: null,
                    },
                ],
            }) // findLog: parent at depth-1
            .mockResolvedValueOnce({ rows: [{ id: '300' }] }) // INSERT
            .mockResolvedValueOnce({
                rows: [
                    makeLogRow({
                        id: '300',
                        user_id: '7',
                        parent_id: '200',
                        path: ['100', '200', '300'],
                        depth: '2',
                    }),
                ],
            }) // UPDATE+SELECT
            .mockResolvedValueOnce({}); // COMMIT

        const result = await createLog(
            poolFrom(client),
            7,
            '200',
            'deep reply'
        );

        expect(result.depth).toBe(2);
        expect(result.path).toEqual(['100', '200', '300']);
        expect(result.parentId).toBe('200');
        expect(result.id).toBe('300');
    });
});

// ---------------------------------------------------------------------------
// (e) BIGINT id integrity — id > 2^53 stays string, never Number()
// ---------------------------------------------------------------------------
describe('createLog — BIGINT id integrity (e)', () => {
    it('returns id as string with no precision loss for id > 2^53', async () => {
        const bigId = '9223372036854775806'; // max int8 - 1
        const client = makeClientWithMock();

        // top-level post (parentId=null) — no parent lookup
        //   0: BEGIN
        //   1: INSERT RETURNING id
        //   2: UPDATE+SELECT
        //   3: COMMIT
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: bigId }] }) // INSERT
            .mockResolvedValueOnce({
                rows: [makeLogRow({ id: bigId, path: [bigId], depth: '0' })],
            }) // UPDATE+SELECT
            .mockResolvedValueOnce({}); // COMMIT

        const result = await createLog(
            poolFrom(client),
            1,
            null,
            'top-level post'
        );

        expect(typeof result.id).toBe('string');
        expect(result.id).toBe(bigId);

        // Path entries must also be strings
        expect(result.path.every((p) => typeof p === 'string')).toBe(true);
        expect(result.path[0]).toBe(bigId);
    });
});

// ---------------------------------------------------------------------------
// (f) Blog-surface isolation: SQL text never touches posts/comments
// ---------------------------------------------------------------------------
describe('createLog — blog-surface isolation (f)', () => {
    it('SQL queries touch only log and users tables, never posts/comments', async () => {
        const client = makeClientWithMock();

        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: '1001' }] }) // INSERT
            .mockResolvedValueOnce({
                rows: [makeLogRow({ id: '1001', path: ['1001'] })],
            }) // UPDATE+SELECT
            .mockResolvedValueOnce({}); // COMMIT

        await createLog(poolFrom(client), 1, null, 'isolation check');

        const sqls = client.query.mock.calls.map((c: unknown[]) =>
            String(c[0]).toLowerCase()
        );

        for (const sql of sqls) {
            expect(sql).not.toMatch(/\bposts\b/);
            expect(sql).not.toMatch(/\bcomments\b/);
        }

        // INSERT and UPDATE should reference the log table
        const logRefs = sqls.filter((s: string) => s.includes('log'));
        expect(logRefs.length).toBeGreaterThanOrEqual(2);
    });

    it('softDeleteLog SQL touches only log table, never posts/comments', async () => {
        const client = makeClientWithMock();

        // softDeleteLog with caller = author (user_id match → no root lookup)
        //   0: BEGIN
        //   1: SELECT (findLog)
        //   2: UPDATE del CTE + SELECT
        //   3: COMMIT
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({
                rows: [
                    { id: '42', user_id: '1', path: ['42'], deleted_at: null },
                ],
            }) // findLog
            .mockResolvedValueOnce({
                rows: [
                    makeLogRow({
                        id: '42',
                        body: '[deleted]',
                        is_deleted: true,
                        author_name: null,
                    }),
                ],
            }) // UPDATE
            .mockResolvedValueOnce({}); // COMMIT

        await softDeleteLog(poolFrom(client), '42', 1, false);

        const sqls = client.query.mock.calls.map((c: unknown[]) =>
            String(c[0]).toLowerCase()
        );
        for (const sql of sqls) {
            expect(sql).not.toMatch(/\bposts\b/);
            expect(sql).not.toMatch(/\bcomments\b/);
        }
    });
});

// ---------------------------------------------------------------------------
// createLog — LogParentError when parent is deleted or missing
// ---------------------------------------------------------------------------
describe('createLog — LogParentError (deleted or missing parent)', () => {
    it('throws LogParentError when parent exists but is deleted', async () => {
        const client = makeClientWithMock();

        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: '10',
                        user_id: '1',
                        path: ['10'],
                        deleted_at: '2026-07-01T00:00:00Z',
                    },
                ],
            }) // findLog: deleted parent
            .mockResolvedValueOnce({}); // ROLLBACK

        await expect(
            createLog(poolFrom(client), 1, '10', 'reply to dead parent')
        ).rejects.toBeInstanceOf(LogParentError);
    });

    it('throws LogParentError when parent row does not exist', async () => {
        const client = makeClientWithMock();

        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // findLog: missing
            .mockResolvedValueOnce({}); // ROLLBACK

        await expect(
            createLog(poolFrom(client), 1, '99', 'ghost parent')
        ).rejects.toBeInstanceOf(LogParentError);
    });
});

// ---------------------------------------------------------------------------
// softDeleteLog — error cases
// ---------------------------------------------------------------------------
describe('softDeleteLog — error cases', () => {
    it('throws LogNotFoundError when log node does not exist', async () => {
        const client = makeClientWithMock();

        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // findLog: not found
            .mockResolvedValueOnce({}); // ROLLBACK

        await expect(
            softDeleteLog(poolFrom(client), '999', 1, false)
        ).rejects.toBeInstanceOf(LogNotFoundError);
    });

    it('throws LogForbiddenError when caller is not author, not root-owner, not admin', async () => {
        const client = makeClientWithMock();

        // assertLogMutable: not author (7≠5), not admin → look up root (100)
        // root owner is 9 (≠7) → forbidden
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: '42',
                        user_id: '5',
                        path: ['100', '42'],
                        deleted_at: null,
                    },
                ],
            }) // findLog
            .mockResolvedValueOnce({ rows: [{ user_id: '9' }] }) // root lookup
            .mockResolvedValueOnce({}); // ROLLBACK

        await expect(
            softDeleteLog(poolFrom(client), '42', 7, false)
        ).rejects.toBeInstanceOf(LogForbiddenError);
    });

    it('allows delete when caller is the root-stream owner (path[0] owner)', async () => {
        const client = makeClientWithMock();

        // caller=7, target.user_id=5 (not author), not admin
        // root '100' owned by 7 (caller) → allowed
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: '42',
                        user_id: '5',
                        path: ['100', '42'],
                        deleted_at: null,
                    },
                ],
            }) // findLog
            .mockResolvedValueOnce({ rows: [{ user_id: '7' }] }) // root lookup
            .mockResolvedValueOnce({
                rows: [
                    makeLogRow({
                        id: '42',
                        body: '[deleted]',
                        is_deleted: true,
                        author_name: null,
                    }),
                ],
            }) // UPDATE del
            .mockResolvedValueOnce({}); // COMMIT

        const result = await softDeleteLog(poolFrom(client), '42', 7, false);
        expect(result.isDeleted).toBe(true);
        expect(result.body).toBe('[deleted]');
        expect(result.authorName).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// assertLogMutable (pure unit — uses a fake db directly)
// ---------------------------------------------------------------------------
describe('assertLogMutable (unit)', () => {
    it('allows when caller is the author (user_id match)', async () => {
        const dbQuery = jest.fn();
        const db = { query: dbQuery } as never;
        await expect(
            assertLogMutable(db, { user_id: '3', path: ['3'] }, 3, false)
        ).resolves.toBeUndefined();
        // Author short-circuit: no DB call
        expect(dbQuery).not.toHaveBeenCalled();
    });

    it('allows when caller is admin (admin short-circuit)', async () => {
        const dbQuery = jest.fn();
        const db = { query: dbQuery } as never;
        await expect(
            assertLogMutable(db, { user_id: '99', path: ['99'] }, 1, true)
        ).resolves.toBeUndefined();
        expect(dbQuery).not.toHaveBeenCalled();
    });

    it('throws LogForbiddenError when caller is not author, not root-owner, not admin', async () => {
        const dbQuery = jest
            .fn()
            .mockResolvedValueOnce({ rows: [{ user_id: '9' }] }); // root owner ≠ caller
        const db = { query: dbQuery } as never;
        await expect(
            assertLogMutable(
                db,
                { user_id: '5', path: ['100', '42'] },
                7,
                false
            )
        ).rejects.toBeInstanceOf(LogForbiddenError);
    });
});
