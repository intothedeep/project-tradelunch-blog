-- =============================================================================
-- Migration: 0002_rls_policies.sql
-- Purpose   : Enable Row Level Security on all blog tables.
--             Phase A: public SELECT only. No write policies.
--             Writes go through the service-role/backend connection (bypasses RLS).
--             Phase D will add owner-based write policies (Clerk + authoring UI).
-- =============================================================================

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE files           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_categories ENABLE ROW LEVEL SECURITY;

-- Public read: blog is read-only and fully public; any anonymous request may SELECT.
CREATE POLICY "public_select_users"           ON users           FOR SELECT USING (true);
CREATE POLICY "public_select_posts"           ON posts           FOR SELECT USING (true);
CREATE POLICY "public_select_categories"      ON categories      FOR SELECT USING (true);
CREATE POLICY "public_select_files"           ON files           FOR SELECT USING (true);
CREATE POLICY "public_select_tags"            ON tags            FOR SELECT USING (true);
CREATE POLICY "public_select_post_tags"       ON post_tags       FOR SELECT USING (true);
CREATE POLICY "public_select_post_categories" ON post_categories FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE policies. The backend connects via DATABASE_URL using a
-- role that bypasses RLS; all writes (publish scripts) run outside RLS context.
