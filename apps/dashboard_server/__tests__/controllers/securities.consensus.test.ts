// Phase P STEP 1 (P8) — consensus endpoint shape tests (no real DB).
//
// Covers:
//   1. Invalid CUSIP → { success: true, data: null } (no DB hit)
//   2. View-absence guard → { success: true, data: null }
//   3. Unknown CUSIP (no consensus row) → { success: true, data: null }
//   4. Happy path → { success: true, data: { cusip, holders[] , ... } }
//
// The pool is mocked so these run without Postgres.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { router as consensusRouter } from '../../src/controllers/securities/consensus';

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

async function invoke(params: Record<string, string>): Promise<CapturedResponse> {
    const route = routeByPath(consensusRouter, '/:cusip/consensus');
    if (!route) throw new Error('/:cusip/consensus route not registered');
    const { res, handler } = mockRes();
    await lastHandle(route)({ params, query: {} }, handler);
    return res;
}

beforeEach(() => mockQuery.mockReset());

describe('consensus route registration', () => {
    it('registers GET /:cusip/consensus', () => {
        const route = routeByPath(consensusRouter, '/:cusip/consensus');
        expect(route).toBeDefined();
        expect(route!.methods.get).toBe(true);
    });
});

describe('GET /:cusip/consensus — input validation', () => {
    it('rejects a too-short / non-alphanumeric cusip without hitting DB', async () => {
        const result = await invoke({ cusip: 'ab$' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('GET /:cusip/consensus — view-absence guard', () => {
    it('returns data:null when analytics views are absent', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ analytics: false, secmap: false }] });
        const result = await invoke({ cusip: '037833100' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });
});

describe('GET /:cusip/consensus — unknown cusip', () => {
    it('returns data:null when no consensus row exists', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ analytics: true, secmap: true }] });
        mockQuery.mockResolvedValueOnce({ rows: [] }); // consensus row empty
        const result = await invoke({ cusip: '999999999' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });
});

describe('GET /:cusip/consensus — happy path', () => {
    it('returns envelope with active/total counts and per-fund holders', async () => {
        const period = new Date('2026-03-31');
        mockQuery.mockResolvedValueOnce({ rows: [{ analytics: true, secmap: true }] });
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    period_of_report: period,
                    cusip: '037833100',
                    name_of_issuer: 'APPLE INC',
                    holder_count_active: '2',
                    holder_count_total: '4',
                    active_value_usd: '9000000000',
                    mapped_ticker: 'AAPL',
                },
            ],
        });
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001067983',
                    label: 'Berkshire Hathaway',
                    is_active_manager: true,
                    shares: '900000000',
                    value_usd: '8000000000',
                    weight_pct: '40.1234',
                    delta_shares: '1000000',
                    delta_weight_pct: '1.5000',
                    is_new: false,
                },
            ],
        });

        const result = await invoke({ cusip: '037833100' });
        const body = result.payload as { success: boolean; data: Record<string, unknown> };
        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
            cusip: '037833100',
            name: 'APPLE INC',
            mappedTicker: 'AAPL',
            periodOfReport: '2026-03-31',
            holderCountActive: 2,
            holderCountTotal: 4,
            activeValueUsd: 9000000000,
        });
        const holders = body.data.holders as Array<Record<string, unknown>>;
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            cik: '0001067983',
            isActiveManager: true,
            valueUsd: 8000000000,
            weightPct: 40.1234,
            deltaShares: 1000000,
            isNew: false,
        });
    });
});

describe('GET /:cusip/consensus — Cache-Control', () => {
    it('sets the shared funds cache header', async () => {
        const result = await invoke({ cusip: 'bad$' });
        expect(result.headers['Cache-Control']).toBe(
            'public, s-maxage=86400, stale-while-revalidate=604800'
        );
    });
});
