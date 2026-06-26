// DB-dependent integration test for the owner-scoped username claim.
// Requires a live Postgres (DATABASE_URL). When no DB is reachable the whole
// suite is skipped so the pure unit suite still runs green.
import { pool } from '../../src/database';
import { claimUsername } from '../../src/helpers/claimUsername';

async function isDbReachable(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

const tag = `test_${Date.now()}`;
const clerkA = `clerk_a_${tag}`;
const clerkB = `clerk_b_${tag}`;
const wantedName = `claim_${tag}`.slice(0, 30);

describe('claimUsername (integration)', () => {
    let reachable = false;
    let userA = 0;
    let userB = 0;

    beforeAll(async () => {
        reachable = await isDbReachable();
        if (!reachable) return;
        const a = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerkA]
        );
        const b = await pool.query<{ id: number }>(
            'INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id',
            [clerkB]
        );
        userA = a.rows[0].id;
        userB = b.rows[0].id;
    });

    afterAll(async () => {
        if (reachable) {
            await pool.query('DELETE FROM users WHERE clerk_user_id = ANY($1)', [
                [clerkA, clerkB],
            ]);
        }
        await pool.end();
    });

    const guard = () => {
        if (!reachable) {
            console.warn('claimUsername.test: DB unreachable — skipping');
        }
        return reachable;
    };

    it('first claim succeeds', async () => {
        if (!guard()) return;
        const result = await claimUsername(pool, userA, wantedName);
        expect(result).toEqual({ ok: true, username: wantedName });
    });

    it('a second user claiming the same name conflicts (409 taken)', async () => {
        if (!guard()) return;
        const result = await claimUsername(pool, userB, wantedName);
        expect(result).toEqual({
            ok: false,
            status: 409,
            reason: 'username taken',
        });
    });

    it('the same user re-claiming conflicts (409 already set)', async () => {
        if (!guard()) return;
        const result = await claimUsername(pool, userA, `${wantedName}_2`.slice(0, 30));
        expect(result).toEqual({
            ok: false,
            status: 409,
            reason: 'username already set',
        });
    });
});
