// B — category-title filter on the per-author feed (GET /api/posts/users/:username).
//
// The pool is mocked (no DB), so we assert the WIRING, not DB-level filtering:
//   * a `category_title` query value is bound as the 5th SQL param ($5);
//   * absent/empty `category_title` binds null (=> the `$5 IS NULL` no-op);
//   * the SQL actually references the $5 title predicate.
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

describe('per-author feed category_title filter (wiring)', () => {
    it('binds the category_title value as the 5th param ($5)', async () => {
        await invokeFeed({ category_title: 'jdbc' });
        expect(lastParams()[4]).toBe('jdbc');
    });

    it('binds null when category_title is absent', async () => {
        await invokeFeed({});
        expect(lastParams()[4]).toBeNull();
    });

    it('binds null when category_title is an empty string', async () => {
        await invokeFeed({ category_title: '' });
        expect(lastParams()[4]).toBeNull();
    });

    it('the SQL references the $5 title predicate', async () => {
        await invokeFeed({ category_title: 'jdbc' });
        expect(lastSql()).toContain('$5');
        expect(lastSql()).toContain('c.title = $5');
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
