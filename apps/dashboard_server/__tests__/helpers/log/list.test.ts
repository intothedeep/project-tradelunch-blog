// Unit tests for helpers/log/list.ts (Phase Y — Y-T12).
//
// Covers:
//   (b) Ancestor chain correctness — deleted ancestor is masked-but-present,
//       ordered root→…→parent.
//   (c) Depth-1 children keyset: 2-page cursor continuity (oldest-first) +
//       dead-leaf prune (deleted child with NO live descendant → hidden) vs
//       deleted-ancestor-with-live-descendant survives (masked).
//   (f) Blog-surface isolation: SQL text touches only `log` + `users`, never
//       `posts`/`comments`.
//
// All DB calls are mocked — no live Postgres required.
//
// Query call sequence in listLogThread:
//   1. Focus query (always)
//   2. Ancestor query (ONLY when ancestorIds.length > 0 — skipped for top-level)
//   3. Children query (always)

const mockDbQuery = jest.fn();

import { listLogStream, listLogThread } from '../../../src/helpers/log';

// Minimal fake db (Pool or PoolClient shape — only .query used by list.ts)
const db = { query: (...args: unknown[]) => mockDbQuery(...args) } as never;

// Helper: make a TLogRow DB row
function makeRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '100',
        user_id: '1',
        parent_id: null,
        path: ['100'],
        depth: '0',
        body: 'hello',
        is_deleted: false,
        author_name: 'alice',
        created_at: '2026-07-10T00:00:00Z',
        ...overrides,
    };
}

beforeEach(() => {
    mockDbQuery.mockReset();
    // Default for any un-queued call: empty rows. listLogThread fires an extra
    // depth-2 (grandchildren) query when the depth-1 page is non-empty; tests
    // that don't queue it fall through to this empty default (no depth-2 rows →
    // children.items = depth-1 only, matching the pre-nesting assertions).
    // mockResolvedValueOnce chains still take precedence for the queued calls.
    mockDbQuery.mockResolvedValue({ rows: [] });
});

// ---------------------------------------------------------------------------
// listLogStream — basic paging
// ---------------------------------------------------------------------------
describe('listLogStream', () => {
    it('returns empty list when user does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [] }); // SELECT id FROM users

        const result = await listLogStream(db, 'unknown_user', {
            cursor: '9223372036854775807',
            limit: 10,
        });
        expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
    });

    it('returns items and sets hasMore + nextCursor when there is a next page', async () => {
        // username → user_id
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: '7' }] });

        // top-level rows: limit=2, return 3 → hasMore=true
        const rows = [
            makeRow({ id: '300', path: ['300'] }),
            makeRow({ id: '200', path: ['200'] }),
            makeRow({ id: '100', path: ['100'] }), // extra
        ];
        mockDbQuery.mockResolvedValueOnce({ rows });

        const result = await listLogStream(db, 'alice', {
            cursor: '9223372036854775807',
            limit: 2,
        });

        expect(result.hasMore).toBe(true);
        expect(result.items).toHaveLength(2);
        // nextCursor = last kept item id as string
        expect(result.nextCursor).toBe('200');
        expect(typeof result.nextCursor).toBe('string');
    });

    it('hasMore=false and nextCursor=null when result fits in one page', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: '7' }] });
        mockDbQuery.mockResolvedValueOnce({
            rows: [makeRow({ id: '100', path: ['100'] })],
        });

        const result = await listLogStream(db, 'alice', {
            cursor: '9223372036854775807',
            limit: 10,
        });
        expect(result.hasMore).toBe(false);
        expect(result.nextCursor).toBeNull();
        expect(result.items).toHaveLength(1);
    });

    // (f) isolation — listLogStream SQL
    it('SQL touches only log and users tables, never posts/comments', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: '7' }] });
        mockDbQuery.mockResolvedValueOnce({ rows: [] });

        await listLogStream(db, 'alice', {
            cursor: '9223372036854775807',
            limit: 10,
        });

        const sqls = mockDbQuery.mock.calls.map((c: unknown[]) =>
            String(c[0]).toLowerCase()
        );
        for (const sql of sqls) {
            expect(sql).not.toMatch(/\bposts\b/);
            expect(sql).not.toMatch(/\bcomments\b/);
        }
    });
});

// ---------------------------------------------------------------------------
// listLogThread — null when focus does not exist
// ---------------------------------------------------------------------------
describe('listLogThread — focus not found', () => {
    it('returns null when the focus id does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [] }); // focus query: empty

        const result = await listLogThread(db, '999', {
            cursor: '0',
            limit: 10,
        });
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// (b) Ancestor chain: deleted ancestor masked-but-present, order root→parent
// ---------------------------------------------------------------------------
describe('listLogThread — ancestor chain correctness (b)', () => {
    it('includes a deleted ancestor masked as [deleted] with authorName absent', async () => {
        // Focus at depth 2, path=['10','20','30']; ancestor ids=['10','20']
        const focusRow = makeRow({
            id: '30',
            parent_id: '20',
            path: ['10', '20', '30'],
            depth: '2',
        });

        // Query order: (1) focus, (2) ancestors (length>0 → runs), (3) children
        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] }) // focus
            .mockResolvedValueOnce({
                rows: [
                    // Returned in root-first order (ORDER BY path)
                    makeRow({
                        id: '10',
                        parent_id: null,
                        path: ['10'],
                        depth: '0',
                        body: 'root content',
                        is_deleted: false,
                        author_name: 'alice',
                    }),
                    makeRow({
                        id: '20',
                        parent_id: '10',
                        path: ['10', '20'],
                        depth: '1',
                        body: '[deleted]',
                        is_deleted: true,
                        author_name: null,
                    }),
                ],
            }) // ancestors
            .mockResolvedValueOnce({ rows: [] }); // children (empty)

        const result = await listLogThread(db, '30', {
            cursor: '0',
            limit: 10,
        });

        expect(result).not.toBeNull();
        expect(result!.ancestors).toHaveLength(2);

        // Root comes first (ORDER BY path ascending)
        expect(result!.ancestors[0]!.id).toBe('10');
        expect(result!.ancestors[0]!.isDeleted).toBe(false);

        // Deleted ancestor is present (masked)
        expect(result!.ancestors[1]!.id).toBe('20');
        expect(result!.ancestors[1]!.isDeleted).toBe(true);
        expect(result!.ancestors[1]!.body).toBe('[deleted]');
        expect(result!.ancestors[1]!.authorName).toBeUndefined();
    });

    it('focus is a top-level node → ancestors array is empty, only 2 DB queries', async () => {
        // path=['10'] length=1 → ancestorIds=[] → NO ancestor query
        const focusRow = makeRow({ id: '10', path: ['10'], depth: '0' });

        // Only 2 queries: focus + children
        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] }) // focus
            .mockResolvedValueOnce({ rows: [] }); // children

        const result = await listLogThread(db, '10', {
            cursor: '0',
            limit: 10,
        });
        expect(result!.ancestors).toHaveLength(0);
        // Verify exactly 2 DB queries fired (ancestor query was skipped)
        expect(mockDbQuery).toHaveBeenCalledTimes(2);
    });
});

// ---------------------------------------------------------------------------
// (c) Depth-1 children keyset: 2-page cursor continuity + dead-leaf prune
// ---------------------------------------------------------------------------
describe('listLogThread — depth-1 children keyset (c)', () => {
    it('2-page cursor continuity: page 2 starts after page 1 nextCursor', async () => {
        // Top-level focus (no ancestor query) → 2 queries per listLogThread call
        const focusRow = makeRow({ id: '10', path: ['10'], depth: '0' });

        // Page 1: limit=2, return 3 → hasMore=true, nextCursor='20'
        const childRowsPage1 = [
            makeRow({
                id: '11',
                parent_id: '10',
                path: ['10', '11'],
                depth: '1',
            }),
            makeRow({
                id: '20',
                parent_id: '10',
                path: ['10', '20'],
                depth: '1',
            }),
            makeRow({
                id: '30',
                parent_id: '10',
                path: ['10', '30'],
                depth: '1',
            }), // extra (triggers hasMore)
        ];

        // First listLogThread call: focus + children
        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] }) // focus
            .mockResolvedValueOnce({ rows: childRowsPage1 }); // children page 1

        const page1 = await listLogThread(db, '10', { cursor: '0', limit: 2 });

        expect(page1!.children.hasMore).toBe(true);
        expect(page1!.children.items).toHaveLength(2);
        expect(page1!.children.nextCursor).toBe('20');
        expect(typeof page1!.children.nextCursor).toBe('string');

        // Page 2: cursor='20', return 1 item → hasMore=false
        const childRowsPage2 = [
            makeRow({
                id: '30',
                parent_id: '10',
                path: ['10', '30'],
                depth: '1',
            }),
        ];

        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] }) // focus
            .mockResolvedValueOnce({ rows: childRowsPage2 }); // children page 2

        const page2 = await listLogThread(db, '10', {
            cursor: page1!.children.nextCursor!, // '20'
            limit: 2,
        });

        expect(page2!.children.hasMore).toBe(false);
        expect(page2!.children.nextCursor).toBeNull();
        expect(page2!.children.items).toHaveLength(1);
        expect(page2!.children.items[0]!.id).toBe('30');
    });

    it('children are returned oldest-first (ASC) — validated via SQL ORDER clause', async () => {
        // Top-level focus → 2 queries
        const focusRow = makeRow({ id: '10', path: ['10'], depth: '0' });

        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] }) // focus
            .mockResolvedValueOnce({ rows: [] }); // children

        await listLogThread(db, '10', { cursor: '0', limit: 10 });

        // For a top-level focus, calls[0]=focus, calls[1]=children
        const childrenSql = String(mockDbQuery.mock.calls[1]![0]).toLowerCase();
        expect(childrenSql).toMatch(/order by l\.id asc/);
    });

    // Rewritten to capture SQL and verify the correct EXISTS predicate is used.
    // The prune rule: a deleted child is excluded UNLESS l.id appears in some
    // live descendant d's path (with d ≠ l). The old buggy form used focusId
    // ($3) instead of l.id, which wrongly retained dead leaves when any sibling
    // subtree had a live node.
    it('dead-leaf prune SQL uses l.id = ANY(d.path) descendant check, not focusId', async () => {
        const focusRow = makeRow({ id: '10', path: ['10'], depth: '0' });

        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] }) // focus
            .mockResolvedValueOnce({ rows: [] }); // children

        await listLogThread(db, '10', { cursor: '0', limit: 10 });

        // calls[0]=focus query, calls[1]=children query (top-level → no ancestor query)
        const childrenSql = String(mockDbQuery.mock.calls[1]![0]).toLowerCase();

        // Correct predicate: l.id = ANY(d.path) — child l is ancestor of d
        expect(childrenSql).toMatch(/l\.id\s*=\s*any\(d\.path\)/);

        // Exclude self: d.id <> l.id (or d.id != l.id)
        expect(childrenSql).toMatch(/d\.id\s*<>\s*l\.id|d\.id\s*!=\s*l\.id/);

        // The children query params must NOT pass focusId twice.
        // Correct params: [focusId, childCursor, childLimit+1] — 3 elements.
        const childrenParams = mockDbQuery.mock.calls[1]![1] as unknown[];
        expect(childrenParams).toHaveLength(3);

        // Confirm the buggy form ($3 as focusId inside EXISTS) is absent —
        // the SQL should not have a bare $3 placeholder inside the EXISTS block.
        // The corrected query has only $1, $2, $3 total (parent_id, cursor, limit).
        // We verify no 4th placeholder exists anywhere in the SQL.
        expect(childrenSql).not.toMatch(/\$4/);
    });

    it('dead-leaf child (deleted, no live descendants) is absent from returned items', async () => {
        // Dead-leaf prune is SQL-side; the mock simulates DB already excluding it
        // (the corrected EXISTS predicate filters it out before rows are returned).
        const focusRow = makeRow({ id: '10', path: ['10'], depth: '0' });

        // Only the live child returned (dead leaf id='99' excluded by SQL WHERE)
        const childRows = [
            makeRow({
                id: '20',
                parent_id: '10',
                path: ['10', '20'],
                depth: '1',
                body: 'survivor',
                is_deleted: false,
                author_name: 'bob',
            }),
        ];

        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] })
            .mockResolvedValueOnce({ rows: childRows });

        const result = await listLogThread(db, '10', {
            cursor: '0',
            limit: 10,
        });

        const ids = result!.children.items.map((c) => c.id);
        // Dead leaf absent
        expect(ids).not.toContain('99');
        // Survivor present
        expect(ids).toContain('20');
    });

    it('deleted child WITH a live descendant is returned (masked)', async () => {
        // A deleted depth-1 node that still has a live child: DB returns it masked.
        // The EXISTS (l.id = ANY(d.path) AND d.id <> l.id AND d.deleted_at IS NULL)
        // evaluates true → the row survives the WHERE and is returned.
        const focusRow = makeRow({ id: '10', path: ['10'], depth: '0' });

        const childRows = [
            makeRow({
                id: '20',
                parent_id: '10',
                path: ['10', '20'],
                depth: '1',
                body: '[deleted]',
                is_deleted: true,
                author_name: null,
            }),
        ];

        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] })
            .mockResolvedValueOnce({ rows: childRows });

        const result = await listLogThread(db, '10', {
            cursor: '0',
            limit: 10,
        });

        expect(result!.children.items).toHaveLength(1);
        expect(result!.children.items[0]!.id).toBe('20');
        expect(result!.children.items[0]!.isDeleted).toBe(true);
        expect(result!.children.items[0]!.body).toBe('[deleted]');
        expect(result!.children.items[0]!.authorName).toBeUndefined();
    });

    // (f) isolation — listLogThread SQL
    it('all SQL queries touch only log and users tables, never posts/comments', async () => {
        // Depth-2 focus → 3 queries (focus + ancestors + children)
        const focusRow = makeRow({
            id: '30',
            path: ['10', '20', '30'],
            depth: '2',
        });

        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] }) // focus
            .mockResolvedValueOnce({ rows: [] }) // ancestors
            .mockResolvedValueOnce({ rows: [] }); // children

        await listLogThread(db, '30', { cursor: '0', limit: 10 });

        const sqls = mockDbQuery.mock.calls.map((c: unknown[]) =>
            String(c[0]).toLowerCase()
        );
        for (const sql of sqls) {
            expect(sql).not.toMatch(/\bposts\b/);
            expect(sql).not.toMatch(/\bcomments\b/);
        }
        // All 3 queries should reference log and/or users
        const logOrUsersRefs = sqls.filter(
            (s: string) => s.includes('log') || s.includes('users')
        );
        expect(logOrUsersRefs.length).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// (e) BIGINT id integrity in list results — IDs remain strings
// ---------------------------------------------------------------------------
describe('listLogThread — BIGINT id integrity (e)', () => {
    it('returns all ids as strings, cursor as string, even for ids > 2^53', async () => {
        const bigId = '9223372036854775800';
        const bigChildId1 = '9223372036854775801';
        const bigChildId2 = '9223372036854775802';
        const bigChildId3 = '9223372036854775803'; // extra → triggers hasMore

        // Top-level focus → 2 queries (no ancestor query)
        const focusRow = makeRow({ id: bigId, path: [bigId], depth: '0' });
        const childRows = [
            makeRow({
                id: bigChildId1,
                parent_id: bigId,
                path: [bigId, bigChildId1],
                depth: '1',
            }),
            makeRow({
                id: bigChildId2,
                parent_id: bigId,
                path: [bigId, bigChildId2],
                depth: '1',
            }),
            makeRow({
                id: bigChildId3,
                parent_id: bigId,
                path: [bigId, bigChildId3],
                depth: '1',
            }), // extra
        ];

        mockDbQuery
            .mockResolvedValueOnce({ rows: [focusRow] })
            .mockResolvedValueOnce({ rows: childRows });

        const result = await listLogThread(db, bigId, {
            cursor: '0',
            limit: 2,
        });

        // focus.id must be a string
        expect(typeof result!.focus.id).toBe('string');
        expect(result!.focus.id).toBe(bigId);

        // child ids must all be strings
        for (const item of result!.children.items) {
            expect(typeof item.id).toBe('string');
        }
        // nextCursor must be a string equal to the last kept child id
        expect(result!.children.hasMore).toBe(true);
        expect(typeof result!.children.nextCursor).toBe('string');
        expect(result!.children.nextCursor).toBe(bigChildId2);
    });
});

// ---------------------------------------------------------------------------
// listLogStream — BIGINT id integrity
// ---------------------------------------------------------------------------
describe('listLogStream — BIGINT id integrity (e)', () => {
    it('nextCursor is a string even for BIGINT ids beyond 2^53', async () => {
        const bigId1 = '9223372036854775801';
        const bigId2 = '9223372036854775800';

        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: '7' }] }); // username lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                makeRow({ id: bigId1, path: [bigId1] }),
                makeRow({ id: bigId2, path: [bigId2] }),
                makeRow({
                    id: '9223372036854775799',
                    path: ['9223372036854775799'],
                }), // extra
            ],
        });

        const result = await listLogStream(db, 'alice', {
            cursor: '9223372036854775807',
            limit: 2,
        });

        expect(result.hasMore).toBe(true);
        expect(typeof result.nextCursor).toBe('string');
        expect(result.nextCursor).toBe(bigId2);
        for (const item of result.items) {
            expect(typeof item.id).toBe('string');
        }
    });
});
