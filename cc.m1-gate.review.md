# Phase CC M-CC1 gate review (cycle 1/2)

> reviewer, 2026-10-14. 읽기 전용 검증이다. 고치지 않았다.
> 대상: `00.plan.md` Phase CC M-CC1 줄, `00.tasks.md` Phase CC 행 CC-U0a…CC-U3, 후속 행 QW1-2, QW2-2, U1a-2, U1b-2.
> 운영 배포 = `0ac938c` (U3). main HEAD = `787daed` (문서와 스크립트 v2만 뒤에 있음).
> 내 검사: `check-types` 0, `lint` 0, 운영 GET 11회 (1초 간격), 저장된 run 파일 읽기, git 시각.

## 0. 결론

**판정: ISSUE.** M-CC1 exit 4개 중 2개가 닫히지 않았다.

| exit 항목 (`00.plan.md:292`) | 판정 | 근거 |
| --- | --- | --- |
| W1–W4가 운영에서 돈다 | PASS | U2, U3 브라우저 run 각 3회가 네 walk를 돌았다 (`runs/*_U2_u2_c26c69d_browser`, `*_U3_u3_0ac938c_browser`) |
| 가드 G-a…G-l 통과 | ISSUE | 측정된 가드는 모두 통과. G-g, G-h, G-l(B1, B3, C5, C6, D2), smoke 15개는 어느 단위에도 기록이 없다. 기준선 `smoke.txt`가 없다. 미측정은 통과가 아니다 |
| 단위마다 주 지표 판정이 `00.runs.md`에 있음 | ISSUE | 대장은 11행에서 멈췄다 (U2 curl 1 "pending"). U2 PASS, U3 FAIL은 `01.status.md` 88–89행과 커밋 메시지에만 있다. run 폴더 7개가 행이 없다 |
| 단계 보고가 `cc.report.md` "MVP1"에 있음 | ISSUE | 파일이 없다 (CC-U3 AC8) |

```
exit 4개:  W1–W4 운영 ████ PASS | 가드 전부 ░░░░ ISSUE | 00.runs.md 판정 ░░░░ ISSUE | cc.report.md ░░░░ ISSUE
```

- 코드와 운영은 건강하다. 문서와 대장이 뒤처졌다. 측정 안 한 가드가 남았다.
- 사전 등록 규칙 위반으로 판정이 뒤집힐 단위는 없다. 시각 어긋남 2건은 §4에 기록했다.

## 1. 반드시 고칠 것 (must-fix)

| # | 항목 | 닫는 조건 | 담당 | 분류 |
| --- | --- | --- | --- | --- |
| M1 | `cc.report.md` "MVP1" 절이 없다 | 단위 U0a, U0b, QW1, QW2, U1a, U1b, U1c, U2, U3 각각 단계 보고 1개 (What, Why, Input, Output, Result, Status, 그림 1, 표 1). 맨 위 요약에서 링크. 숫자는 저장 파일에서 읽는다 | main session이 `sonnet-writer` dispatch (출처 = run 폴더, `criteria.md`, `00.runs.md`) | implementation |
| M2 | `00.runs.md`에 U2, U3 행과 판정이 없다 | run 폴더 7개 행 추가: `*_U2_u2_{2,3}_c26c69d`, `*_U2_u2_c26c69d_browser`, `*_U3_u3_{1,2,3}_0ac938c`, `*_U3_u3_0ac938c_browser`. 11번 행(U2 curl 1)을 완료로 정정 (manifest 있음). §2 판정 요약에 U2 PASS (1 1 1 → 0 0 0, 판정선 1, 간격 8.25–8.30 s), U3 FAIL (317 → 174, 판정선 192, 가드 통과로 유지) 행. QW1, QW2 행에 가드 칸 채움 | `data-analyst` | reasoning (대장) |
| M3 | 가드 G-g, G-h, G-l, smoke 15개가 어느 단위에도 없다 | (a) G-h: 저장된 `raw.jsonl`에서 같은 URL의 prefetch `_rsc`와 이동 `_rsc` 값이 다른지 읽는다 (새 트래픽 없음). (b) G-l D2: `prefetch=` 수 13 (오늘 grep)을 기준선 커밋 `19f5e31`과 비교. B1, B3: `Promise.all` 0건 (오늘 확인, PASS). C5, C6: 코드 grep 1회. (c) smoke 15개 (`cc.design.md` §7.3): 기준선 `smoke.txt`가 없다. `0ac938c`의 값을 기준선으로 삼을지는 pm과 architect가 정한다. 정하면 그 값을 저장한다. (d) G-g: 로그인 스크립트로 비공개 글 1개를 익명 요청 → 404 확인. 결과 파일 경로를 `00.runs.md`에 적는다 | main session (측정), `data-analyst` (기록) | reasoning (측정) |
| M4 | CC-U3 AC2 미충족이 행에 적혀 있지 않다. `[slug]/layout.tsx:40–46`이 `await auth()` + `await getPostBySlug(slug, token)`를 layout 맨 위에 둔다. page에 `void getPostBySlug` 없음. §3.1 규칙 "layout의 데이터 읽기는 Suspense 잎으로"와 어긋난다 (U3 전부터 있던 코드, U3가 유지함. 주석: 404 status 경계) | pm이 CC-U3를 `AC PARTIALLY MET (AC2)`로 적고 남은 일을 CC-U4 선행 행으로 연다. architect가 §18(실제 404 vs soft 404)에서 이 읽기의 자리를 정한다. 오너의 2026-10-14 실제 404 결정과 충돌하면 오너에게 묻는다 | `product-manager` (행), `system-architect` (§18) | ladder L1 (M-CC2 차단, M-CC1 폐쇄는 막지 않음) |
| M5 | U1 판정 "선택지 B"를 main session이 골랐다 (`01.status.md:87`). `u1-verdict.md` §5.4는 오너 몫으로 적었다. `DECISIONS.md` 행이 없다 (#96 뒤 행 없음) | `decisions.plan.md`에 #97 행: U1 = 판정 없음(B), Why = M-CC1, Rejected = A(운영 재배포 2회), Decided by = main session, 오너 확인 요청 문구. `01.status.md`에 D-id 한 줄 | `product-manager`, 오너 확인 | hierarchy H2 |
| M6 | `00.plan.md:292` M-CC1 줄이 `cycle 0/2`다. 이 gate가 cycle 1이다 | `cycle 1/2`로 올린다 (`recover` step 3). 이 파일 경로를 Gating fact에 적는다 | `product-manager` | hierarchy H1 |
| M7 | `00.tasks.md:943` CC-U1c가 `[ ]`다. 코드는 `e05cec6`, 배포 `3596e4c`, 측정 `u1-verdict.md`에 있다 | CC-U1c를 `[x]`로 (AC1, AC1b, AC2 grep PASS 오늘 확인). AC1c, AC3, AC4, AC5 중 미측정 항목은 CC-U1b-2에 합치거나 CC-U1c-2로 연다 | `product-manager` | hierarchy H1 (행 상태) |

## 2. 고치면 좋은 것 (nice-to-fix)

| # | 항목 | 사실 | 담당 |
| --- | --- | --- | --- |
| N1 | G-CC가 DRAFT다. 날짜 없음, 판정선 숫자 없음 | `rules/docs.md` §0.1: 날짜 없는 수치 goal은 vision이다. M-CC1은 막지 않는다. **M-CC2(U4)의 주 지표가 G-CC라 U4 전에 필요하다.** 기준값은 이제 있다: U3 뒤 auth expanded s2–s6 합 343 ms (338–348), 판정선 max(20, 34.3) = 34.3 ms | 오너 (pm이 초안 전달) |
| N2 | CC-U0a AC2 문구와 코드가 다르다 | 로거 키 = `severity, message, time, method, path, status, ms, auth` (`utils/ssrFetchLog.util.ts:16–25`). AC는 "키는 `message, path, status, ms`뿐"이다. 비밀은 없다 (token, cookie, header 0). 로거 위치도 `http.server.ts`가 아니라 util이다. AC를 코드에 맞게 고친다 | `product-manager` |
| N3 | CC-QW2 AC4 둘째 절 `useSyncExternalStore` 0건 | 구현은 jotai atom + `<html data-rail>` 속성 읽기 (`store/layout.atom.ts`). 판정 (1)은 참 3/3이므로 동작은 맞다. AC 문구만 틀렸다 | `product-manager` |
| N4 | CC-U3 AC6 산출물 위치 | `runs/<T>_u3-flagon-build/errors.txt`가 없다. 같은 내용이 `deploy/traffic/review/cc/u4-preview.md`에 있다 (run 3개, 오류 목록). 행에 그 경로를 적는다 | `product-manager` |
| N5 | CC-U2 AC3 고의 확인 (좋아요 → 10초 안 재클릭) 기록 없음 | 되돌림 조건이 아니다. 기록 또는 "안 함" 한 줄 | main session |
| N6 | CC-U0b가 `[ ]`다. AC3("criteria.md 커밋이 QW1 배포보다 앞")은 이제 불가능하다 | `criteria.md`가 그 사실을 머리 메모에 적었다. 행을 `AC PARTIALLY MET (AC3 불가)`로 닫고, 남은 AC2b, AC4를 후속 행으로 | `product-manager` |
| N7 | 하네스 `CODE_VERSION`이 모든 run에서 `v1`, code_sha는 5가지. 재현 검사 없음 (`rules/measurement.md` §2.4) | `787daed`가 v2로 올렸다. `CHANGELOG.md` 한 줄과, v1 run과 v2 run을 같은 표에서 비교할 때의 표시 규칙이 필요하다 | `developer`, `data-analyst` |
| N8 | QW1 집계 규칙(§14.2)이 QW1 비교 run 뒤에 커밋됐다 | §4 표 참고. 판정은 바뀌지 않는다 (범위 0, 19 → 13) | 기록만 |
| N9 | `app/ResumePage.tsx` 죽은 사본 (import 0) | U3 행이 보고만 하기로 했다. 오너 삭제 대상 | 오너 |
| N10 | CC-U1c AC3 "프로필 카드가 표지 요소보다 앞" | 스트리밍 HTML은 바이트 순서가 렌더 순서가 아니다. HTML로 판정할 수 없다. 브라우저 DOM 검사로 바꾼다 | `product-manager` |

## 3. 단위별 AC 검사

경로 기호는 `00.tasks.md` Phase CC 머리와 같다. "오늘 grep" = main HEAD `787daed`.

### 3.1 CC-U0a 계측 (행 `[~]`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1 | PASS | `instrumentation-client.ts` 3, 6, 17행: `[nav]`, `onRouterTransitionStart`, `navTiming` |
| AC2 | PASS (문구 어긋남, N2) | `ssr_fetch` 줄은 `utils/ssrFetchLog.util.ts`가 쓰고 `http.server.ts:25`가 쓴다. token, cookie, header 키 0 |
| AC3 | PASS | `_scripts/perf/cc-measure.mjs`, `cc-browser.mjs` 있음. 비밀 문자열 0 (env만) |
| AC4 (대체) | PASS | `const CODE_VERSION` 각 1 (`v2`, 787daed) |
| AC5 | PASS | 단위 행 9, `G-` 행 13, `w1_s6_home_rsc_nonprefetch` 있음 |
| AC6 | PASS | `check-types` 0, `lint` 0 (오늘 실행) |
| AC7 | PASS | `[nav]` 5줄/run (`nav.log` 60줄 = 4 그룹 × 3 run × 5). `ssr_fetch` 줄은 `blog-web-log.json`에 있음 (기준선, QW1 폴더) |

### 3.2 CC-U0b 기준선 (행 `[ ]`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1 | PASS | 폴더 3개, 필수 파일 있음. `web_sha`는 dispatch 기록 (`00.runs.md` 2–4행) |
| AC1b | PASS | QW1 run부터 `web_sha`, `unit`, `harness_sha`, `rail_aside_class_*`, `rail_width_same` 있음 (U2, U3 manifest 확인) |
| AC2 | PASS | 브라우저 기준선 1폴더 run 3개, 지표 그룹 4개, `[nav]` 있음. `text/x-component` 바이트 열은 after-QW부터 있음 |
| AC2b | PASS | 세 폴더에 `blog-web-log.json`, `ssr_fetch_summary.txt` |
| AC3 | ISSUE (불가) | `criteria.md` 첫 커밋 `42d518c` 07:02:53Z. QW1 커밋 `61d48bc` 05:31Z, 배포는 그 뒤 (시각은 저장 파일에 없음). 머리 메모가 사실을 적었다 (N6) |
| AC4 | ISSUE | `00.runs.md` 기준선 행에 D1 재현, load-more `DYNAMIC`, 404 3개는 있다. `/@taeklim/about-me` status 칸 없음 |
| AC5 | PASS | `baseline.md` §2.2: 범위 ≤ 중앙값 50 % 모두 통과 |

### 3.3 CC-QW1 (행 `[x]`, 배포 `61d48bc`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1–AC5 | PASS | 오늘 grep: `<Suspense fallback={<CommentsSkeleton />}>` 134행, `cache(` 4파일, `FilterChipRowLeaf` 104행, `CategorySidebarWrapper` 96행 Suspense 안, `x_post.action.ts` 있음, `loadMorePosts` 0 |
| AC6 | PASS | 오늘 check-types 0, lint 0 (HEAD 기준. 61d48bc 기준 GH 로그 링크는 CC-QW1-2) |
| AC7 | ISSUE | 로그인 비공개 카테고리 확인 기록 없음 (CC-QW1-2 AC2) |
| AC8 CM | PASS (판정) / ISSUE (가드 칸) | 19 → 13, 범위 0, 판정선 2, 통과 (`criteria.md` §1). `/posts/slug/` 줄 = 1. 가드 G-a…G-l 각각과 smoke는 `00.runs.md`에 없음 |

### 3.4 CC-QW2 (행 `[x]`, 배포 `61d48bc`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1, AC2 | PASS | `BlogShell.server.tsx` 없음(ContentFrame으로 대체). `useHydrateAtoms` 사용 0 (주석 1), `initialCollapsed` 0 |
| AC3 | PASS | `app/layout.tsx:121–122` `data-rail`, `railCollapsed`. 스크립트 = `components/shell/railInitScript.ts` |
| AC4 | PASS (문구 어긋남, N3) | `in-data-[rail=collapsed]` 변형 사용 (`LeftRailAside.client.tsx`, `LeftRail.client.tsx`). `useSyncExternalStore` 0 |
| AC5 | PASS | 쿠키 이름 `railCollapsed`, 값 `1`/`0` (`store/layout.atom.ts`) |
| AC6 | PASS | `seeds expanded` 0. 공통 ENG AC 0, 0 |
| AC7 | 판정 미완 | (1) 참 3/3 (QW1, U2, U3 curl run 모두 `rail_width_same: true`). (3) 참 (hydration 0, U2, U3 run 12 세션). (2) 첫 paint 스크린샷 없음 (CC-QW2-2) |

### 3.5 CC-U1a, CC-U1b (행 `[x]`, 배포 `df11372` → 운영 `3596e4c`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| U1a AC1–AC3 | PASS | `@/app/[handle]` import 0. `app/[handle]/components/` 없음. `components/projects/` 11파일 (9 + U3의 2) |
| U1a AC4 | 일부 | 운영 GET 오늘: `/@nouser/posts` 404, `/@taeklim/about-me` 404 (BYPASS). smoke 15개 전체는 미측정 (CC-U1a-2) |
| U1b AC1–AC6 | PASS | `(shell)/layout.tsx` 있음, `(feed)`, `[handle]` 그 아래. `RailFrame` 사용 = `(shell)/layout.tsx` 1개. `BlogShell` 0 (test 제외). `railVisibility` 1, `RESERVED_HANDLE_SEGMENTS` import, react import 0. `RailContextPublisher` 정의 1 + `RightRailSwitch` 사용 1. `(shell)/loading.tsx`, `not-found.tsx` 없음 |
| U1b AC7 CM | ISSUE | 주 지표 판정 불가 (`u1-verdict.md`): 기준 run 1개, rail 조각 크기 R 미측정, 바이트가 null을 0으로 셈. 가드 G-a, G-b, G-f 통과. 왼쪽 rail: 오늘 GET에서 200 페이지 7개 모두 `<aside>` 1, 404 페이지 0 |

### 3.6 CC-U1c (행 `[ ]`, 코드 `e05cec6`, 배포 `3596e4c`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1 (#94) | PASS | `<HomeRightRail` = `(feed)/layout.tsx`, `[handle]/(rail)/layout.tsx` 2개. `<UserContextRail` = `[slug]/layout.tsx` 1개. `(rail)` 아래 `PopularTags` 0. `(rail)/posts`, `projects`, `saved` 있음. 옛 자리 없음 |
| AC1b | PASS | `(rail)/layout.tsx:28` `notFound()`. posts layout에 `notFound`, `ContentFrame`, `UserContextRail` 0. `x_layout.tsx` 2개 있음, 옛 `layout.tsx` 없음. `PostsProfileSlot.client.tsx` 있음. `isPostsPath` 27행. `[handle]/(posts|projects|saved)` 참조 0 (주석 3줄만) |
| AC1c | PASS | `/@nouser/posts` 404 (오늘 GET). `/@taeklim/projects` HTML에 프로필 카드: HTML 바이트 순서로 판정 불가 (N10) |
| AC2 | PASS | `data-right-rail="shared"` `HomeRightRail.server.tsx:22`. check-types 0, lint 0 |
| AC3 | PASS (익명 부분) | 오늘 GET `data-right-rail="shared"` 수: `/` 1, `/tags/rust` 1, `/@taeklim/posts` 1, `/@taeklim/projects` 1, `/@taeklim/projects/cnn-from-scratch` 1, `/@taeklim/<S>` 0, `/@taeklim/about` 0. 인기 태그 제목 문구는 `/`, posts, projects에서 같은 수 (i18n 번들 포함)라 posts 전용 절 없음. `/@taeklim/saved`, `/@taeklim/me` 로그인 값은 미측정 |
| AC4, AC5 | 미측정 | HTML 구조 비교와 G-k(`/?cb=` 쿠키 유무 비교)는 U1 뒤 기록 없음. G-k 자체는 U2, U3 curl run이 참 3/3 |

### 3.7 CC-U2 staleTimes (행 `[~]`, 배포 `c26c69d`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1 | PASS | `next.config.ts:55` `staleTimes: { dynamic: 30 }`. `static:` 0 |
| AC2 (#96) | **PASS** | 기준 = U1 브라우저 run anon expanded `w1_s6_home_rsc_nonprefetch` 1 1 1 (범위 0). U2 뒤 0 0 0. 판정선 max(0, 1) = 1. 감소 1 ≥ 1. 유효 조건: s1 document → s6 첫 요청 간격 8.27, 8.30, 8.25 s (`raw.jsonl` `at` 차, run 1–3) < 25 s. `w2_back3_rsc` 0 유지. 로그인 팔도 1 → 0 (기록만). 결과 폴더 경로가 행에 없다 (M2) |
| AC3 | ISSUE | 고의 확인(좋아요, 제목 수정 재클릭) 기록 없음 (N5). 되돌림 조건 아님 |

### 3.8 CC-U3 잎 정리 (행 `[~]`, 배포 `0ac938c`)

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1 | PASS | layout에 `getProjectsTree` 0 (`preloadProjectsTree` void 호출만). `RightRailSwitch` 정의 1 + 사용 1, `<Suspense fallback={<RailCardSkeleton />}>` 안 |
| AC2 | **ISSUE** | page에 `void getPostBySlug` 0. page 맨 위 `auth(`, `cookies(`, `headers(` 0은 참. 그러나 layout 40–46행이 `await auth()`와 `await getPostBySlug(slug, token)`를 맨 위에 둔다 (U3 전 `c26c69d`에도 35, 40행에 있었다). 설계 C4 "token 읽기는 잎 안"과 §3.1 layout 규칙에 어긋난다 (M4) |
| AC3 | PASS | `[slug]/layout.tsx:63–66`, `(rail)/posts/layout.tsx:21–22` 모두 `<Suspense>` 바로 안 |
| AC4 | PASS | `resume/page.tsx` `new Date()` 0. `LastUpdatedDate.client.tsx` 1개. 죽은 사본 `app/ResumePage.tsx` 있음 (N9) |
| AC5 | PASS | `.github/workflows/cc-build.yml`: `workflow_dispatch` 6행, ssh/scp/rsync/release.sh 0, flag는 runner 안 `sed`만. `next.config.ts`에 `cacheComponents` 0 |
| AC6 | 일부 | 잡 3회 실행 기록 = `u4-preview.md` (flag off 통과는 기록 없음, flag on 오류 목록 있음). `runs/<T>_u3-flagon-build/errors.txt` 없음 (N4) |
| AC7 CM | **FAIL (사전 등록 그대로, 코드 유지)** | 기준 = U2 뒤 auth expanded `w1_s5_post_nav_ms` 317 / 403 / 307 → 317, 범위 96. 판정선 max(192, 31.7) = 192. U3 뒤 176 / 174 / 169 → 174. 감소 143 < 192. 실패 조건 "미달이면 효과 없음, 가드 통과면 남긴다"대로 처리됐다. 기록만: s2–s6 합 527 → 343, 익명 s5 73 → 45. 판정이 `00.runs.md`에 없다 (M2) |
| AC8 (exit) | **ISSUE** | `cc.report.md` 없음 (M1) |

### 3.9 후속 행 (QW1-2, QW2-2, U1a-2, U1b-2)

- 넷 모두 `[ ]`다. 내용은 위 표의 "기록 없음" 항목과 같다.
- 넷이 닫히지 않으면 exit "가드 통과"와 "00.runs.md 판정"도 닫히지 않는다.

## 4. 사전 등록 규칙 검사 (`rules/measurement.md` §1)

**무엇을 알려고 쓰나:** 지표나 공식을 비교 run 뒤에 바꾼 단위가 있는가.

| 단위 | 지표 고정 커밋 (UTC) | 비교 run 시작 (UTC) | 순서 | 판정 |
| --- | --- | --- | --- | --- |
| QW1 공식 | #88 `19f5e31` 05:00:46 | 05:38 | 전 | PASS |
| QW1 집계 규칙 §14.2 | `3b0201f` 05:51:55 | 05:38–05:46 (QW1 curl 1–3) | **뒤** | 기록 (N8). 공식은 안 바뀜. 범위 0이라 판정 불변 |
| QW2 | #88 05:00:46 | 05:38 | 전 | PASS |
| U1 | #88 + #94 (`3b0201f` 05:51:55) | 05:57 | 전 | PASS. 판정은 불가 (측정 결함) |
| U2 지표 교체 §16, #96 | §16 `3b0201f` 05:51:55. #96 행 `37b069d` 06:53:14 | 코드 `c26c69d` 06:06:26. 브라우저 07:06:08 | §16 전. #96은 코드 뒤, 판정 run 전 | PASS (§1). 설계 사전 등록은 코드 전이다. 결정 행 #96은 코드 커밋 뒤, 판정 run 전이다. `rules/core.md` "Log first" 어긋남 (H2 기록, 차단 아님) |
| U3, U4 지표 교체 §17, #88 Update 2 | `2167e7a` 07:04:27, `4695596` 07:06:04 | U3 기준 run 07:06:08, U3 run 07:32:07 | 전 | PASS. 기준선 데이터(U1 run)를 본 뒤 지표를 바꿨다. 처치 run 전이라 허용. 사실을 적는다 |
| `criteria.md` 자체 | `42d518c` 07:02:53 | QW1, U1, U2 배포 뒤 | 뒤 | 늦은 사본. 원본 사전 등록은 `decisions.plan.md`다. 머리 메모가 사실을 적었다 |

- 판정을 뒤집는 위반은 없다.
- U3 FAIL은 공식대로다. 범위 96이 커서 판정선 192가 효과 143보다 크다. 손으로 줄이지 않았다. 맞다.

## 5. 가드 표 (단위별, 측정 또는 미측정)

| ID | 기준선 | QW1 (`61d48bc`) | U1 (`3596e4c`) | U2 (`c26c69d`) | U3 (`0ac938c`) | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| G-a | anon 23, auth 38 | 23 / 37 | 최대 36 | 22 / 35 | 22 / 35 | PASS (한도 27.6, 45.6) |
| G-b | anon 2, auth 5 | 2 / 5 | 2 / 2 | 2 / 2 | 2 / 2 | PASS |
| G-c | 0 FAIL ×3 | 0 FAIL ×3 | 미측정 (curl run 없음) | 0 FAIL ×3 | 0 FAIL ×3 | PASS (U1 빈칸) |
| G-d | 0 | 0 | 미측정 | 0 | 0 | PASS. 오늘 GET 11개 `set-cookie` 0 |
| G-e | 404, 404 | 404 ×3 | 미측정 | 404 ×3 | 404 ×3 | PASS. 오늘 `/@nouser/posts` 404 |
| G-e2 | 404 | 404 | 미측정 | 404 | 404 | PASS. 오늘 `/@taeklim/about-me` 404 BYPASS |
| G-f | 0 | 0 | 0 | 0 (12 세션) | 0 (12 세션) | PASS |
| G-g | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | **미측정** (M3) |
| G-h | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | **미측정**. `raw.jsonl`로 계산 가능 (M3) |
| G-i | 52.9 % | 53.8 % | 미측정 | 53.8 % | 53.9 % (24h 최대 56.7 %) | PASS (< 80 %) |
| G-j | 19 | 13 | 미측정 | 미측정 | 미측정 | **U1 뒤 미측정** (`blog-web-log.json` 없음). M3에 넣는다 |
| G-k | 거짓 (정상) | 참 3/3 | 미측정 | 참 3/3 | 참 3/3 | PASS |
| G-l | D3 PASS | D3 PASS | 미측정 | 미측정 | 미측정 | **일부**. 오늘 grep: B1, B3 `Promise.all` 0 PASS. D2 `prefetch=` 13 (기준 없음). C5, C6 미확인 |
| smoke 15 | `smoke.txt` 없음 | 없음 | 없음 | 없음 | 없음 | **미측정**. 오늘 route 표 11개는 기대와 같음 |

오늘 운영 GET (`?cb=` 새 값, 1초 간격, 11회):

| 경로 | status | cf | right-rail shared | left aside |
| --- | --- | --- | --- | --- |
| `/` | 200 | MISS | 1 | 1 |
| `/tags/rust` | 200 | MISS | 1 | 1 |
| `/@taeklim/posts` | 200 | MISS | 1 | 1 |
| `/@taeklim/projects` | 200 | MISS | 1 | 1 |
| `/@taeklim/projects/cnn-from-scratch` | 200 | MISS | 1 | 1 |
| `/@taeklim/<S>` | 200 | MISS | 0 | 1 |
| `/@taeklim/about` | 200 | MISS | 0 | 1 |
| `/@taeklim/about-me` | 404 | BYPASS | 0 | 0 |
| `/@nouser/posts` | 404 | BYPASS | 0 | 0 |
| `/@taeklim/me` (익명) | 404 | DYNAMIC | 0 | 0 |
| `/@taeklim/saved` (익명) | 404 | DYNAMIC | 0 | 0 |

## 6. MVP 사다리 (`.claude/CLAUDE.md` "System build phasing")

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| L1 스키마 하나 | **ISSUE** | MVP1 계약 = §3.1 배치 규칙 + §7.2 캐시 지도 (§7.1). `[slug]/layout.tsx`가 layout 맨 위에서 `auth()`와 글 읽기를 await한다. §3.1 "layout의 데이터 읽기는 Suspense 잎으로"를 만족하지 않는다. `u4-preview.md`가 같은 종류의 오류를 `/tags/[tag]`, `/log/[username]/[logId]`에서 이미 보였다. → `system-architect` (§18). U4가 이 모양 위에 flag를 켜면 안 된다 (M4) |
| L2 mock 전 pipeline 없음 | PASS | mock이 없다 (§7.1). MVP2 코드(`cacheComponents: true`)는 branch `cc-u4`, `cc-u4-soft404`에만 있다. main과 운영에는 없다 (`next.config.ts` grep 0) |
| L3 mock 격리 | PASS (해당 없음) | mock 데이터가 없다 |
| L4 이전 단계 exit 닫힘 | PASS | Phase PJ P1 gate PASS cycle 2/2 (2026-10-14, `pj.p1-gate.review.md`). M-CC2는 열리지 않았다 (branch만). 열림 조건 = 이 gate PASS |

## 7. 계층 검사 (`rules/core.md` "Decision hierarchy", `rules/docs.md` §0.1, §8)

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| H1 mission block | PASS | `00.plan.md:287–295` 블록 있음. `cc.design.md` §0 인용 블록 있음 |
| H1 행 태그 | PASS | Phase CC 17행 모두 `→ M-CC1/2/3` |
| H1 milestone → strategy → goal | PASS (G-CC DRAFT) | `M-CC1 → S-CC → G-CC`. G-CC는 DRAFT, 날짜 없음 (N1) |
| H1 cycle 카운터 | **ISSUE** | `cycle 0/2; recovery 0/2`. 이 gate = cycle 1 (M6). `budget:` 없음 |
| H2 결정 기록 | **ISSUE** | #82–#96 모두 행과 Why가 있다. U1 "선택지 B" (main session, `01.status.md:87`)는 행이 없다 (M5). #96 행은 U2 코드 커밋 뒤에 적혔다 (§4, 기록만) |

## 8. U4 맥락 (판정 밖)

- branch `cc-u4`, `cc-u4-soft404`가 있다. 이 gate는 보지 않았다.
- soft 404는 오너의 2026-10-14 실제 404 결정(#89, PJ-1-35)과 충돌한다. architect §18이 정한다.
- U4 비교 기준은 U3 뒤 auth expanded `w1_nav_ms_s2_s6` 343 ms (338–348, 범위 10). 판정선 max(20, 34.3) = 34.3 ms. `01.status.md:89`에만 있다. `criteria.md` U4 행 갱신은 M2와 함께.

## Sources

- [S-GATE-1] 운영 GET 11회 | `https://my.prettylog.com` (`?cb=gate<HHMMSS>`) | published: 2026-10-14 | accessed: 2026-10-14 | type: measurement | note: status, cf-cache-status, set-cookie, marker counts. 본문은 scratchpad에만 저장
- [S-GATE-2] U2, U3 run 폴더 | `deploy/traffic/review/cc/runs/*_U2_u2_*`, `*_U3_u3_*` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: manifest guards, summary.csv rows, browser_summary.txt, raw.jsonl `at` 차, vm.txt, traffic-check.txt
- [S-GATE-3] 기준선, QW1, U1 run 폴더 | `deploy/traffic/review/cc/runs/*baseline*`, `*_QW1_*`, `*_U1_*` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: `baseline.md`, `u1-verdict.md`, `criteria.md`, `00.runs.md` 경유 + summary.csv 행 grep
- [S-GATE-4] 판정 기준과 대장 | `deploy/traffic/review/cc/criteria.md`, `00.runs.md`, `baseline.md`, `u1-verdict.md`, `u4-preview.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full read
- [S-GATE-5] 계획과 결정 | `00.plan.md` 285–300행, `00.tasks.md` 869–1000행, `cc.plan.md`, `cc.design.md` §3.1, §5, §7, §14–§17, `decisions.plan.md` #82–#96, `01.status.md` 73–89행 | published: 2026-10-14 | accessed: 2026-10-14 | type: plan | note: full read of named sections
- [S-GATE-6] git 시각 | `git log --format='%h %cI'` (main), `git show 0ac938c --stat`, `git show c26c69d:[slug]/layout.tsx` | published: 2026-10-14 | accessed: 2026-10-14 | type: vcs | note: 시각은 -05:00을 UTC로 바꿔 적었다
- [S-GATE-7] 정적 검사 | `pnpm --filter dashboard_client_web check-types`, `lint` | published: 2026-10-14 | accessed: 2026-10-14 | type: build | note: exit 0, 0 (main HEAD 787daed)

---

# Cycle 2/2 (2026-10-14, reviewer)

> 읽기 전용 재검증이다. 고치지 않았다. 대상 = cycle 1 must-fix M1–M7과 exit 4개.
> main HEAD = `8517aa8`. 운영 배포 = `0ac938c` (U3). `git diff --stat 0ac938c HEAD -- apps/dashboard_client_web` = 빈 출력. 작업 트리 grep은 배포 코드에 그대로 적용된다.
> 내 검사: `check-types` exit 0, `lint` exit 0, 운영 GET 10회 (1초 간격, `?cb=g2031353`), 저장 파일 읽기, git grep, G-h 직접 계산.

## C2.0 결론

**판정: PASS.** M-CC1 exit 4개가 모두 닫혔다. must-fix 7개 중 7개가 실질로 닫혔다. 기록 결함 2건(M1 보고서 낡은 줄, M3 대장 미기재)이 남는다. 둘 다 판정 숫자를 바꾸지 않는다. 아래 "고치면 좋은 것"으로 넘긴다.

```
exit 4개:  W1–W4 운영 ████ PASS | 가드 전부 ████ PASS | 00.runs.md 판정 ████ PASS | cc.report.md ████ PASS
must-fix:  M1 PASS* | M2 PASS | M3 PASS* | M4 PASS | M5 PASS | M6 PASS | M7 PASS      (* = 기록 보완 남음)
```

| exit 항목 (`00.plan.md:292`) | cycle 1 | cycle 2 | 근거 |
| --- | --- | --- | --- |
| W1–W4가 운영에서 돈다 | PASS | PASS | 변동 없음. U2, U3 브라우저 run 각 3회 (`00.runs.md` 14, 18행) |
| 가드 G-a…G-l 통과 | ISSUE | **PASS** | §C2.2 가드 표. G-g, G-h, G-j, G-l, smoke 15개가 이제 측정됐다. 모두 통과 |
| 단위마다 주 지표 판정이 `00.runs.md`에 있음 | ISSUE | **PASS** | `00.runs.md` §1 행 12–19, §2 판정 행 QW1, QW2, U1, U2, U3, U4 기준 |
| 단계 보고가 `cc.report.md` "MVP1"에 있음 | ISSUE | **PASS** | 단위 9개 절 + U4 대기 절. 각 절에 What, Why, Input, Output, Result, Status, 표 1, 그림 1. 요약 표가 절로 링크 |

- cycle 1 §3.9의 문장 "넷(QW1-2, QW2-2, U1a-2, U1b-2)이 닫히지 않으면 exit 둘도 닫히지 않는다"를 고쳐 읽는다. 그 행들은 가드 기록을 담는 자리였다. 가드 기록은 지금 `00.runs.md` §2.1과 `smoke-0ac938c.txt`에 있다. 행에 남은 것은 단위 AC(로그인 확인, 스크린샷, 문구)다. exit 문장에 없다. 그래서 exit를 막지 않는다. 단, CC-QW1-2의 QW1 AC7(로그인 비공개 카테고리 확인)은 정확성 무게가 있다. "기록 마무리"로 묻히면 안 된다 (N12).

## C2.1 must-fix 재검증

| # | cycle 1 항목 | 판정 | 근거 (저장 파일, 오늘 확인) | 남는 것 |
| --- | --- | --- | --- | --- |
| M1 | `cc.report.md` "MVP1" 절 | **PASS** (구조) | 파일 344줄, 커밋 `063a117`. 요약 표 10행이 절로 링크. 단위 9개 절마다 필드 7개, ASCII 그림 1, 표 1 이상. 숫자는 run 폴더와 `criteria.md`, `00.runs.md` 값과 일치 (QW1 19 → 13, U2 1 1 1 → 0 0 0, U3 317 → 174, 판정선 192) | 낡은 줄: 보고서가 `00.runs.md` 갱신(`8517aa8`) 전에 커밋됐다. "열린 것" 절의 "G-g, G-h, G-l, smoke 기록 없음", "`00.runs.md`는 11행에서 멈췄다"는 지금 거짓이다. `[확인 필요]` 3개가 남아 있다. U2 간격 값 충돌은 `00.runs.md` 14행이 푼다 (익명 8.25–8.30 s, 로그인 9.14–9.40 s. `01.status.md`의 8.2–9.5는 두 팔을 합친 값). G-j 판정 칸은 §2.1에 통과로 있다 → N11 |
| M2 | `00.runs.md` U2, U3 행과 판정 | **PASS** | §1 행 12–19 (run 폴더 7개 + U4 v2 기준). 11행 "pending" → 완료로 정정, 정정 사유 적음. §2 판정 행: U2 통과 (1 → 0, 판정선 1, 간격 8.25–8.30 s), U3 미달·유지 (317 → 174, 판정선 192). §2.1 단위별 가드 표에 QW1 열(QW2 포함) 채움 | 없음 |
| M3 (a) G-h | prefetch와 이동의 `_rsc` 값 | **PASS** | `00.runs.md` §2.1 "G-h 계산": 폴더 6개, 이동 359건, 키 12개, prefetch 겹침 0. 내 재계산 (U3 브라우저 `raw.jsonl`): 이동 52건, 이동 키 5개, prefetch 키 9개, 겹침 0 | 없음 |
| M3 (b) G-l | B1, B3, C5, C6, D2, D3 | **PASS** | git grep 오늘: `prefetch=` 13줄, sha 6개 모두 (`19f5e31`, `61d48bc`, `3596e4c`, `c26c69d`, `0ac938c`, HEAD) 동일 → D2 회귀 없음. `Promise.all` 0, sha 6개 모두 → B1, B3. C6 `initialData` hook 4개 (`useComments`, `useLogStream`, `useLogGlobalStream`, `useLogThread`). C5 오늘 GET: 글 상세 HTML에 "Rules Written First" 14회, 댓글 표지 있음, 홈 글 링크 14개. D3 curl 12폴더 PASS (대장) | 없음 |
| M3 (c) smoke 15 | 기준선 없음 | **PASS** (측정) | `smoke-0ac938c.txt` (08:11:36Z): 200 ×5, 404 ×3, 308 + location ×5, `/me/saved` 404, sitemap 200 글 23. 오늘 GET 10회 중 smoke와 겹치는 9개가 같은 값 (§C2.3). `/blog` location은 상대 경로로 보였다 (`curl -D` 표기 차이, 같은 대상) | (1) 기준선 채택 결정이 없다. cycle 1은 "pm과 architect가 정한다"였다. 사실상 설계 §7.3 기대표 + `0ac938c` 값을 기준으로 썼다. 결정 행 없음 → N13. (2) §7.3 14번 "`/me/saved` 로그인 redirect" 기대가 낡았다. 오너 #89, PJ-1-32로 404가 맞다. 설계 표 미정정 → N14. (3) 결과 파일 경로가 `00.runs.md` §1에 없다 → N15 |
| M3 (d) G-g | 익명 비공개 글 | **PASS** | smoke 파일: 404, `body_has_title=0`. 오늘 GET: 404, `cf-cache-status: BYPASS`, `<title>Page Not Found</title>`, 제목 문구 0회. 본문에 slug 문자열 4회는 URL 반향이다 (opengraph-image 경로, router 상태). 본문 유출 아님. sitemap에 그 slug 없음 | 글이 실제로 존재하는 비공개 글인지는 저장 파일로 증명되지 않는다 (오너 제공 경로로 읽는다). 로그인 200 확인은 CC-U3-2 AC3가 한다 |
| M3 (G-j) | U1 뒤 미측정 | **PASS** | `runs/*_U2_u2_{1,2,3}_c26c69d`, `*_U3_u3_{1,2,3}_0ac938c` `ssr_fetch_summary.txt`: 6개 run 모두 12 (home 3, posts 5, post 4), 범위 0, valid 3/3, 오염 창 없음. 한도 13 | U1 열(`3596e4c`)은 curl run 없음. U2 run이 U1c 코드를 포함한 상위 코드라 덮는다 |
| M4 | CC-U3 AC2 미충족 기록 | **PASS** | `00.tasks.md:963` CC-U3 = `AC PARTIALLY MET (AC2)` + `[slug]/layout.tsx:40–46` 사실. `00.tasks.md:975` CC-U3-2 (M-CC2) AC1–AC3, 선행 = gate PASS, "flag on은 AC1, AC2 참인 코드에서만". architect §18 (#97 P안) 자리 결정. 코드는 아직 그대로다 (`[slug]/layout.tsx` 41, 46행 `await auth()`, `await getPostBySlug`) | M-CC2 열림 조건으로 넘어간다 (§C2.4 L1) |
| M5 | U1 선택지 B 결정 행 | **PASS** | `decisions.plan.md` #99: Why = M-CC1 → S-CC → G-CC, Rejected = A (재배포 2회), Decided by = main session, 오너 확인 요청 문구. `01.status.md` 94–95행 D-id와 오너 요청 줄 | 오너 확인은 열려 있다. B는 운영에 닿지 않아 차단 아님 |
| M6 | `cycle 0/2` | **PASS** | `00.plan.md:292` `cycle 1/2; recovery 0/2; gate 1 = ISSUE (cc.m1-gate.review.md)`. 이 gate = cycle 2/2. 두 값 모두 분모 이하 | pm이 이 결과로 `cycle 2/2; gate 2 = PASS`를 적는다 |
| M7 | CC-U1c `[ ]` | **PASS** | `00.tasks.md:943` `[x]`, 코드 `e05cec6`, 배포 `3596e4c`, AC1, AC1b, AC2 PASS 근거. 미측정 AC1c, AC3, AC4, AC5 → `00.tasks.md:952` CC-U1c-2 AC1–AC5 (DOM 검사, 로그인 값, G-k 경로) | 없음 |

## C2.2 가드 표 (단위별, cycle 2)

| ID | 기준선 | QW1 | U1 | U2 | U3 (`0ac938c`) | 판정 | 출처 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-a | 23 / 38 | 23 / 37 | 23 / 34 | 22 / 35 | 22 / 35 | PASS | `00.runs.md` §2.1 |
| G-b | 2 / 5 | 2 / 5 | 2 / 2 | 2 / 2 | 2 / 2 | PASS | 같음 |
| G-c | 0 FAIL | 0 FAIL | 미측정 | 0 FAIL | 0 FAIL | PASS | 같음 |
| G-d | 0 | 0 | 미측정 | 0 | 0 | PASS. 오늘 GET 10개 `set-cookie` 0 | 같음, [S-GATE-8] |
| G-e | 404 | 404 | 미측정 | 404 | 404 | PASS. 오늘 `/nope`, `/@nope/x` 404 | 같음, [S-GATE-8] |
| G-e2 | 404 | 404 | 미측정 | 404 | 404 | PASS. smoke `/@taeklim/nope` 404 | [S-GATE-9] |
| G-f | 0 | 0 | 0 | 0 | 0 | PASS | `00.runs.md` §2.1 |
| G-g | 미측정 | 미측정 | 미측정 | 미측정 | **404, 본문 없음** | PASS | [S-GATE-8], [S-GATE-9] |
| G-h | 다름 | 다름 | 다름 | 다름 | 다름 (겹침 0) | PASS | `00.runs.md` §2.1, [S-GATE-10] |
| G-i | 52.9 % | 53.8 % | 미측정 | 53.3 % | 53.9 % | PASS (< 80 %) | `00.runs.md` §2.1 |
| G-j | 19 | 13 | 미측정 | 12 ×3 | 12 ×3 | PASS (한도 13) | [S-GATE-11] |
| G-k | 거짓 | 참 3/3 | 미측정 | 참 3/3 | 참 3/3 | PASS | `00.runs.md` §2.1 |
| G-l | D3 | D3 | 미측정 | D3 | B1, B3, C5, C6, D2, D3 | PASS | [S-GATE-9], [S-GATE-12] |
| smoke 15 | 없음 | 없음 | 없음 | 없음 | **15/15 기대값** | PASS (`/me/saved` 기대는 설계 표가 낡음, N14) | [S-GATE-9] |

- U1 열의 "미측정"은 curl run이 없어서다. U2, U3 curl run이 U1 코드를 포함한 배포 위에서 통과했다. exit 2에 구멍은 없다.
- 가드 실패는 0건이다. 되돌림 조건에 걸린 단위는 없다.

## C2.3 오늘 운영 GET (10회, 1초 간격)

| 경로 | status | cf | set-cookie | location | smoke 파일과 같음 |
| --- | --- | --- | --- | --- | --- |
| `/` | 200 | MISS | 0 | | 같음 |
| `/@taeklim/posts` | 200 | MISS | 0 | | 같음 |
| `/@taeklim/<S>` | 200 | MISS | 0 | | 같음 |
| `/nope` | 404 | BYPASS | 0 | | 같음 |
| `/@nope/x` | 404 | BYPASS | 0 | | 같음 |
| `/blog` | 308 | MISS | 0 | `/?cb=…` | 같음 (표기 차이) |
| `/@taeklim` | 308 | MISS | 0 | `/@taeklim/posts` | 같음 |
| `/@taeklim/<private>` | 404 | BYPASS | 0 | | 같음 (G-g) |
| `/sitemap.xml` | 200 | MISS | 0 | | 같음 (글 23개, private 0) |
| `/me/saved` | 404 | DYNAMIC | 0 | | 같음 |

- 표지: `/` `<aside>` 1, `data-right-rail="shared"` 1. `/nope` `<aside>` 0. cycle 1 §5와 같다.

## C2.4 MVP 사다리 (cycle 2)

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| L1 스키마 하나 | PASS (M-CC1 기준, 조건부) | flag off라 MVP1 계약(§3.1 배치, §7.2 캐시 지도)이 운영에서 깨지지 않는다. `[slug]/layout.tsx` 41, 46행의 await는 CC-U3-2에 기록됐다. 그 행이 "flag on 빌드와 배포는 AC1, AC2 참인 코드에서만"으로 L1을 지킨다. architect §18이 자리를 정했다 (#97). **M-CC2 열림 조건:** CC-U3-2 AC1, AC2가 참이기 전에 `cacheComponents: true`를 운영에 올리지 않는다 |
| L2 mock 전 pipeline 없음 | PASS | 변동 없음. `next.config.ts` `cacheComponents` 0 (main, 운영). U4 코드는 branch에만 있다 |
| L3 mock 격리 | PASS (해당 없음) | mock 없음 |
| L4 이전 단계 exit 닫힘 | PASS | M-CC1 exit 4개가 실측 run으로 닫혔다 (§C2.0). 이 gate PASS로 M-CC2가 열릴 수 있다. 열기 전 조건: CC-U3-2 AC1, AC2 · G-CC 날짜와 승인 (U4 주 지표) · #99 B 확인 · #98 오너 답 |

## C2.5 계층 검사 (cycle 2)

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| H1 mission block, 행 태그, M → S → G | PASS | 변동 없음. G-CC는 DRAFT (N1 유지, M-CC2 조건) |
| H1 cycle 카운터 | PASS | `cycle 1/2; recovery 0/2`. 이 gate = 2/2. 분모 이하. `budget:` 없음 |
| H2 결정 기록 | PASS (기록 2건) | #97, #98, #99 행 있음. 행 구조 = Why, Rejected, Consequences, Decided by, Evidence, Supersedes (본 그대로). 기록만: (1) smoke 기준선 = `0ac938c` 값 채택이 행이 없다 (N13). (2) U4 기준 v1 343 → v2 329 재설정(`bd93787`)이 `criteria.md` 줄긋기와 `01.status.md`에만 있다. 선택지(v1 유지 vs v2 재측정)였다. #88 Update 3 또는 새 행이 맞다 (N16). 둘 다 M-CC1 판정을 바꾸지 않는다 |

## C2.6 고치면 좋은 것 (cycle 2 추가)

| # | 항목 | 사실 | 담당 |
| --- | --- | --- | --- |
| N11 | `cc.report.md` 낡은 줄 | "열린 것" 절 3줄과 `[확인 필요]` 3개가 `8517aa8` 뒤 거짓이다. 바꿀 값: G-g, G-h, G-j, G-l, smoke 통과 (`00.runs.md` §2.1, `smoke-0ac938c.txt`). 대장 19행. U2 간격 익명 8.25–8.30 s, 로그인 9.14–9.40 s. G-j 통과 | `sonnet-writer` (출처 = `00.runs.md`, `smoke-0ac938c.txt`) |
| N12 | CC-QW1-2의 QW1 AC7 | 로그인 비공개 카테고리 확인은 `cache()` + token 변경의 정확성 검사다. 기록 마무리가 아니다. 행에서 따로 보이게 적는다 | `product-manager` |
| N13 | smoke 기준선 결정 행 없음 | 기준 = 설계 §7.3 기대표 + `0ac938c` 값. 뒤 단위는 이 값과 비교한다. 결정 행 1개 | `product-manager` |
| N14 | 설계 §7.3 14번 기대 낡음 | `/me/saved` 익명 = 404 (#89, PJ-1-32). "로그인 redirect"가 아니다 | `system-architect` |
| N15 | `smoke-0ac938c.txt`가 `00.runs.md`에 없다 | §1 행 또는 §3 10번 갱신, `criteria.md` §2 G-g와 §3 6번 "남음" 갱신. 지금 두 파일은 `01.status.md`와 어긋난다 | `data-analyst` |
| N16 | U4 기준 v2 재설정 결정 행 없음 | `bd93787`. 선택지 = v1 343 유지 vs v2 329 재측정. `criteria.md`에 줄긋기로만 있다 | `product-manager` (#88 Update 3) |

- cycle 1의 N1–N10은 그대로 열려 있다. N1(G-CC 날짜)은 M-CC2 전에 필요하다.

## C2.7 오너 대기 항목 (exit 밖)

| 항목 | M-CC1 차단 | 이유 |
| --- | --- | --- |
| #99 U1 선택지 B 확인 | 아니오 | 행이 있다. B는 운영에 닿지 않는다. A로 뒤집으면 새 행이 CC-U1b-2 AC2를 다시 연다 |
| #98 로그인 RSC 200 not-found 알림 | 아니오 | M-CC2(U4) 범위다. (b)로 뒤집으면 U4 지표에 비용이 든다 |
| G-CC 날짜, 승인 (DRAFT) | 아니오 | M-CC1 exit 문장에 없다. **M-CC2 열림 조건**이다. U4 주 지표라 날짜 없이 U4 판정을 낼 수 없다 |

## C2.8 판정과 다음

- **M-CC1 gate 2/2 = PASS.** 차단 항목 없음.
- pm: `00.plan.md:292`를 `cycle 2/2; gate 2 = PASS 2026-10-14`로. N11–N16 행.
- M-CC2 열기 전: CC-U3-2 AC1, AC2 (코드 main 반영), G-CC 날짜, #99, #98 답.

## Sources (cycle 2)

- [S-GATE-8] 운영 GET 10회 | `https://my.prettylog.com` (`?cb=g2031353`, UA `cc-gate-c2`) | published: 2026-10-14 | accessed: 2026-10-14 | type: measurement | note: status, cf-cache-status, set-cookie, location, 본문 표지 수. 본문은 scratchpad에만 저장
- [S-GATE-9] smoke, G-g, C5, G-l 결과 | `deploy/traffic/review/cc/smoke-0ac938c.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: measurement | note: full read, 25줄
- [S-GATE-10] G-h 재계산 | `deploy/traffic/review/cc/runs/20261014T073207Z_U3_u3_0ac938c_browser/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: `"rsc":true,"prefetch":null` 52건 키 5개, `"prefetch":"1"` 키 9개, comm 겹침 0
- [S-GATE-11] G-j 값 | `deploy/traffic/review/cc/runs/*_U2_u2_{1,2,3}_c26c69d/ssr_fetch_summary.txt`, `*_U3_u3_{1,2,3}_0ac938c/ssr_fetch_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full read, 6 files
- [S-GATE-12] G-l git grep | `git grep 'prefetch='`, `git grep 'Promise\.all'` on `19f5e31 61d48bc 3596e4c c26c69d 0ac938c HEAD`; `git diff --stat 0ac938c HEAD -- apps/dashboard_client_web`; `grep -rl initialData apps/dashboard_client_web/hooks` | published: 2026-10-14 | accessed: 2026-10-14 | type: vcs | note: 13 / 0 / empty / 4 files
- [S-GATE-13] 갱신된 대장과 기준 | `deploy/traffic/review/cc/00.runs.md` (181줄), `criteria.md` (107줄), `cc.report.md` (344줄) | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full read
- [S-GATE-14] 계획과 결정 | `00.plan.md` 285–300행, `00.tasks.md` 869–990행, `decisions.plan.md` #97–#99, `01.status.md` 꼬리 25줄, `cc.design.md` §7.3, §18.1, §18.6, `[slug]/layout.tsx` grep | published: 2026-10-14 | accessed: 2026-10-14 | type: plan | note: named sections read
- [S-GATE-15] 정적 검사 | `pnpm --filter dashboard_client_web check-types`, `lint` | published: 2026-10-14 | accessed: 2026-10-14 | type: build | note: exit 0, 0 (main HEAD 8517aa8)
