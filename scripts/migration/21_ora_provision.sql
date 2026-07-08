-- 21 — Run ONCE on the Oracle PG17 box as superuser (postgres) to create the
-- finance database, a least-privilege app role, and required extensions.
--   psql "postgresql://postgres:PW@localhost:5432/postgres" -v ON_ERROR_STOP=1 -f 21_ora_provision.sql
-- Then set the app password with:  ALTER ROLE app PASSWORD '...';

CREATE ROLE app LOGIN PASSWORD 'CHANGE_ME';

CREATE DATABASE finance OWNER app;

\connect finance

-- Extensions the finance schema relies on (pgcrypto for gen_random_uuid, etc.).
-- Add any others surfaced when 31_restore_finance.sh reports missing functions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- app owns its schema objects after restore (--no-owner means restorer becomes owner).
GRANT ALL ON SCHEMA public TO app;

-- TLS: enable in postgresql.conf (ssl = on) + place server.crt/server.key.
-- node-pg (rejectUnauthorized:false) and asyncpg (CERT_NONE) FORCE ssl → if TLS is
-- off they cannot connect. Self-signed is fine (non-verifying clients).
