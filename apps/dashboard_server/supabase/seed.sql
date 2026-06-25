-- =============================================================================
-- Seed: seed.sql
-- Purpose   : Dev seed data only. NOT run in production migrations.
--             Extracted from apps/dashboard_server/schema/tradelunch.schema.sql.
-- =============================================================================

INSERT INTO users (username, email)
VALUES ('darkowlrising', 'darkowlrising@gmail.com');

INSERT INTO users (username, email)
VALUES ('taeklim', 'tio.taek.lim@gmail.com');

INSERT INTO users (username, email, password_hash)
VALUES ('john', 'john@example.com', 'hashed_pw')
ON CONFLICT (email)
DO UPDATE
SET username      = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at    = CURRENT_TIMESTAMP;
