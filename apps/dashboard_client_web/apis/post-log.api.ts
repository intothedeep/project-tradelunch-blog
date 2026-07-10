// apis/post-log.api.ts
// Purpose: create a log entry (POST /v1/api/log).
// parentId=null → top-level log post (owner-only, server enforces 403 else).
// parentId=string → reply to an existing live log node (any authenticated user).
// Constraints: requires a Clerk bearer token. id stays STRING. Unwraps envelope once.

import { clientRequest } from '@/apis/http.client';
import type { TLog, TLogCreateRequest } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLog;
}

export async function postLog(
    token: string,
    input: TLogCreateRequest
): Promise<TLog> {
    const envelope = await clientRequest<TEnvelope>({
        path: '/v1/api/log',
        method: 'POST',
        body: input,
        token,
        fallbackError: 'Failed to create log entry',
    });
    return envelope.data;
}
