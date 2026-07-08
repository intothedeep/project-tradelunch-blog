// __tests__/helpers/secDerivatives.test.ts
// Purpose: unit tests for fetchSecDerivatives (Phase U, migration 0027).
// Pool is mocked — no Postgres required.
// Covers: presence-guard short-circuit, empty rows → null, call/put skew,
//         balanced skew, BIGINT→number, null leg coalesce.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { fetchSecDerivatives } from '../../src/helpers/secDerivatives';

beforeEach(() => mockQuery.mockReset());

describe('fetchSecDerivatives — presence guard', () => {
    it('returns null WITHOUT querying when the view is absent', async () => {
        const result = await fetchSecDerivatives('AAPL', false);
        expect(result).toBeNull();
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('fetchSecDerivatives — no rows', () => {
    it('returns null when the view exists but no option legs for ticker', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        const result = await fetchSecDerivatives('AAPL', true);
        expect(result).toBeNull();
    });
});

describe('fetchSecDerivatives — aggregation + skew', () => {
    it('maps BIGINT strings to numbers and derives call_skew', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    period_of_report: '2025-09-30',
                    call_value_usd: '25732534860',
                    put_value_usd: '1356942042',
                    holder_count: '2',
                },
            ],
        });
        const result = await fetchSecDerivatives('SPY', true);
        expect(result).toEqual({
            periodOfReport: '2025-09-30',
            callValueUsd: 25732534860,
            putValueUsd: 1356942042,
            holderCount: 2,
            netSkew: 'call_skew',
        });
    });

    it('derives put_skew when puts dominate and coalesces a null call leg', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    period_of_report: '2025-12-31',
                    call_value_usd: null,
                    put_value_usd: '5000',
                    holder_count: '1',
                },
            ],
        });
        const result = await fetchSecDerivatives('QQQ', true);
        expect(result?.callValueUsd).toBe(0);
        expect(result?.putValueUsd).toBe(5000);
        expect(result?.netSkew).toBe('put_skew');
    });

    it('derives balanced when call and put notional are equal', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    period_of_report: '2025-12-31',
                    call_value_usd: '1000',
                    put_value_usd: '1000',
                    holder_count: '1',
                },
            ],
        });
        const result = await fetchSecDerivatives('IWM', true);
        expect(result?.netSkew).toBe('balanced');
    });
});
