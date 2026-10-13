// Purpose: validate BIGINT (Snowflake) ids arriving as strings.
// Constraints: ids exceed 2^53, so they stay strings end to end - never
//   Number()/parseInt. An id that is not a positive int64 would make Postgres
//   raise "invalid input syntax for type bigint" (a 500), so callers reject it
//   with a 4xx before binding.

const BIGINT_MAX = '9223372036854775807';

export function isValidBigintId(value: unknown): value is string {
    if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value)) {
        return false;
    }
    return value.length < BIGINT_MAX.length || value <= BIGINT_MAX;
}
