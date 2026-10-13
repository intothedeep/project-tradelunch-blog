# 2. Unreachable API takes the whole home page down

Result: fixed. Commit `77315eb`, file `apps/dashboard_client_web/app/blog/components/RecentPostsList.server.tsx`.

## Symptom

| Where | What |
| --- | --- |
| Home feed, API unreachable | whole page goes to the error boundary |
| Server log | `TypeError: fetch failed` inside `getFeed` |

## Cause

```text
page ─► layout, nav, sidebar ─► RecentPostsList (server)
                                     └─ getFeed() throws
                                        └─ no catch ─► error boundary replaces the PAGE
```

- One failed fetch in one list component threw past the whole page.
- Other rails were already guarded: `UserProfileCard`, `MobileContextHeader` and `TagCloud` use try/catch. The category tree uses `CategoryErrorBoundary`.

## Fix

In `RecentPostsList.server.tsx`:

```tsx
let feed: Awaited<ReturnType<typeof getFeed>>;
try {
    feed = await getFeed(undefined, 10, username, { categories, tags });
} catch (err) {
    console.error('[RecentPostsList] feed fetch failed:', err instanceof Error ? err.message : err);
    return ( /* "Posts are unavailable right now. Please try again in a moment." */ );
}
```

Test it with mode B of `apps/dashboard_client_web/LOCAL_PROD_API.md`:

```sh
NEXT_PUBLIC_API_BASE=http://127.0.0.1:9 pnpm dev:web
```

Pass: nav and rails render, and the list shows the notice.

## Evidence

- `RecentPostsList.server.tsx` lines 27 to 45 hold the try/catch and the notice.
- The comment at line 27 states the intent: layout, nav and sidebar still render.

## Lesson

Guard each data island, not the page. A failed list must degrade alone.
