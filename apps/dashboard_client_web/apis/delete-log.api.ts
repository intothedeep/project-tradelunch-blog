// apis/delete-log.api.ts
// Purpose: soft-delete a log entry (DELETE /v1/api/log/:id).
// The server tombstones the row (sets deleted_at); body is masked to "[deleted]"
// and authorName is omitted in subsequent reads. Authorized for the entry author,
// the log owner, or an admin (server enforces).
// Constraints: requires a Clerk bearer token. id stays STRING. Unwraps envelope once.

import { clientRequest } from '@/apis/http.client';
import type { TLog } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLog;
}

export async function deleteLog(token: string, logId: string): Promise<TLog> {
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log/${encodeURIComponent(logId)}`,
        method: 'DELETE',
        token,
        fallbackError: 'Failed to delete log entry',
    });
    return envelope.data;
}
