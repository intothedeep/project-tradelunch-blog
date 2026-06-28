// Integration test for provisionUser (Phase F2 email-adoption).
// Exercises the helper directly against a live Postgres (the same read-first,
// adopt, create logic resolveAuth runs) with the verified email supplied as a
// stub (no Clerk network). Requires DATABASE_URL; skips wholesale when unreachable.
import { pool } from '../../src/database';
import { provisionUser } from '../../src/helpers/provisionUser';

async function isDbReachable(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

const tag = `pu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const email = (s: string) => `${tag}-${s}@example.com`;
const sub = (s: string) => `${tag}_sub_${s}`;
const stub = (e: string | null) => () => Promise.resolve(e);

describe('provisionUser — email adoption (integration)', () => {
    let reachable = false;

    beforeAll(async () => {
        reachable = await isDbReachable();
    });

    afterAll(async () => {
        if (reachable) {
            await pool.query(
                'DELETE FROM users WHERE clerk_user_id LIKE $1 OR email LIKE $1',
                [`${tag}%`]
            );
        }
        await pool.end();
    });

    const guard = () => {
        if (!reachable) console.warn('provisionUser.test: DB unreachable — skipping');
        return reachable;
    };

    it('adopts an UNLINKED row matched by verified email (links clerk_user_id)', async () => {
        if (!guard()) return;
        const e = email('adopt');
        const pre = await pool.query<{ id: number }>(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id',
            [`${tag}_taeklike`, e]
        );
        const preId = Number(pre.rows[0].id);

        const row = await provisionUser(pool, sub('adopt'), stub(e));
        expect(row).not.toBeNull();
        expect(Number(row!.id)).toBe(preId); // SAME row adopted, not a new one

        const { rows } = await pool.query<{ clerk_user_id: string | null }>(
            'SELECT clerk_user_id FROM users WHERE id = $1',
            [preId]
        );
        expect(rows[0].clerk_user_id).toBe(sub('adopt'));
    });

    it('does NOT steal a row already linked to another Clerk account', async () => {
        if (!guard()) return;
        const e = email('linked');
        const pre = await pool.query<{ id: number }>(
            'INSERT INTO users (username, email, clerk_user_id) VALUES ($1, $2, $3) RETURNING id',
            [`${tag}_owned`, e, sub('owner')]
        );
        const preId = Number(pre.rows[0].id);

        // A different sub with the SAME email must NOT adopt the linked row.
        const row = await provisionUser(pool, sub('intruder'), stub(e));
        expect(row).not.toBeNull();
        expect(Number(row!.id)).not.toBe(preId); // a fresh row, not the linked one
    });

    it('creates a new row (with email) when nothing matches', async () => {
        if (!guard()) return;
        const e = email('new');
        const row = await provisionUser(pool, sub('new'), stub(e));
        expect(row).not.toBeNull();

        const { rows } = await pool.query<{ email: string | null }>(
            'SELECT email FROM users WHERE clerk_user_id = $1',
            [sub('new')]
        );
        expect(rows[0].email).toBe(e);
    });

    it('creates a row with NULL email when the email fetch yields null', async () => {
        if (!guard()) return;
        const row = await provisionUser(pool, sub('noemail'), stub(null));
        expect(row).not.toBeNull();

        const { rows } = await pool.query<{ email: string | null }>(
            'SELECT email FROM users WHERE clerk_user_id = $1',
            [sub('noemail')]
        );
        expect(rows[0].email).toBeNull();
    });

    it('is idempotent: the same sub resolves to one row (fast path, no duplicate)', async () => {
        if (!guard()) return;
        const first = await provisionUser(pool, sub('idem'), stub(email('idem')));
        const second = await provisionUser(pool, sub('idem'), stub(email('idem')));
        expect(Number(first!.id)).toBe(Number(second!.id));

        const { rows } = await pool.query<{ n: string }>(
            'SELECT COUNT(*)::int AS n FROM users WHERE clerk_user_id = $1',
            [sub('idem')]
        );
        expect(Number(rows[0].n)).toBe(1);
    });
});
