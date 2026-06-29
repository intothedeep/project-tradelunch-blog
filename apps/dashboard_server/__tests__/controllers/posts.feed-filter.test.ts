// Phase 2-filter — multi-category + multi-tag filter on the per-author feed
// (GET /api/posts/users/:username).
//
// The pool is mocked (no DB), so we assert the WIRING, not DB-level filtering:
//   * `categories=a,b` binds a canonical text[] as the 5th SQL param ($5);
//   * `tags=x,y` binds a canonical text[] as the 6th SQL param ($6);
//   * absent/empty facets bind null (=> the `IS NULL` no-op);
//   * cross-attribute is AND (both predicates present, both params bound);
//   * the SQL uses array overlap (&&) for categories (ancestor-inclusive) and
//     correlated EXISTS for tags (so ROW_NUMBER PARTITION BY slug stays intact);
//   * legacy single `category_title` folds into $5 when `categories` is absent.
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
    await userFeedHandler()({ params: { username: 'u' }, query }, mockRes());
}

// The bind-params array is the 2nd arg of pool.query(sql, params).
function lastParams(): unknown[] {
    return mockQuery.mock.calls[0][1] as unknown[];
}
function lastSql(): string {
    return mockQuery.mock.calls[0][0] as string;
}

beforeEach(() => mockQuery.mockReset());

describe('per-author feed multi-category filter (wiring)', () => {
    it('binds a canonical text[] for `categories=a,b` as the 5th param ($5)', async () => {
        await invokeFeed({ categories: 'jdbc,spring' });
        expect(lastParams()[4]).toEqual(['jdbc', 'spring']);
    });

    it('lowercases, trims, and dedupes the category facet', async () => {
        await invokeFeed({ categories: ' JDBC , spring , jdbc ' });
        expect(lastParams()[4]).toEqual(['jdbc', 'spring']);
    });

    it('binds null when `categories` is absent', async () => {
        await invokeFeed({});
        expect(lastParams()[4]).toBeNull();
    });

    it('binds null when `categories` is an empty string', async () => {
        await invokeFeed({ categories: '' });
        expect(lastParams()[4]).toBeNull();
    });

    it('the SQL filters categories via array overlap on the path (ancestor-inclusive)', async () => {
        await invokeFeed({ categories: 'jdbc' });
        expect(lastSql()).toContain('$5');
        expect(lastSql()).toContain('cpath.path && $5::text[]');
    });
});

describe('per-author feed multi-tag filter (wiring)', () => {
    it('binds a canonical text[] for `tags=x,y` as the 6th param ($6)', async () => {
        await invokeFeed({ tags: 'sql,nosql' });
        expect(lastParams()[5]).toEqual(['sql', 'nosql']);
    });

    it('binds null when `tags` is absent', async () => {
        await invokeFeed({});
        expect(lastParams()[5]).toBeNull();
    });

    it('binds null when `tags` is an empty string', async () => {
        await invokeFeed({ tags: '' });
        expect(lastParams()[5]).toBeNull();
    });

    it('the SQL filters tags via correlated EXISTS on $6 (not an INNER JOIN)', async () => {
        await invokeFeed({ tags: 'sql' });
        const sql = lastSql();
        expect(sql).toContain('$6');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('pt.tag_title = ANY($6)');
    });
});

describe('per-author feed cross-attribute filter is AND (wiring)', () => {
    it('binds BOTH $5 and $6 when categories and tags are present', async () => {
        await invokeFeed({ categories: 'jdbc', tags: 'sql' });
        expect(lastParams()[4]).toEqual(['jdbc']);
        expect(lastParams()[5]).toEqual(['sql']);
    });
});

describe('per-author feed legacy category_title (wiring)', () => {
    it('folds legacy `category_title` into $5 when `categories` is absent', async () => {
        await invokeFeed({ category_title: 'jdbc' });
        expect(lastParams()[4]).toEqual(['jdbc']);
    });

    it('prefers `categories` over legacy `category_title`', async () => {
        await invokeFeed({ categories: 'spring', category_title: 'jdbc' });
        expect(lastParams()[4]).toEqual(['spring']);
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

    it('keeps ROW_NUMBER PARTITION BY slug intact (dedup not broken by filters)', async () => {
        await invokeFeed({ categories: 'jdbc', tags: 'sql' });
        expect(lastSql()).toContain('ROW_NUMBER() OVER(PARTITION BY p.slug');
    });
});
