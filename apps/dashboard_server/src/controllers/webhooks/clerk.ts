// Purpose: Clerk -> server user provisioning webhook (invite-gated).
// Invariants:
//   * Svix signature MUST verify against the RAW request body; a bad/absent
//     signature => 400 and no DB write.
//   * Only `user.created` provisions. Unhandled events => 200 (ack, no-op).
//   * Provisioning requires a valid, unused, unexpired invite code.
//   * INSERT is idempotent via ON CONFLICT (clerk_user_id) DO NOTHING.
// Side effects: Svix verify (CPU), DB reads/writes inside a transaction.
// Constraints: this router is mounted on a path that receives express.raw(),
//   so req.body is a Buffer here — never JSON-parsed upstream.
import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { pool } from '../../database';
import { CLERK_WEBHOOK_SECRET } from '../../config/env.schema';

export const router = Router();

type TClerkEmailAddress = { id: string; email_address: string };

type TClerkUserCreatedData = {
    id: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: TClerkEmailAddress[];
    public_metadata?: Record<string, unknown>;
    unsafe_metadata?: Record<string, unknown>;
};

type TClerkWebhookEvent = {
    type: string;
    data: TClerkUserCreatedData;
};

function verifyEvent(req: Request): TClerkWebhookEvent | null {
    if (!CLERK_WEBHOOK_SECRET) return null;
    const payload = req.body instanceof Buffer ? req.body.toString('utf8') : '';
    const headers = {
        'svix-id': req.header('svix-id') ?? '',
        'svix-timestamp': req.header('svix-timestamp') ?? '',
        'svix-signature': req.header('svix-signature') ?? '',
    };
    try {
        const wh = new Webhook(CLERK_WEBHOOK_SECRET);
        return wh.verify(payload, headers) as TClerkWebhookEvent;
    } catch {
        return null;
    }
}

function pickPrimaryEmail(data: TClerkUserCreatedData): string | null {
    const list = data.email_addresses ?? [];
    const primary = list.find((e) => e.id === data.primary_email_address_id);
    return (primary ?? list[0])?.email_address ?? null;
}

function buildDisplayName(data: TClerkUserCreatedData): string | null {
    const parts = [data.first_name, data.last_name].filter(
        (p): p is string => Boolean(p && p.trim())
    );
    if (parts.length > 0) return parts.join(' ');
    return data.username ?? null;
}

function readInviteCode(data: TClerkUserCreatedData): string | null {
    const fromPublic = data.public_metadata?.['inviteCode'];
    const fromUnsafe = data.unsafe_metadata?.['inviteCode'];
    const code = fromPublic ?? fromUnsafe;
    return typeof code === 'string' && code.trim() ? code.trim() : null;
}

async function provisionUser(data: TClerkUserCreatedData): Promise<void> {
    const inviteCode = readInviteCode(data);
    if (!inviteCode) return; // invite-gate: no code => no provisioning

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: invites } = await client.query<{ id: number }>(
            `SELECT id FROM invites
             WHERE code = $1
               AND used_by IS NULL
               AND deleted_at IS NULL
               AND (expires_at IS NULL OR expires_at > now())
             FOR UPDATE`,
            [inviteCode]
        );
        const invite = invites[0];
        if (!invite) {
            await client.query('ROLLBACK');
            return; // invalid/used/expired invite => no provisioning
        }

        const { rows: inserted } = await client.query<{ id: number }>(
            `INSERT INTO users (clerk_user_id, email, username, display_name, avatar_url)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (clerk_user_id) DO NOTHING
             RETURNING id`,
            [
                data.id,
                pickPrimaryEmail(data),
                data.username ?? null,
                buildDisplayName(data),
                data.image_url ?? null,
            ]
        );

        const newUser = inserted[0];
        if (newUser) {
            await client.query(
                `UPDATE invites
                 SET used_by = $1, used_at = now(), updated_at = now()
                 WHERE id = $2`,
                [newUser.id, invite.id]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

router.post('/clerk', async (req: Request, res: Response) => {
    const event = verifyEvent(req);
    if (!event) {
        res.status(400).json({ success: false, message: 'invalid signature' });
        return;
    }

    try {
        if (event.type === 'user.created') {
            await provisionUser(event.data);
        }
        // Unhandled events are acknowledged without side effects.
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('clerk webhook provisioning error:', error);
        res.status(500).json({ success: false, message: 'provisioning failed' });
    }
});

export default router;
