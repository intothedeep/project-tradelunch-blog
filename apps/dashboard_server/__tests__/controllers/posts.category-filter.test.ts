// B — category filter on the per-author feed (GET /api/posts/users/:username).
//
// Phase 2-filter migrated the single `category_title` ($5 scalar, `= ANY(path)`)
// to a multi-category text[] facet ($5, array overlap `&&`). Legacy
// `category_title` is still accepted and FOLDED into the $5 array. The pool is
// mocked (no DB), so we assert the WIRING, not DB-level filtering:
//   * a `category_title` value is canonicalized to a text[] bound at $5;
//   * absent/empty `category_title` binds null (=> the `$5 IS NULL` no-op);
//   * the SQL references the $5 path-overlap predicate.
// optionalAuth is mocked so importing the posts router needs no Clerk/env.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));
jest.mock('../../src/middlewares/optionalAuth', () => ({
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { router as postsRouter } from '../../src/controllers/posts/posts';

type AnyRoute = { path: string; stack: { handle: unknown }[] };

function routeByPath(
    r: { stack: { route?: AnyRoute }[] },
    path: string
): AnyRoute {
    const route = r.stack
        .filter((l) => !!l.route)
        .map((l) => l.route as AnyRoute)
        .find((rt) => rt.path === path);
    if (!route) throw new Error(`route ${path} not found`);
    return route;
}

function userFeedHandler(): (req: unknown, res: unknown) => Promise<void> {
    const route = routeByPath(postsRouter, '/users/:username');
    return route.stack[route.stack.length - 1].handle as (
        req: unknown,
        res: unknown
    ) => Promise<void>;
}

function mockRes() {
    const res = {
        setHeader() {
            return res;
        },
        status() {
            return res;
        },
        json() {
            return res;
        },
    };
    return res;
}

async function invokeFeed(query: Record<string, string>): Promise<void> {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await userFeedHandler()(
        { params: { username: 'u' }, query },
        mockRes()
    );
}

// The bind-params array is the 2nd arg of pool.query(sql, params).
function lastParams(): unknown[] {
    return mockQuery.mock.calls[0][1] as unknown[];
}
function lastSql(): string {
    return mockQuery.mock.calls[0][0] as string;
}

beforeEach(() => mockQuery.mockReset());

describe('per-author feed legacy category_title filter (wiring)', () => {
    it('folds the legacy category_title into the $5 text[] facet', async () => {
        await invokeFeed({ category_title: 'jdbc' });
        expect(lastParams()[4]).toEqual(['jdbc']);
    });

    it('binds null when category_title is absent', async () => {
        await invokeFeed({});
        expect(lastParams()[4]).toBeNull();
    });

    it('binds null when category_title is an empty string', async () => {
        await invokeFeed({ category_title: '' });
        expect(lastParams()[4]).toBeNull();
    });

    it('the SQL references the $5 path-overlap predicate (ancestor-inclusive)', async () => {
        await invokeFeed({ category_title: 'jdbc' });
        expect(lastSql()).toContain('$5');
        // Match each title ANYWHERE in the path (not just the leaf) so ancestor
        // category clicks include descendant posts — now via array overlap.
        expect(lastSql()).toContain('cpath.path && $5::text[]');
    });
});

describe('per-author feed returns the category_path breadcrumb (wiring)', () => {
    it('SQL includes the recursive cat_path CTE and selects category_path', async () => {
        await invokeFeed({});
        const sql = lastSql();
        expect(sql).toContain('RECURSIVE cat_path');
        expect(sql).toContain('cpath.path');
        expect(sql).toContain('category_path');
    });
});
