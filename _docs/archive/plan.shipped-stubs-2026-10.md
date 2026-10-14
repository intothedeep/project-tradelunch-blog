# Archived `00.plan.md` stubs: shipped blog phases (moved 2026-10-14)

> Completed items live in `_archive/` (cold storage, do not read unless
> investigating history). This doc holds the active + planned log only.

Moved verbatim from `00.plan.md` on 2026-10-14 (rules/docs.md §1 hard line 400, §2).
Every unit below was DONE or SHIPPED with no open item. Phase F and Phase H stay live
in `00.plan.md` (open USER / DEFERRED lines).

---

### Phase E2 — Comment Edit + Comment Pagination — DONE/SHIPPED (`85093b4`)

> Closed Phase E's two deferrals: comment EDIT (`PATCH /comments/:id`, auth==delete, tombstone→409, "(edited)" badge) + keyset pagination (50 roots/page each with full subtree, STRING cursor). Purely additive — no schema/index/migration change. `comments.ts` split into a barrel. <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/plan.phase-E2.md](./_docs/archive/plan.phase-E2.md)

### Blog card actions — SHIPPED (`894fce3`)

> Post-card Share / Save / whole-card navigation; favorites backend (migrations `0006_post_favorites` + `0007_*_idx`, `controllers/favorites/` + `SaveButton`/`useSharePost`/`useFavorites`). Not a numbered phase. <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/blog-card-actions.plan.md](./_docs/archive/blog-card-actions.plan.md)

---

### Phase F2 — blog_agent webp compression (local Python CLI) — DONE (`3e5b04c`)

> `apps/blog_agent/utils/image_transform.py` `to_webp` (Pillow LANCZOS + `exif_transpose`, 1600 fit-inside, q80, metadata stripped); thumbnails keep 1200×630 letterbox → webp q80 (Option A); path scheme unchanged; intentional duplicate of Phase F's Node transform. Decision #28. <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/plan.phase-F2.md](./_docs/archive/plan.phase-F2.md)

---

### Phase G — Editor Category Selector + Tags (write/edit screen) — DONE (`bced84e`)

> Cascading 3-box category picker + flat tag-chip editor on `/write`; migration `0010` switches category uniqueness to `(user_id, parent_id, title)`; tri-state `category_id` PATCH (CASE not COALESCE); by-id read now returns `tags` + `stored_uri`; new `POST /v1/api/categories`; AC1–AC10 met. Decision #29. <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/plan.phase-G.md](./_docs/archive/plan.phase-G.md)
> **SUPERSEDED (push gate closed):** migration `0010_category_unique_parent.sql` push is SUPERSEDED by **Phase M** — the clean-cut applied all 12 blog migrations to the new blog-only Supabase project (2026-07-09). No open USER item.

---

### Phase 2-mobile — Mobile context UX (chip header + in-article TOC) — SHIPPED (MOB.0–MOB.3)

> Two additive client-side-only mobile (`<lg`) UX changes — (D) top-of-article collapsible TOC, (B) top-of-feed context header (author chip + category/tag chip row) — replacing the heavier `<lg` `UserContextSheet`; Phase 2-filter later SUPERSEDED the NAV chip row (`MobileChipRow`/`getMobileChips` `x_`-retired). <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/plan.phase-2-mobile.md](./_docs/archive/plan.phase-2-mobile.md)

---

### Phase 2-filter — Multi-category + multi-tag feed filter (desktop rails + mobile rows) — DONE (SHIPPED 2026-06-29)

> Reader narrows the author feed `/blog/[username]` by categories AND/OR tags at all breakpoints; URL state (`?categories=a,b&tags=a,b`), same-type OR / cross-type AND, no migration; SUPERSEDES Phase 2-tags. Decision #34. <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/plan.phase-2-filter.md](./_docs/archive/plan.phase-2-filter.md)

---

### Phase 2-fetch — Feed data layer: axios→native fetch + tag revalidation — DONE (SHIPPED 2026-06-29)

> Blog feed read moved off client axios onto a server-only native fetch wrapper for Next 16 tag-based revalidation (instant read-your-writes on publish-class mutations); Express CDN backstop lowered. Builds on Phase 2-filter; delivers the instant-invalidation upgrade #34 F.11 deferred. Decision #35. <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/plan.phase-2-fetch.md](./_docs/archive/plan.phase-2-fetch.md)

### Phase 2-fetch follow-up — F-fetch.2 client axios retirement — DONE/SHIPPED (2026-07-08)

> **Shipped:** all axios removed from BOTH frontends. `dashboard_client_web` (25 `.api.ts` + local `axios_instance`) and `finance_web` (`getMe`) migrated to native-fetch wrappers `apis/http.core.ts` (pure/isomorphic) + `apis/http.client.ts` (`clientRequest<T>`) + `apis/http.server.ts` (delegates to core, `serverRequest` unchanged); `axios_instance.ts` → `x_`-retired; npm `axios` dropped from both apps. `ApiError` gained `body?` (createCategory 409). **`@repo/axios` never existed** (confirmed). Envelope double-unwrap risk resolved: every fetcher verified against its real Express shape and unwraps exactly once — extra latent bugs fixed beyond plan (createPost/updatePost/getMyDrafts/uploadImage returned the envelope as the raw type; getPosts/getPostsByTag/getPopularTags/getUserPopularTags double `.data`; getCategories dead `.status` guard). Gate: 4 apps check-types 0 · 4 apps build green · dashboard_server jest 352/352 · zero axios imports in active code.
>
> **Bundled follow-on — backend `{success,data}` envelope convergence:** owner-chosen "envelope 통일" (code was already ~95% envelope). Added `sendOk`/`sendError` helpers to `dashboard_server` + `finance_api`; converted the 4 remaining RAW routes to the envelope (dashboard `GET /users/me`, `POST /users/me/username`, `GET /users/:username/categories`; finance `GET /users/me`) with the 4 consuming fetchers flipped to unwrap once; added a global error-handler middleware to `finance_api` (was missing). `TCategoryTreeResponse` now dead (kept per soft-delete). NOT converted: `GET /users/:username/category/:categoryId` (bespoke top-level-spread shape, no frontend consumer found — flagged for later).

---

### Phase SEO-2 — SEO coverage completion (sitemap detail URLs · author/home metadata · dynamic OG) — SHIPPED (2026-07-05, `63eb56b`)

> Sitemap now enumerates `/symbols/[ticker]` (getRankings top-1000) + `/politicians/[filerId]` (new Express `GET /v1/api/politicians` list route); per-author + home metadata; dynamic OG via `next/og` (`lib/og.tsx`) on blog/symbols/politicians/funds; hreflang DROPPED (content is single-language). <!-- ARCHIVE: history-only -->
> Detail: [\_docs/archive/plan.seo-2.md](./_docs/archive/plan.seo-2.md)

### Blog owner-private visibility + StatusBadge — SHIPPED (2026-07-05, `53196a8`)

> A `status='private'` post was invisible even to its own author on the public blog because server-side fetches ran anonymously. Forward the Clerk token (`auth().getToken()`) on the detail / TOC / category-sidebar reads so the owner sees their own non-public posts; anonymous visitors unchanged (private still 404s / excluded — `auth()` forces dynamic render, no private cache leak; OG images stay anonymous). Backend detail + author-feed routes were already owner-aware (`status='public' OR user_id=viewer`); the category route (`/users/:username/categories` ×2 queries) gained `optionalAuth` + `OR user_id=$viewer`. `/me` widened (`listDrafts` → `status IN ('draft','private')`). 🔒 Private / Draft `StatusBadge` on feed card + detail header + `/me`. Also fixed React #418 date hydration on post cards (`utils/formatPostDate`, `16e2e18`).
