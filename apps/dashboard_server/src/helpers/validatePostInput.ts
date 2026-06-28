// Purpose: pure validation of a create/update post request body.
// Invariants: a non-draft (publish) save requires a non-empty title AND a
//             non-null categoryId; a draft (status 'draft' or absent) accepts an
//             empty/absent title (stored as '') and a null/absent category. A
//             present title must be a string ≤255 chars (trimmed). status (when
//             present) is a known post_status_enum value; content/description are
//             string|undefined; categoryId is null or a numeric STRING (BIGINT-
//             safe, never Number()-ed); tags (when present) normalize to a
//             lowercase, deduped, capped string[] (an empty array = clear set).
// Constraints: deterministic, zero side effects. Mirrors validateUsername's shape.
import type { TPostInput, TPostStatus } from '@repo/types';
import { normalizeTags } from './normalizeTags';

type TValidatePostInputResult =
    | { ok: true; value: TPostInput }
    | { ok: false; reason: string };

const TITLE_MAX = 255;

const VALID_STATUSES: ReadonlySet<TPostStatus> = new Set<TPostStatus>([
    'public',
    'private',
    'follower',
    'draft',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

// Absent status is treated as a draft for the title/category requirement rules,
// matching body-first autosave which may fire before a title is typed.
function isDraftStatus(status: unknown): boolean {
    return status === undefined || status === 'draft';
}

// A category id is null or a numeric string (the BIGINT serialized form).
function isValidCategoryId(value: unknown): value is string | null {
    return value === null || (typeof value === 'string' && /^\d+$/.test(value));
}

export function validatePostInput(body: unknown): TValidatePostInputResult {
    if (!isRecord(body)) {
        return { ok: false, reason: 'body must be an object' };
    }

    const { title, content, description, categoryId, status, slug, thumbnailUrl, tags } =
        body;

    if (status !== undefined && !VALID_STATUSES.has(status as TPostStatus)) {
        return { ok: false, reason: 'status is invalid' };
    }

    if (title !== undefined && typeof title !== 'string') {
        return { ok: false, reason: 'title is required' };
    }
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (!isDraftStatus(status) && trimmedTitle.length === 0) {
        return { ok: false, reason: 'title is required' };
    }
    if (trimmedTitle.length > TITLE_MAX) {
        return { ok: false, reason: 'title must be 255 characters or fewer' };
    }

    if (content !== undefined && typeof content !== 'string') {
        return { ok: false, reason: 'content must be a string' };
    }
    if (description !== undefined && typeof description !== 'string') {
        return { ok: false, reason: 'description must be a string' };
    }

    if (categoryId !== undefined && !isValidCategoryId(categoryId)) {
        return { ok: false, reason: 'categoryId must be a numeric string or null' };
    }

    // Publish rule: a non-draft save requires a category (≥ depth 1). Mirrors the
    // title-required rule. A present null or an absent categoryId both fail.
    if (!isDraftStatus(status) && (categoryId === undefined || categoryId === null)) {
        return { ok: false, reason: 'categoryId is required to publish' };
    }

    if (slug !== undefined && typeof slug !== 'string') {
        return { ok: false, reason: 'slug must be a string' };
    }

    // Tags: undefined = leave untouched; an array (incl. empty) = replace set.
    let normalizedTags: string[] | undefined;
    if (tags !== undefined) {
        const tagsResult = normalizeTags(tags);
        if (tagsResult.ok === false) {
            return { ok: false, reason: tagsResult.reason };
        }
        normalizedTags = tagsResult.value;
    }

    // Tri-state thumbnail: undefined = untouched, null = clear, string = set.
    if (
        thumbnailUrl !== undefined &&
        thumbnailUrl !== null &&
        typeof thumbnailUrl !== 'string'
    ) {
        return { ok: false, reason: 'thumbnailUrl must be a string or null' };
    }

    const value: TPostInput = {
        title: trimmedTitle,
        ...(content !== undefined ? { content } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(categoryId !== undefined
            ? { categoryId: categoryId as string | null }
            : {}),
        ...(status !== undefined ? { status: status as TPostStatus } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
        ...(thumbnailUrl !== undefined
            ? { thumbnailUrl: thumbnailUrl as string | null }
            : {}),
    };

    return { ok: true, value };
}
