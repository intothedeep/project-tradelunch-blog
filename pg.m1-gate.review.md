# Phase PG M1 gate review (reviewer 단독)

- 날짜: 2026-10-18
- 대상: `pg.plan.md` M1 exit, 행 PG-1-01..PG-1-08. 추가 지시: 일찍 들어온 PG-2-01 커밋 `4246056`의 SQL 위험.
- 범위: worktree `/Users/tio/Documents/00_projects/project_tradelunch_pg`, branch `pg-m1` HEAD `ae0b718`, `git diff main...pg-m1` (18 파일, +526 / -31, 커밋 3개).
- 근거 파일: `deploy/projects/pg-m1-evidence-2026-10-18.txt`, `projects.report.md` "PG MVP1 (2026-10-18)", `projects.design.md` §12, `decisions.plan.md` #119.
- 이 검토가 직접 보낸 요청: 실행 중인 mock dev 서버(`https://local.prettylog.com`)에 읽기 GET 6회. 정적 검사 3종 로컬 실행. 파일 수정 0, 커밋 0, 서버 시작과 정지 0.
- 카운터: dispatch 값 `cycle 1/2; recovery 0/2`. `pg.plan.md` 18행은 아직 `cycle 0/2`다. 갱신은 `recover` step 3의 몫이다. 이 검토는 계획 파일을 고치지 않았다.

## 1. 판정 요약

**판정: ISSUE.** 코드와 정적 검사는 모두 통과한다. mock 화면 5개 항목은 이 검토가 직접 다시 확인했다. M1 exit 한 절("env를 빼면 real 카드")만 시연 기록이 없다. 그 밖은 문서 상태(hierarchy)와 AC 문구 어긋남이다.

```
M1 exit 절                                  판정     근거
 1 [MOCK] 카드, 구역 4 + Other 순서            PASS    §3.1 (직접 GET)
 2 구역 제목 = i18n short                      PASS    §3.1
 3 모바일 칩 = #<group> 앵커                   PASS    §3.1 (증거 파일에는 없던 값, 이 검토가 채움)
 4 상세 breadcrumb 링크 /@taeklim/projects#utrgv PASS  §3.2
 5 env를 빼면 real 카드(cnn 1개, Other 구역)   ISSUE   웹 real 모드 렌더 기록 없음 (F1)
 6 projects.report.md "PG MVP1" 절             PASS    722행
사다리   L1 PASS · L2 PASS · L3 PASS · L4 ISSUE (M2 행 PG-2-01이 M1 gate 전에 들어옴, F6)
계층     H1 ISSUE (G1 날짜 없음, F7) · H2 ISSUE (AC 이탈 2건의 D-row 없음, F8)
```

| 분류 | 건수 | 절 |
| --- | --- | --- |
| Must-fix (M1 닫기 전) | 1 | §8 F1 |
| Must-fix (문서, M1을 막지 않음) | 2 | §8 F7, F8 |
| Nice-to-fix | 8 | §9 |

## 2. 빌드와 정적 검사

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| `pnpm --filter dashboard_client_web check-types` | PASS | tsc 출력 0줄 |
| `pnpm --filter dashboard_client_web lint` | PASS | eslint `--max-warnings 0` 출력 0줄 |
| `pnpm --filter dashboard_server check-types` | PASS | tsc 출력 0줄 |
| 작업 트리 | PASS | `git status --short` 출력 0줄 |
| 원격 | PASS | `origin/pg-m1` = `ae0b718` |

`next build`, 테스트, 배포, 서버 시작과 정지는 하지 않았다 (지시 범위). GH Actions 결과는 보지 않았다.

## 3. M1 exit 재확인 (mock dev 서버, 읽기 GET)

### 3.1 `GET /@taeklim/projects` (200)

| 항목 | 값 |
| --- | --- |
| `<section id>` | `my-work`, `company`, `gatech`, `utrgv`, `ungrouped` 각 1개, 이 순서 |
| `<h2>` 구역 제목 | My Work, Company, GT MSCS, UTRGV MSCS, Other (i18n `short`, Other = `ungrouped`) |
| 모바일 칩 `href="#..."` | `#my-work`, `#company`, `#gatech`, `#utrgv`, `#ungrouped` |
| `[MOCK]` 글자 | 10 (증거 파일과 같음) |
| 메뉴 배지 | 5 (mock 카드 수. `ProjectsCountBadge`가 같은 `getProjects()`를 읽는다) |
| 오른쪽 rail tree (real) | RSC payload에 `cnn-from-scratch` 카테고리 노드 1개(`post_id:null`)와 그 글 slug가 있다. `sliceProjectsSubtree` 변경 뒤에도 real 노드가 남는다 |

### 3.2 `GET /@taeklim/projects/mock-utrgv-project` (200)

| 항목 | 값 |
| --- | --- |
| breadcrumb | `<a href="/@taeklim/projects#utrgv">UTRGV MSCS</a> ▸ mock-utrgv-project` |
| `[MOCK]` 글자 | 5 (증거 파일과 같음) |

### 3.3 mock 모드의 404 (관찰, 판정 아님)

| 요청 | HTTP | 본문 |
| --- | --- | --- |
| `/@taeklim/projects/does-not-exist-zzz` | 200 | 404 페이지 ("try one of these") |
| `/@taeklim/projects/utrgv` | 200 | 404 페이지 |

- 원인: `existence.proxy.ts:107-112`가 mock 모드에서 project gate를 `unknown`으로 통과시킨다. 그 뒤 page의 `notFound()`는 cacheComponents 스트리밍 아래라 상태 코드가 200이다 (soft 404). proxy gate가 진짜 404의 유일한 장치다 (`cc.design.md` §18).
- 영향: dev mock 모드만. env가 없으면 분기가 죽어 운영 동작은 main과 같다. M2 exit의 `/@taeklim/projects/utrgv` 404는 운영에서 따로 본다.

## 4. AC 점검 PG-1-01..08

| 행 | 판정 | 근거와 비고 |
| --- | --- | --- |
| PG-1-01 타입 | PASS | `packages/types/src/project.ts:8-9` 두 칸. `posts.user-projects.ts:184-185`, `231-232` 두 매핑이 채운다 (PG-2-01이 함께 들어와 `null` 고정이 아니라 row 값. 상위 AC와 모순 없음). 고의 파손 기록 없음 (F10). GH Actions 초록 미확인 |
| PG-1-02 i18n | PASS | en, ko에 `groups.{my-work,company,gatech,utrgv}.short` 4개, `ungrouped` = Other / 기타. `.full` 0개. 각 파일의 `-` 1줄은 `sortDescending` 끝 쉼표 추가뿐이다. 키와 값 변경 0. "추가 줄만"은 글자 그대로는 아니고 뜻은 맞다 |
| PG-1-03 mock + 전환 | PASS (AC 문구 이탈 1) | `mocks/projects/groups.cards.json` 카드 5개, 그룹 4 + `group: null` 1. id `9990000000000000101`부터 문자열. overview 제목은 `[MOCK] `로 시작. **`project` 값은 `mock-*`이고 `[MOCK] `로 시작하지 않는다** (F3). `groups.posts.json` `group` = `utrgv`. main에 `PROJECTS_DATA_SOURCE` 0개 (`git grep` 0). 분기는 `getProjects.api.ts:13`, `getProjectPosts.api.ts:19`, 그리고 AC 밖 `existence.proxy.ts:109` (F2). `turbo.json:10` env 선언은 lint `turbo/no-undeclared-env-vars`에 필요하다. `=== 'mock'` 정확 비교. `NEXT_PUBLIC_` 0. env 미설정 `[MOCK]` 0개 시연 없음 (F1과 같은 run으로 닫힌다) |
| PG-1-04 순수 함수 | PASS (코드) | `project-groups.ts:15-34` 입력 순서 유지, null 맨 뒤, 빈 구역 없음. `projects-tree.ts:31-55` `classifyProjectNodes` = §12.3 (깊이 1 + 자식 카테고리 = 그룹, 그룹 자식 = 프로젝트). `projectOf` 59-70 손자까지 올라감. `selectedNodeIdOf` 138-146 `projectIds`로 찾음. `hrefOfNode` 118 그룹 → 앵커. `sliceProjectsSubtree` 89-96 루트 직계 자식 중 자식 노드 0개를 뺀다. 실행 증거는 real tree의 cnn 1회(§3.1)뿐. 그룹 노드 판정은 PG-2-06 |
| PG-1-05 구역, 칩, breadcrumb | PASS (AC 이탈 1) | `(list)/page.tsx:72-86` `<section id>` + 제목 + 수 + `ProjectCardGrid`. 둘째 줄 없음. `ungrouped` 맨 뒤. 칩 58-71 구역 2개 이상, `href="#..."`, `prefetch={false}`. `[project]/page.tsx:45-56` breadcrumb, `prefetch={false}`, `group: null`이면 없음. `ProjectsCountBadge.server.tsx`, `notFoundGate.ts` diff 0. **`existence.proxy.ts` diff +8** (F2) |
| PG-1-06 tree 라벨 | PASS (코드, 검증은 PG-2-06) | `ProjectsTree.client.tsx:37-51` 그룹 노드 title → i18n `short` (없으면 대문자). 클릭은 원본 노드로 `hrefOfNode` 53-56. `CategoryTree.client.tsx` diff 0 |
| PG-1-07 오너 dev 실행 | PARTIAL | 증거 파일에 목록, 상세, 로컬 Express 4줄. 칩 줄 없음 (이 검토가 §3.1로 채움). **env 미설정 웹 렌더 줄 없음** (F1). 스크린샷 없음. 오너 문장은 질문 형태 |
| PG-1-08 단계 보고 | PASS (수치 1건 낡음) | `projects.report.md:722` 절. 단계마다 What, Why, Input, Output, Result, 좋은 점과 나쁜 점, Status. 그림 1 (ASCII), 표 2. 판정 없음 (첫 cycle). "커밋 2개, 16 파일, 369/31"은 보고 커밋 전 값이다. HEAD에서는 3개, 18 파일, 526/31 (F9) |

## 5. MVP 사다리 (`.claude/CLAUDE.md` "System build phasing")

| 불변식 | 판정 | 근거 |
| --- | --- | --- |
| L1 스키마 하나 | PASS | mock 카드 칸 = `TProjectCard`: `project_id`, `project`, `group_id`, `group`, `post_count`, `overview{post_id, slug, title, stored_uri}`. mock 상세 = `{ project: TProjectRef, posts: TProjectPost[] }` 칸 전부 일치, id 전부 문자열. Express `TCardRow` → `TProjectCard` 매핑 184-195, `TProjectRef` 228-233 같은 칸. 운영 DB 읽기 응답도 `group=null group_id=null`로 같은 모양 (증거 파일). 스키마(`categories`) 변경 0. 단, `as TProjectCard[]` 캐스트는 칸이 빠져도 통과한다 (F5) |
| L2 mock 시연 뒤 파이프라인 | PASS | 흐름 시연 `736bb46` 뒤에 SQL `4246056`. 같은 날이지만 순서는 맞다 |
| L3 mock 격리와 표식 | PASS | `apps/dashboard_client_web/mocks/projects/` 전용 디렉터리. id `999…`, 제목 `[MOCK] `, project `mock-*`. 읽는 곳은 env 분기 안 2곳만. real 경로는 읽지 않는다. 정적 import라 번들에는 들어간다 (M3 PG-3-02가 뺀다) |
| L4 앞 exit 닫힌 뒤 다음 phase | ISSUE | M2 행 PG-2-01이 M1 gate 전에 같은 branch에 들어왔다 (F6). PJ gate(`pj.p1-gate.review.md`)와 같은 읽기. MVP1로 되돌릴 조각은 없다. 결과는 "PG-2-02(배포)는 M1 PASS 뒤"이고, 계획이 이미 그렇게 쓰고 있다 |

## 6. 계층 (`rules/core.md` Decision hierarchy, `rules/docs.md` §0.1, §8)

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| H1 trace | ISSUE | `pg.plan.md` mission block 있음. `projects.design.md` §0 인용 있음. 모든 행 `→ M<n>` 있음. M1–M3 → S1 → G1. `cycle 0/2; recovery 0/2` 세 줄 모두 분모 안. `budget:` 없음. **G1이 DRAFT이고 `by <owner date>`가 자리표시다** (F7). §0.1: 수치 goal은 measure와 날짜가 있어야 한다. M1 행은 전부 AC만 있는 행이라 진행은 허용된다 (`core.md` "No mission block" 준용) |
| H2 decisions | ISSUE | #119 행은 Why, Rejected, Decided by, Evidence 모두 있다. 그 뒤 선택 2건에 행이 없다: (a) proxy gate를 mock 모드에서 건너뛰기 (대안: probe도 mock, gate 그대로 두고 상세 404 감수), (b) mock `project` 이름을 `[MOCK] ` 대신 `mock-*`로 (대안: AC 그대로). 둘 다 AC 제약을 바꿨다 (F8) |

## 7. cacheComponents 규칙 (`cc.design.md` §18, `projects.design.md` §12.7)

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| 새 서버 `catch`의 첫 문장 `unstable_rethrow` | PASS (새 catch 0) | diff에 새 `catch` 없음. 손댄 파일의 기존 catch `getProjectPosts.api.ts:31`는 main에서도 `unstable_rethrow`가 없다. 이번 branch가 mock `notFound()`를 그 try 안에서 던지므로 이 catch를 실제로 지난다. `throw error`가 다시 던져 동작은 맞다. 문구는 규칙에 어긋난다 (F4) |
| 새 `Link`는 `prefetch={false}` | PASS | `(list)/page.tsx:64`, `[project]/page.tsx:49`. 카드는 기존 `HoverPrefetchLink` |
| 새 서버 코드가 auth, cookies를 읽지 않음 | PASS | 묶기는 순수 함수. env만 읽는다 |

## 8. Must-fix

### F1 (M1 exit 5절) env 미설정 웹 렌더 시연 없음

- 심각도: 중간. M1 exit 6절 중 유일한 미시연. 판정 ISSUE의 직접 원인.
- 위치: `deploy/projects/pg-m1-evidence-2026-10-18.txt` (해당 줄 없음), `projects.report.md:~790` "원본에 없는 값".
- 근거: 증거 파일의 real 확인은 로컬 Express(PORT 4011) GET 4줄이다. 웹 real 모드 렌더(`[MOCK]` 0개, cnn이 `id="ungrouped"` 구역)는 저장 기록이 없다. 두 부품(Express `group=null`, mock에서 null → Other)은 있지만 끝-끝은 아니다.
- 고침: main session이 오너 허락 아래 dev 서버를 env 없이 1회 띄우고 `curl -sk https://local.prettylog.com/@taeklim/projects`를 저장한다. 확인 값: `[MOCK]` 0, `id="ungrouped"` 1, `cnn-from-scratch` 카드 1, 다른 `id="<group>"` 0. 같은 파일에 덧붙이고 보고 절 PG-1-03, PG-1-07에 한 줄씩 적는다. PG-1-03의 고의 파손 AC도 같은 run으로 닫힌다.
- 경로: main session (실행), `sonnet-writer` 또는 main session (보고 줄 추가). 분류: 구현 증거 누락.
- 대안: PG-2-02 운영 배포에서 같은 값을 본다. 그러나 L4 때문에 M1을 그 전에 닫아야 하므로 로컬 1회가 더 짧다.

### F7 (H1) G1 날짜 자리표시

- 심각도: 낮음 (M1을 막지 않음). 문서 상태.
- 위치: `pg.plan.md:16` `by <owner date>`, Q-PG2.
- 고침: 오너가 날짜를 준다. pm이 G1의 `(DRAFT, owner 승인 대기)`를 지우고 날짜를 넣는다.
- 경로: `product-manager` → 오너.

### F8 (H2) AC 이탈 2건의 D-row 없음

- 심각도: 낮음.
- 위치: `decisions.plan.md` (#119 뒤 없음). 이탈 코드: `existence.proxy.ts:105-112`, `mocks/projects/groups.cards.json` `project` 값.
- 고침: pm이 D-row 1개를 쓴다. Decision: "mock 모드에서 project gate를 `unknown`으로 통과, mock project slug는 `mock-*`". Why: M1 → S1 (mock 상세 화면이 gate 404로 열리지 않았다). Rejected: probe를 mock으로 (코드 더 큼), gate 그대로 (상세 breadcrumb 시연 불가), `[MOCK] ` slug (URL 인코딩). Decided by: main session. Evidence: `projects.report.md:803`. 같은 편집에서 PG-1-05 AC의 "`existence.proxy.ts` diff 0"을 "mock 분기 1개만"으로, PG-1-03 AC의 "`project`와 overview 제목" 을 "overview 제목은 `[MOCK] `, `project`는 `mock-` 접두"로 고친다.
- 경로: `product-manager`.

## 9. Nice-to-fix

### F2 `existence.proxy.ts` mock 분기 (알려진 이탈)

- 판정: 허용. dev 전용이고 env 없으면 죽은 분기다. gate는 real API 존재 확인이라 mock을 통과시키려면 우회 또는 probe mock이 필요하고 우회가 가장 작다.
- 비용 (관찰): §3.3 soft 404. mock 모드에서는 진짜 404 기능을 시연할 수 없다.
- 후속 행: M3 exit "`PROJECTS_DATA_SOURCE` 문자열 0"은 한정이 없다. 지금 hit 4개 = `getProjects.api.ts`, `getProjectPosts.api.ts`, `existence.proxy.ts`, `turbo.json`. PG-3-02 AC는 fetcher 2개와 "앱 소스 grep 0"만 적는다. `existence.proxy.ts`는 "앱 소스"가 묵시로 덮지만 `turbo.json:10`은 덮지 않는다. **후속 행은 있으나 불완전하다.**
- 고침: pm이 PG-3-02 AC에 `existence.proxy.ts:105-112` 분기 제거와 `turbo.json` `globalEnv` 항목 제거를 명시한다. 경로: `product-manager`.

### F3 mock `project` 값이 `[MOCK] `로 시작하지 않음

- 위치: `mocks/projects/groups.cards.json` 5건, `groups.posts.json:4`.
- 판정: L3는 통과한다 (`mock-` 접두, id `999…`, 제목 `[MOCK] `). AC 글자와만 다르다. URL 칸에 `[MOCK] `를 넣으면 인코딩 문제가 있어 의도된 선택으로 본다.
- 고침: 코드가 아니라 AC를 고친다 (F8에 포함). 경로: `product-manager`.

### F4 `getProjectPosts.api.ts:31` catch에 `unstable_rethrow` 없음

- main에도 없던 것이다. 이번 branch가 mock `notFound()`를 이 try 안에서 던지므로 지금은 실제로 지나는 경로다. `throw error`가 있어 동작은 맞다.
- 고침 (둘 중 하나): (a) mock 분기 두 줄을 `try` 앞으로 올린다. (b) `import { unstable_rethrow } from 'next/navigation'` 뒤 catch 첫 줄에 `unstable_rethrow(error);`. 다른 fetcher 7개가 (b) 형식이다. 경로: `developer`.

### F5 mock JSON 캐스트가 계약을 강제하지 않음

- 위치: `getProjects.api.ts:14` `mockCards as TProjectCard[]`, `getProjectPosts.api.ts:21` `mockPosts as TProjectPosts`.
- `as`는 JSON 추론 타입이 상위 타입이면 통과한다. 칸이 빠져도 check-types가 잡지 못한다. 이 검토의 L1 PASS는 §5의 칸 대조에 기댄다.
- 고침: `const cards: TProjectCard[] = mockCards;` 또는 `satisfies`. M3에서 파일이 `x_`로 가므로 비용 대비 효과는 작다. 경로: `developer` (선택).

### F6 (L4) PG-2-01이 M1 gate 전에 들어옴

- 위치: 커밋 `4246056`.
- 되돌릴 것 없음. 고정 순서 1이 "PG-2-01 + M1 웹 코드"를 한 배포로 묶으므로 같은 branch는 실용적이다. 기록만 남긴다. PG-2-02는 M1 PASS 뒤에만.

### F9 보고 수치 낡음

- 위치: `projects.report.md` "정적 검사와 코드 규모" 표: 커밋 2, 파일 16, 369/31. HEAD `ae0b718` 기준 커밋 3, 파일 18, 526/31 (보고 커밋이 파일 2개를 더했다).
- 고침: 표에 "기준 커밋 `4246056`"을 적거나 HEAD 값으로 바꾼다. 경로: `sonnet-writer`.

### F10 PG-1-01 고의 파손 기록 없음

- AC: 매핑 한 곳에서 `group`을 빼면 check-types 빨강. 기록 없음 (보고도 인정).
- 고침: `developer`가 한 번 빼고 tsc 출력을 증거 파일에 붙인 뒤 되돌린다. 또는 pm이 AC에서 뺀다. 타입이 필수 칸이라 결과는 자명하다.

### F11 PG-1-07 스크린샷 없음, 오너 문장이 질문 형태

- "I see groups and mock is ok?"는 확인이면서 질문이다. 오너의 한 줄 승인("ok")을 받아 증거 파일에 덧붙인다. 경로: main session.

## 10. PG-2-01 SQL 조기 검토 (`posts.user-projects.ts`, §12.3, PG-2-01 AC)

### 10.1 AC 대조

| AC 항목 | 판정 | 위치 |
| --- | --- | --- |
| `lvl1` CTE + `is_group` | PASS | 32-40 |
| `project` CTE에 `group_id`, `group_title`, `g_priority`, `g_seq`, `is_leaf1` | PASS | 41-50 (`project_raw`) |
| `DISTINCT ON (title)` CTE 1개, 카드와 상세 공용 | PASS | 51-55 (`project`), 두 쿼리 모두 `FROM project pr` |
| 두 SELECT에 `group_id::text`, `group_title AS "group"` | PASS | 103, 120 |
| 카드 `ORDER BY g_priority, g_seq, priority, seq` | PASS | 113 |
| 글 0개 깊이 1 잎 숨김 WHERE가 두 쿼리에 | PASS | 86-89 `HIDE_EMPTY_LEAF`, 112, 127 |
| 가려진 같은 title `req.log.warn` 1줄 | PASS | 173-179 (`shadowed` 칸 104-105) |
| `null` 고정 → row 값 | PASS | 184-185, 231-232 |
| GH Actions `pnpm --filter dashboard_server build` 초록 | 미확인 | 로컬 server check-types PASS만 있다 |

### 10.2 명백한 결함

없다. 운영 DB 읽기 전용 GET 4회(증거 파일)에서 타입 오류 없이 돌았다.

- `UNION ALL` 타입: 양쪽 9칸. 둘째 갈래의 `NULL` 3개는 첫 갈래의 `int8`, `varchar`, `int8`을 받는다. `2147483647`은 `int4` 최대값이고 `g.priority int4`와 맞는다. `true`/`false` bool. 문제 없음.
- `DISTINCT ON (title) ... ORDER BY title, g_priority, ...`: 그룹 없음 갈래는 `g_priority` 2147483647이라 항상 뒤다. 같은 title이면 **그룹 아래 행이 이긴다**. §12.10 1행의 위험이 바로 이것이다. 고정 순서(3 전에 5 금지)가 유일한 방어다. PG-2-08이 이 방향을 확인한다.

### 10.3 데이터 이동 뒤 위험 (기록용)

| 시점 | 상태 | SQL 결과 | 위험 |
| --- | --- | --- | --- |
| 고정 순서 2 뒤 (그룹 4행, 자식 0) | 4행 `is_group=false` → 잎 갈래, `ranked` 0 | `HIDE_EMPTY_LEAF`가 숨김. 카드 1, `/projects/{4 그룹}` 404 | 없음. 설계대로 |
| 고정 순서 3 뒤 (cnn → utrgv) | `utrgv` `is_group=true`. cnn은 그룹 갈래 `is_leaf1=false` | `/projects/utrgv`는 `project_raw`에 없어 404. cnn 글 8개는 `subtree`(56-62)로 따라온다. 카드 정렬은 utrgv priority 40 | `post_categories` 미채움. Express는 읽지 않는다 (§12.6 부작용 2). `level=2`는 SQL이 안 쓴다 |
| 그룹 아래 글 0개 프로젝트 | `is_leaf1=false` → 보인다 (§11 Q5) | overview `null` 카드 | 설계대로. 글 없는 카드가 보일 수 있다 |
| 그룹 없음 프로젝트에 하위 카테고리 추가 | 깊이 1 + 자식 → 그룹으로 읽힘 | 그 프로젝트 URL 404, 하위 카테고리가 카드가 됨 | §12.3 규칙으로만 금지. 쓰기 경로 거부 없음 (Q-G2 후속) |
| 같은 title 둘 (다른 그룹) | `DISTINCT ON` 첫 행 | 하나만 열림, warn 1줄 | 설계대로. 가려진 쪽 글이 사라져 보임 |
| `root` CTE가 2행 | 사용자 아래 `title='projects'` 카테고리가 다른 부모에 또 있으면 (0010 이후 가능) | `lvl1`이 두 루트의 자식을 합친다 | main에도 있던 전제. `root`에 `c.parent_id IS NULL` 또는 `level = 0` 조건을 두면 닫힌다 (선택, `developer`) |
| `shadowed` 서브쿼리 | 카드마다 `project_raw` 스캔 | 카드 수 × 행 수 | 수십 행 규모라 무시 |

- 웹 `classifyProjectNodes`와 SQL `lvl1.is_group`은 같은 판정이다 (깊이 1 + 자식 카테고리). 웹 `sliceProjectsSubtree`는 "자식 노드 0개"를 숨기고 SQL은 "보이는 글 0개"를 숨긴다. tree endpoint가 보이는 글만 주면 같다. 다르면 M2 PG-2-06의 "빈 그룹 노드 0개"에서 드러난다.

## 11. 라우팅 요약

| 찾은 것 | 분류 | 경로 |
| --- | --- | --- |
| F1 | 구현 증거 누락 (exit 미시연) | main session 실행 1회 (오너 허락), 보고 줄 추가 |
| F7 | hierarchy H1 | `product-manager` → 오너 (G1 날짜) |
| F8, F2 후속, F3 | hierarchy H2 + AC 문구 | `product-manager` (D-row 1, AC 3곳) |
| F4, F5, F10, root CTE 조건 | 구현 (선택) | `developer` |
| F9 | 보고 문구 | `sonnet-writer` |
| F6 | ladder L4 (기록) | 없음. PG-2-02는 M1 PASS 뒤 |
| F11 | 증거 | main session |

F1 하나가 닫히면 M1 exit 6절이 모두 시연된다. 재검토 범위는 F1 한 줄 확인으로 좁힐 수 있다. 결정은 `recover` step 3의 몫이다.

---

# Cycle 2 (2026-10-18, HEAD `3999864`, cycle 2/2)

- 범위: `ae0b718..3999864` 커밋 1개. 코드 2파일(`utils/project-groups.ts`, `projects/[project]/page.tsx`), 증거 파일 +6줄, `pg.plan.md`, `decisions.plan.md`.
- 이 검토가 직접 보낸 요청: env 없는 dev 서버에 읽기 GET 4회. 정적 검사 3종 재실행. 파일 수정 0, 커밋 0.

## C2.1 판정

**판정: PASS.** M1 exit 6절이 모두 시연됐다. 남은 ISSUE는 G1 날짜(오너 몫, goal 줄)와 문구 2건이며 M1을 막지 않는다.

```
M1 exit  1-4, 6                          PASS   cycle 1 §3과 같음 (코드 변경이 mock 경로를 건드리지 않음)
         5 env 빼면 real 카드             PASS   C2.2 (직접 GET)
사다리    L1 PASS · L2 PASS · L3 PASS · L4 기록만 (변동 없음)
계층      H1 ISSUE 유지 (G1 날짜, 오너) · H2 PASS (#120)
정적 검사 web check-types / web lint / server check-types PASS
```

## C2.2 F1 재확인 (dev, `PROJECTS_DATA_SOURCE` 없음, 운영 API)

| 요청 | HTTP | 값 |
| --- | --- | --- |
| `/@taeklim/projects` | 200 | `id="ungrouped"` 1, 다른 그룹 `id` 0, `<h2>` "Other", cnn 카드 링크 1, `[MOCK]` 0, 칩 0 (구역 1개), 배지 1, `TypeError` 0 |
| `/@taeklim/projects/cnn-from-scratch` | 200 | `[MOCK]` 0, breadcrumb `▸` 0 (`group` 없음), H1 `CNN-FROM-SCRATCH` |
| `/@taeklim/projects/utrgv` | **404** | 404 본문. real 모드에서는 proxy gate가 살아 있어 진짜 404다 (cycle 1 §3.3의 soft 404는 mock 모드만이라는 판단을 확인) |
| `/@taeklim/projects/mock-utrgv-project` | 404 | mock 이름은 real 모드에서 없다. mock과 real이 섞이지 않는다 (L3) |

증거 파일 `deploy/projects/pg-m1-evidence-2026-10-18.txt` 18-23행과 값이 같다.

## C2.3 고침 코드 검토

| 파일 | 변경 | 판정 |
| --- | --- | --- |
| `utils/project-groups.ts:19-21` | `card.group === null` → `== null` | PASS. 옛 운영 API(PG-2-01 전)는 `group` 칸을 주지 않아 `undefined`였고 `toUpperCase`에서 죽었다. 배포 사이(새 웹 + 옛 API)에도 같은 상태가 생기므로 고정 순서 1의 안전망이다. 타입 `string \| null`과 어긋나지 않는다 |
| `projects/[project]/page.tsx:34-46` | `=== null` → `== null`, `!== null` → `!= null` | PASS. `!= null` 뒤 `ref.group`은 `string`으로 좁혀진다 (check-types PASS) |

- 이 crash는 cycle 1 F1이 "두 부품은 있지만 끝-끝은 아니다"라고 쓴 바로 그 틈에서 나왔다. 끝-끝 시연 요구가 맞았다.
- mock 경로(`groups.cards.json`은 `group: null` 명시)는 영향이 없다. cycle 1 §3.1, §3.2 결과는 그대로 유효하다.
- 회귀 없음: 정적 검사 3종 PASS, 다른 파일 변경 0.

## C2.4 F8, F7, 나머지

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| F8 D-row | PASS | `decisions.plan.md` #120: Decision, Why(M1 → S1 → G1), Rejected 2개, Decided by, Evidence, Supersedes 모두 있음 (`rules/docs.md` §8) |
| F8 AC 수정 | PASS (1곳 남음) | PG-1-03 slug 문구, PG-3-02에 `existence.proxy.ts`, `turbo.json` 명시: 됨. **PG-1-05 AC의 "`existence.proxy.ts` diff 0"은 그대로다.** #120이 이탈을 받아들였으므로 모순은 문서 안에서 해소되지만 AC 글자는 코드와 다르다. nice-to-fix (pm, 한 줄) |
| F2, F3 | PASS | #120과 PG-3-02 AC로 닫힘 |
| F7 G1 날짜 | ISSUE 유지, M1을 막지 않음 | G1은 goal 줄이고 M1 exit 항목이 아니다. M1 행 8개는 모두 AC가 있고 선택이 없다 (`rules/core.md` "No mission block" 준용). 오너가 날짜를 주면 pm이 넣는다. M2 gate 전까지 열어 둔다 |
| F9 보고 수치, F1 run 보고 줄 | 열림 | `projects.report.md`는 이 cycle에서 바뀌지 않았다. "PG MVP1" 절에 F1 run(crash와 고침, 값 4개)과 HEAD 기준 수치가 없다. PG-1-08 AC "숫자는 저장 파일에서"는 지키나 최신 줄이 빠졌다. nice-to-fix (`sonnet-writer`) |
| F4, F5, F10, F11 | 열림 (선택) | 변동 없음 |
| cycle 카운터 | 확인 | `pg.plan.md:18` `cycle 1/2 (ISSUE 2026-10-18, …)`. 이 PASS 뒤 갱신은 `recover` step 3 또는 pm의 몫 |

## C2.5 다음 단계에 넘기는 것

- M2 PG-2-02(배포)는 열 수 있다 (L4 조건 충족).
- 배포 뒤 PG-2-02 AC의 `"group":null` 확인은 새 Express가 칸을 주는지의 확인이기도 하다. `== null` 안전망이 있어도 운영 응답에 `group` 칸이 있어야 PG-1-01 AC가 운영에서 참이다.
- 열린 nice-to-fix: PG-1-05 AC 한 줄(pm), 보고 절 갱신(F9 + F1 run, `sonnet-writer`), F4, F5, F10, F11.
