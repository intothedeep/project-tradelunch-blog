// Purpose: shape an UNTRUSTED error-report body into a bounded, insert-ready row
//          and persist it. The ingest is PUBLIC (called server-to-server by the
//          Next runtime), so the coercion is defensive: every field is forced to
//          string-or-null, truncated to a hard cap, and unknown fields dropped.
// Invariants:
//   * Pure shaper (normalizeErrorLog) is deterministic, zero side effects — the
//     ONLY thing under test. `source` defaults to 'browser' when absent/blank.
//   * Truncation caps: message 2000, stack 8000, path 1000, user_agent 500,
//     source 100 — bounds runaway payloads before they reach Postgres.
// Side effects: insertErrorLog runs ONE parameterized INSERT (no SELECT-back).
import type { Pool } from 'pg';

const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;
const PATH_MAX = 1000;
const USER_AGENT_MAX = 500;
const SOURCE_MAX = 100;

export type TErrorLogRow = {
    digest: string | null;
    message: string | null;
    stack: string | null;
    path: string | null;
    userAgent: string | null;
    source: string;
};

// Coerce one field to a trimmed, length-capped string, or null when absent/blank.
function toCappedStringOrNull(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, max);
}

// Shape an untrusted body into a bounded row. Non-object bodies yield an
// all-null row with the default source — never throws.
export function normalizeErrorLog(body: unknown): TErrorLogRow {
    const input = (
        typeof body === 'object' && body !== null ? body : {}
    ) as Record<string, unknown>;
    return {
        digest: toCappedStringOrNull(input.digest, PATH_MAX),
        message: toCappedStringOrNull(input.message, MESSAGE_MAX),
        stack: toCappedStringOrNull(input.stack, STACK_MAX),
        path: toCappedStringOrNull(input.path, PATH_MAX),
        userAgent: toCappedStringOrNull(input.user_agent, USER_AGENT_MAX),
        source: toCappedStringOrNull(input.source, SOURCE_MAX) ?? 'browser',
    };
}

// Describe an unknown throw as a string: Error → message, string → itself,
// anything else → best-effort JSON (circular/undefined fall back to String()).
function describeThrown(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

// Shape a thrown Express runtime error into a bounded row (source='express').
// Pure + total: extracts message/stack from an Error, coerces request context
// to the same caps as the ingest path, never throws. `digest` is always null
// (digest is a Next-only correlation key; Express errors have none).
export function buildExpressErrorRow(
    err: unknown,
    path: string | undefined,
    userAgent: string | undefined
): TErrorLogRow {
    const stack = err instanceof Error ? (err.stack ?? null) : null;
    return {
        digest: null,
        message: toCappedStringOrNull(describeThrown(err), MESSAGE_MAX),
        stack: toCappedStringOrNull(stack, STACK_MAX),
        path: toCappedStringOrNull(path, PATH_MAX),
        userAgent: toCappedStringOrNull(userAgent, USER_AGENT_MAX),
        source: 'express',
    };
}

// Persist a shaped row. One parameterized INSERT; no value is returned.
export async function insertErrorLog(
    pool: Pool,
    row: TErrorLogRow
): Promise<void> {
    await pool.query(
        `INSERT INTO error_log (digest, message, stack, path, user_agent, source)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            row.digest,
            row.message,
            row.stack,
            row.path,
            row.userAgent,
            row.source,
        ]
    );
}
