# Phase PG M2 gate review (reviewer 단독)

- 날짜: 2026-10-18
- 대상: `pg.plan.md` M2 exit (19행), 행 PG-2-01..PG-2-09.
- 범위: main HEAD `d368270`. 운영 배포 `4c4a73e`. 그 뒤 커밋 4개는 문서와 CI 워크플로 1건만이다 (`git diff --stat 4c4a73e d368270`: 9 파일, 코드 0).
- 근거 파일: `deploy/projects/pg-2-03.sql`, `pg-2-prod-2026-10-18.txt`, `pg-2-07-check-2026-10-18.txt`, `pg-mvp2-dup-2026-10-18.txt`, `pg-m1-evidence-2026-10-18.txt`, `projects.report.md` "PG MVP2 (2026-10-18)", `decisions.plan.md` #119–#121, `01.status.md` 135–140행.
- 이 검토가 직접 한 일: 운영 읽기 GET 15회 (API 6, 웹 9). 정적 검사 3종 로컬. `gh run list/view`. 파일 수정 0, 커밋 0, 서버 0, SQL 0, `.env` 읽기 0.
- 카운터: dispatch 값 `cycle 1/2; recovery 0/2`. `pg.plan.md` 19행은 아직 `cycle 0/2`다. 갱신은 `recover` step 3의 몫이다. 이 검토는 계획 파일을 고치지 않았다.

## 1. 판정 요약

**판정: PASS.** M2 exit 7절이 모두 운영에서 시연됐다. 이 검토가 오늘 다시 읽어 확인했다 (§3). 남은 ISSUE는 모두 문서 상태(hierarchy)다. 흐름이 돌아가는지에는 영향이 없다. M2를 막지 않는다. 단, F1–F3은 M3가 열리기 전에 `product-manager`가 닫는다. `recover`로 보낼 사안은 없다.

```
M2 exit 절 (pg.plan.md 19행)                      판정   근거
 1 고정 순서 1–4 끝남                               PASS   §3.1 (배포 CI 3종 success, SQL 파일, 운영 값, purge 뒤 MISS→HIT)
 2 운영 목록에 UTRGV MSCS 구역, cnn 카드 1개        PASS   §3.2 (<section id="utrgv"> 1, 카드 링크 1)
 3 메뉴 배지 1                                      PASS   §3.2 (배지 span children:1, 오너 시각 확인 2026-10-18)
 4 /@taeklim/projects/cnn-from-scratch 200          PASS   §3.2, CI run 39103426635
 5 /@taeklim/projects/utrgv 404                     PASS   §3.2, CI run 39103426635
 6 cc-standalone-check.yml 실행 PASS                PASS   §3.4 (gh run view: success)
 7 projects.report.md "PG MVP2" 절 있음             PASS   868행
사다리   L1 PASS · L2 PASS · L3 PASS · L4 PASS
계층     H1 ISSUE (F1, F3) · H2 ISSUE (F2)
정적     web check-types 깨끗 · server check-types 깨끗 · web lint 깨끗 (오류 줄 0)
```

## 2. 소유자 사실 (2026-10-18)

| 사실 | 이 검토의 처리 |
| --- | --- |
| 시각 확인 "good": tree가 `UTRGV MSCS ▸ cnn-from-scratch`, 배지 1 | tree 렌더의 유일한 근거로 쓴다 (§3.3). 배지는 curl로도 확인했다 |
| 같은 title 위험 = B (#121, SQL 무변경) | `decisions.plan.md` 209행에 행 있음. Why = G1, Rejected = A, Decided by = owner, Evidence = dup 파일. §8 형식 충족 |
| G1 날짜 2026-10-20 | `pg.plan.md` 16행에 있음. M1 gate의 남은 ISSUE(날짜 없음)가 닫혔다 |

## 3. 운영 재확인 (이 검토, 2026-10-18, `?probe=<epoch>` GET)

### 3.1 API (`blog-api.prettylog.com/v1/api/posts/users/taeklim/projects`)

| 요청 | 결과 | AC |
| --- | --- | --- |
| `/projects` | 카드 1개. `project` = `cnn-from-scratch`, `group_id` = `"16"`, `group` = `"utrgv"`, `post_count` = 8 | PG-2-05: 일치. `post_count` 8 = 이동 전 기준값 (`pg-m1-evidence` 12행) |
| `/projects/cnn-from-scratch` | 200 | PG-2-05 |
| `/projects/{my-work,company,gatech,utrgv}` | 4개 모두 404 | PG-2-04, 05 |

### 3.2 웹 (`my.prettylog.com`)

| 요청 | 결과 | AC |
| --- | --- | --- |
| `/@taeklim/projects` 1회차 | 200, `cf-cache-status: MISS` | PG-2-06 |
| `/@taeklim/projects` 2회차 (같은 URL) | 200, `cf-cache-status: HIT` | PG-2-06. 보고서 "원본에 없는 값"이던 MISS/HIT를 이 파일이 채운다 |
| 목록 `<section id=...>` | `<section id="utrgv">` 1개. `id="my-work"`, `"company"`, `"gatech"`, `"ungrouped"` 0개 | PG-2-06 |
| 목록 카드 링크 `href="/@taeklim/projects/<p>"` | `cnn-from-scratch` 1개 | exit 2 "cnn 카드 1개" |
| 목록 `UTRGV MSCS` 글자 | 4 (`pg-2-prod` 9행과 같음) | PG-2-06 |
| 목록 `[MOCK]` | 0 | L3 |
| 목록 모바일 칩 `href="#..."` | 0. 구역이 1개라 칩이 없는 것이 AC대로다 (PG-1-05 "구역 2개 이상일 때만") | 정상 |
| 메뉴 배지 span | `text-primary-foreground ... "children":1` 2개 (rail + collapsed) | exit 3 "배지 1" |
| `/@taeklim/projects/cnn-from-scratch` | 200. `href="/@taeklim/projects#utrgv"` 1개. 글자 `UTRGV MSCS</a> ▸ ` 1개. `/projects/utrgv` 링크 0 | PG-2-06 breadcrumb |
| `/@taeklim/projects/{my-work,company,gatech,utrgv}` | 4개 모두 404 | PG-2-06, exit 5 |
| cnn 글 상세 1개 (`training-a-cnn-from-scratch-...`) | 200. `/projects/cnn-from-scratch` 링크 39, `/projects/utrgv` 링크 0 | PG-2-06 글 상세 |

### 3.3 tree (오른쪽 rail)

- RSC payload에는 그룹 title 4개(`my-work`, `company`, `gatech`, `utrgv`)와 `cnn-from-scratch`가 각 1회 있다. 이것은 `getProjectsTree` 응답 데이터다. 렌더가 아니다.
- 빈 그룹 숨김은 클라이언트 코드가 한다: `apps/dashboard_client_web/utils/projects-tree.ts` 92–96행 (`parent_id === root.id && !withParent.has(node.id)` 제외). 코드 경로는 PG-1-04 AC대로다.
- HTML에 `My Work`, `Company`, `GT MSCS`는 각 1회만 있다 (i18n 메시지 블록). 렌더된 라벨은 0으로 읽힌다. `UTRGV MSCS`는 4회다.
- curl은 렌더를 증명하지 못한다. 렌더 근거는 오너 시각 확인 1건(2026-10-18, `01.status.md` 140행)이다. 이 둘로 exit 2의 tree 부분을 닫는다. ISSUE 아님.

### 3.4 CI (`gh`)

| run | 결과 |
| --- | --- |
| `4c4a73e` push: CI, CC standalone check, GCP build | 3개 모두 success (PG-2-01 "build 초록", PG-2-02 배포) |
| `39103426635` main push `9dde8d6` | success. 표 4행 PASS (`pg-2-07-check` 3–6행) |
| `39103434210` `pg-break-2-07` workflow_dispatch | failure. `utrgv` 200 기대 행 FAIL (고의 파손, 기대대로) |
| `git ls-remote --heads origin pg-break-2-07` | 없음. 지워졌다. `01.status.md` 140행이 맞고 `pg-2-07-check` 10행 "left on origin"은 낡았다 |

## 4. AC 대조 (PG-2-01..09)

| 행 | 체크 | 판정 | 근거와 어긋남 |
| --- | --- | --- | --- |
| PG-2-01 | `[x]` | PASS | `posts.user-projects.ts` 32–55행 `lvl1`, `project_raw`, `DISTINCT ON (title)`. 102–103, 119–120행 두 SELECT에 `group_id::text`, `"group"`. 113행 ORDER BY. 86–89행 `HIDE_EMPTY_LEAF`가 112, 127행 둘 다에 있음. 173–179행 warn. CI success |
| PG-2-02 | `[x]` | PASS, AC 일부 미충족 | 운영 값은 §3. `pg-mvp2-step1-<date>.txt` 없음. `"group":null` 시점 원문은 `pg-m1-evidence` 12행(로컬 Express, 운영 DB)만 있다 → F1 |
| PG-2-03 | `[x]` | PASS, AC 문구 어긋남 | 파일 이름 `pg-2-03.sql` (AC는 `pg-sql.md`). 내용 4블록 모두 있음: 사전 검사 10–23행, A 27–31행 (10/20/30/40, `seq` 없음, `group_id` = 루트, `level` 1, id는 DB 기본값 = Q-PG3 기본값), B 34–37행, 되돌리기 48–54행 (`DELETE` 0) → F1, F2 |
| PG-2-04 | `[x]` | PASS, AC 일부 미충족 | 4개 404 (§3.1), 배지 1 (§3.2). A와 B를 한 트랜잭션으로 실행해 "A 뒤" 중간 상태 기록(`step2`)이 없다. 지금은 복구 불가 → F1, F2 |
| PG-2-05 | `[x]` | PASS, AC 일부 미충족 | 카드 1, `group` utrgv, `group_id` "16", `post_count` 8 = 기준값, cnn 200, utrgv 404 (§3.1). `step3` 파일 없음 → F1 |
| PG-2-06 | `[x]` | PASS, AC 일부 미충족 | 웹 값 전부 §3.2에서 확인. MISS→HIT와 배지는 이 파일이 채웠다. tree 렌더는 오너 확인 (§3.3). `step4` 파일 대신 `pg-2-prod-2026-10-18.txt` → F1 |
| PG-2-07 | `[x]` | PASS | `cc-standalone-check.yml` 84행 404 목록에 `utrgv`, `company`. 85행 200 목록에 `/@taeklim/projects`, `cnn-from-scratch`. run success + 파손 run failure (§3.4). 머지 시점은 SQL A 뒤 (run 06:15:56Z, SQL 기록 06:15:22Z) |
| PG-2-08 | `[x]` | PASS | `pg-mvp2-dup` 파일: BEGIN → INSERT → 결과 1행 (`my-work`, post_count 0, shadowed 1) → ROLLBACK, 23 → 23. §12.10 위험 확인. 후속 결정 #121 있음. pooled 6543을 쓴 이유(IPv6 전용) 기록됨. AC는 5432인데 세션 1개 조건은 지켰다 |
| PG-2-09 | `[ ]` | PASS (내용), 체크 미반영 | `projects.report.md` 868행 절 있음. PG-1-08과 같은 칸, 그림 1, 표 1, M1 비교 열. AC "step1–4 저장 파일 숫자만"은 그 파일이 없어 그대로는 충족 불가. 보고는 존재하는 5개 파일을 원본으로 썼고 그 사실을 적었다 → F3 |

## 5. MVP 사다리

| 불변식 | 판정 | 근거 |
| --- | --- | --- |
| L1 스키마 하나 | PASS | `git diff --stat 4246056~1 d368270 -- packages/db` 빈 결과. 마이그레이션 0. mock `groups.cards.json`과 운영 응답이 같은 `TProjectCard` 칸(`project_id`, `project`, `group_id`, `group`, `post_count`, `overview`)이다. `packages/types/src/project.ts` 5–21행. Constraints "스키마 변경 없음" 유지 |
| L2 mock 뒤에 파이프라인 | PASS | M1이 mock으로 흐름을 돌렸다 (M1 gate cycle 2 PASS). M2 SQL은 그 흐름의 real 조각이다. M1에 없던 경로 0 |
| L3 mock 격리 | PASS | `mocks/projects/` 전용 디렉터리. id `999…`, 제목 `[MOCK] `. 읽는 곳은 `getProjects.api.ts` 13행, `getProjectPosts.api.ts` 19행, `existence.proxy.ts` 109행, 모두 `=== 'mock'` 분기 안. 운영 HTML `[MOCK]` 0 |
| L4 앞 단계 exit 닫힘 | PASS | M1 exit 6절 PASS (`pg.m1-gate.review.md` 241행, cycle 2/2). M2 exit는 운영 시연으로 닫혔다 (§3). 머지된 diff나 빌드 통과가 아니다 |

- 보고서(`projects.report.md` "PG MVP2") 비교: 단계마다 M1 비교 열 있음. 숫자는 저장 파일에서 읽었고 없는 값은 "원본에 없는 값" 절에 적었다. 스키마 변경 없음. 통과.

## 6. 계층 (H1, H2)

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| H1 mission block | ISSUE (F1, F3) | `pg.plan.md` 11–21행 블록 있음. 행마다 `→ M2`. M2 → S1 → G1 추적 됨. G1 날짜 2026-10-20 있음. `budget:` 없음. 카운터 `cycle 0/2; recovery 0/2` (dispatch 1/2, 초과 없음). 어긋남: 6행 "PLANNED, 모두 열림"과 `00.plan.md` 265행 stub "22 open"이 낡았다 (`rules/docs.md` §1: stub이 진실인데 거짓이다). 미충족 AC가 `[ ]`로 남지 않았다 (§7) |
| H1 design doc | PASS (경미) | `projects.design.md` 10–15행 인용 블록. 15행이 `00.plan.md` Phase PJ를 원본으로 가리키는데 PJ는 archive로 갔다. 현재 원본은 `pg.plan.md` 11행. 기록만 |
| H2 결정 기록 | ISSUE (F2) | #119, #120, #121 있음. 없음: (a) SQL A+B 한 트랜잭션 (고정 순서 2·3 병합, step2/3 기록 포기), (b) Q-PG3 오너 "ok" (SQL 25행 주석에만), (c) `pg-sql.md` → `pg-2-03.sql`. `rules/docs.md` §8 "each owner pick", "approach change" |

## 7. 발견 (번호, 심각도, 위치, 처방)

| # | 심각도 | 분류 | 위치 | 내용 | 처방 (→ 담당) |
| --- | --- | --- | --- | --- | --- |
| F1 | 중 (M2를 막지 않음, M3 전 닫기) | hierarchy (docs §7, §1) | `pg.plan.md` 60–69행, 6행. `00.plan.md` 265행 | PG-2-02/04/05/06 `[x]`인데 AC의 `step1..4` 파일이 없다. PG-2-03은 파일 이름이 다르다. `AC PARTIALLY MET` 표기와 `[ ]` 형제 행이 없다. step1–3 상태는 운영이 지나가 복구 불가다. 6행과 stub은 "PLANNED, 22 open"으로 낡았다 | pm: 다섯 행에 `AC PARTIALLY MET (<없는 파일>)` 주석. §7 문구대로면 미충족 항목마다 `[ ]` 형제 행이다. 그 행은 닫을 수 없다 (중간 상태 복구 불가). 이 검토는 대신 D-row(F2)로 포기를 기록하는 쪽을 권한다. 선택은 pm 몫이다. step4 대체 파일은 `pg-2-prod-2026-10-18.txt` + 이 파일로 적는다. 6행 상태와 `00.plan.md` stub을 "M2 gate PASS, 9/9 닫힘, M3 열림"으로 같은 edit에서 갱신 (→ `product-manager`) |
| F2 | 중 | hierarchy (docs §8) | `decisions.plan.md` (#121 뒤) | 결정 3건에 행이 없다: SQL A+B 한 트랜잭션(고정 순서 2·3 병합), Q-PG3 id = DB 기본값(오너 "ok"), SQL 파일 형식 `.sql` 1개 | pm: D-row 1건 이상 추가. Why = M2 → S1 → G1. Rejected = 단계별 2트랜잭션 (중간 404 상태 기록 가능, 운영 노출 시간 증가). Decided by: `pg-2-03.sql` 3행은 "오너 OK 뒤 main session 실행"이라 적혀 있다. 한 트랜잭션 파일을 오너가 승인한 것인지 main session 판단인지 `01.status.md`와 세션 기록으로 pm이 확인해 적는다. Q-PG3는 owner. Evidence = `pg-2-03.sql`, `pg-2-prod-2026-10-18.txt`. `01.status.md` 한 줄 (→ `product-manager`) |
| F3 | 하 | hierarchy (docs §7 "AC는 있는 그대로에 맞춘다") | `pg.plan.md` 74–75행 | PG-2-09 `[ ]`인데 절은 있고 내용은 AC를 충족한다. AC 문구 "step1–4 저장 파일 숫자만"은 그 파일이 없어 그대로는 충족 불가 | pm: AC를 실제 원본 5개 파일 이름으로 고쳐 쓰고 `[x]`. 보고서 "원본에 없는 값" 절에 이 검토 파일(§3.2 MISS/HIT, 배지)을 보충 원본으로 한 줄 추가는 main session 수술 edit (→ `product-manager`) |
| F4 | 기록만 | implementation (증거 파일 문구) | `deploy/projects/pg-2-07-check-2026-10-18.txt` 10행 | "breakage branch left on origin"이 낡았다. `git ls-remote`에 없다. `01.status.md` 140행이 맞다 | 고치지 않아도 된다. 다음 edit 때 한 줄 추가로 정정 (→ main session) |
| F5 | 기록만 | hierarchy (경미) | `projects.design.md` 15행 | 인용 원본이 archive된 PJ 블록을 가리킨다. 현재 원본은 `pg.plan.md` 11행 | §12 rev5 때 15행을 `pg.plan.md`로 바꾼다 (→ `system-architect`, rev5 항목에 추가) |
| F6 | 기록만 | reasoning (위험 수용) | `posts.user-projects.ts` 52–54행 | `DISTINCT ON (title)`에서 글 0개 중복이 이긴다 (PG-2-08 확인). #121로 오너가 B를 택해 코드 변경 없음. 방어 = 발행 관례 + warn 1줄 | 조치 없음. M3 PG-OWN-1/2 발행 폴더가 `projects/company/<project>/`인지 PG-3-01에서 본다 |

## 8. 보고서 "알려진 공백" 판정

| 공백 (`projects.report.md` "원본에 없는 값") | 판정 | 이유 |
| --- | --- | --- |
| `step1..4` 파일 없음 | 기록만 (F1, F2) | 최종 상태는 `pg-2-prod` + 이 파일로 시연됐다. 중간 상태(A 뒤, B 전)는 복구 불가라 `[ ]`를 열어도 닫을 수 없다. D-row로 받아들임을 기록한다 |
| MISS/HIT 없음 | 닫힘 | 이 검토 §3.2에서 MISS → HIT 확인 |
| 배지 값, tree 라벨 없음 | 닫힘 | 배지 1은 §3.2 curl. tree는 오너 시각 확인 + 코드 경로 (§3.3) |
| PG-2-02 CI/standalone/GCP 성공의 저장 파일 없음 | 닫힘 | §3.4 `gh run list`로 `4c4a73e` 3개 success 확인. 이 파일이 저장 기록이다 |
| PG-2-09 `[ ]` | 기록만 (F3) | 내용은 충족. 문서 상태만 어긋남 |

## 9. 정적 검사 (로컬, `~/.claude/CLAUDE.md` "Not covered" 범위)

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter dashboard_client_web check-types` | 오류 줄 0 |
| `pnpm --filter dashboard_server check-types` | 오류 줄 0 |
| `pnpm --filter dashboard_client_web lint` (`--max-warnings 0`) | 오류 줄 0 |

## 10. 다음 단계

1. `product-manager`: F1, F2, F3을 한 docs edit로 닫는다 (`pg.plan.md`, `00.plan.md` stub, `decisions.plan.md`, `01.status.md`).
2. `recover` step 3: `pg.plan.md` 19행을 `cycle 1/2 PASS (2026-10-18, pg.m2-gate.review.md)`로 갱신.
3. M3 열림. 첫 행은 PG-OWN-1 (오너 발행). 발행 폴더 `projects/company/recobell/<slug>/`. 코드 커밋 0 (M3 exit).
4. G1 측정일 2026-10-20: `id="utrgv"`는 오늘 충족. `id="company"`와 카드 3개는 M3 PG-OWN-1/2 + PG-3-01 몫.
