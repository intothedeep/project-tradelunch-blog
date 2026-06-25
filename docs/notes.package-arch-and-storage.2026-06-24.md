# Architecture Notes — Package Layering & S3→Supabase Storage (2026-06-24)

Authored by the system-architect agent during the deploy-prep refactor. Companion to
`00.plan.md` / `00.tasks.md` / `01.status.md`.

---

## Note 1 — Shared-package layering (target state)

DAG after the 2026-06-24 refactor:

```
@repo/types            (raw TS, NO build, no deps)
      ^
@repo/markdown-parsing  (rollup dist; depends on @repo/types)
@repo/ui                (tsc dist; React)
@repo/axios             (tsc dist; axios)
      ^
apps/dashboard_client_web   (Next.js; transpilePackages: ['@repo/types'])
apps/dashboard_server       (tsc; resolves @repo/types via raw-TS main/types field)
```

Roles:
- **`@repo/types`** — cross-cutting API-boundary type contracts only. No build step;
  `main`/`types` → `./src/index.ts`. Holds: `ETreeNodeType`, `TCategoryTreeNode`,
  `TPostTreeNode`, `TCategoryTreeResponse`, `TTreeNode`, `TTreeNodeWithChildren`
  (the server↔client wire contract for the category tree).
- **`@repo/markdown-parsing`** — shared LOGIC (TOC parse, `CustomSnowflake`,
  `extractMarkdownFile`) + its own internal types (`TTocItem`, `TProcessedMarkdown`,
  `TPostFileMeta`). `category.types.ts` is now `export * from '@repo/types'` (back-compat).
- **`@repo/ui`, `@repo/axios`** — client-leaning shared libs (not used by the server).
- **`@repo/assets`** — static files; near-zero coupling after today's cleanup.

### Guardrail — what belongs in `@repo/types`
Add only when ALL hold: (1) the type crosses a server↔client HTTP boundary (serialized in a
response, deserialized in another app); (2) it's a stable contract, not an impl detail;
(3) no import-time side effects, no Node/DOM/React references.
Do NOT add: single-package internal types (`TTocItem`), UI/DOM types, script-only types
(`TPostFileMeta`). Test: if removing it would break only one app/package, it doesn't belong.

### Gotchas
- `@repo/types` has no build → turbo has no task for it → no `dist`. The workspace symlink
  must exist before either app compiles → **`pnpm install` is mandatory** after pulling.
- `ETreeNodeType` is a runtime enum (emits JS). Next.js handles it via
  `transpilePackages: ['@repo/types']`; the server via tsc compiling the raw source. Both correct.
- Do not remove `@repo/types` from `@repo/markdown-parsing` deps — its `/types` re-export
  depends on it being linked.

### Remaining smell (accepted for now)
Server publish-scripts import `CustomSnowflake` from `@repo/markdown-parsing` built dist →
build-order coupling. Acceptable: offline scripts only, contained to `scripts/`. Extract to a
`@repo/snowflake` (no-build, like `@repo/types`) only if a third consumer appears.

---

## Note 2 — S3 → Supabase Storage migration (Phase B)

### Current S3 surface (narrow — offline tooling only)
| File | Ops |
|---|---|
| `apps/dashboard_server/src/lib/awsS3.ts` | `S3Client` singleton (AWS_* creds) |
| `scripts/publish_post/upload_image.ts` | `PutObjectCommand` upload; `getSignedUrl` (debug log only); sets `meta.storedUri = userId/folderPath/slug/slug.ext` |
| `scripts/publish_posts.ts` | builds `${CDN_ASSET_POSTS}/${storedUri}`; rewrites markdown image links |
| `src/middlewares/multer-s3.js` | dead (S3 block commented; uses local disk) |
| `src/controllers/posts/posts.ts` | only reads `stored_uri` string from DB — no runtime S3 call |

Live server routes never call S3 at runtime; they serve the `stored_uri` string written at
publish time.

### Supabase Storage equivalent
- Public bucket `post-images` (public → stable cacheable `getPublicUrl`, no signed URLs needed).
- First (and only) place `@supabase/supabase-js` enters the server; uses
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role needed for writes). Blog READS
  stay on pg/raw SQL — storage is a separate concern.
- New `src/lib/supabaseStorage.ts` singleton (mirrors `awsS3.ts`).
- Upload: `supabase.storage.from('post-images').upload(key, buffer, { contentType, upsert:true })`.
- Key format unchanged (`userId/folderPath/slug/slug.ext`) → **no DB migration of `stored_uri`**.
- Public URL: `getPublicUrl(key)` → `https://<ref>.supabase.co/storage/v1/object/public/post-images/<key>`.

### Env swap (Phase B)
Remove `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`.
Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only; never `NEXT_PUBLIC_*`).

### CDN / public URL
`posts.prettylog.com` currently fronts S3. Two options:
- **A (recommended):** CNAME `posts.prettylog.com` → Supabase Storage public CDN.
  `CDN_ASSET_POSTS` unchanged → existing `stored_uri` + embedded markdown URLs keep resolving.
  Zero DB migration. (Verify Supabase free-tier custom-domain support first.)
- **B:** point `CDN_ASSET_POSTS` at the Supabase public URL + update `next.config.ts`
  `remotePatterns`; requires a one-time SQL rewrite of old URLs in `posts.content`.

### Atomic Phase-B steps
1. Add `@supabase/supabase-js` to `dashboard_server`.
2. Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to `env.schema.ts`.
3. Create `src/lib/supabaseStorage.ts`.
4. Create public bucket `post-images` (manual, document it).
5. New `scripts/publish_post/upload_image_supabase.ts` (same `meta` shape).
6. Wire `publish_posts.ts` to it; keep `upload_image.ts` as `x_` until verified.
7. Make AWS env vars optional during transition.
8. Publish one post end-to-end; verify URL + `stored_uri`.
9. One-off migration script: copy every existing S3 object → Supabase Storage (same key).
10. Cut over CDN (Option A or B).
11. Only after verified: remove `@aws-sdk/*`, AWS env vars; `x_`-rename `awsS3.ts`, `multer-s3.js`.

### Do NOT do now
Don't remove S3 creds/`awsS3.ts` until Storage is wired + images migrated + CDN cut over.
Don't rewrite `stored_uri`/`posts.content` until the Option A/B decision. Don't add Supabase to
the client or any read endpoint. Never expose the service role key to the client.
