# CC-U4 attempt 1: log diagnosis (data-analyst, recover step 1)

Date: 2026-10-14. Counters: recovery 1/2 (01.status.md line 99).
Scope: saved files only. No code read, no request sent, no run.

## 0. Result

- The export holds 41 entries, all `severity: ERROR`, one GCE instance, one log `blog-web` [S-U4R-1].
- The entries span 08:28:59.850 to 08:29:45.576 UTC (46 s). The query window was 08:28:00 to 08:50:00, limit 300, not hit [S-U4R-1] [S-U4R-5].
- All 41 fall inside the U4 live window: 535b931 deployed ~08:28:30, 7b4a138 deployed ~08:31:45 [S-U4R-5].
- 6 entries are request errors. All 6 carry the same err: `Invalid revalidate configuration provided: 0 < 1` [S-U4R-1].
- The other 35 entries are caught fetch failures with no `path` field [S-U4R-1].
- Each of the 6 request errors sits within 200 ms of a `Dynamic server usage ... revalidate: 0 fetch .../v1/api/tags?limit=30` entry on the same route pattern [S-U4R-1].
- Real-page fetch failures (tag `rust`, user `taeklim`, post `cnn-from-scratch-...`) have no request error and no `Dynamic server usage` entry [S-U4R-1].

```
                      41 ERROR entries (08:28:59.850 .. 08:29:45.576)
                                       |
          +----------------------------+-----------------------------+
          |                                                          |
  has path + routePath (6)                                no path (35)
  "request error"                                         "Failed to fetch ..."
  err E3 = Invalid revalidate 0 < 1                        |
  /nope x1, /nope?cb x2, /zzz-unknown?cb,          +-------+--------+
  /foo/bar?cb, /nope2?cb                           |                |
  status line: these paths gave HTTP 500     E1 prerender-     E2 Dynamic server
                                             complete (28)     usage, revalidate: 0,
                                                               tags?limit=30 (7)
                                                               6 of 7 paired with E3
```

### Three most important facts

1. The 500 signature in the log is the pair E2 + E3 on `[handle]` routes for non-`@` paths. E2 appears 7 times. 6 sit within 200 ms of an E3 request error on the same route pattern. 0 appear in the real-page clusters [S-U4R-1].
2. The err that caused the request error (E3, `Invalid revalidate configuration provided: 0 < 1`) does not appear in the runner-only preview. That preview lists only the caught "fetch rejected when a prerender completes" warnings and the build-fatal errors [S-U4R-3]. So the runner build did not surface the failure that gave the prod 500.
3. All 41 entries are runtime output of 535b931, and request errors stop with the revert. The build finished 08:28:01, before the first entry (08:28:59.850, ~29 s after deploy). The last request error is 08:29:45.576, still on U4. After the revert deploy (~08:31:45): 0 entries to 08:50:00 in the full export, 0 request errors to 09:30:00 [S-U4R-1] [S-U4R-5]. See §7 for what this does and does not prove.

Correction to `01.status.md` line 99: it quotes the E2 text as "Error log in the window" [S-U4R-2]. E2 is the err of a caught fetch-failure log. The request error itself carries E3 [S-U4R-1].

## 1. Err codes used in this memo

| Code | Exact err text (jsonPayload.err.message) | Count |
| --- | --- | --- |
| E1 | `During prerendering, fetch() rejects when the prerender is complete. Typically these errors are handled by React but if you move fetch() to a different context by using setTimeout, after, or similar functions you may observe this error and you should handle it in that context. This occurred at route "<route>".` | 28 |
| E2 | `Dynamic server usage: Route <route> couldn't be rendered statically because it used revalidate: 0 fetch https://blog-api.prettylog.com/v1/api/tags?limit=30 <route>. See more info here: https://nextjs.org/docs/messages/dynamic-server-error` | 7 |
| E3 | `Invalid revalidate configuration provided: 0 < 1` | 6 |
| Total | | 41 |

All `err.name` values are `Error` [S-U4R-1].

## 2. Timeline (all 41 entries)

Time = `jsonPayload.time` (UTC, 2026-10-14). Cluster = entries grouped by route and by a gap under 200 ms.
Path = `jsonPayload.path` if present. Otherwise the route named inside the err text, in brackets.

| # | Time | Path / [route] | message | extra field | err | Cluster |
| --- | --- | --- | --- | --- | --- | --- |
| d1 | 08:28:01 | | 535b931 GCP build finished | | | deploy [S-U4R-5] |
| d2 | ~08:28:30 | | 535b931 deployed + purged (U4 live) | | | deploy [S-U4R-5] |
| 1 | 08:28:59.850 | [/[handle]] | Failed to fetch popular tags | | E1 | A |
| 2 | 08:28:59.889 | [/[handle]] | Failed to fetch popular tags | | E1 | A |
| 3 | 08:28:59.930 | [/[handle]] | Failed to fetch popular tags | | E2 | A |
| 4 | 08:28:59.977 | `/nope` (routePath `/(shell)/[handle]/page`) | request error | GET | E3 | A |
| 5 | 08:29:00.632 | [/[handle]] | Failed to fetch popular tags | | E1 | B |
| 6 | 08:29:00.693 | [/[handle]] | Failed to fetch popular tags | | E1 | B |
| 7 | 08:29:00.752 | [/[handle]] | Failed to fetch popular tags | | E2 | B |
| 8 | 08:29:05.875 | [/tags/[tag]] | Failed to fetch popular tags | | E1 | C |
| 9 | 08:29:05.875 | [/tags/[tag]] | Failed to fetch posts by tag | tag=rust | E1 | C |
| 10 | 08:29:05.909 | [/tags/[tag]] | Failed to fetch popular tags | | E1 | C |
| 11 | 08:29:05.909 | [/tags/[tag]] | Failed to fetch posts by tag | tag=rust | E1 | C |
| 12 | 08:29:12.621 | [/[handle]/projects/[project]] | Failed to fetch popular tags | | E1 | D |
| 13 | 08:29:12.622 | [/[handle]/projects/[project]] | Failed to fetch user profile | username=taeklim | E1 | D |
| 14 | 08:29:12.658 | [/[handle]/projects/[project]] | Failed to fetch popular tags | | E1 | D |
| 15 | 08:29:12.658 | [/[handle]/projects/[project]] | Failed to fetch user profile | username=taeklim | E1 | D |
| 16 | 08:29:15.483 | [/[handle]/[slug]] | Failed to fetch popular tags | | E1 | E |
| 17 | 08:29:15.484 | [/[handle]/[slug]] | Failed to fetch a post | slug=cnn-from-scratch-7-7-139-runs-in-4-days-with-the-rules-written-first | E1 | E |
| 18 | 08:29:15.515 | [/[handle]/[slug]] | Failed to fetch popular tags | | E1 | E |
| 19 | 08:29:15.515 | [/[handle]/[slug]] | Failed to fetch a post | slug=cnn-from-scratch-7-7-139-runs-in-4-days-with-the-rules-written-first | E1 | E |
| 20 | 08:29:39.333 | `/nope?cb=12753` (routePath `/(shell)/[handle]/page`) | request error | GET | E3 | F |
| 21 | 08:29:39.361 | [/[handle]] | Failed to fetch popular tags | | E1 | F |
| 22 | 08:29:39.422 | [/[handle]] | Failed to fetch popular tags | | E1 | F |
| 23 | 08:29:39.482 | [/[handle]] | Failed to fetch popular tags | | E2 | F |
| 24 | 08:29:40.756 | `/nope?cb=12753` (routePath `/(shell)/[handle]/page`) | request error | GET | E3 | G |
| 25 | 08:29:40.785 | [/[handle]] | Failed to fetch popular tags | | E1 | G |
| 26 | 08:29:40.819 | [/[handle]] | Failed to fetch popular tags | | E1 | G |
| 27 | 08:29:40.868 | [/[handle]] | Failed to fetch popular tags | | E2 | G |
| 28 | 08:29:42.233 | [/[handle]] | Failed to fetch popular tags | | E1 | H |
| 29 | 08:29:42.265 | [/[handle]] | Failed to fetch popular tags | | E1 | H |
| 30 | 08:29:42.303 | [/[handle]] | Failed to fetch popular tags | | E2 | H |
| 31 | 08:29:42.351 | `/zzz-unknown?cb=12753` (routePath `/(shell)/[handle]/page`) | request error | GET | E3 | H |
| 32 | 08:29:43.728 | [/[handle]/[slug]] | Failed to fetch popular tags | | E1 | I |
| 33 | 08:29:43.728 | [/[handle]/[slug]] | Failed to fetch a post | slug=bar | E1 | I |
| 34 | 08:29:43.777 | [/[handle]/[slug]] | Failed to fetch popular tags | | E1 | I |
| 35 | 08:29:43.778 | [/[handle]/[slug]] | Failed to fetch a post | slug=bar | E1 | I |
| 36 | 08:29:43.881 | [/[handle]/[slug]] | Failed to fetch popular tags | | E2 | I |
| 37 | 08:29:44.067 | `/foo/bar?cb=12753` (routePath `/(shell)/[handle]/[slug]/page`) | request error | GET | E3 | I |
| 38 | 08:29:45.441 | [/[handle]] | Failed to fetch popular tags | | E1 | J |
| 39 | 08:29:45.479 | [/[handle]] | Failed to fetch popular tags | | E1 | J |
| 40 | 08:29:45.519 | [/[handle]] | Failed to fetch popular tags | | E2 | J |
| 41 | 08:29:45.576 | `/nope2?cb=12753` (routePath `/(shell)/[handle]/page`) | request error | GET | E3 | J |
| d3 | 08:31:16 | | 7b4a138 (revert) GCP build finished | | | deploy [S-U4R-5] |
| d4 | ~08:31:45 | | 7b4a138 deployed + purged (U4 gone) | | | deploy [S-U4R-5] |
| | 08:29:45.576 to 08:50:00 | | no entry of any kind in the export | | | [S-U4R-1] [S-U4R-5] |
| | 08:29:45 to 09:30:00 | | 1 request error (#41 itself), none after | | | [S-U4R-5] |

Source for rows 1 to 41: [S-U4R-1]. Rows d1 to d4: [S-U4R-5].

### Cluster summary

| Cluster | Window | Route | Request error | E2 present | Shape |
| --- | --- | --- | --- | --- | --- |
| A | 59.850 to 59.977 | /[handle] | `/nope` | yes | 2 E1 + E2 + E3 |
| B | 00.632 to 00.752 | /[handle] | none | yes | 2 E1 + E2, no E3 (unexplained) |
| C | 05.875 to 05.909 | /tags/[tag] | none | no | 4 E1 (tag=rust) |
| D | 12.621 to 12.658 | /[handle]/projects/[project] | none | no | 4 E1 (taeklim) |
| E | 15.483 to 15.515 | /[handle]/[slug] | none | no | 4 E1 (cnn post) |
| F | 39.333 to 39.482 | /[handle] | `/nope?cb=12753` | yes | E3 + 2 E1 + E2 |
| G | 40.756 to 40.868 | /[handle] | `/nope?cb=12753` | yes | E3 + 2 E1 + E2 |
| H | 42.233 to 42.351 | /[handle] | `/zzz-unknown?cb=12753` | yes | 2 E1 + E2 + E3 |
| I | 43.728 to 44.067 | /[handle]/[slug] | `/foo/bar?cb=12753` | yes | 4 E1 (slug=bar) + E2 + E3 |
| J | 45.441 to 45.576 | /[handle] | `/nope2?cb=12753` | yes | 2 E1 + E2 + E3 |

- Max gap between an E3 and its cluster's E2: 186 ms (cluster I, #36 to #37) [S-U4R-1].
- Cluster I ties by value: `slug=bar` in #33 and #35 matches the request path `/foo/bar` in #37 [S-U4R-1].
- Every fetch-failure entry appears twice per cluster, 30 to 60 ms apart (popular tags x2, post x2, profile x2, posts by tag x2) [S-U4R-1].

## 3. (a) Request errors (the 500s)

| Path | routePath | Count | err |
| --- | --- | --- | --- |
| `/nope` | `/(shell)/[handle]/page` | 1 | E3 |
| `/nope?cb=12753` | `/(shell)/[handle]/page` | 2 | E3 |
| `/zzz-unknown?cb=12753` | `/(shell)/[handle]/page` | 1 | E3 |
| `/nope2?cb=12753` | `/(shell)/[handle]/page` | 1 | E3 |
| `/foo/bar?cb=12753` | `/(shell)/[handle]/[slug]/page` | 1 | E3 |
| Total | 2 route files | 6 | E3 only |

- All 6 are `GET`, `routeType: render`, `routerKind: App Router` [S-U4R-1].
- The log has no HTTP status field. "500" is the curl result in the status line (HTTP 500, 21 B, cf BYPASS) [S-U4R-2].
- The log corroborates the paths. It does not record the status code.
- `/nope2` is in the log but not in the status line's list of 500 paths [S-U4R-1] [S-U4R-2].

## 4. (b) Build or prerender time vs request time

| Population | Count | Has path / routePath | Where logged | Classification |
| --- | --- | --- | --- | --- |
| E3 request errors | 6 | yes | `blog-web`, gce_instance `instance-servers` | request time (fact: path + method present) |
| E2 + E1 in clusters A, F, G, H, I, J | 20 | no | same | request time (inference: same route, under 200 ms from an E3, `slug=bar` ties I to `/foo/bar`) |
| E1 + E2 in cluster B | 3 | no | same | runtime (fact: after the 08:28:01 build end). Which request: unknown |
| E1 in clusters C, D, E | 12 | no | same | runtime (fact: after the 08:28:01 build end). Values match real smoke pages. Which request: unknown |
| Runner preview warnings | n/a | n/a | GitHub Actions `cc-build.yml` | build time [S-U4R-3] |

- No entry comes from the Actions runner. All 41 have `logName projects/mywebsite-511502/logs/blog-web`, `resource.type gce_instance` [S-U4R-1].
- The wording "During prerendering" does not by itself mean build time. Under cacheComponents the server also prerenders at request time. That reading is a labeled inference, not shown by the log.
- The 535b931 build finished at 08:28:01, 58 s before the first entry [S-U4R-5]. So none of the 41 entries is build output.

### Preview (runner) vs prod (runtime)

| Item | Runner preview [S-U4R-3] | Prod log [S-U4R-1] |
| --- | --- | --- |
| E1-type "Failed to fetch popular tags" | `/`, `/write`, `/tags/[tag]`, `/[handle]/posts`, `/[handle]/projects`, `/[handle]/projects/[project]`, `/[handle]/saved` | `/[handle]`, `/tags/[tag]`, `/[handle]/projects/[project]`, `/[handle]/[slug]` |
| E2 (revalidate: 0 dynamic usage) | not listed | 7 |
| E3 (Invalid revalidate 0 < 1) | not listed | 6 |
| Code state | 6 `dynamic` lines dropped only (run 38525062185) | 535b931 |

- The preview code state is not 535b931. So the comparison shows a gap in coverage, not a regression between the two.

## 5. (c) Which fetches fail, on which routes

| Fetch (message) | /[handle] | /[handle]/[slug] | /[handle]/projects/[project] | /tags/[tag] | Total |
| --- | --- | --- | --- | --- | --- |
| popular tags | 18 (12 E1 + 6 E2) | 5 (4 E1 + 1 E2) | 2 (E1) | 2 (E1) | 27 |
| a post | 0 | 4 (E1; cnn x2, bar x2) | 0 | 0 | 4 |
| user profile | 0 | 0 | 2 (E1; taeklim) | 0 | 2 |
| posts by tag | 0 | 0 | 0 | 2 (E1; rust) | 2 |
| Total | 18 | 9 | 4 | 4 | 35 |

- E2 occurs only on the popular-tags fetch, URL `https://blog-api.prettylog.com/v1/api/tags?limit=30` [S-U4R-1].
- Post, profile and posts-by-tag fetches fail only with E1 [S-U4R-1].
- The log does not show Express (`blog-api`) failures. E1 and E2 are Next-side rejections. Whether the API answered is unknown.

## 6. (d) 500s on `@` paths or real pages

| Check | Result | Proof level |
| --- | --- | --- |
| Any request error with a path starting `/@` | 0 of 6 | fact [S-U4R-1] |
| Request error on a real page route (`/tags/rust`, `taeklim` project, cnn post) | 0 | fact: clusters C, D, E have no E3 [S-U4R-1] |
| Real pages returned 200 on 535b931 | yes, per status line | status line only [S-U4R-2] |
| Real pages rendered their content on 535b931 | unknown | not provable (see below) |

- Expected none. Observed none.
- Gap: `Failed to fetch a post` fired twice for the cnn slug (#17, #19) [S-U4R-1].
- The post page may have returned 200 with a fallback body. The log cannot prove the body held the post.
- The C5 content check ran on 0ac938c, not on 535b931 [S-U4R-4].
- The same holds for popular tags and profile: all real-page fetches in C, D, E were rejected and caught.

## 7. (e) Do the errors stop after the revert

Answer: yes. No error of any kind is logged after the revert deploy.

```
08:28:01  build 535b931 done
08:28:30  U4 live ---------------------------------------------+
08:28:59.850  first entry                                       | 41 entries
08:29:45.576  last entry (#41, /nope2, E3)                      |
          (2 min, U4 still live, 0 entries)                     |
08:31:16  build 7b4a138 done                                    |
08:31:45  revert live ------------------------------------------+
08:50:00  end of full export: 0 entries after revert
09:30:00  end of request-error check: 0 after revert
```

| Window | Code live | Entries (any severity >= WARNING, "Error", request error) | Request errors |
| --- | --- | --- | --- |
| 08:28:00 to ~08:28:30 | 0ac938c | 0 | 0 |
| ~08:28:30 to ~08:31:45 | 535b931 (U4) | 41 | 6 |
| ~08:31:45 to 08:50:00 | 7b4a138 (revert) | 0 | 0 |
| 08:50:00 to 09:30:00 | 7b4a138 | not queried | 0 |

Sources: [S-U4R-1] [S-U4R-5].

- The earlier [CONFLICT] is resolved: the 08:40 to 08:50 deploy estimate was wrong [S-U4R-5].
- The export query (limit 300, 41 returned) did not hit its limit. So the export is complete for its filter [S-U4R-5].
- Limit of the proof: no error needs a failing request. The log does not show request volume.
- The positive evidence that `/nope` works after the revert is the curl 404 in the status line [S-U4R-2]. It is not in the log.
- The 08:50 to 09:30 check covered request errors only. Fetch-failure logs in that span were not queried [S-U4R-5].
- The pre-U4 baseline (`/nope` 404 at 08:11:36) is on 0ac938c [S-U4R-4]. The revert returns to that code (inference from commit 7b4a138 "Revert U4 merge").

## 8. What the logs prove and do not prove

| Claim | Proven by log | Note |
| --- | --- | --- |
| 6 request errors, paths and err text | yes | |
| These 6 returned HTTP 500 | no | status line curl only |
| E2 co-occurs with every E3 (within 186 ms) | yes | timing + route match |
| E2 causes E3 | no | co-occurrence only |
| Real pages had no request error in this window | yes | |
| Real pages showed their content | no | 4 post-fetch failures on the cnn and bar slugs |
| No errors logged after revert | yes | 0 entries ~08:31:45 to 08:50, 0 request errors to 09:30 [S-U4R-5] |
| Unknown paths return 404 after revert | no | curl in status line only; the log shows no request volume |
| All 41 entries are runtime, not build | yes | build ended 08:28:01, first entry 08:28:59 [S-U4R-5] |
| Cluster B belongs to a request | no | no path, no paired E3 |
| Full set of errors for the query filter | yes | limit 300, 41 returned [S-U4R-5] |

## 9. Hypotheses (labeled, not tested)

- H1: under cacheComponents, the popular-tags fetch with `revalidate: 0` makes the runtime prerender of `[handle]` routes throw E3. Evidence: E2 names that fetch, and E2 pairs with all 6 E3. Check (system-architect): find `revalidate: 0` on the tags fetcher and any route-level `revalidate = 0` on branch `cc-u4`.
- H2: `@` paths do not reach the failing branch because the U4 proxy gates answer them first (D #97). Non-`@` top-level paths fall through to `/(shell)/[handle]/page`. Evidence: only non-`@` paths in E3. Check: proxy matcher on `cc-u4`.
- H3: local dev gave 404 because dev mode does not run the runtime prerender validation that throws E3. Evidence: status line says local dev 404, prod 500 [S-U4R-2]. Check: `next build && next start` on the cluster or the runner, not dev.
- H4: the doubled fetch entries (x2, 30 to 60 ms apart) are two render passes per request (prospective prerender + final render). Low impact.
- H5: cluster B (08:29:00.6) is a second request to `/nope`, for example an `_rsc` fetch, whose E3 was not logged. Unexplained.

## 10. Information needed (hand back)

Closed. The coordinator answered deploy times and the query (2026-10-14) [S-U4R-5].

## open_questions

- §6 real-page content on 535b931 after caught post/profile/tag fetch failures.
- §2 cluster B: E2 with no paired request error.

## Sources

[S-U4R-1] blog-web errors export: Cloud Logging, blog-web, 41 entries | deploy/traffic/review/cc/u4-recover/blog-web-errors.json | published: 2026-10-14 | accessed: 2026-10-14 | type: official | note: full file read, every entry tabulated
[S-U4R-2] 01.status.md: CC-U4 lines | 01.status.md (lines 90, 92, 99) | published: 2026-10-14 | accessed: 2026-10-14 | type: official | note: grep for U4, lines 94 to 99 read
[S-U4R-3] U4 preview: cacheComponents on, runner-only builds | deploy/traffic/review/cc/u4-preview.md | published: 2026-10-14 | accessed: 2026-10-14 | type: official | note: full file read
[S-U4R-4] smoke 15 + G-g + C5 on deployed 0ac938c | deploy/traffic/review/cc/smoke-0ac938c.txt | published: 2026-10-14 | accessed: 2026-10-14 | type: official | note: full file read
[S-U4R-5] Coordinator message: deploy times, export query, post-revert request-error check | not saved to disk (dispatch message) | published: 2026-10-14 | accessed: 2026-10-14 | type: anecdotal | note: coordinator's GCP build and deploy readings, deploy and purge times approximate; export query on logName blog-web, 08:28:00Z to 08:50:00Z, severity>=WARNING OR textPayload Error OR request error, limit 300, asc, 41 returned; second query request error only, 08:29:45Z to 09:30:00Z, 1 entry (#41)
