// Phase H P0 — H0.6 route-resolution test (no DB).
//
// Proves each of the 4 new tag endpoints resolves to its OWN handler and
// produces the tag-list / tag-feed response shape (NOT a single-post payload):
//   GET /api/tags                              (tags router)
//   GET /api/posts/users/:username/tags        (posts router)
//   GET /api/posts/by-tag/:tag                 (posts router)
//   GET /api/posts/users/:username/by-tag/:tag (posts router)
//
// The pool is mocked, so the handlers run without a DB; optionalAuth is mocked
// so importing the posts router needs no Clerk/env. (We do NOT assert anything
// about registration ORDER — Express 5 matches by segment count, so a
// multi-segment tag route cannot be shadowed by the single-segment /:postid.)

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));
jest.mock('../../src/middlewares/optionalAuth', () => ({
    optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { router as postsRouter } from '../../src/controllers/posts/posts';
import { router as tagsRouter } from '../../src/controllers/tags/index';

type AnyRoute = {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown }[];
};

function routes(r: { stack: { route?: AnyRoute }[] }): AnyRoute[] {
    return r.stack.filter((l) => !!l.route).map((l) => l.route as AnyRoute);
}

function routeByPath(
    r: { stack: { route?: AnyRoute }[] },
    path: string
): AnyRoute | undefined {
    return routes(r).find((rt) => rt.path === path);
}

function lastHandle(route: AnyRoute): unknown {
    return route.stack[route.stack.length - 1].handle;
}

function mockRes() {
    const captured: { status: number; payload: unknown } = {
        status: 200,
        payload: undefined,
    };
    const res = {
        status(code: number) {
            captured.status = code;
            return res;
        },
        json(payload: unknown) {
            captured.payload = payload;
            return res;
        },
        _captured: captured,
    };
    return res;
}

async function invoke(
    handle: unknown,
    params: Record<string, string>
): Promise<{ status: number; payload: unknown }> {
    const res = mockRes();
    await (handle as (req: unknown, res: unknown) => Promise<void>)(
        { params, query: {} },
        res
    );
    return res._captured;
}

beforeEach(() => mockQuery.mockReset());

describe('H0.6 tag endpoints resolve to their own handler', () => {
    it('all four tag routes are registered as distinct GET routes', () => {
        const tagsGet = routes(tagsRouter).filter((r) => r.methods.get);
        expect(tagsGet).toHaveLength(1); // GET /api/tags

        expect(routeByPath(postsRouter, '/users/:username/tags')).toBeDefined();
        expect(routeByPath(postsRouter, '/by-tag/:tag')).toBeDefined();
        expect(
            routeByPath(postsRouter, '/users/:username/by-tag/:tag')
        ).toBeDefined();
        // The single-post wildcard still exists, as a SEPARATE route.
        expect(routeByPath(postsRouter, '/:postid')).toBeDefined();
    });

    it('each tag route uses a handler distinct from the /:postid handler', () => {
        const postId = lastHandle(routeByPath(postsRouter, '/:postid')!);
        const tagHandlers = [
            lastHandle(routes(tagsRouter)[0]),
            lastHandle(routeByPath(postsRouter, '/users/:username/tags')!),
            lastHandle(routeByPath(postsRouter, '/by-tag/:tag')!),
            lastHandle(
                routeByPath(postsRouter, '/users/:username/by-tag/:tag')!
            ),
        ];
        for (const h of tagHandlers) {
            expect(typeof h).toBe('function');
            expect(h).not.toBe(postId);
        }
    });

    it('GET /api/tags returns a TPopularTag[] list (not a single post)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ tag: 'x', count: 2 }] });
        const handle = lastHandle(routes(tagsRouter)[0]);
        const { payload } = await invoke(handle, {});
        const data = (payload as { success: boolean; data: unknown }).data;
        expect(Array.isArray(data)).toBe(true);
        expect(data).toEqual([{ tag: 'x', count: 2 }]);
    });

    it('GET .../users/:username/tags returns a TPopularTag[] list', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ tag: 'y', count: 1 }] });
        const handle = lastHandle(
            routeByPath(postsRouter, '/users/:username/tags')!
        );
        const { payload } = await invoke(handle, { username: 'u' });
        const data = (payload as { data: unknown }).data;
        expect(Array.isArray(data)).toBe(true);
        expect(data).toEqual([{ tag: 'y', count: 1 }]);
    });

    it('GET .../by-tag/:tag returns a tag-FEED shape (posts/nextCursor/hasMore)', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: '7',
                    slug: 's',
                    title: 't',
                    likeCount: 0,
                    viewerLiked: false,
                    commentCount: 0,
                },
            ],
        });
        const handle = lastHandle(routeByPath(postsRouter, '/by-tag/:tag')!);
        const { payload } = await invoke(handle, { tag: 't' });
        const data = (payload as { data: Record<string, unknown> }).data;
        expect(Array.isArray(data.posts)).toBe(true);
        expect(data).toHaveProperty('nextCursor');
        expect(data).toHaveProperty('hasMore');
        // NOT a single-post payload (which would expose title/slug on data itself).
        expect(data).not.toHaveProperty('title');
    });

    it('GET .../users/:username/by-tag/:tag returns a tag-FEED shape', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        const handle = lastHandle(
            routeByPath(postsRouter, '/users/:username/by-tag/:tag')!
        );
        const { payload } = await invoke(handle, { username: 'u', tag: 't' });
        const data = (payload as { data: Record<string, unknown> }).data;
        expect(Array.isArray(data.posts)).toBe(true);
        expect(data).toMatchObject({
            posts: [],
            nextCursor: null,
            hasMore: false,
        });
    });
});
