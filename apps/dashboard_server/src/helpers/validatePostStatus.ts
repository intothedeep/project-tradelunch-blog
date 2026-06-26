// Purpose: pure validation of an admin status-change input (TAdminPostStatusInput).
// Invariants: accepts only a known post_status_enum value
//             (public | private | follower | draft); deterministic, no side effects.
import type { TPostStatus } from '@repo/types';

type TValidatePostStatusResult =
    | { ok: true; value: TPostStatus }
    | { ok: false; reason: string };

const VALID_STATUSES: ReadonlySet<TPostStatus> = new Set<TPostStatus>([
    'public',
    'private',
    'follower',
    'draft',
]);

export function validatePostStatus(v: unknown): TValidatePostStatusResult {
    if (typeof v !== 'string' || !VALID_STATUSES.has(v as TPostStatus)) {
        return { ok: false, reason: 'status is invalid' };
    }
    return { ok: true, value: v as TPostStatus };
}
