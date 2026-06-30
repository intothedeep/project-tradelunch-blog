// Phase L Slice B — rankflow endpoint shape tests (no real DB).
//
// Covers:
//   1. Invalid CIK → { success: true, data: null }
//   2. Table-absence guard → { success: true, data: null }
//   3. Unknown CIK (no filings) → { success: true, data: null }
//   4. Happy path → { success: true, data: { cik, periods[], rows[] } }
//
// The pool is mocked so these tests run without a Postgres connection.
// DB-gated assertions are skipped per existing suite convention.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { router as rankflowRouter } from '../../src/controllers/funds/rankflow';

// ---- minimal express-like mock helpers ----

type CapturedResponse = { status: number; payload: unknown; headers: Record<string, string> };

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
        _captured: captured,
    };
    return { res: captured, handler: res };
}

type AnyRoute = {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown }[];
};

function routeByPath(
    r: { stack: { route?: AnyRoute }[] },
    path: string
): AnyRoute | undefined {
    return r.stack
        .filter((l) => !!l.route)
        .map((l) => l.route as AnyRoute)
        .find((rt) => rt.path === path);
}

function lastHandle(route: AnyRoute): (req: unknown, res: unknown) => Promise<void> {
    return route.stack[route.stack.length - 1].handle as (
        req: unknown,
        res: unknown
    ) => Promise<void>;
}

async function invokeRankflow(
    params: Record<string, string>,
    query: Record<string, string> = {}
): Promise<CapturedResponse> {
    const route = routeByPath(rankflowRouter, '/:cik/rankflow');
    if (!route) throw new Error('/:cik/rankflow route not registered');
    const { res, handler } = mockRes();
    await lastHandle(route)({ params, query }, handler);
    return res;
}

beforeEach(() => mockQuery.mockReset());

describe('rankflow route registration', () => {
    it('registers GET /:cik/rankflow', () => {
        const route = routeByPath(rankflowRouter, '/:cik/rankflow');
        expect(route).toBeDefined();
        expect(route!.methods.get).toBe(true);
    });
});

describe('GET /:cik/rankflow — input validation', () => {
    it('non-digit cik returns { success: true, data: null } without hitting DB', async () => {
        const result = await invokeRankflow({ cik: 'abc' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('cik with letters+digits returns { success: true, data: null }', async () => {
        const result = await invokeRankflow({ cik: '123abc' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('GET /:cik/rankflow — table-absence guard', () => {
    it('returns { success: true, data: null } when tables are absent', async () => {
        // holdingsTablesPresent() returns false
        mockQuery.mockResolvedValueOnce({ rows: [{ present: false }] });

        const result = await invokeRankflow({ cik: '1234567890' });
        expect(result.payload).toEqual({ success: true, data: null });
        // Only the guard query fired, no data queries.
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });
});

describe('GET /:cik/rankflow — unknown cik', () => {
    it('returns { success: true, data: null } when no periods exist for cik', async () => {
        // holdingsTablesPresent() → true
        mockQuery.mockResolvedValueOnce({ rows: [{ present: true }] });
        // CUSIP_SQL → empty
        mockQuery.mockResolvedValueOnce({ rows: [] });
        // PERIOD_SQL → empty
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await invokeRankflow({ cik: '9999999999' });
        expect(result.payload).toEqual({ success: true, data: null });
    });
});

describe('GET /:cik/rankflow — happy path', () => {
    it('returns correct envelope shape with periods and rows', async () => {
        // holdingsTablesPresent() → true
        mockQuery.mockResolvedValueOnce({ rows: [{ present: true }] });

        // CUSIP_SQL rows
        const periodDate = new Date('2024-09-30');
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cusip: 'AAPL0001',
                    label: 'Apple Inc.',
                    period_of_report: periodDate,
                    rnk: '1',
                    weight_pct: '12.3456',
                    value_usd: '5000000000',
                },
                {
                    cusip: 'MSFT0001',
                    label: 'Microsoft Corp.',
                    period_of_report: periodDate,
                    rnk: '2',
                    weight_pct: '8.1234',
                    value_usd: '3000000000',
                },
            ],
        });

        // PERIOD_SQL rows
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    period_of_report: periodDate,
                    total_value_usd: '40000000000',
                    remaining_count: '23',
                    remaining_weight_pct: '79.5310',
                },
            ],
        });

        const result = await invokeRankflow({ cik: '0001234567' });
        const body = result.payload as { success: boolean; data: unknown };

        expect(body.success).toBe(true);
        expect(body.data).not.toBeNull();

        const data = body.data as {
            cik: string;
            periods: object[];
            rows: object[];
        };

        expect(data.cik).toBe('0001234567');

        // periods shape
        expect(Array.isArray(data.periods)).toBe(true);
        expect(data.periods).toHaveLength(1);
        expect(data.periods[0]).toMatchObject({
            periodOfReport: '2024-09-30',
            totalValueUsd: 40000000000,
            remainingCount: 23,
            remainingWeightPct: 79.531,
        });

        // rows shape
        expect(Array.isArray(data.rows)).toBe(true);
        expect(data.rows).toHaveLength(2);

        const appleRow = (data.rows as Array<{ cusip: string; label: string; cells: object }>).find(
            (r) => r.cusip === 'AAPL0001'
        );
        expect(appleRow).toBeDefined();
        expect(appleRow!.label).toBe('Apple Inc.');
        expect(appleRow!.cells).toMatchObject({
            '2024-09-30': { rank: 1, weightPct: 12.3456, valueUsd: 5000000000 },
        });
    });

    it('pads a short cik to 10 digits', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ present: true }] });
        mockQuery.mockResolvedValueOnce({ rows: [] }); // CUSIP
        mockQuery.mockResolvedValueOnce({ rows: [] }); // PERIOD → unknown cik

        const result = await invokeRankflow({ cik: '12345' });
        // Should not throw — padded internally; unknown cik yields null.
        expect(result.payload).toEqual({ success: true, data: null });

        // Verify $1 in the guard query received the padded value by checking the
        // second call's first argument string.
        const secondCall = mockQuery.mock.calls[1] as [string, unknown[]];
        expect(secondCall[1][0]).toBe('0000012345');
    });

    it('clamps quarters and k query params', async () => {
        // Table present
        mockQuery.mockResolvedValueOnce({ rows: [{ present: true }] });
        // Both data queries return empty → null response (we only care about params passed)
        mockQuery.mockResolvedValueOnce({ rows: [] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await invokeRankflow({ cik: '1' }, { quarters: '9999', k: '9999' });

        // CUSIP_SQL call: params = [cik, quarters, k]
        const cusipCall = mockQuery.mock.calls[1] as [string, unknown[]];
        expect(cusipCall[1][1]).toBe(40);  // clamped quarters max
        expect(cusipCall[1][2]).toBe(200); // clamped k max
    });

    it('uses defaults when quarters/k are absent', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ present: true }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await invokeRankflow({ cik: '1' });

        const cusipCall = mockQuery.mock.calls[1] as [string, unknown[]];
        expect(cusipCall[1][1]).toBe(8);  // default quarters
        expect(cusipCall[1][2]).toBe(25); // default k
    });
});

describe('GET /:cik/rankflow — Cache-Control header', () => {
    it('sets public s-maxage=86400 header on all success paths', async () => {
        // Non-digit cik path
        const result = await invokeRankflow({ cik: 'bad' });
        expect(result.headers['Cache-Control']).toBe(
            'public, s-maxage=86400, stale-while-revalidate=604800'
        );
    });
});
