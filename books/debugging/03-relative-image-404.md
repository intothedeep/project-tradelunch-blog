# 3. Relative image refs send a post page to the error page

Result: page fixed by commit `42ba55c` (`apps/dashboard_client_web/apis/getPost.api.ts`). Content bug still OPEN, the owner has not chosen an option.

## Symptom

| Where | What |
| --- | --- |
| Post body | `![rust-config thumbnail](./rust-config.jpeg)` |
| Browser request | resolves to `/blog/@taeklim/rust-config.jpeg` |
| Next route | the post route takes `rust-config.jpeg` as a slug |
| API | 404, `Post not found` |
| Web | `getPostBySlug` rethrew a generic Error, so the error page showed |

## Cause

```text
![](./rust-config.jpeg)  ── relative to /blog/@taeklim/<slug>
        ▼
GET /blog/@taeklim/rust-config.jpeg ─► post route (slug = "rust-config.jpeg")
        ▼
API GET /v1/api/posts/slug/rust-config.jpeg ─► 404 "Post not found"
        ▼
catch { throw new Error(...) } ─► error page      (should be a 404 page)
```

- Two bugs. The page treated a normal 404 as a crash. The content holds a relative ref that never resolves.

## Fix

In `getPost.api.ts`, inside the catch:

```ts
if (error instanceof ApiError && error.status === 404) notFound();
```

Status code stays 200. The route has `loading.tsx`, so the response is streamed before the 404 is known. The page carries `<meta name="robots" content="noindex">`. (Measured 2026-10-13 against the dev server: status 200, `noindex` present.)

Tried and reverted: `unstable_rethrow` in `generateMetadata` for a hard 404. The status did not change.

## Open: the content bug

| Check | Result |
| --- | --- |
| `https://blog-assets.prettylog.com/1/Rust/rust-config/rust-config.jpeg` | 404 |
| same path with `.webp` (the `stored_uri`) | 200 |

| Option | Idea |
| --- | --- |
| A | `blog_agent` rewrites relative refs, then republish |
| B | the renderer drops relative images |
| C | leave as is |

Owner has not chosen. Log the choice in `DECISIONS.md` before any work starts.

## Evidence

- `getPost.api.ts` lines 38 to 40: the comment and the `notFound()` call.
- The CDN results were measured with `curl` on 2026-10-13.

## Lesson

Separate "the page must not crash" from "the data is wrong". Fix the first now and track the second.
