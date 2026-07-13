// apis/patch-log-todo.api.ts
// Purpose: update todo fields on a log entry (PATCH /v1/api/log/:id/todo).
// Caller: useUpdateLogTodo. Requires a Clerk bearer token (author-only, server
// enforces). Unwraps {success, data} envelope exactly once.
// Constraints: id stays STRING (BIGINT-safe). Never Number()/parseInt.

import { clientRequest } from '@/apis/http.client';
import type { TLog, TLogTodoUpdateRequest } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLog;
}

export async function patchLogTodo(
    token: string,
    logId: string,
    input: TLogTodoUpdateRequest
): Promise<TLog> {
    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log/${encodeURIComponent(logId)}/todo`,
        method: 'PATCH',
        body: input,
        token,
        fallbackError: 'Failed to update log todo',
    });
    return envelope.data;
}
