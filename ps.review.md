# PS-2-08 Review: Prettylog From Scratch (8 posts)

- Reviewer: `reviewer` agent, 2026-10-18. Read only. No file under `P` was edited.
- Target: `apps/blog_agent/posts/projects/my-work/prettylog/0*/0*.md` (8), 20 PNG, `_series/` (figures.md, 13 CSV, 6 mmd).
- Plan: `ps.plan.md` row PS-2-08, 공통 AC C1–C12, row AC PS-2-00…07. Decisions #124, #125 applied.
- Paths below start at the repo root. `P` = `apps/blog_agent/posts/projects/my-work/prettylog/`.

## Verdict: ISSUE

- 7 must-fix findings (F1–F7). 10 nice findings (F8–F17).
- No build. Static greps and `test -e` only. No figure was regenerated.

## Check table

| Check | Result | Note |
| --- | --- | --- |
| 1 Number traceability (C7) | ISSUE | 113 Sources rows, every path exists (`test -e` 0 MISSING). About 60 cited lines opened (table at the end). 1 wrong-line citation (F5). 1 claim cited to an unchecked to-do box (F7). 1 figure value the post disowns (F1). |
| 2 Honesty (C8) | ISSUE | `not measured`, `one snapshot`, `at list price (not a bill)`, `byte metric broken, no verdict` all present verbatim. $3.65 never called a bill. Worsened results present (07). One "got worse" outside the counted 2 (F2). One figure marks an unverified count as measured (F1). |
| 3 Style (C9, C3) | ISSUE | Em dash grep: 0. `;` outside code and front matter: 1 (F3). Titles over 15 words: 3 (F4). `desc:` over 15 words: 6 (F6). |
| 4 Mermaid (C6) | PASS | 6 blocks. First lines `flowchart LR` x3, `flowchart TD` x2, `sequenceDiagram` x1. `<br` 0. All labels with `(`, `:`, `[`, `/` are inside double quotes. Not render-tested. Quirks: F13, F14. |
| 5 Figures (`rules/figures.md` §7) | PASS | 12 charts + 8 thumbnails opened. No overlap. Legends under the title. Axis labels with units. Single-series charts carry no legend (rule §2). Thumbnails: same layout, 1200 x 630, one number each. Caption source folder: waived by #125 (`Data:` paths removed, Sources table carries it). Caption gaps: F15. |
| 6 Publish readiness (C1, C2, C4, C5, C11) | PASS | md name = folder name (8/8). Keys = title, tags, desc, date, priority, userId, username, status (8/8). priority 0–7 in order. First body line = thumbnail (8/8). Folder PNG set = referenced set (8/8). 00 map links = `/@taeklim/TBD-01…07` (7). 01–07 link to no series post. |
| C10 line cap | PASS | Body lines: 01 60/60, 02 65/65, 03 70/70, 04 73/75, 05 65/65, 06 52/60. 00 (92) and 07 (148) waived by #125. |
| Row AC PS-2-00 | PASS | First sentence verbatim (00:25). F00a + 2 PNG. `at list price (not a bill)` at 00:36, 00:52. Map 7 rows. |
| Row AC PS-2-01 | PASS (see F7) | F01a, F01b present. 70 / 10 s → `README.md:125`, 4 rules → `deploy/traffic/README.md:29-37`. |
| Row AC PS-2-02 | PASS | "Heap caps are config" (02:34). 626 ms → `01.status.md:56`, `07-testing.tex:26`. 475 MiB "one snapshot" (02:67). |
| Row AC PS-2-03 | PASS | 3 PNG. 640 / 0 → `[S-TDE-7]` and `02-blocking.md:213-217`. No HIT-ratio sentence. 79 "after the fix: not measured" (03:61). |
| Row AC PS-2-04 | PASS | F04a + PNG. 19 → 13 verdict (04:29). 13 → 12 "no recorded cause" (04:74). U1 phrase (04:32). U4 count only, no time. |
| Row AC PS-2-05 | PASS | F05a, F05b. 7 workflows, 3 releases → `README.md:299-305`, `:71`. |
| Row AC PS-2-06 | PASS (see F8) | Title 82 = `figures.md` Checks 1 (82). Sources row cites it. |
| Row AC PS-2-07 | ISSUE (F1, F2) | 10 events x 4 rows. Every event has a source cell. B7, B9, B10 rows present. "render time" next to 528 → 12 (07:116). Never-measured table = design §6. 16 / 6 / 2 = CSV sums (4 + 2 + 10 = 16). |
| H1 trace | PASS | `ps.plan.md` has a mission block (Mission, Vision, Constraints, G-PL1, G-PL2, S1, M1–M3). `prettylog-series.design.md:9` has one. Every row tags `→ M2`. M2 line: `cycle 0/2; recovery 0/2`. No `budget:` line. |
| H2 decisions logged | PASS | #124 (language, mermaid, one review), #125 (C10 waiver, caption paths) each have a Why. |
| L1–L4 ladder | N/A | Content only. No schema, API or pipeline (plan line "MVP 사다리는 적용하지 않는다"). |

## Findings

Severity: must-fix blocks publish. nice is optional before publish.
Class: reasoning (wrong or missing source, data) → `data-analyst` or `developer` (CSV + rerun script). implementation (text, format) → `sonnet-writer`.

### F1 (must-fix, reasoning) Figure marks "restarts 15" as measured. The post says it is unverified.

- `P/07-debugging-timeline/07-debugging-timeline.md:70`: "`blog-api` restarted in a loop (↺15 is unverified in a repo file)".
- `P/_series/data/fig_07_timeline.csv` row T5: `key_number` = "restarts 15; hang 20 s", `status` = "measured".
- `P/07-debugging-timeline/fig_07_timeline.png`: T5 is a blue point ("event with a measured number") with the label "restarts 15; hang 20 s".
- Source check: `books/debugging/09-blog-api-crash-loop.md:9` says "↺15 in the brief, not verified in a repo file". `books/debugging/README.md:31` repeats "(↺15)" without a source.
- The post and the figure disagree on the same number. The reader sees a measured 15 in the chart and an unverified 15 in the text.
- Fix (CSV, then rerun `fig_07.py`): T5 `key_number` → "hang 20 s (restart count from the brief, unverified)". Keep `status` = measured for the 20 s, which `README.md:23` records. Or drop "restarts 15" from `key_number` and leave 07:70 as is.
- Route: `developer` (CSV edit + `fig_07.py` run, allowed locally: CSV input, one core, 300 s).

### F2 (must-fix, implementation) T8 says "got worse" but the title counts 2 worsened.

- `P/07-debugging-timeline/07-debugging-timeline.md:93`: "This result got worse."
- Title (07:2), 07:28, `fig_07_measured.png`: 2 got worse (B9, B10). T8 is not one of them.
- Fix: replace with "This was a regression. It was reverted the same day."
- Route: `sonnet-writer`.

### F3 (must-fix, implementation) Semicolon in a Sources cell, two files in one row.

- `P/06-engineering-the-process/06-engineering-the-process.md:69`: `| PG M1 ISSUE then PASS | \`pg.m1-gate.review.md\`, \`01.status.md\` | 3 ; 137 |`.
- C9: 0 `;` outside code and front matter. C7: one path per row (`test -e` per path).
- `pg.m1-gate.review.md:3` is the date line. The ISSUE verdict is line 12.
- Fix: two rows: `| PG M1 ISSUE | \`pg.m1-gate.review.md\` | 12 |` and `| PG M1 PASS | \`01.status.md\` | 137 |`.
- Route: `sonnet-writer`.

### F4 (must-fix, implementation) Three titles exceed 15 words (C3, C9).

Count = whitespace tokens, code spans excluded (`style.md` §2 "세는 법"). Prefix "Prettylog From Scratch (n/7):" = 4 tokens.

| File:line | Words | Fix (15 words, numbers kept) |
| --- | --- | --- |
| `P/02-one-gigabyte-vm/02-one-gigabyte-vm.md:2` | 18 | `Prettylog From Scratch (2/7): Two Servers, 1 GB, API p95 626 ms at 8 rps` |
| `P/04-nextjs-pipeline/04-nextjs-pipeline.md:2` | 17 | `Prettylog From Scratch (4/7): Server Fetches 19 to 13, Real 404s From a Proxy Gate` |
| `P/05-build-and-deploy/05-build-and-deploy.md:2` | 16 | `Prettylog From Scratch (5/7): No next build on the VM, 7 Workflows, 3 Kept Releases` |

- "API" stays in 02: the web p95 was 874 ms (02:58), so a bare "p95 626 ms" misattributes the number.
- Route: `sonnet-writer`.

### F5 (must-fix, reasoning) "4 Cache Rules" cites a line that has no 4.

- `P/00-overview/00-overview.md:111` and `P/07-debugging-timeline/07-debugging-timeline.md:157`: `| 4 Cache Rules | books/debugging/15-traffic-overrun.md | B1, 29 |`.
- `books/debugging/15-traffic-overrun.md:29` (B1) reads "엣지 캐시 없음 … 두 번째 GET HIT". No count of rules.
- The count 4 is at `deploy/traffic/README.md:29-37` (rule order 1–4). 01 and 03 already cite that.
- Fix: in both rows, file → `deploy/traffic/README.md`, line → `29-37`.
- Companion (nice): `07-debugging-timeline.md:78` "Four Cache Rules (#54)". `decisions.plan.md:123` #54 is the `blog-api.` rule only (07:154 says so). Fix: "Four Cache Rules (api rule: #54)".
- Route: `sonnet-writer`.

### F6 (must-fix, implementation) Six `desc:` fields exceed 15 words (C9).

C9 exempts front matter from the `;` rule only. `desc` is reader-visible (card text). If main session waives it by decision, record the waiver like #125.

| File:line | Words | Fix |
| --- | --- | --- |
| `P/00-overview/00-overview.md:15` | 24 | `A full-stack blog on 8 free-tier services and one 1 GB VM. Every number traces to a saved file.` |
| `P/01-request-path/01-request-path.md:14` | 26 | `One Cloudflare Tunnel reaches a 1 GB VM with no open web port. Four cache rules and a per-IP limit sit in front.` |
| `P/02-one-gigabyte-vm/02-one-gigabyte-vm.md:14` | 30 | `Next.js and Express share a 1 GB VM. Heap caps, swap and an off-VM build make it fit. Load tests checked it.` |
| `P/03-edge-cache/03-edge-cache.md:14` | 22 (2nd sentence) | `Four Cloudflare Cache Rules turned DYNAMIC into HIT. 640 load-test requests never reached the VM. The rate limit went 100 to 50 to 70.` |
| `P/06-engineering-the-process/06-engineering-the-process.md:13` | 21 | `One person kept 82 logged decisions. Review gates stop at two rounds. Pass lines are written before each run.` |
| `P/07-debugging-timeline/07-debugging-timeline.md:14` | 16, 16 | `Ten debugging events, 2026-07-09 to 2026-10-18, each with why, what and how. Only 6 of 16 traffic causes have a before and after. Two got worse.` |

- 04:13 and 05:13 pass.
- Route: `sonnet-writer`.

### F7 (must-fix, reasoning) Firewall fact cited to an unchecked to-do box.

- `P/01-request-path/01-request-path.md:65`: "The firewall allows inbound `tcp:22` from IAP only. No rule opens ports 3000 or 4000." Sources row 01:73 → `deploy/gcp/README.md:37`.
- `deploy/gcp/README.md:37` is `- [ ] Firewall: inbound only tcp:22 from 35.235.240.0/20 (IAP). No rule opens 3000/4000.` An unchecked checklist line is a plan, not a record.
- No saved `gcloud compute firewall-rules list` output was found under `deploy/gcp/`, `gcp.design.md` or `01.status.md`. `gcp.design.md:130` states the same as design.
- Fix: cite `gcp.design.md` 125-131 (already at 01:79) and write "By design, the firewall allows inbound `tcp:22` from IAP only. No rule opens ports 3000 or 4000. (Design line, not a saved rule listing.)" Or save a rule listing under `deploy/gcp/` and cite it (main session or owner, no agent ssh).
- Route: `sonnet-writer` for the wording. Owner for a saved listing.

### F8 (nice, reasoning) Decision count is a snapshot. The live command now gives 83.

- `grep -c '^> - \*\*#[0-9]\+ ' decisions.plan.md` = 83 today. Largest id = 125 (#125 was added after `figures.md` Checks 1 ran).
- Post 06 (title, 06:27), `fig_06_decisions.png`, `fig_00_numbers.png`, thumbnails 00 and 06 say 82 and #124. They cite the `figures.md` snapshot, so the number traces to a saved file. The dispatch note calls 82 correct.
- Option a: add "as of 2026-10-18" to 06:27. Option b: rerun Checks 1, `fig_06.py`, `fig_00.py`, `thumbs.py` with 83 before publish. Owner or main session decides.

### F9 (nice, implementation) "What failed" row is labelled QW1.

- `P/04-nextjs-pipeline/04-nextjs-pipeline.md:74`: `| QW1 | 13 to 12 | no recorded cause |`. QW1 passed (04:29). The 13 → 12 gap is ch15 B6.
- Fix: label the row `B6 (after QW1)`.

### F10 (nice, reasoning) "12 of 15 casebook cases dated 2026-10-13" cites 2 of 12 files.

- `P/07-debugging-timeline/07-debugging-timeline.md:143-144` cite chapters 01 and 14 only. The CSV cites all 12 line-3 Result lines (checked: 01, 04–14 = 12).
- Fix: one row `| 12 cases dated 2026-10-13 | books/debugging/01…14-*.md | line 3 of 12 chapters (02, 03 excluded) |`.

### F11 (nice, implementation) `[S-TDE-9]` sits on a `prefetch-source.md` row.

- `P/03-edge-cache/03-edge-cache.md:87`. The tag resolves in `deploy/traffic/review/traffic-debug-evidence.md:162` (§5 Sources), not in `prefetch-source.md`.
- Fix: move `[S-TDE-9]` to a `traffic-debug-evidence.md` row (line 48).

### F12 (nice, reasoning) `$3.65` row cites a line that holds `$0.005/hour` only.

- `P/00-overview/00-overview.md:107`: `| $3.65 list price | research/free-tiers-2026-10.md | 25 |`. Line 25 gives $0.005/hour. $3.65 is the design §6 product (730 h).
- Fix: row label `$0.005 per hour (list price)`. Keep 00:106 (`README.md:53`) for $3.65.

### F13 (nice, implementation) Mermaid nodes referenced before their subgraph.

- `P/01-request-path/01-request-path.md:33`: `B["Browser"] --> DNS` before `subgraph CF` declares `DNS` (01:37).
- `P/04-nextjs-pipeline/04-nextjs-pipeline.md:44-45`: `D -->|"no dot"| C1`, `M -->|"no"| C1` before `subgraph CL` declares `C1` (04:48).
- Mermaid may draw these nodes outside the subgraph. Not a parse error. Check on the rendered page (PS-3 owner visual check).

### F14 (nice, implementation) Long one-line labels after `<br/>` removal.

- `P/00-overview/00-overview.md:58, 60`: labels of 8 to 12 words with double spaces. Nodes get very wide on a phone.
- Fix: shorten to the first phrase, e.g. `CF["Cloudflare Free  $0"]`, and keep the detail in the Stack table (00:72-80).

### F15 (nice, implementation) Captions missing or inconsistent.

- Mermaid blocks in 04 (F04a, 04:66) and 05 (F05a 05:55, F05b 05:71) have no caption. `figures.md` rows 87-89 define them ("… Why: …").
- Caption style: italic in 01, 02, 03. Plain in 00, 07. Pick one.
- `rules/figures.md` §3: second sentence starts with "Why:". All existing captions comply.

### F16 (nice, implementation) U3 "line of 192 ms" reads as a target value.

- `P/04-nextjs-pipeline/04-nextjs-pipeline.md:31`, `P/06-engineering-the-process/06-engineering-the-process.md:54`. `fig_04_cc_units.png` and `09-lessons.tex:38` give 192 as the required drop (317 − 174 = 143 < 192).
- Fix: "Its line, a drop of 192 ms, was not met (drop 143)."

### F17 (nice, reasoning) Rule-file line numbers will drift.

- `P/06-engineering-the-process/06-engineering-the-process.md:64-66` cite `.claude/rules/core.md:105`, `.claude/CLAUDE.md:143`, `:162`. Correct today. Those files change often.
- Fix: cite the section name instead ("Log first", "Review happens at two points only", "Bounded by BOTH").

## Traceability sample (opened at the cited line)

| Post | Number | File:line | Value found | OK |
| --- | --- | --- | --- | --- |
| 00 | $0.005/h, $3.65 | `README.md:53` | `$0.005 / hour`, `≈ $3.65` | yes |
| 00 | 7 workflows | `README.md:299-305` | 7 rows | yes |
| 00 | 3 apps, 7 packages | `README.md:83-90` | 3 + (3 + 4 configs) | yes |
| 00 | 15 cases | `books/debugging/README.md:3` | "Fifteen real cases" | yes |
| 00 | 70 / 10 s | `README.md:10` | `rate limit 70 / 10 s` | yes |
| 01 | tcp:22 | `deploy/gcp/README.md:37` | unchecked `- [ ]` line | no (F7) |
| 01 | 6543 | `README.md:139` | `pooled :6543` | yes |
| 01 | 404, 308 | `README.md:222-223` | Removed 404, Moved 308 | yes |
| 02 | 160 / 256 | `ecosystem.config.cjs:31, 49` | `--max-old-space-size=160`, `=256` | yes |
| 02 | 106 MB, 220 MB, 287, 190 MiB | `02-blocking.md:299, 240` | api 106, web 220, 287 MiB, swap 190 | yes |
| 02 | 626 ms, 450, 8 rps | `02-blocking.md:291, 295, 297` | 8 rps, 450, p95 626 | yes |
| 02 | 874 ms, 10 timeouts, 4 rps | `02-blocking.md:230, 236, 237` | 4 rps, 10건, 874 | yes |
| 02 | 475 MiB | `deploy/gcp/web-self-proxy.md:14` | 475 MiB available | yes |
| 03 | about 230, 53 | `02-blocking.md:260, 395` | 약 230번째, 53번째 | yes |
| 03 | 6, 2 windows, peak 89 | `02-blocking.md:316-320` | 50 → 6, 70 → 2, 89 | yes |
| 03 | 320 + 320 | `02-blocking.md:213` | web 320, api 320 | yes |
| 03 | 4.5 / 3.4 / 0.2 MB | `01.status.md:49` | ≈4.5 MB/day (syslog 3.4, blog-api 0.2) | yes |
| 03 | 79, 264 kB, 28, 27 | `prefetch-source.md:14-15` | 79 requests, 264 kB, 28줄, 1줄 빼면 실패 | yes |
| 03 | S-TDE-5, 7, 9 | `traffic-debug-evidence.md:158, 160, 162` | rows in §5 Sources | yes |
| 04 | 19 → 13, 1 → 0, 317 → 174 (192), 12 → 0 | `09-lessons.tex:30, 36, 38, 44` | as written | yes |
| 04 | 2 → 6 x3 | `15-traffic-overrun.md:37` | 2, 6, ×3 | yes |
| 04 | 1500 ms | `README.md:171` (in 155-185) | fail-open at 1500 ms | yes |
| 05 | 3 on push | `README.md:299-301` | ci, gcp, cc-standalone-check on push | yes |
| 05 | 4 groups, priority 10–40 | `projects.design.md:874-877` | my-work 10, company 20, gatech 30, utrgv 40 | yes |
| 06 | 82, #124, 79, 3 | `figures.md` Checks 1 | 82, 124, 79, 3 | yes (snapshot, F8) |
| 06 | 72 of 79 | `fig_06_decisions.csv` | 8 + 28 + 36 = 72 | yes |
| 06 | 2/2, 2/2 | `01.status.md:93, 97, 110-111` | as written | yes |
| 07 | 16 / 4 / 2 / 10 | `15-traffic-overrun.md:23-38` | A1, B6, B7, B8 reduced. B9, B10 worse. 10 other | yes |
| 07 | 528 → 12 | `15-traffic-overrun.md:23` | 528 ms (렌더 시간) → 12 ms | yes |
| 07 | 43 render errors | `decisions.plan.md:189` | 43회 | yes |
| 07 | /nope 500, 21 B | `01.status.md:99` | HTTP 500 (21 B) | yes |
| 07 | 4 group rows, 1 category | `01.status.md:138` | groups 13-16, cnn → utrgv | yes |
| 07 | 108 of 177 | `traffic-debug-evidence.md:49` | 108 / 177 (무효) | yes |
| 07 | restarts 15 | `09-blog-api-crash-loop.md:9` | "not verified in a repo file" | post yes, figure no (F1) |
| 00, 07 | 4 Cache Rules | `15-traffic-overrun.md:29` | no count on that line | no (F5) |

## Commands run

```bash
# paths: every Sources row (113), test -e           -> 0 MISSING
# em dash: rules/writing/style.md §3 grep           -> 0
# semicolon outside fences and front matter         -> 1 (06:69)
# mermaid first lines, '<br'                        -> 6 valid, 0
# body lines excluding front matter                 -> see C10 row
# forbidden values (egress, visitors, traffic volume) -> 1 hit, 07:129 "Monthly egress | not measured" (allowed by design §6)
# TBD links in 00                                   -> 7. /@taeklim/ links in 01–07 -> 0
# front matter keys, priority, first body line, PNG set per folder -> all 8 pass
# sentence length > 15 words (uv run python, scratchpad script) -> titles 02/04/05, desc 00/01/02/03/06/07
# decision count: grep -c '^> - \*\*#[0-9]\+ ' decisions.plan.md -> 83, max id 125
# grep -n Mission prettylog-series.design.md        -> line 9
```

## Fixes applied (writer, 2026-10-18)

`P` = `apps/blog_agent/posts/projects/my-work/prettylog/`. No commit, no publish, no build. Final line numbers.

| Finding | Status | Where (file:line) |
| --- | --- | --- |
| F1 | done by main session. Post 07 agrees ("↺15 is unverified"), CSV T5 = "hang 20 s (restarts unverified)" | `P/07-debugging-timeline/07-debugging-timeline.md:70`, `P/_series/data/fig_07_timeline.csv` row T5 |
| F2 | done. "This was a regression. It was reverted the same day." Source line `01.status.md:99` is dated 2026-10-14 and says revert 7b4a138 | `07-debugging-timeline.md:93` |
| F3 | done. Two rows. Checked `pg.m1-gate.review.md:12` = ISSUE, `01.status.md:137` = PG M1 gate PASS | `06-engineering-the-process.md:69-70` |
| F4 | done. Titles 02, 04, 05 use the review text. Word count 15 or fewer | `02-one-gigabyte-vm.md:2`, `04-nextjs-pipeline.md:2`, `05-build-and-deploy.md:2` |
| F5 | done. Both rows now `deploy/traffic/README.md` 29-37 (lines 29-37 hold the 4 rules, rule order 1-4). Companion "api rule: #54" done | `00-overview.md:111`, `07-debugging-timeline.md:157`, `:78` |
| F6 | done. `desc:` of 00, 01, 02, 03, 06, 07 use the review text. Each sentence is 15 words or fewer | `desc:` line of each file (00:15, 01:14, 02:14, 03:14, 06:13, 07:14) |
| F7 | done. "By design" wording plus "(Design line, not a saved rule listing.)". Source row now `gcp.design.md` 125-131 (line 130 states inbound blocked, only IAP tcp:22). `deploy/gcp/README.md:37` is no longer cited for this | `01-request-path.md:65`, `:73` |
| F8 | done (option a). "82 decision rows in the log as of 2026-10-18", source row unchanged. Figures and thumbnails keep 82 | `06-engineering-the-process.md:27` |
| F9 | done. Row label `B6 (after QW1)` | `04-nextjs-pipeline.md:75` |
| F10 | skipped (nice, no exact in-scope text asked) | |
| F11 | skipped | |
| F12 | done. Row label `$0.005 per hour (list price)` | `00-overview.md:107` |
| F13, F14 | skipped (rendered-page check in PS-3) | |
| F15 | done for the 3 missing mermaid captions (text from `figures.md` rows 45-47). Italic like 01-03. Plain style in 00 and 07 left as is | `04-nextjs-pipeline.md:67`, `05-build-and-deploy.md:56`, `:73` |
| F16 | done. "Its line, a drop of 192 ms, was not met (the drop was 143 ms)." The Sources label in 04 now names 143 = 317 minus 174 | `04-nextjs-pipeline.md:31`, `:85`, `06-engineering-the-process.md:54` |
| F17 | skipped | |

공통 AC re-check on all 8 files (script in the session scratchpad): C1/C2/C4 unchanged, em dash 0, `;` outside code and front matter 0, titles 15 words or fewer (00: 15, 01: 14, 02: 15, 03: 13, 04: 15, 05: 15, 06: 12, 07: 13), `desc:` sentences 15 words or fewer (max 13), C10 body lines 01 59/70... 06 52/70 (limits are the review's caps without the +10, all within), every Sources path passes `test -e`.
