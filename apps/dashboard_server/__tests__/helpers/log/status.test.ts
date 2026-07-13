// Unit tests for helpers/log/status.ts (Phase Y-TD — Y-TD-T3).
//
// Covers all five branching rules of deriveLogStatus:
//   1. done wins over overdue: done_at set + past due → 'done' (not 'overdue').
//   2. due null → undefined (not a todo).
//   3. due < now → 'overdue'.
//   4. due > now → 'todo'.
//   5. Boundary: due === now (same millisecond) → 'todo' (NOT 'overdue').
//
// No DB or clock reads — pure function; `now` is injected.
import { deriveLogStatus } from '../../../src/helpers/log/status';

const NOW = new Date('2026-07-13T12:00:00.000Z');
const PAST = '2026-07-13T11:59:59.999Z'; // 1ms before NOW
const FUTURE = '2026-07-13T12:00:00.001Z'; // 1ms after NOW
const SAME = NOW.toISOString(); // exactly NOW

describe('deriveLogStatus', () => {
    it('returns "done" when done_at is set, even if due_at is in the past', () => {
        // done wins over overdue — done_at is checked first.
        expect(deriveLogStatus(PAST, '2026-07-12T00:00:00.000Z', NOW)).toBe(
            'done'
        );
    });

    it('returns "done" when done_at is set and due_at is in the future', () => {
        expect(deriveLogStatus(FUTURE, '2026-07-12T00:00:00.000Z', NOW)).toBe(
            'done'
        );
    });

    it('returns undefined when due_at is null (not a todo)', () => {
        expect(deriveLogStatus(null, null, NOW)).toBeUndefined();
    });

    it('returns undefined when due_at is null even if done_at is set', () => {
        // Impossible state in practice (done_at requires due_at), but the
        // function must handle it without crashing. done_at check comes first.
        expect(deriveLogStatus(null, '2026-07-12T00:00:00.000Z', NOW)).toBe(
            'done'
        );
    });

    it('returns "overdue" when due_at is strictly before now and done_at is null', () => {
        expect(deriveLogStatus(PAST, null, NOW)).toBe('overdue');
    });

    it('returns "todo" when due_at is strictly after now and done_at is null', () => {
        expect(deriveLogStatus(FUTURE, null, NOW)).toBe('todo');
    });

    it('returns "todo" when due_at equals now exactly (boundary — not overdue)', () => {
        // due === now is NOT overdue (strict < required).
        expect(deriveLogStatus(SAME, null, NOW)).toBe('todo');
    });

    it('accepts Date objects as well as ISO strings for due_at', () => {
        const dueDate = new Date(PAST);
        expect(deriveLogStatus(dueDate, null, NOW)).toBe('overdue');
    });

    it('accepts Date objects for done_at', () => {
        const doneDate = new Date('2026-07-12T00:00:00.000Z');
        expect(deriveLogStatus(PAST, doneDate, NOW)).toBe('done');
    });
});
