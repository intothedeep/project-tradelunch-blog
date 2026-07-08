# 91 — Post-cutover: rotate & scrub Supabase secrets

Both blog DB and storage now leave the **current** Supabase project, so its live
credentials (in the root `.env`) must be rotated/scrubbed once the new stack is stable.

## Steps

1. **Root `.env`** — remove/rotate the live SRC values:
   - Supabase project ref `rdtvemrbbsmiagbyvgzz` references
   - `sb_secret_...` service key
   - SRC `POSTGRES_URL*` DSNs
2. **Vercel** — remove the SRC Supabase integration (auto-injected `POSTGRES_*`) once
   DST-SB vars are manually set and verified. Rotate the DST-SB service key after go-live.
3. **GitHub Actions** — delete the old SRC `DATABASE_URL` / `POSTGRES_URL_NON_POOLING`
   secret values; keep only the Oracle DSNs (prefer a `oracle-prod` Environment).
4. **Keep the keepalive workflow, REPOINT it** (do NOT delete — the blog DB still lives
   on a Supabase project subject to the 7-day auto-pause; only finance left Supabase):
   - Set a dedicated GitHub secret `BLOG_SUPABASE_DATABASE_URL` = new blog Supabase pooled URI.
   - `supabase-keepalive.yml` already reads it (falls back to `DATABASE_URL` pre-cutover).
   - Remove the fallback once `BLOG_SUPABASE_DATABASE_URL` is confirmed set.
5. **Supabase Storage S3 keys** — revoke the SRC S3 access keys used by `50_storage_presync.sh`.

## Do NOT do until reconciliation green ≥1 week
- Deleting the SRC Supabase project (it is the rollback anchor — see `90_rollback.sh`).
