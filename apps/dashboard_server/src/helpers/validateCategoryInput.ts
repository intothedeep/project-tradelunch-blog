// Purpose: pure validation of a create-category request body.
// Invariants: title is a string, trimmed + lowercased (canonical), 1..100 chars
//             (mirrors categories.title varchar(100)). parentId is null/absent
//             (a root) OR a numeric STRING (BIGINT-safe; never Number()-ed) —
//             absent normalizes to null.
// Constraints: deterministic, zero side effects. Mirrors validatePostInput's
//             result shape ({ ok, value } | { ok:false, reason }).
import type { TCreateCategoryInput } from '@repo/types';

type TValidateCategoryInputResult =
    | { ok: true; value: { title: string; parentId: string | null } }
    | { ok: false; reason: string };

const TITLE_MIN = 1;
const TITLE_MAX = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function validateCategoryInput(
    body: unknown
): TValidateCategoryInputResult {
    if (!isRecord(body)) {
        return { ok: false, reason: 'body must be an object' };
    }

    const { title, parentId } = body as Partial<TCreateCategoryInput>;

    if (typeof title !== 'string') {
        return { ok: false, reason: 'title is required' };
    }
    const normalizedTitle = title.trim().toLowerCase();
    if (normalizedTitle.length < TITLE_MIN) {
        return { ok: false, reason: 'title is required' };
    }
    if (normalizedTitle.length > TITLE_MAX) {
        return { ok: false, reason: 'title must be 100 characters or fewer' };
    }

    let normalizedParentId: string | null = null;
    if (parentId !== undefined && parentId !== null) {
        if (typeof parentId !== 'string' || !/^\d+$/.test(parentId)) {
            return {
                ok: false,
                reason: 'parentId must be a numeric string or null',
            };
        }
        normalizedParentId = parentId;
    }

    return {
        ok: true,
        value: { title: normalizedTitle, parentId: normalizedParentId },
    };
}
