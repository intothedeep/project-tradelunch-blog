-- =============================================================================
-- Migration: 0025_politician_committees.sql
-- Purpose   : Congressional committee membership + sector-jurisdiction map for
--             Phase Q committee-relevance enrichment. Links politician_registry
--             (via bioguide_id) to the committees they currently serve on, and
--             maps committees to GICS-aligned sectors so we can flag trades where
--             the filer's committee governs that stock's sector.
-- Source    : unitedstates/congress-legislators (CC0 public domain):
--               committees-current.yaml
--               committee-membership-current.yaml
-- Limitation: CURRENT members only — historical committee memberships are not
--             available from this dataset. Filers who have left office won't
--             have committee rows. Accepted v1 limitation; noted in UI.
-- Note      : MANUAL — apply by hand AFTER 0024. Additive + idempotent
--             (CREATE TABLE IF NOT EXISTS; CREATE OR REPLACE VIEW).
--             Re-confirm next free number before applying (multi-session).
-- =============================================================================

-- Committee membership per politician (current only; soft-delete for staleness).
CREATE TABLE IF NOT EXISTS politician_committees (
    bioguide_id          TEXT        NOT NULL,
    committee_thomas_id  TEXT        NOT NULL,
    committee_name       TEXT        NOT NULL,
    committee_type       TEXT        NOT NULL,  -- 'house' | 'senate' | 'joint'
    title                TEXT            NULL,  -- 'Chair', 'Ranking Member', etc.
    source               TEXT        NOT NULL DEFAULT 'congress-legislators',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ         NULL,
    PRIMARY KEY (bioguide_id, committee_thomas_id)
);

-- Fixed committee -> sector mapping (seeded by collector; data-driven / refineable).
CREATE TABLE IF NOT EXISTS committee_sector_map (
    committee_thomas_id  TEXT  NOT NULL,
    sector               TEXT  NOT NULL,
    PRIMARY KEY (committee_thomas_id, sector)
);

-- "Which sectors does this member's committee jurisdiction cover?"
-- Join on deleted_at IS NULL so only active memberships qualify.
CREATE OR REPLACE VIEW v_politician_sector_oversight AS
SELECT DISTINCT
    pc.bioguide_id,
    csm.sector
FROM politician_committees pc
JOIN committee_sector_map csm
    ON csm.committee_thomas_id = pc.committee_thomas_id
WHERE pc.deleted_at IS NULL;
