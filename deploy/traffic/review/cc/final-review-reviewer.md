# Phase CC 최종 검토 (reviewer)

- 작성: reviewer, 2026-10-14. 범위 = `.claude/agents/reviewer.md` (build + AC + MVP ladder + H1/H2).
- 검토 대상: main HEAD `12a4c64` (dispatch 시점 `8b8dd39` 이후 다른 세션이 올린 docs 커밋 1개 포함). 운영 web = `181e6ed`. `git diff --stat 181e6ed main -- apps/ packages/` = `apps/dashboard_client_web/README.md`만. 앱 트리는 운영과 같다.
- 검토 시점에 작업 트리에 커밋되지 않은 편집이 있었다: `00.tasks.md` (행 9개 `[x]`), `decisions.plan.md` (#113, #114), `cc.design.md` (§7.3 14번). 이 편집은 다른 세션의 것이다. 이 검토는 그것을 **검토하지 않았다**. §7에 관찰만 적었다.
- 고친 것 없음. git, rm 없음. 로컬 실행 = 정적 검사 2개 + 운영 GET 30회 (경로 15개 × 2, 1.2초 간격).

## 0. 판정

**ISSUE.** must-fix 1건 (구현). 나머지는 열린 항목이다.

| 구분 | 수 |
| --- | --- |
| must-fix | 1 |
| 열린 항목 (문서, 측정 기록, 설계 확인) | 12 |
| 오너 결정으로 닫힌 AC | 아래 §2 표 |

```
check-types 0 ──► PASS
lint          ──► FAIL (경고 4, --max-warnings 0)  ──► CI 빨강 (0a27b51 → 12a4c64, 4회 연속) ──► must-fix 1
AC grep       ──► 닫힌 행 모두 코드 조건 참 (문구 예외 1건, §2 CC-U3)
운영 probe    ──► 15 경로 기대대로 (200 ×8, 404 ×7)
숫자 추적     ──► run 파일로 풀리는 숫자 전부 일치. 저장 파일 없는 숫자 4종 (§3)
문서 일치     ──► 최종 상태(U4 유지, U5/U6 뺌, G-CC 미달)는 5개 문서가 같다. 낡은 줄 7곳 (§4)
ladder/H     ──► L1 PASS, L2/L3 해당 없음, L4 오너 결정으로 PASS, H1 PASS(문구 1), H2 PASS
```

## 1. 빌드 (정적)

| 명령 | 결과 | 판정 |
| --- | --- | --- |
| `pnpm --filter dashboard_client_web check-types` | `tsc --noEmit` exit 0 | PASS |
| `pnpm --filter dashboard_client_web lint` | exit 1. `eslint . --max-warnings 0`, 경고 4 (`scripts/gen-public-paths.mjs` 31:5 `no-undef` process, 35:13 `no-empty`, 37:23 `prettier/prettier`, 38:9 `no-undef` process) | **ISSUE** |

- 같은 실패가 GitHub Actions `ci.yml`에 있다: `gh run list --workflow ci.yml` → `0a27b51`, `588c200`, `8b8dd39`, `12a4c64` 모두 failure. 실패 step = "Run pnpm --filter dashboard_client_web lint" (run 38618670471). `0a27b51`은 `cc-u4-o` merge 커밋이다.
- 파일 출처: `598e2e1` "fix(cc): A2 dotted paths handled in proxy, generated PUBLIC_PATHS" (U4 recover A2). 운영 `181e6ed` 트리에도 있다. `build:dev`, `build:prod`, `cc-standalone-check.yml`이 이 스크립트를 실행한다. 실행 자체는 통과했다 (경고는 lint 규칙).
- Phase CC 모든 행의 공통 ENG AC = "lint 0". 닫힌 행(CC-U4, CC-U3-2)이 이 AC를 통과한 적이 없다.
- **분류: 구현 issue → developer.** 범위 = 그 파일 1개 (globals 선언 또는 eslint 환경 설정, 빈 catch 처리, prettier). 다른 파일 변경 없음.

## 2. 행별 AC (코드 조건은 main `12a4c64`에서 grep)

| 행 | 상태 | 코드 AC | 배포 뒤 AC | 비고 |
| --- | --- | --- | --- | --- |
| CC-U0a | `[~]` | AC1–AC5 (gate 2 PASS 기록) | AC7 기록 없음 | 닫히지 않은 채 Phase 닫음 (§4 6번) |
| CC-U0b | `[ ]` | 해당 없음 | AC3 불가 (criteria.md가 QW1 뒤), AC5 기록 있음 (`criteria.md` 범위) | 미결 AC = 측정 기록 |
| CC-QW1 | `[x]` | AC1–AC5 참 (cache() 4파일, `x_post.action.ts` 있음, `post.action.ts` 없음) | AC7, AC8 → CC-QW1-2 열림 | 판정 통과 19 → 13 (`runs/*_QW1_qw1_{1,2,3}_61d48bc/ssr_fetch_summary.txt`) |
| CC-QW2 | `[x]` | AC1–AC3 참 (`cookies(` 0, `data-rail`/`railCollapsed` 2줄 in `app/layout.tsx`) | 판정 (2) 미측정 → CC-QW2-2 | 판정 미완 |
| CC-U1a | `[x]` | `@/app/[handle]` import 0 | AC4 → CC-U1a-2 | |
| CC-U1b | `[x]` | `(shell)/layout.tsx`, `utils/rail-visibility.ts` 있음 | AC7 → CC-U1b-2 | U1 판정 없음 (#99, #107) |
| CC-U1c | `[x]` | `<HomeRightRail` 2곳 (`(feed)/layout.tsx`, `[handle]/(rail)/layout.tsx`), `data-right-rail="shared"` 1 | AC1c, AC3–AC5 → CC-U1c-2 | |
| CC-U2 | `[~]` | `staleTimes: { dynamic: 30 }`, `static:` 0 | AC2 통과 (`runs/20261014T070608Z_U2_u2_c26c69d_browser`), AC3 고의 확인 기록 없음 | 닫히지 않은 채 Phase 닫음 |
| CC-U3 | `[~]` | AC1 literal grep = 1: 2행 `import { preloadProjectsTree } from '@/apis/getProjectsTree.api'`, 39행 `preloadProjectsTree(username)`. 그 함수는 `void getProjectsTree(username, null).catch(...)` (`apis/getProjectsTree.api.ts:29–31`). layout은 대기하지 않는다. 읽기는 `<Suspense>` 안 `RightRailSwitch` (72행)에서. 의도(layout은 shell만, 대기 없음) 충족. AC4 `new Date()` 0. AC5 `cc-build.yml` 있음 | AC7 미달 (사전 등록대로, 코드 유지). AC8 `cc.report.md` "MVP1" 있음 | AC1 정규식이 preload import와 호출에 걸린다. 결함 아님. AC 문구 정리 (§9 8번) |
| CC-U3-2 | `[x]` | AC1 `await auth(`/`await getPostBySlug` 0. AC2 `<PostGate>`를 `<Suspense>`가 감싼다, 호출은 `components/projects/PostGate.server.tsx` | AC3 로그인 절 기록 없음 → CC-U4-2 | PASS |
| CC-U4 | `[x]` (#106) | AC1 `cacheComponents: true` 1, `export const dynamic` 0. AC2 `generateStaticParams` `[handle]`, `[slug]`, `[project]` layout 있음, `CC_SAMPLE_*` 2. AC3 `(shell)/write/[postId]/loading.tsx` + log 3개 있음 (행 본문 경로 `A/app/write/`는 낡음, 실제 `(shell)/write/`). AC4 `ClerkProvider` dynamic 0, `requestLocale` 주석 1. AC6 `packages/types`, `packages/db` diff 없음 | AC5 **미충족**: 앱 소스에 `'use cache'`, `cacheTag` 0건 (OG 제목 fetch에 없음). sitemap 안 미기록. AC7d–g, AC8a, AC9 → CC-U4-2 | 주 지표 판정 없음 (#105, #106). G-a 50 / 53 / 50 ≤ 60 (`runs/20261014T181839Z_U4_u4o_f76c1d9_browser/summary.csv` 행 `auth,expanded,g_a_max_10s`) |
| CC-U5 | `[x]` 뺌 (#111) | 코드 main에 없음 (branch `cc-u5`) | A-B 미달 (`u5-ab.md`) | 오너 결정으로 닫힘 |
| CC-U6 | `[x]` 뺌 (#109) | `app/api/revalidate/route.ts` 없음 | 없음 | 오너 결정으로 닫힘 |
| CC-U7 | `[x]` | AC1 route 파일 없음, 문자열은 주석 1줄 (`apis/getFeedPage.client.api.ts:3`). AC2 두 client 파일 `fetch(` 0 | AC4 → CC-U7-2. AC5 `rate_limit` 0줄은 저장 파일 없음 | 판정 통과 12 → 0 (아래 §3) |
| CC-N13, N16 | `[x]` | 문서 행 | | PASS |
| CC-N11, N14, N15 | `[ ]` (HEAD) | | | `cc.report.md` 낡은 줄 2곳 그대로 (§4). N14의 `cc.design.md` 편집은 작업 트리에만 있다 (§7) |
| CC-U4-2, U7-2 | `[ ]` | | | 측정 기록 행 |

- 공통 ENG AC "BIGINT `Number(`/`parseInt(` 0": `app/`, `components/`, `apis/`, `utils/`, `hooks/`의 일치는 모두 주석이다. PASS.
- 공통 ENG AC "lint 0": **모든 닫힌 행에서 FAIL** (§1).
- 공통 측정 AC (CM) "smoke 15 = `smoke-0ac938c.txt`": U4, U7 배포에 smoke 15 비교 파일이 없다 (`00.runs.md` §2.1.1 "없음"). 이 검토의 probe (§5)는 §7.3 목록과 다른 15개다. 대체 증거가 아니다.

## 3. `cc.report.md` 요약 숫자의 출처

| 숫자 | 출처 파일 | 확인 |
| --- | --- | --- |
| QW1 19 → 13 | `runs/*_baseline{1,2,3}_*/ssr_fetch_summary.txt`, `runs/*_QW1_qw1_{1,2,3}_61d48bc/ssr_fetch_summary.txt` | `criteria.md` §1, `00.runs.md` 2–9행과 같다 |
| U2 1 1 1 → 0 0 0 | `runs/20261014T070608Z_U2_u2_c26c69d_browser/summary.csv` | `00.runs.md` 14행 |
| U3 317 → 174 ms | `runs/20261014T073207Z_U3_u3_0ac938c_browser/summary.csv` | `00.runs.md` 18행 |
| U4 attempt 2 329 → 434 ms | `runs/20261014T074439Z_U4_u4base_v2_0ac938c_browser/summary.csv` `auth,expanded,w1_nav_ms_s2_s6` 329 (295 329 329); `runs/20261014T092201Z_U4_u4_f122265_browser/summary.csv` 434 (482 421 434) | 일치 |
| A-B-A d = 534, c̃ 897.5 | C1 `runs/20261014T164336Z_U4_u4abaC1_964c9f8_browser/summary.csv` 643 (643 1134 526 560 1307); C2 `runs/20261014T173359Z_U4_u4abaC2_964c9f8_browser/summary.csv` 1177 (661 2278 528 1946 1177) | 643 − 1177 = −534. 일치 |
| 운영 G-a 50 / 53 / 50, hydration 0, prefetch 6 | `runs/20261014T181839Z_U4_u4o_f76c1d9_browser/summary.csv` | 일치 (`g_a_max_10s` 값 "50 53 50") |
| U7 12 → 0 | `raw.jsonl`의 `"path":"/api/posts/load-more` 줄 수: U3 폴더 12, U4 기준 폴더 12, `runs/20261014T095432Z_U7_u7_964c9f8_browser` 0 | 일치 (reviewer가 다시 셌다) |
| U5 302 → 316 ms (run p50 472 / 302 / 263, 283 / 343 / 316) | `runs/20261014T18{3605,3636,3654}Z_U5_u5C*_181e6ed/manifest.json`, `runs/20261014T18{3758,3817,3835}Z_U5_u5T_*_b30d03a/manifest.json`, `metrics.arms.anon.steps.{miss.home,miss.projects,miss.post}.ttfb_ms.values` 9개의 중앙값 | 6 run 모두 일치 (reviewer가 node로 다시 계산) |
| 오류 로그 855 → 1134, `Connection closed.` 43회 | `u5-ab.md` (main session이 VM 로그에서 옮김). 원본 로그 파일 저장 없음 | **추적 끝 = 메모**. 저장 산출물 없음 |
| 배포 뒤 ERROR 8줄 → 새 줄 0 | `u4o-prerender-errors.md`. 원본 로그 저장 없음 | 같음 |
| Express `rate_limit` 0줄 (U7) | dispatch 기록 (`00.runs.md` 25행, `criteria.md` §3 7번) | 저장 파일 없음 |
| Cloudflare 한도 70 / 10 s | #106 오너 원문 | 오너 설정값. 저장 파일 없음 (운영 설정) |

- `rules/answering.md` §3 "숫자는 저장된 산출물에서 읽는다"에 걸리는 것은 위 네 줄이다. 분류: 측정 기록 issue → data-analyst (원본 로그 조각을 `runs/` 아래에 저장하거나, 메모에 "저장 파일 없음"을 명시). `u5-ab.md`, `u4o-prerender-errors.md`에는 그 표시가 없다.
- 판정 파일(`verdicts.json`, `rules/measurement.md` §4.1)은 없다. `00.runs.md` 머리 메모가 그것을 적는다. 열린 항목.

## 4. 문서 일치 (최종 상태)

최종 상태 "U4 유지 #106, U5 뺌 #111, U6 뺌 #109, G-CC 미달, M4 열림"은 `00.plan.md` Phase CC 절, `00.tasks.md` Phase CC 머리, `cc.plan.md` §1, `cc.report.md` "Phase CC 닫음", `decisions.plan.md` #106–#112, `01.status.md` 115–116행이 같다. PASS.

낡은 줄 (ISSUE, 문서 → product-manager, 또는 열린 행 N11):

| # | 파일:줄 | 내용 | 맞는 값 |
| --- | --- | --- | --- |
| 1 | `00.tasks.md` 7행 ACTIVE/OPEN | "Phase CC … IN PROGRESS M-CC1 2026-10-14 … 13 rows" | CLOSING, 26 rows |
| 2 | `cc.report.md` 39행 | "`cc/00.runs.md`는 19행까지 있다" | 29행 (26–29 추가됨) |
| 3 | `cc.report.md` 45행 | "열린 것은 U1 오너 확인(#99)" | #107로 확정됨 |
| 4 | `00.plan.md` M-CC2 줄 | "exit 미충족 칸: … `cc.report.md` "MVP2" 없음 (→ CC-U4-2)" | `cc.report.md` "MVP2" 절은 있다 (343행). 남은 미충족 = U4 단계 보고 형식(그림 1, 표 1)과 G-CC 판정 |
| 5 | `00.plan.md` G-CC 줄 | "(DRAFT, architect, 오너 승인 대기)" | #103이 날짜를, #111이 상태(미달)를 오너 결정으로 정했다. 라벨만 낡음 |
| 6 | `00.tasks.md` CC-U0a, CC-U2, CC-U3 | `[~]` 그대로 | Phase를 닫으면서 `[~]`가 남는다. `rules/docs.md` §7: `[x]` + AC PARTIALLY MET + 형제 행, 또는 오너 결정 줄 |
| 7 | `cc.report.md` 14행, 352행 표 | 머리 칸 5개, 구분선 칸 4개 | Markdown 표 깨짐. 렌더러에 따라 열이 사라진다 |

## 5. 운영 probe (2026-10-14, `https://my.prettylog.com`, GET, 1.2 s 간격, 경로마다 `?cb=` 1회 + 없이 1회)

| 경로 | status | cf-cache-status |
| --- | --- | --- |
| `/`, `/@taeklim/posts`, `/@taeklim/projects`, `/@taeklim/about`, `/@taeklim/resume`, `/tags/rust`, `/robots.txt`, `/sitemap.xml` | 200 | MISS (새 `cb`) |
| `/nope`, `/@nope/x`, `/zzz/foo`, `/xmlrpc.php`, `/@taeklim/cc-nope-slug` | 404 | BYPASS |
| `/@taeklim/me`, `/@taeklim/saved` (익명) | 404 | DYNAMIC |

- 500 없음. 404는 엣지에 저장되지 않는다 (BYPASS, DYNAMIC). `u4o-prerender-errors.md` route 표(200 7, 404 8)와 어긋남 없음.
- 이 목록은 `cc.design.md` §7.3 smoke 15와 다르다. 308 경로 5개는 재지 않았다.

## 6. MVP ladder (L1–L4)

| ID | 검사 | 결과 |
| --- | --- | --- |
| L1 스키마 = 계약 하나 | `git diff --stat 19f5e31 main -- packages/types packages/db` 비어 있음. Phase PJ Constraints "스키마 변경 없음" 유지 | PASS |
| L2 mock 위에서 흐름 먼저 | 이 Phase는 mock이 없다 (`cc.plan.md` §1 "mock은 없다. 기다리는 backend가 없다"). MVP1 = flag off 운영 측정 | 해당 없음 |
| L3 mock 데이터 격리 | mock 없음 | 해당 없음 |
| L4 이전 phase exit 닫힘 뒤 열기 | M-CC2는 M-CC1 gate 2/2 PASS 뒤 열림 (#100). M-CC3는 M-CC2 exit(G-CC 판정, MVP2 보고) 미충족인 채 오너 결정 #106으로 열림. exit 완화는 오너 권한 (`rules/core.md` Decision hierarchy, Milestone 행) | PASS (오너 결정). 기록: 사전 등록 판정 없이 운영에 간 단위 = U4 |

- Phase 안에서 schema 외 운영 상태 변화: Cloudflare 한도 50 → 70 (#106, 오너). 저장 파일 없음.
- 설계 확인 요청 (system-architect, 열린 항목): `app/sitemap.ts:25`, `app/(shell)/[handle]/[slug]/opengraph-image.tsx:23`에 `export const revalidate = 86400`이 `cacheComponents: true` 아래 남아 있다. 두 파일 주석은 "BOTH knobs required"라 적는다. 앱 소스에 `'use cache'`가 0건이라 Next 안쪽 캐시는 없다. 두 경로는 Cloudflare 엣지가 저장한다 (`deploy/traffic/README.md` 88행). Next 16.2.9 소스에서 segment `revalidate`와 `cacheComponents`의 정적 충돌 문구는 찾지 못했다. 효과는 미확인이다. `u4o-prerender-errors.md`의 "Invalid revalidate configuration" 18줄은 Next `app-page.js` E22 (`revalidate < 1` throw, ISR 경로)이고, 메모대로 배포 전 줄이며 smoke 뒤 늘지 않았다.

## 7. 계층 검사 (H1, H2)

| ID | 검사 | 결과 |
| --- | --- | --- |
| H1 trace | Phase CC mission block은 Phase PJ block을 인용한다 (`00.plan.md` 289행). G-CC → S-CC (B, owner #85 Update) → M-CC1, M-CC2, M-CC3. 행 26개 모두 `→ M-CC1/2/3` 태그. 카운터: M-CC1 cycle 2/2, recovery 0/2. M-CC2 cycle 0/2, recovery 2/2 (#105 K4, #106 해제). M-CC3 0/2, 0/2. 분모 초과 없음. `budget:` 없음 | PASS. 문구 1: G-CC 라벨 "DRAFT, 오너 승인 대기" (§4 5번) |
| H2 결정 기록 | #82–#113 (커밋됨). 각 행에 Why = mission-block 줄, Rejected, Decided by, Evidence. 선택 지점(S-CC, U1 판정, U2 재설정, 404 방식, K3 정지, A-B-A, K4 해제, U5/U6 뺌, Phase 닫음)마다 행이 있다 | PASS |

작업 트리의 미커밋 편집 (검토 밖, 관찰만):

- `decisions.plan.md` +#114 "남은 행 7개를 오너가 닫는다". 본문은 "남은 열린 행: CC-QW1-2, CC-U7-2, CC-QW2-2, CC-N14 (오너 답 대기)"라 적는다.
- `00.tasks.md` diff는 행 **9개**를 `[x]`로 바꾼다: CC-U0b, CC-QW2-2, CC-U1a-2, CC-U1b-2, CC-U1c-2, CC-N11, CC-N14, CC-N15, CC-U4-2. #114 본문이 열린 채라 적은 CC-QW2-2, CC-N14도 닫혀 있다. 수(7 대 9)와 목록이 어긋난다.
- `cc.design.md` diff = §7.3 표 14번 기대 "로그인으로 redirect" → "404 (#89, 지금 주소 `/@u/saved`)" (CC-N14 AC1). 검토하지 않았다.
- `00.plan.md` Phase CC stub ("3 in progress, 11 open")은 diff에 없다. 같은 편집에서 stub를 고치는 규칙 (`rules/docs.md` §1 1번) 위반이 될 수 있다.
- 분류: 문서 → product-manager. 커밋 전에 맞춘다.

## 8. must-fix (실제 결함만)

| # | 결함 | 증거 | 분류 | 라우팅 |
| --- | --- | --- | --- | --- |
| 1 | `apps/dashboard_client_web/scripts/gen-public-paths.mjs` ESLint 경고 4 → `lint` exit 1 → `ci.yml` main 4회 연속 failure. 공통 ENG AC "lint 0" 미충족 | 로컬 lint 출력, `gh run view 38618670471 --log-failed` | 구현 | developer. 파일 1개만. 테스트 파일 금지 유지 |

## 9. 열린 항목 (결함 아님, 기록·확인)

| # | 항목 | 라우팅 |
| --- | --- | --- |
| 1 | §4 낡은 줄 1–7 (`00.tasks.md` 7행, `cc.report.md` 39·45행과 표 2개, `00.plan.md` M-CC2 exit 문구, G-CC 라벨, `[~]` 3행) | product-manager (N11은 sonnet-writer) |
| 2 | §7 미커밋 #114 편집의 수 불일치 (7 대 9)와 stub 미갱신 | product-manager |
| 3 | 저장 파일 없는 숫자 4종 (§3): VM 오류 로그 855/1134/43/8, `rate_limit` 0, Cloudflare 한도 70 | data-analyst (메모에 "저장 파일 없음" 표시, 또는 로그 조각 저장) |
| 4 | 판정 파일 `verdicts.json` 없음 (`rules/measurement.md` §4.1) | data-analyst |
| 5 | U4, U7 배포의 smoke 15 비교 기록 없음 (CM AC) | main session 또는 오너 결정 (#114가 덮는지 확인) |
| 6 | CC-U4 AC5 미충족: OG 제목 fetch에 `'use cache'` + `cacheTag` 없음, sitemap 안 미기록. U5/U6를 뺀 뒤 이 AC가 아직 유효한지 | system-architect (설계 줄 D26, D27 정리), product-manager (AC 정리) |
| 7 | `export const revalidate` 2곳이 `cacheComponents` 아래 남음. 효과 미확인 (§6) | system-architect |
| 8 | CC-U3 AC1 정규식이 `preloadProjectsTree` import와 `void` preload 호출에 걸린다 (literal 1, 의도 충족) | product-manager (AC 문구) |
| 9 | CC-QW1-2 AC2, CC-U7-2 AC1 (비공개 카테고리·draft 노출 확인) 미실행. #114는 오너 브라우저 확인 대기로 둔다 | 오너 |
| 10 | G-g, G-h, smoke가 U4 attempt 2, U7, U4 운영 run에서 미측정 (`00.runs.md` §2.1.1) | 오너 결정 #114가 덮으면 닫음 |
| 11 | U7 지표 출처가 등록된 `proxy.ts` 로그가 아니라 브라우저 `raw.jsonl` (`criteria.md` §3 7번) | system-architect (출처 확인 한 줄) |
| 12 | 하네스 v1/v2 재현 검사 없음 (`criteria.md` §3 8번, `rules/measurement.md` §2.4) | 기록만. Phase 닫힘 뒤 재측정 없음 (#114) |

## Sources

- [S-FR-1] lint, check-types 출력 | 로컬 실행 2026-10-14, main `12a4c64` | type: run-output | note: 전체 읽음
- [S-FR-2] CI 실패 로그 | `gh run view 38618670471 --log-failed` (ci.yml, `8b8dd39`) | type: run-output | note: lint step 줄 읽음
- [S-FR-3] run 폴더 | `deploy/traffic/review/cc/runs/` (U4 base v2, U4 f122265, ABA C1/T/C2, u4o, U5 6개, U7, U3 browser) `summary.csv`, `manifest.json`, `raw.jsonl` | type: run-output | note: 지표 행 grep, U5 p50은 node로 재계산, load-more 줄 수 재셈
- [S-FR-4] 판정 메모 | `deploy/traffic/review/cc/criteria.md`, `00.runs.md`, `u4-aba-verdict.md`, `u4o-prerender-errors.md`, `u5-ab.md`, `smoke-0ac938c.txt` | type: analysis | note: 전체 읽음
- [S-FR-5] 계획 문서 | `00.plan.md` Phase CC 절, `00.tasks.md` Phase CC 절 (870–1066행), `cc.plan.md`, `cc.report.md`, `decisions.plan.md` #82–#113, `01.status.md` 꼬리 | type: plan | note: 절 전체 읽음
- [S-FR-6] 운영 probe | `https://my.prettylog.com` 15 경로 GET, 2026-10-14 | type: run-output | note: status와 `cf-cache-status`만
- [S-FR-7] Next 소스 | `apps/dashboard_client_web/node_modules/next/dist/esm/build/templates/app-page.js` 993행 (E22), `dist/build/analysis/get-page-static-info.js` | type: code | note: grep만
- [S-FR-8] 앱 소스 grep | `apps/dashboard_client_web/app/(shell)/[handle]/[slug]/layout.tsx` 2, 39, 72행; `apis/getProjectsTree.api.ts` 29–31행; `next.config.ts` 53, 59행; `scripts/gen-public-paths.mjs` | type: code | note: grep만
