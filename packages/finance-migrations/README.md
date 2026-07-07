# finance-migrations

DDL SSOT for the finance Oracle VM PG17 instance.

## Purpose

This package holds all SQL migration files for the finance schema. It is the single authoritative source for the finance database structure — `finance_api` applies migrations from here; `finance_web` never touches DDL directly.

## Status

`0001_finance_init.sql` — reviewed draft assembled by a parallel task from `apps/dashboard_server/supabase/migrations/` (sources 0001–0035). **Not yet applied to the Oracle VM instance.** At cutover, validate the draft against a `pg_dump --schema-only` of the source database before applying.

## Migration naming convention

```
migrations/   (future incremental DDL — not yet created)
0001_finance_init.sql     # reviewed draft; authoritative once applied at cutover
0002_<description>.sql    # incremental DDL changes post-cutover
```

## Applying the initial migration

```sh
psql $FINANCE_POSTGRES_URL_NON_POOLING -f 0001_finance_init.sql
```

Use `FINANCE_POSTGRES_URL_NON_POOLING` (direct connection, port 5432) — never the pooled URL.
