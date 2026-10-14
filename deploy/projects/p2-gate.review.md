# P2 gate review (Phase PJ M4) · cycle 1/2 · 2026-10-14

- reviewer 단독 (`.claude/CLAUDE.md` Workflow 4, `.claude/agents/reviewer.md`).
- 대상: main `2cfb6bc` (HEAD), 운영 web `8eac7d8` (= P2 배포 `1c035f2` + R2). 셋 모두 HEAD 조상 확인.
- 입력: `00.plan.md` Phase PJ M4 줄, `00.tasks.md` PJ-2-01…06, PJ-1-28, `decisions.plan.md` #79, #80, #89, #113 (Update 1–3), #114, `projects.report.md` "P2", `deploy/projects/p2-prod-2026-10-14.txt`, `deploy/projects/p2-traffic-check-2026-10-14.txt`.
- 방법: 정적 검사 2개(check-types, lint), 코드 grep, 운영 익명 GET 순차 curl 약 35회 (1.2 s 간격, UA `reviewer-p2-gate/1.0`, 2026-10-14T19:35–19:37Z). 빌드, dev 서버, 브라우저 없음.

## 판정: ISSUE (must-fix 1)

```
AC 전부 PASS  --+
                +--> 하지만 오너 선(#89 "모르는 page는 진짜 HTTP 404")이 깨짐
운영 probe -----+     /@u/logs/<없는 id> = 200, 엣지 HIT (age 90)
```

| 묶음 | 결과 |
| --- | --- |
| 정적 검사 | PASS 2/2 |
| AC (PJ-2-01…06, PJ-1-28) | PASS 전부 (아래 표) |
| 운영 probe | 기대값 24/24 일치. AC 밖 1건 ISSUE |
| MVP ladder L1–L4 | PASS |
| Hierarchy H1–H2 | PASS (pm 후속 1) |
| must-fix | 1 (M-1) |

## 1. 정적 검사

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter dashboard_client_web check-types` | exit 0 |
| `pnpm --filter dashboard_client_web lint` (`--max-warnings 0`) | exit 0 |

## 2. AC 점검

`A/` = `apps/dashboard_client_web/`. "코드" = grep. "운영" = 이번 probe 또는 증거 파일.

| 행 | AC | 확인 | 결과 |
| --- | --- | --- | --- |
| PJ-2-01 | AC1 `/about`, `/resume` 308 + location | 운영: `/about` 308 `location: /@taeklim/about`, `/resume` 308 `location: /@taeklim/resume` | PASS |
| PJ-2-01 | AC1 `/@taeklim/about` 200, 다른 handle 404 | 운영: `/@taeklim/about` 200, `/@taeklim/resume` 200, `/@someone-else/about` 404 | PASS |
| PJ-2-01 | 코드 | `A/app/(shell)/[handle]/{about,resume}/page.tsx`, `isOwnerHandle` 아니면 `notFound()`. 308은 `utils/legacyRedirect.ts` 16–19행 (#113 위치) | PASS |
| PJ-2-02 | AC1 (#89 대체) 쿠키 없이 `/@taeklim/saved` 404, location 없음 | 운영: 404, `location` 없음, `cf-cache-status: DYNAMIC`. 본문 `<meta name="robots" content="noindex"/>` | PASS |
| PJ-2-02 | AC1 robots `/@*/saved` ≥1 | 운영 `robots.txt` 1개. 코드 `app/robots.ts` `/@*/saved`, `/%40*/saved` | PASS |
| PJ-2-02 | AC2 오너 브라우저 (다른 계정 404 화면, 오너 목록) | 오너 몫. `projects.report.md` P2 단계 2: 오너 렌더 기록 없음. 코드: `saved/page.tsx` `robots: { index: false }`, `OwnerOnly` → `notFound()` | PASS (코드). 운영 오너 확인 = 열린 항목 O-2 |
| PJ-2-03 | AC1 `Number(\|parseInt` in logs/ → 0 | 코드: 0 | PASS |
| PJ-2-03 | AC1 `/log/@` → 0 (주석 제외) | 코드: 1 히트, `utils/notFoundGate.ts` 82행 주석 | PASS |
| PJ-2-03 | AC3 `export const (dynamic\|dynamicParams)` → 0 | 코드: 0 | PASS |
| PJ-2-03 | AC3 `loading.tsx` = `logs`, `logs/[logId]` | 코드: 둘 다 있음 | PASS |
| PJ-2-03 | AC2 `/@taeklim/logs` 200. `/log/@taeklim`, `/log` 404, location 0 | 운영: 200 (HIT). `/log` 404, `/log/@taeklim` 404, `/log/@taeklim/0` 404, location 없음. `/@nobodyxyz/logs` 404 | PASS |
| PJ-2-03 | 본문: `logsPath`, `logPath`, `toUsernameSegment`, `components/log/*` 링크 | 코드: `utils/routes.ts` 39, 43행. `components/log/*` 6개 파일 모두 `logPath` 사용. `app/log/` 없음 (`app/_x_log/` = 은퇴 폴더) | PASS |
| PJ-2-04 | `/@taeklim/saved` 2회 → 2번째 `BYPASS` 또는 `DYNAMIC` | 운영: 1회 DYNAMIC, 2회 DYNAMIC | PASS |
| PJ-2-05 | AC 결과가 `projects.report.md` "P2" 절에 줄마다 있음 | 절 있음. 단계 1–7 표, 주소 23개 합계 표, traffic-check 줄 | PASS |
| PJ-2-06 | AC1 `p2-prod-2026-10-14.txt` 있음, 5개 줄 | 파일 있음. `/@taeklim/logs` 200, `/log` 404, `/log/@taeklim` 404, `/@taeklim/about` 200, `/@taeklim/resume` 200 모두 있음 | PASS |
| PJ-2-06 | AC2 "P2" 절 형식 (What, Why, Input, Output, Result, Status, 그림 1, 표 1), 요약 링크, sitemap 수 | 단계마다 7칸 있음. ASCII 그림 1, 표 여러 개. 3행 요약에 `[P2](#p2-2026-10-14)` 링크. sitemap 표: `/@taeklim/(about\|resume)` 2, 옛 형태 0 | PASS |
| PJ-2-06 | AC3 traffic-check 한 줄 | 단계 7: 0 FAIL, exit=0. 파일 `p2-traffic-check-2026-10-14.txt` 13 PASS | PASS |
| PJ-1-28 | AC1 `SITE_URL\}/(about\|resume)` → 0 | 코드: 0. 44, 50행 = `aboutPath`, `resumePath` | PASS |
| PJ-1-28 | AC2 sitemap 개수 | 운영 sitemap `<loc>` 29개. AC 정규식 `<loc>[^<]*/(about\|resume)</loc>` = 2 (새 URL도 잡힘). 엄격 `https://my.prettylog.com/(about\|resume)</loc>` = 0. `/@taeklim/(about\|resume)` = 2. `/blog` 0 | PASS. AC 정규식이 새 URL도 세므로 보고서는 엄격 값을 쓴다 (O-4) |

AC 밖, #113 Update 2 "모바일 메뉴 = 데스크톱 rail": 코드 `MenuDrawer.client.tsx`, `nav-menu.client.tsx`, `rail/PrimaryNav.client.tsx` 셋 다 `hooks/useNavLinks.hook.ts` 하나를 읽는다. 항목 출처가 같다. 운영 화면 기록은 없다 (O-3).

## 3. 운영 probe (AC 밖 포함)

| 경로 | 상태 | cf | 기대 | 판정 |
| --- | --- | --- | --- | --- |
| `/` | 200 | HIT | 200 | 일치 |
| `/@taeklim/logs` | 200 | HIT | 200 | 일치 |
| `/@taeklim/logs/31` (실제 id, HTML에 `Back to log`) | 200 | MISS | 200 | 일치 |
| `/@taeklim/logs/0` | **200** | MISS → 2회째 **HIT age=90** | 404 (#89) | **ISSUE M-1** |
| `/@taeklim/logs/99999999999999` | **200** | MISS | 404 | **ISSUE M-1** |
| `/@taeklim/logs/abc` | **200** | | 404 | **ISSUE M-1** |
| `/@nobodyxyz/logs/31` | **200** | MISS | 404 | **ISSUE M-1** |
| `/@nobodyxyz/logs` | 404 | BYPASS | 404 | 일치 |
| `/@taeklim/no-such-post-xyz` | 404 | BYPASS | 404 | 일치 (대조군) |
| `/@taeklim/projects/no-such-project` | 404 | BYPASS | 404 | 일치 (대조군) |
| `/log`, `/log/@taeklim`, `/log/@taeklim/0` | 404 | BYPASS | 404 | 일치 |
| `/@taeklim/about`, `/resume`, `/projects`, `/posts` | 200 | | 200 | 일치 |
| `/about`, `/resume` | 308 + location | | 308 | 일치 |
| `/@taeklim/saved` ×2, `/@taeklim/me`, `/me`, `/me/saved` | 404 | DYNAMIC | 404 | 일치 |
| `/api/x`, `/tags` | 404 | | 404 | 일치 |
| `/favicon.ico`, `/robots.txt`, `/sitemap.xml` | 200 | | 200 | 일치 |

## 4. Must-fix

### M-1. `/@u/logs/<logId>`가 없는 id에 HTTP 200을 내고 엣지가 저장한다

- 증상: 위 표 4줄. 본문은 not-found 화면 (`Back to log` 0개). 2회째 요청 `cf-cache-status: HIT`, `age: 90`. 즉 soft 404가 Cloudflare "web cache"에 하루 남는다.
- 같은 뿌리: `/@nobodyxyz/logs/31`도 200. 없는 사용자인데 user gate가 3세그먼트 경로에는 돌지 않는다. 페이지의 `redirect(logPath(...))`도 HTTP 상태로 나오지 않는다.
- 원인 (코드): `utils/notFoundGate.ts` `classifyGatePath`는 3세그먼트 경로를 `projects`일 때만 분류한다 (56–60행). `/@u/logs/<id>`는 `null` → proxy 존재 검사 없음. 그 뒤 `cacheComponents` 아래서 `loading.tsx` shell이 먼저 흘러가고 `notFound()`, `redirect()`는 스트림 안에서 실행된다. 상태는 이미 200이다.
- 출처: Phase CC U4. `181e6ed`(P2 전 운영)의 `app/log/[username]/[logId]/page.tsx`에 `export const dynamic` 0 (git show 확인). 즉 옛 `/log/@u/<id>`도 같은 soft 404였다. §18 gate는 처음부터 네 종류(user, project, post, ownerOnly)만 있었다. P2(PJ-2-03)는 그 상태를 `/@u/logs/<id>`로 옮겼고 AC3이 `export const dynamic` 금지를 유지했다. gate에 `log` 종류는 아직 없다.
- 출처가 CC여도 M4 판정은 바뀌지 않는다. M4가 소유한 route에서 오너 선이 운영에서 깨져 있고 엣지가 저장한다. 책임 소재가 아니라 통과 여부를 본다.
- 깨진 선: 오너 #89 "모르는 page는 진짜 HTTP 404" (#103 재확인, #113 Update 3가 proxy 안을 고른 이유). 결정 계층에서 오너 선이 AC 통과보다 위다 (`rules/core.md` Decision hierarchy). 그래서 AC 전부 PASS여도 ISSUE다.
- 분류: **implementation issue** (gate 종류 누락) + 설계 단위 선행. `cc.design.md` §18 gate 종류 표에 다섯째 모양 `log`(`/@u/logs/<id>`, 존재 검사 = Express log API 1회)를 더해야 한다. 그 선택은 `DECISIONS.md` 행이 먼저다 (H2).
- 라우팅: **system-architect** (§18 표 + 결정 행, 작은 설계 단위) → **developer** (`notFoundGate.ts`, `existence.proxy.ts`). ladder 문제가 아니다 (스키마 변경 없음).
- 피할 안: `loading.tsx` 제거나 `export const dynamic` 복원. #97이 기록한 대로 Suspense 밖 uncached await는 빌드가 깨지고, PJ-2-03 AC3이 금지한다.
- 닫는 조건 (다음 cycle에 잴 것): `/@taeklim/logs/0` 404 + `BYPASS`. `/@nobodyxyz/logs/31` 404 (user 존재 검사 포함). `/@taeklim/logs/31` 200 유지. purge 뒤 측정.

## 5. MVP ladder (`.claude/CLAUDE.md` "System build phasing")

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| L1 Schema is the single contract | PASS | P2는 스키마 변경 없음 (Constraints). 계약 `@repo/types` 그대로. logId는 문자열 end-to-end (AC1 0). |
| L2 No pipeline before the flow is demonstrated | PASS | P2는 새 파이프라인 없음. 기존 log API를 새 경로에서 부른다. |
| L3 Mock data isolated | PASS | P2에 mock 없음. 운영 `[MOCK]` 0 (MVP2 절). |
| L4 Phase opens on closed exit | PASS | M4 열림 = #111 오너 결정 (기록됨). M3 exit = P1 gate 2/2 PASS (`pj.p1-gate.review.md`). |
| M4가 돌아가는 것으로 끝나나 | PASS | 운영 `8eac7d8`에서 새 주소 3종 200, 옛 주소 308 또는 404 (위 표). |

## 6. Hierarchy (`rules/core.md` Decision hierarchy, `rules/docs.md` §0.1, §8)

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| H1 mission block (plan) | PASS | `00.plan.md` Phase PJ: Mission, Vision, Constraints, G1 (owner #91), S1 → G1, M1–M4 → S1. |
| H1 mission block (design) | PASS | `projects.design.md` §0 "Mission block (인용)" → plan 원본 참조. |
| H1 task rows `→ M<n>` | PASS | PJ-2-01, 02 → M1, PJ-2-04 → M2, PJ-2-03, 05, 06 → M4, PJ-1-28 → M3 (gate 밖). |
| H1 counters | PASS | M4 줄 `cycle 0/2; recovery 0/2`. 이번 gate = cycle 1/2 (dispatch). 분모 안. `budget:` 없음 (K7 해당 없음). pm 후속: M4 줄을 `cycle 1/2`로 올린다 (O-5). |
| H2 decisions logged | PASS | #113 (A안, Update 1–3 각각 Why, Rejected, Decided by), #89, #111, #114. M-1 고침은 새 행 필요. |

## 7. 열린 항목 (must-fix 아님)

| ID | 항목 | 담당 |
| --- | --- | --- |
| O-1 | 이번 probe가 엣지에 soft-404 200을 남겼다: `/@taeklim/logs/0`, `/@taeklim/logs/99999999999999`, `/@taeklim/logs/abc`, `/@nobodyxyz/logs/31`. M-1 배포 뒤 purge 때 함께 지운다. | main session |
| O-2 | PJ-2-02 AC2 오너 브라우저 확인 (`/@taeklim/saved` 오너 렌더) 기록 없음. | owner |
| O-3 | 모바일 메뉴 = rail 운영 화면 기록 없음 (코드 출처는 같음). | owner 또는 main session |
| O-4 | PJ-1-28 AC2 정규식이 새 URL도 센다. 보고서 단계 5는 엄격 값(옛 0, 새 2)으로 적혀 있어 맞다. AC 문구만 pm이 고친다. | product-manager |
| O-5 | `00.plan.md` M4 줄 `cycle 0/2` → `1/2`. `00.tasks.md` M4 머리 "gate 대기" → ISSUE 1. | product-manager |
| O-6 | `app/robots.ts` 9행 주석 "Public/indexable: /, /blog, /about, /resume" 낡음 (동작 영향 없음). | developer (다음 손댈 때) |
| O-7 | `app/_x_log/` 은퇴 폴더 삭제 (soft-delete 규칙, 오너가 지운다). | owner |

## 8. 다음 cycle

- M-1 닫힘 뒤 gate 재실행 = cycle 2/2. 측정 = §4 "닫는 조건" + §3 표 재확인.
