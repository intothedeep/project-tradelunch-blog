// apis/get-log-todos.api.ts
// Purpose: fetch owner's todo log entries (GET /v1/api/log/todos).
// Owner-scoped — server enforces auth; requires a Clerk bearer token.
// Keyset paginated via compound (due_at|id) STRING cursor.
// Unwraps {success, data} envelope exactly once.
// Constraints: cursor stays STRING. Never Number()/parseInt.

import { clientRequest } from '@/apis/http.client';
import type { TLogTodoListResponse } from '@repo/types';

interface TEnvelope {
    success: boolean;
    data: TLogTodoListResponse;
}

export type TLogTodoStatus = 'todo' | 'done' | 'overdue' | 'all';

type TGetLogTodosOpts = {
    status?: TLogTodoStatus;
    cursor?: string;
    limit?: number;
};

export async function getLogTodos(
    token: string,
    opts?: TGetLogTodosOpts
): Promise<TLogTodoListResponse> {
    const params = new URLSearchParams();
    if (opts?.status) params.append('status', opts.status);
    if (opts?.cursor !== undefined) params.append('cursor', opts.cursor);
    if (opts?.limit !== undefined) params.append('limit', String(opts.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const envelope = await clientRequest<TEnvelope>({
        path: `/v1/api/log/todos${qs}`,
        method: 'GET',
        token,
        fallbackError: 'Failed to load todo log entries',
    });
    return envelope.data;
}
