# Phase PG: 프로젝트 그룹 (project groups)

> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.

- 상태: M1 PASS, M2 PASS (2026-10-18, `pg.m2-gate.review.md`). 행 22개: M1 8/8, M2 9/9 닫힘, M3 5개 열림. M3는 오너 발행이다. prettylog 연재(Phase PS, `ps.plan.md`) M3 뒤로 미뤘다 (#122). G1, M3 exit, PG-3-01 AC는 배지 4로 바꿨다 (#124).
- 설계: `projects.design.md` §12 (rev4 DRAFT). 오너 결정: `decisions.plan.md` #119.
- 행은 여기에만 있다. `00.tasks.md`는 400줄을 넘어서 새 행을 받지 않는다.
- #119가 §12와 다르면 #119를 따른다. 다른 곳은 "§12 정정 필요" 절에 적는다.

## Mission block

- Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
- Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)
- Constraints: 스키마 변경 없음 · 계약 = `@repo/types` `TProjectRef`, `TProjectCard` (추가만) · BIGINT id는 문자열 · soft-delete만 · 새 `Link`는 `prefetch={false}` 또는 `HoverPrefetchLink` (#90) · 테스트 러너 금지, 검증 = 고의 파손(deliberate breakage)과 운영(prod) curl · 빌드는 GH Actions에서만 · 로컬 실행 = `~/.claude/CLAUDE.md` "No local execution" · mock은 `mocks/projects/`에 격리, 운영은 언제나 `real` · URL `/@u/projects/<project>` 불변, 308 없음, 그룹 URL 없음 (#119) · 운영 SQL은 main session 또는 오너만 실행한다. agent는 파일만 쓴다 · 데이터 이동은 아래 "고정 순서"를 지킨다.
- G1: 프로젝트 화면이 소속별 구역으로 보인다. measure: `my.prettylog.com/@taeklim/projects` HTML에 `id="my-work"`, `id="company"`, `id="utrgv"` 구역이 있고, 카드가 cnn, prettylog, recobell, adriel 4개, 메뉴 배지 4다. by: date TBD after PS plan, owner. 오너 "ok" 2026-10-18, #124.
- S1 → G1: A = 카테고리 한 단계 추가 `projects/<group>/<project>` (picked: A of A/B/C, owner 2026-10-17, #119); listed alternatives: B (코드 안 매핑), C (새 열).
- M1 → S1: MVP1 모양 (mock); exit: 오너가 허용한 dev 실행 1회(Q-PG1)에서 `PROJECTS_DATA_SOURCE=mock`으로 `/@taeklim/projects`에 `[MOCK]` 카드가 그룹 구역 4개 + "Other" 순서로 렌더 · 구역 제목 = i18n `short` · 모바일 칩이 `#<group>` 앵커 · 상세 breadcrumb 링크 = `/@taeklim/projects#<group>` · env를 빼면 real 카드(cnn 1개, "Other" 구역) · `projects.report.md` "PG MVP1" 절 있음; cycle 2/2 PASS (2026-10-18, pg.m1-gate.review.md); recovery 0/2
- M2 → S1: MVP2 진짜 조각 (Express SQL + cnn 이동 + purge); exit: 고정 순서 1–4가 끝남 · 운영 `/@taeklim/projects`에 UTRGV MSCS 구역, cnn 카드 1개 · 메뉴 배지 1 · `/@taeklim/projects/cnn-from-scratch` 200 · `/@taeklim/projects/utrgv` 404 · `cc-standalone-check.yml` 실행 PASS · `projects.report.md` "PG MVP2" 절 있음; cycle 1/2 PASS (2026-10-18, pg.m2-gate.review.md); recovery 0/2
- M3 → S1: MVP3 핵심 이전 (발행 + mock 은퇴); exit: 프로젝트 기능 코드를 고치지 않고 발행만으로 (PG-3-02 전까지, 무관한 렌더러 변경 5b23750은 제외, main session 2026-10-18) recobell, adriel이 Company 구역에 보임 · prettylog가 My Work 구역에 보임 · HTML에 `id="my-work"`, `id="company"` 있음, 순서 `id="my-work"` < `id="company"` < `id="utrgv"` · 배지 4 (#124) · `PROJECTS_DATA_SOURCE` 문자열 0 · mock 파일 `x_` · `projects.report.md` "PG MVP3" 절 있음; cycle 0/2; recovery 0/2
- Gate: 각 milestone 끝에 reviewer 단독 (`.claude/CLAUDE.md` Workflow 4). task별 review 행은 없다. 다음 milestone은 앞 exit가 닫혀야 열린다.

## 고정 순서 (§12.6, 바꾸지 않는다)

```
1 배포   PG-2-01 Express SQL + M1 웹 코드가 운영에 있다     cnn = "Other" 구역
2 SQL A  그룹 4행 INSERT (PG-2-04)                         빈 그룹 숨김, 배지 1 그대로
3 SQL B  cnn 1행 UPDATE (PG-2-05)                          cnn = UTRGV 구역
4 purge  cf-purge.sh 전체 (PG-2-06, my. + blog-api. 한 zone) 엣지 s-maxage 1일 제거
5 발행    그 뒤에만 projects/<group>/<project>/ (PG-OWN-1, 2)
```

- 1 전에 2를 하면 옛 SQL이 `utrgv`를 글 0개 프로젝트로 연다. `/@taeklim/projects/utrgv`가 200이 된다.
- 3 전에 5를 하면 `cnn-from-scratch` 카테고리가 둘 생긴다 (§12.10 1행).
- 운영 curl은 엣지 캐시를 피하려고 `?probe=$T`를 붙인 GET을 쓴다 (Phase TC 관례). HEAD는 쓰지 않는다.

## Tactic: MVP1 모양 (mock 카드, real tree) → M1

- [x] **PG-1-01 (ENG) 타입 `group_id`, `group` 추가 (G1)** → M1
  - **AC** `packages/types/src/project.ts` `TProjectRef`에 `group_id: string | null`, `group: string | null` · `posts.user-projects.ts`의 두 매핑(카드 `projects`, 상세 `ref`)이 두 칸을 채운다. 이 행에서는 `null` 고정, 진짜 값은 PG-2-01 · GH Actions `pnpm check-types` 초록 · 고의 파손: 매핑 한 곳에서 `group`을 빼면 check-types가 빨강.
- [x] **PG-1-02 (ENG) i18n 그룹 이름 (G6)** → M1
  - **AC** `messages/en/blog.json`, `messages/ko/blog.json`에 `blog.projects.groups.{my-work,company,gatech,utrgv}.short` = My Work / Company / GT MSCS / UTRGV MSCS (en, ko 같음, #119) · `blog.projects.ungrouped` = en "Other", ko "기타" · `.full` 키 0개 · 기존 키 변경 0 (diff가 추가 줄만).
- [x] **PG-1-03 (ENG) mock 카드 + dev 전환 (G2)** → M1
  - **AC** 새 `apps/dashboard_client_web/mocks/projects/groups.cards.json` = `TProjectCard[]`, 그룹 4개에 카드 1개 이상 + `group: null` 카드 1개, id는 `9990000000000000101`부터 문자열, `project`는 `mock-<group>-project` (URL 칸이라 괄호·공백 없음, #120), overview와 글 제목은 `[MOCK] `로 시작 · 새 `mocks/projects/groups.posts.json` = `[MOCK]` 프로젝트 1개의 `{ project: TProjectRef, posts }`, `group` = `utrgv` (breadcrumb용, PJ 선례 `mocks/x_projects/posts.json`) · 오늘 이 env는 없다(grep 0). `apis/getProjects.api.ts`와 `apis/getProjectPosts.api.ts`에만 서버 전용 `PROJECTS_DATA_SOURCE` 분기를 새로 둔다. 값이 정확히 `mock`일 때만 fixture, 그 밖은 real · `NEXT_PUBLIC_` 접두 없음 · 고의 파손: env 미설정 빌드에서 `/@taeklim/projects` HTML에 `[MOCK]` 0개.
- [x] **PG-1-04 (ENG) 순수 함수: 묶기와 노드 판정 (G3)** → M1
  - **AC** 새 `utils/project-groups.ts` `groupProjectCards(cards)` = 입력 순서를 지키며 `group`별 구역 배열, `group: null`은 맨 뒤 한 구역, 카드 0개 구역 없음 · `utils/projects-tree.ts`에 `classifyProjectNodes(nodes)` → `{ groupIds, projectIds }`, 판정 = §12.3 표 (깊이 1 + 자식 카테고리 있음 = 그룹) · `projectOf`가 그룹 아래 손자를 프로젝트로 돌려준다. 그래서 `projectOfSlug[slug]`는 프로젝트 title이고 그룹 title이 아니다 · `selectedNodeIdOf(nodes, '/@u/projects/cnn-from-scratch')`가 cnn이 그룹 아래여도 cnn id (오늘 코드는 `parent_id === root.id`라 null) · `hrefOfNode(그룹 노드)` = `projectsPath(u) + '#' + title` · `sliceProjectsSubtree`가 루트 직계 자식 중 자식 카테고리 0개이고 하위 글 0개인 노드를 뺀다 (§12.3 1/0/0 행. SQL A 직후 빈 그룹 4개가 여기에 든다) · 검증: 이 판정은 M2 운영 tree(PG-2-06)에서 다시 본다.
- [x] **PG-1-05 (ENG) 카드 구역, 모바일 칩, 상세 breadcrumb (G4)** → M1
  - **AC** `(list)/page.tsx`가 `groupProjectCards` 결과마다 `<section id={group}>` + 제목(i18n `short`, 키 없으면 title 대문자) + 프로젝트 수 + 기존 `ProjectCardGrid` · 둘째 줄 정식 이름 없음 (#119) · 그룹 없음 구역 = `ungrouped` 제목, 맨 뒤, 1개 이상일 때만 · 모바일 칩은 구역 2개 이상일 때만, `href="#<group>"` · `[project]/page.tsx` 제목 위 breadcrumb `<short> ▸ <project>`, 그룹 칸 링크 = `/@u/projects#<group>`, `prefetch={false}` · `group: null`이면 breadcrumb 없음 · `ProjectsCountBadge.server.tsx`, `apis/existence.proxy.ts`, `utils/notFoundGate.ts` diff 0.
- [x] **PG-1-06 (ENG) 오른쪽 rail tree 그룹 표시 (G5)** → M1
  - **AC** `ProjectsTree.client.tsx`에서 그룹 노드 글자 = i18n `short` (키 없으면 title 대문자) · 그룹 클릭 → `router.push('/@u/projects#<group>')` (PG-1-04 `hrefOfNode`) · 프로젝트와 글 클릭은 오늘과 같음 · `CategoryTree.client.tsx` 공용 renderer는 블로그 사이드바에 영향 0 (블로그 카테고리 tree 글자 불변) · 검증: real 데이터로만 보인다. 그래서 PG-2-06 AC에서 확인한다.
- [x] **PG-1-07 (MAIN/OWNER) M1 dev 실행 1회** → M1
  - **AC** 오너가 Q-PG1에 답한 실행 방식으로 1회 · M1 exit 항목마다 결과 한 줄 (스크린샷 또는 HTML 발췌 경로) · 실행은 main session이 한다. agent는 실행하지 않는다.
- [x] **PG-1-08 (ENG) 단계 보고 "PG MVP1"** → M1
  - **AC** `projects.report.md`에 `## PG MVP1 (<date>)` 절 · 단계마다 What, Why, Input, Output, Result, Status 칸 (`.claude/CLAUDE.md` "System build phasing") · 그림 1개 + 표 1개 · 숫자는 PG-1-07 저장 파일에서 읽는다.

## Tactic: Express SQL + 데이터 이동 (고정 순서 1–4) → M2

- [x] **PG-2-01 (ENG) Express `PROJECT_CTES` 두 단계 (G7)** → M2
  - **AC** `posts.user-projects.ts`에 `lvl1` CTE + `is_group`, `project` CTE에 `group_id`, `group_title`, `g_priority`, `g_seq`, `is_leaf1` (§12.3) · `DISTINCT ON (title)` CTE 1개를 카드와 상세 쿼리가 같이 쓴다 · 두 SELECT에 `pr.group_id::text AS group_id`, `pr.group_title AS "group"` · 카드 `ORDER BY g_priority, g_seq, pr.priority, pr.seq` · 글 0개 깊이 1 잎은 마지막 WHERE `NOT pr.is_leaf1 OR EXISTS (...)`가 숨긴다. 이 WHERE는 `CARDS_QUERY`와 `PROJECT_POSTS_QUERY` 둘 다에 둔다 (상세에 없으면 빈 그룹 URL이 200) · 가려진 같은 title은 `req.log.warn` 1줄 · PG-1-01의 `null` 고정을 row 값으로 바꾼다 · GH Actions `pnpm --filter dashboard_server build` 초록.
- [x] **PG-2-02 (MAIN) 배포: 고정 순서 1** → M2 (AC PARTIALLY MET: `pg-mvp2-step1-<date>.txt` 없음. `"group":null`과 `post_count` 기준값 = `deploy/projects/pg-m1-evidence-2026-10-18.txt` 12행. 배포 CI 3종 success = `pg.m2-gate.review.md` §3.4. 받아들임 #123)
  - **AC** 운영에 PG-2-01 + M1 웹 코드 커밋이 있다 · `blog-api.prettylog.com/v1/api/posts/users/taeklim/projects?probe=$T` → 카드 1개, `project` = `cnn-from-scratch`, `"group":null` · `.../projects/utrgv?probe=$T` → 404 · `my.prettylog.com/@taeklim/projects?probe=$T` 200, cnn이 "Other" 구역 · 응답 원문을 `deploy/projects/pg-mvp2-step1-<date>.txt`에 저장 (cnn `post_count` 기준값).
- [x] **PG-2-03 (ENG) SQL 파일 작성 (실행 안 함)** → M2 (AC PARTIALLY MET: 파일 이름 `pg-sql.md` 아님, 실제 = `deploy/projects/pg-2-03.sql`. 4블록 모두 있음. id = DB 기본값 (Q-PG3). 받아들임 #123)
  - **AC** 새 `deploy/projects/pg-sql.md`에 사전 SELECT, SQL A, SQL B, 되돌리기 4블록 · 사전 SELECT = 루트(`title='projects'`, 사용자 taeklim) id, cnn id, 루트 아래 `my-work|company|gatech|utrgv` 행 0개를 확인 · SQL A 값 = `my-work` 10, `company` 20, `gatech` 30, `utrgv` 40 (#119, §12.6의 옛 값 아님) · 열 목록에 `seq` 없음 (`GENERATED ALWAYS`, `tradelunch.schema.sql` 117행), `group_id` = 루트 id, `level` 1 · id 4개는 `<new id n>` 자리표시. 채우는 방식은 Q-PG3 (agent는 id를 만들지 않는다) · SQL B = cnn `parent_id` → `utrgv` id, `level` 2, `updated_at` · 되돌리기 = SQL B 역방향 + 그룹 행 `deleted_at` tombstone, `DELETE` 0개.
- [x] **PG-2-04 (MAIN/OWNER) SQL A 실행: 고정 순서 2** → M2 (AC PARTIALLY MET: `pg-mvp2-step2-<date>.txt` 없음. SQL A+B를 한 트랜잭션으로 실행해 "A 뒤" 상태는 복구 불가. 최종 상태 = `deploy/projects/pg-2-03.sql` + `deploy/projects/pg-2-prod-2026-10-18.txt`. 받아들임 #123)
  - **AC** PG-2-02가 닫힌 뒤에만 · 사전 SELECT 결과를 저장한 뒤 실행 · 실행 뒤 `.../projects?probe=$T` 카드 수 = 1 (배지 1) · `.../projects/{my-work,company,gatech,utrgv}?probe=$T` 4개 모두 404 (새 SQL은 자식 없는 깊이 1 잎을 숨긴다) · 출력 `deploy/projects/pg-mvp2-step2-<date>.txt`.
- [x] **PG-2-05 (MAIN/OWNER) SQL B 실행: 고정 순서 3** → M2 (AC PARTIALLY MET: `pg-mvp2-step3-<date>.txt` 없음. 한 트랜잭션이라 B 직후 상태 기록 없음. 최종 값 = `deploy/projects/pg-2-prod-2026-10-18.txt` + `pg.m2-gate.review.md` §3.1. 받아들임 #123)
  - **AC** PG-2-04 뒤 · `.../projects?probe=$T` 카드 1개, cnn `"group":"utrgv"`, `group_id` = SQL A의 utrgv id 문자열 · cnn `post_count` = step1 파일 값 · `.../projects/cnn-from-scratch?probe=$T` 200, 글 수 같음 · `.../projects/utrgv?probe=$T` 404 · 출력 `deploy/projects/pg-mvp2-step3-<date>.txt`.
- [x] **PG-2-06 (MAIN) Cloudflare 전체 purge + 운영 확인: 고정 순서 4** → M2 (AC PARTIALLY MET: `pg-mvp2-step4-<date>.txt` 없음. 대체 = `deploy/projects/pg-2-prod-2026-10-18.txt` + `pg.m2-gate.review.md` §3.2 (MISS→HIT, 배지 1). tree 렌더 = 오너 시각 확인 (`01.status.md` 140행). 받아들임 #123)
  - **AC** `_scripts/cloudflare/cf-purge.sh` (인자 없음 = 전체) 1회 · 다음 GET `/@taeklim/projects` `cf-cache-status: MISS`, 둘째 `HIT` · HTML에 `id="utrgv"`, 글자 `UTRGV MSCS`, cnn 카드 1개, `id="my-work"|"company"|"gatech"` 0개 · 메뉴 배지 글자 1 · 오른쪽 rail tree에 그룹 노드 `UTRGV MSCS` 1개, 빈 그룹 노드 0개 (PG-1-04, PG-1-06 확인) · cnn 글 상세 1개가 200, HTML에 `/projects/cnn-from-scratch` 링크 있음, `/projects/utrgv` 링크 0개 · cnn 프로젝트 상세 HTML에 `UTRGV MSCS ▸ cnn-from-scratch`, 링크 `/@taeklim/projects#utrgv` · `/@taeklim/projects/{my-work,company,gatech,utrgv}` 4개 404, `/@taeklim/projects/cnn-from-scratch` 200 · 출력 `deploy/projects/pg-mvp2-step4-<date>.txt`.
- [x] **PG-2-07 (ENG) `cc-standalone-check.yml` 기대 목록 추가** → M2
  - **AC** PG-2-04 뒤에 머지 (그 전에는 404가 그냥 참이라 증명이 없다) · 84행 404 목록에 `/@taeklim/projects/utrgv` · 85행 200 목록에 `/@taeklim/projects`, `/@taeklim/projects/cnn-from-scratch` · main push 실행 1회 PASS, 표 3행 PASS · 고의 파손: branch `workflow_dispatch`에서 `utrgv`를 200 목록에 두면 그 행 FAIL, 확인 뒤 되돌림.
- [x] **PG-2-08 (MAIN) 같은 title 고의 파손 (ROLLBACK 트랜잭션)** → M2 (2026-10-18: 빈 `my-work` 쪽이 이김, §12.10 위험 확인, `deploy/projects/pg-mvp2-dup-2026-10-18.txt`)
  - **AC** PG-2-04 뒤 (`my-work` 행이 있어야 한다) · `POSTGRES_URL_NON_POOLING`(5432) 한 세션에서 `BEGIN` → `my-work` 아래 `cnn-from-scratch` 카테고리 1행 INSERT → 카드 쿼리(PG-2-01 SQL 그대로) 실행 → 결과 `cnn-from-scratch` 행 1개 → `ROLLBACK` · 운영 행 변화 0 (전후 `SELECT count(*) FROM categories`) · 결과 행이 어느 쪽인지 기록 (§12.10: `my-work` 쪽 = 빈 행이 이긴다는 위험 확인) · 출력 `deploy/projects/pg-mvp2-dup-<date>.txt`.
- [x] **PG-2-09 (ENG) 단계 보고 "PG MVP2"** → M2 (2026-10-18: AC를 실제 원본 파일로 고쳐 씀, gate F3)
  - **AC** `projects.report.md` `## PG MVP2 (<date>)` 절 · PG-1-08과 같은 칸 · 숫자는 저장 파일 5개에서만 읽는다: `deploy/projects/pg-2-03.sql`, `pg-2-prod-2026-10-18.txt`, `pg-2-07-check-2026-10-18.txt`, `pg-mvp2-dup-2026-10-18.txt`, `pg-m1-evidence-2026-10-18.txt` · 없는 값은 "원본에 없는 값" 절에 적는다 · M1과 단계별 비교 한 줄씩.

## Tactic: 발행과 mock 은퇴 → M3

- [ ] **PG-OWN-1 (OWNER) recobell 발행** → M3
  - **AC** PG-2-06 뒤에만 · Phase PS M3 exit가 닫힌 뒤에만 (`ps.plan.md`, #122) · 폴더 `projects/company/recobell/<slug>/` + 같은 이름 썸네일 PNG (`publish_oneshot.py`) · 발행 뒤 `SELECT count(*) FROM categories WHERE title='recobell' AND deleted_at IS NULL` = 1, 부모 = `company` · 사이에 코드 커밋 0.
- [ ] **PG-OWN-2 (OWNER) adriel 발행** → M3
  - **AC** PG-OWN-1과 같은 형식, 폴더 `projects/company/adriel/<slug>/`, `title='adriel'` 행 1개.
- [ ] **PG-3-01 (MAIN) purge + Company 구역 확인** → M3
  - **AC** `cf-purge.sh` 1회 · `/@taeklim/projects` HTML에 `id="my-work"` 구역 카드 1개 (prettylog), `id="company"` 구역 카드 2개, `id="utrgv"` 카드 1개 · HTML 안 위치 순서 `id="my-work"` < `id="company"` < `id="utrgv"` · `id="gatech"` 0개 · 배지 4 (#124) · `/@taeklim/projects/prettylog`, `/@taeklim/projects/recobell`, `/@taeklim/projects/adriel` 200 · 출력 `deploy/projects/pg-mvp3-<date>.txt`.
- [ ] **PG-3-02 (ENG) mock 은퇴** → M3
  - **AC** `mocks/projects/groups.cards.json`, `groups.posts.json` → `x_` 접두 (soft-delete, `rm` 없음) · `getProjects.api.ts`, `getProjectPosts.api.ts`, `apis/existence.proxy.ts`의 `PROJECTS_DATA_SOURCE` 분기 제거, `turbo.json` `globalEnv`에서 `PROJECTS_DATA_SOURCE` 제거 (#120), 앱 소스 grep 0 · GH Actions build 초록.
- [ ] **PG-3-03 (ENG) 단계 보고 "PG MVP3" + 요약** → M3
  - **AC** `projects.report.md` `## PG MVP3 (<date>)` 절 · PG MVP1–3 세 절을 잇는 요약 표 1개 · 숫자는 `pg-mvp3-<date>.txt`에서 읽는다.

## 열린 질문 (오너)

| # | 질문 | 기본값 |
| --- | --- | --- |
| Q-PG1 | M1 dev 실행 방식 | PJ Q-L처럼 오너가 허용한 로컬 `next dev` 1회. 대안: GH Actions `workflow_dispatch` standalone + mock env |
| Q-PG2 | G1 날짜 | 2026-10-20은 풀렸다. Phase PS 계획 뒤 오너가 다시 정한다 (#124) |
| Q-PG3 | SQL A의 id 4개 | `id` 열을 빼고 DB가 만든다 (`GENERATED BY DEFAULT`, 작은 수). 대안: `generate_id_str()` 1회 호출 = 로컬 실행이라 오너 허락 필요 |

## §12 정정 필요 (architect, rev5)

- §12.6 SQL A 값이 옛 순서다 (`utrgv` 10 … `personal` 40). #119 값은 PG-2-03.
- §12.4 "둘째 줄 정식 이름", §12.5 `{short,full}`: #119로 `short`만.
- §12.8 "env를 다시 둔다": 웹 앱에 `PROJECTS_DATA_SOURCE`가 없다. PG-1-03이 새로 만든다.
- §12.4 tree 그룹 표시는 MVP1 mock으로 보이지 않는다. tree는 real 전용이다 (`getProjectsTree.api.ts` 8행). 확인은 M2(PG-2-06).
- §12.3 "타입 추가만": 필수 칸이라 Express 매핑도 M1에서 고친다 (PG-1-01).
- §12.3 808행 "`/@u/projects/utrgv` 404"는 SQL B 뒤에만 참이다. 빈 그룹 숨김 WHERE가 상세 쿼리에도 있어야 한다 (PG-2-01).
- §12.8 MVP1 mock은 카드만이다. breadcrumb을 보이려면 상세 mock도 필요하다 (PG-1-03).
- `tradelunch.schema.sql` 130행 `categories_user_title_key`는 `0010`이 지웠다. snapshot이 낡았다.
