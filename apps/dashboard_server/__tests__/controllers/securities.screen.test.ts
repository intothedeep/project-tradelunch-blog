// __tests__/controllers/securities.screen.test.ts
// Phase P STEP 3 (P10) — screener endpoint shape tests (no real DB).
//
// Covers:
//   1. Absence guard (hasConsensus=false) → { success: true, data: null }
//   2. Happy path — envelope shape, score ordering, deferred component nulls
//   3. clampParam behaviour via query string extremes
//
// The pool is mocked so these run without Postgres.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { router as screenRouter } from '../../src/controllers/securities/screen';

type CapturedResponse = {
    status: number;
    payload: unknown;
    headers: Record<string, string>;
};

function mockRes(): { res: CapturedResponse; handler: object } {
    const captured: CapturedResponse = { status: 200, payload: undefined, headers: {} };
    const res = {
        status(code: number) {
            captured.status = code;
            return res;
        },
        json(payload: unknown) {
            captured.payload = payload;
            return res;
        },
        set(key: string, value: string) {
            captured.headers[key] = value;
            return res;
        },
    };
    return { res: captured, handler: res };
}

type AnyRoute = { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };

function routeByPath(r: { stack: { route?: AnyRoute }[] }, path: string): AnyRoute | undefined {
    return r.stack
        .filter((l) => !!l.route)
        .map((l) => l.route as AnyRoute)
        .find((rt) => rt.path === path);
}

function lastHandle(route: AnyRoute): (req: unknown, res: unknown) => Promise<void> {
    return route.stack[route.stack.length - 1].handle as (req: unknown, res: unknown) => Promise<void>;
}

async function invoke(
    query: Record<string, string> = {}
): Promise<CapturedResponse> {
    const route = routeByPath(screenRouter, '/screen');
    if (!route) throw new Error('/screen route not registered');
    const { res, handler } = mockRes();
    await lastHandle(route)({ params: {}, query }, handler);
    return res;
}

beforeEach(() => mockQuery.mockReset());

// --- Route registration ---

describe('screen route registration', () => {
    it('registers GET /screen', () => {
        const route = routeByPath(screenRouter, '/screen');
        expect(route).toBeDefined();
        expect(route!.methods.get).toBe(true);
    });
});

// --- Absence guard ---

describe('GET /screen — view-absence guard', () => {
    it('returns data:null when v_sec_consensus is absent', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_consensus: false, has_secmap: false, has_rankings: false }],
        });
        const result = await invoke();
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('returns data:null when period query returns empty', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_consensus: true, has_secmap: false, has_rankings: false }],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] }); // active count
        mockQuery.mockResolvedValueOnce({ rows: [{ period: null }] });       // no period
        const result = await invoke();
        expect(result.payload).toEqual({ success: true, data: null });
    });
});

// --- Happy path ---

describe('GET /screen — happy path', () => {
    const period = '2026-03-31';

    function mockHappyPath(
        candidateRows: Array<{
            cusip: string;
            name_of_issuer: string;
            holder_count_active: string;
            holder_count_total: string;
            ticker: string | null;
            rank: number | null;
            market_cap: string | null;
        }>
    ): void {
        // 1. probePresence
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_consensus: true, has_secmap: true, has_rankings: true }],
        });
        // 2. active fund count
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        // 3. latest period
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        // 4. candidates
        mockQuery.mockResolvedValueOnce({ rows: candidateRows });
    }

    it('returns envelope with periodOfReport, totalActiveFunds, candidates', async () => {
        mockHappyPath([
            {
                cusip: '037833100',
                name_of_issuer: 'APPLE INC',
                holder_count_active: '3',
                holder_count_total: '4',
                ticker: 'AAPL',
                rank: 1,
                market_cap: '3000000000000',
            },
        ]);
        const result = await invoke();
        const body = result.payload as { success: boolean; data: Record<string, unknown> };
        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
            periodOfReport: '2026-03-31',
            totalActiveFunds: 3,
        });
        const candidates = body.data.candidates as Array<Record<string, unknown>>;
        expect(candidates).toHaveLength(1);
        expect(candidates[0]).toMatchObject({
            cusip: '037833100',
            name: 'APPLE INC',
            ticker: 'AAPL',
            rank: 1,
            holderCountActive: 3,
            holderCountTotal: 4,
        });
    });

    it('score components include consensus, capTier, and null deferred terms', async () => {
        mockHappyPath([
            {
                cusip: '037833100',
                name_of_issuer: 'APPLE INC',
                holder_count_active: '3',
                holder_count_total: '3',
                ticker: 'AAPL',
                rank: 1,
                market_cap: null,
            },
        ]);
        const result = await invoke();
        const body = result.payload as { success: boolean; data: Record<string, unknown> };
        const candidates = body.data.candidates as Array<Record<string, unknown>>;
        const comp = candidates[0].components as Record<string, unknown>;
        expect(comp.consensus).toBeCloseTo(1);
        expect(comp.capTier).toBe(1);
        expect(comp.momentum).toBeNull();
        expect(comp.lowVol).toBeNull();
        // score = 0.4*1 + 0.2*1 = 0.6
        expect(candidates[0].score).toBeCloseTo(0.6);
    });

    it('sorts candidates by score DESC then holderCountActive DESC', async () => {
        mockHappyPath([
            // Low score: 1 active, rank null → 0.4*(1/3)+0.2*0 ≈ 0.133
            {
                cusip: 'BBBBBBBBB',
                name_of_issuer: 'B Corp',
                holder_count_active: '1',
                holder_count_total: '2',
                ticker: null,
                rank: null,
                market_cap: null,
            },
            // High score: 3 active, rank 5 → 0.4*1+0.2*1 = 0.6
            {
                cusip: 'AAAAAAAAA',
                name_of_issuer: 'A Corp',
                holder_count_active: '3',
                holder_count_total: '4',
                ticker: 'AAAA',
                rank: 5,
                market_cap: '1000000000',
            },
        ]);
        const result = await invoke();
        const body = result.payload as { success: boolean; data: Record<string, unknown> };
        const candidates = body.data.candidates as Array<Record<string, unknown>>;
        // A Corp should come first (higher score)
        expect(candidates[0].cusip).toBe('AAAAAAAAA');
        expect(candidates[1].cusip).toBe('BBBBBBBBB');
    });

    it('sets the shared funds cache header', async () => {
        mockHappyPath([]);
        const result = await invoke();
        expect(result.headers['Cache-Control']).toBe(
            'public, s-maxage=86400, stale-while-revalidate=604800'
        );
    });
});

// --- Clamp behaviour ---

describe('GET /screen — clamp params', () => {
    it('makes 4 DB calls for a valid request (no early exit)', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_consensus: true, has_secmap: false, has_rankings: false }],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ period: '2026-03-31' }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        // Out-of-range limit is clamped, not rejected
        await invoke({ limit: '9999' });
        expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    it('returns data:null on unexpected DB error (never 500)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'));
        const result = await invoke();
        expect(result.payload).toEqual({ success: true, data: null });
        expect(result.status).toBe(200);
    });
});
