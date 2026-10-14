# U4 preview: cacheComponents on, runner-only builds (2026-10-14)

Source: GitHub Actions `cc-build.yml` runs (flag on inside the runner only; repo config unchanged).

| Run | Change in runner | Result |
| --- | --- | --- |
| 38524787348 | flag on | 11 errors: 6x route segment `dynamic` incompatible + 5x `@repo/types` unresolved (workflow gap, fixed) |
| 38524923945 | flag on, types built | 6 errors: route segment `dynamic` in `(feed)/page.tsx:26`, `(feed)/tags/[tag]/page.tsx:13`, `[handle]/me/page.tsx:9`, `log/page.tsx:7`, `log/[username]/page.tsx:12`, `log/[username]/[logId]/page.tsx:9` |
| 38525062185 | flag on, those 6 lines dropped | build fails at prerender: **blocking-route** "Uncached data was accessed outside of <Suspense>" on `/tags/[tag]` (3x) and `/log/[username]/[logId]` (1x) |

Non-fatal warnings in the same run (fetch rejected when a prerender completes; caught and logged by our code):
- `Failed to fetch popular tags` on `/`, `/write`, `/tags/[tag]`, `/[handle]/posts`, `/[handle]/projects`, `/[handle]/projects/[project]`, `/[handle]/saved`
- `[RecentPostsList] feed fetch failed` on `/`

What U4 must do (from these runs):
1. Remove the 6 `export const dynamic = 'force-dynamic'` lines.
2. `/tags/[tag]/page.tsx`: the page awaits `getPostsByTag` at the top; move it into a Suspense leaf (or `'use cache'` it, U5) so the shell can prerender.
3. `/log/[username]/[logId]`: same pattern (P2 route; Suspense leaf or keep it dynamic via a request API inside Suspense).
4. Popular tags / feed fetches in prerender: decide per call between `'use cache'` (U5) and reading inside Suspense; the current catch-and-log hides that the prerender dropped them, so the shell renders their fallback.
