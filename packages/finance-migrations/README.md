# finance-migrations

DDL SSOT for the finance Oracle VM PG17 instance.

## Purpose

This package holds all SQL migration files for the finance schema. It is the single authoritative source for the finance database structure — `finance_api` applies migrations from here; `finance_web` never touches DDL directly.

## Status

`0001_finance_init.sql` — reviewed draft assembled by a parallel task from `apps/dashboard_server/supabase/migrations/` (sources 0001–0035). **Not yet applied to the Oracle VM instance.** At cutover, validate the draft against a `pg_dump --schema-only` of the source database before applying.

`0002_users.sql` — finance-local `users` mirror (Clerk identity → Oracle). 0001 deliberately EXCLUDED the blog `users` table; this reintroduces a finance-owned one so role (`is_admin`) lives in our DB and per-user domain data can FK to `users.id`. Populated lazily by `finance_api` (`helpers/provisionUser.ts`) on first authenticated request. Grant admin via SQL: `UPDATE users SET is_admin=true WHERE clerk_user_id='<id>';`

## Migration naming convention

```
migrations/   (future incremental DDL — not yet created)
0001_finance_init.sql     # reviewed draft; authoritative once applied at cutover
0002_<description>.sql    # incremental DDL changes post-cutover
```

## Applying the initial migration

```sh
psql $POSTGRES_URL_NON_POOLING -f 0001_finance_init.sql
psql $POSTGRES_URL_NON_POOLING -f 0002_users.sql
```

Use `POSTGRES_URL_NON_POOLING` (direct connection, port 5432) — never the pooled URL.
