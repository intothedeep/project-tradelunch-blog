# Source notes: "Next.js 이렇게 쓰면 느립니다" (velog, k-svelte-master), fetched 2026-10-14

Summaries extracted by the main session with WebFetch. Quote the article URL when citing. Unverified against Next.js docs unless marked.

## S1. Part 1: dynamic RSC and prefetch
URL: https://velog.io/@k-svelte-master/nextjs-slow-1-dynamic-rsc-prefetch

- Navigation stalls until the RSC payload for the "holes" arrives; React cannot paint an incomplete tree.
- Any request-time API (`cookies()`, `headers()`, `searchParams`, auth helpers built on them) anywhere in a route makes the WHOLE route dynamic (position does not matter, Suspense alone does not help without cacheComponents).
- Dynamic routes: no page-payload prefetch (only up to `loading.js`), client router cache retention 0 s, a network round trip on every navigation.
- Fixes: `cacheComponents: true` (+ `partialPrefetching` 16.3+); wrap dynamic reads in `<Suspense>` so the static shell prefetches and caches; read `params` only at leaves; `generateStaticParams` for hot dynamic segments; set `experimental.staleTimes` deliberately (e.g. dynamic 0, static 300); intercepting routes for instant in-app detail views; Service Worker (Serwist) caching static RSC by `x-nextjs-stale-time`.
- Single rule: navigation speed = whether the page's RSC holes were prefetched and cached before the click.

## S2. Part 2: Server Functions (Server Actions) are sequential
URL: https://velog.io/@k-svelte-master/nextjs-slow-2-server-actions-sequential

- Server Actions run one at a time per client (queued in the App Router); `Promise.all` of three 1 s actions ≈ 3 s.
- Workaround for parallel reads: return an unawaited Promise inside an array so the action completes immediately (`[fn()]`).
- Server Functions cannot be called during initial render; TanStack Query does not recommend them as `queryFn` (`useSuspenseQuery` fails).
- Design rule: Server Actions are for mutations only. Reads go through Server Components, Route Handlers or a custom compiled function layer.
- BFF: route backend calls through the Next server (co-located, ~3 ms) instead of browser → backend round trips (~100 ms each).
- Advanced: compile `'use server'` read functions to Route Handlers + manifest (parallel, render-time callable; loses useActionState/RSC refresh).

## S3. Part 3: Suspense, streaming and waterfalls
URL: https://velog.io/@k-svelte-master/nextjs-slow-3-suspense-streaming-waterfall

- Suspense streams: fallback in the first chunk, response stays open, content + inline script in later chunks; the response ends after the last boundary.
- Nested async components create waterfalls (child fetch starts only after parent await): 300 ms + 300 ms = 600 ms.
- Fix: preload without await using `React.cache` (`void getComments(id)` in the parent, child awaits the same cached promise) → ~300 ms. `cache()` once at module top level; per-request; server-only.
- Client fetching (`useQuery`) ends the response with a loading state; crawlers get incomplete HTML (SEO). Prefer Suspense + server fetch for indexable content.
- TanStack hydration: server values reach the client only via props; without `prefetchQuery` + `HydrationBoundary` you get a double request + hydration mismatch. Fix: `void queryClient.prefetchQuery(...)` in the server component + `HydrationBoundary state={dehydrate(qc)}`.
- Experimental streamed hydration (`@tanstack/react-query-next-experimental`): no prefetch needed; caveats: `useSuspenseQuery` without a Suspense boundary blocks TTFB; client navigations keep deep waterfalls.
