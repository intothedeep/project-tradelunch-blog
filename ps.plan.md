# Phase PS: Prettylog From Scratch 연재 (series)

> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.

- 상태: 00–07 PUBLISHED (2026-10-18). M4 후속 글 08 열림 (2026-11-18). 행 36개, 닫힘 22, 열림 14. M1 4/4, M2 9/9, M3 7/7, M4 2/16. reviewer = PS-2-08 1회 (00–07) + P8-09 1회 (08). 오너 질문 2개 열림 (Q-PS2, Q-PS5). 게이트 사실: P8-02, P8-02c는 2026-11-20 전에 시작 못 한다. P8-10은 P8-09 PASS 뒤 바로 (#147).
- 설계: `prettylog-series.design.md` rev1 + §9 (08, 2026-11-18) (system-architect). 오너 답: `decisions.plan.md` #122, #124, #145, #147. 판정선: #146.
- 설계와 #124가 다르면 #124를 따른다. 다른 곳은 아래 "설계 정정 필요" 절에 적는다.
- 줄인 이름: `P` = `apps/blog_agent/posts/projects/my-work/prettylog/`. `S` = `P/_series/`.

## Mission block

- Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
- Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)
- Constraints: 글은 영어 (#124 Q2) · 글의 숫자는 모두 저장된 파일에서 온다. 잰 적 없는 값은 "not measured"로 쓴다 · `posts/`와 `S`는 gitignore다. 커밋하지 않는다 (#124 Q3, `apps/blog_agent/.gitignore` 213행) · 오래 남길 증거(사전 SELECT, slug, 운영 curl)는 커밋되는 `deploy/projects/ps-*.txt`에 쓴다 (`pg-2-prod-2026-10-18.txt` 선례) · 다이어그램(diagram) = 글 안 ```mermaid 블록. 데이터 차트(chart)만 matplotlib PNG (#124 Q4) · 로컬 실행 = `~/.claude/CLAUDE.md` "Allowed locally" (입력 = `S/data/*.csv`만, 한 코어, 300 s. 08 예외: 08 스크립트는 `deploy/traffic/review/history/2026-11-18-alibaba-bot/*.json`도 읽는다 (#145). 그 폴더 아래 11-20에 저장한 "후" JSON과 `.txt`도 읽는다 (#147). 실행 조건은 같다: 한 코어, 300 s, 모델 없음. 오너 2026-11-18) · 발행(publish), 운영 SQL, purge, 운영 curl = main session 또는 오너만 · 프로젝트 이름 `prettylog`는 그룹 사이에서도 하나뿐 (#121) · 발행 순서 = 01 → 07, 00 마지막 (설계 §5.2). 08은 그 뒤 한 번 (설계 §9.6) · 테스트 러너 금지, 검증 = 검사 명령 + 고의 파손(deliberate breakage) + 운영 curl.
- G-PL1 (DRAFT, owner approval pending): 연재 글 9개가 운영에 있다. measure: `/@taeklim/projects/prettylog` 200, 글 9개, 순서 00 → 08 (measure 오너 2026-11-18, #145) · Projects 화면 `id="my-work"` 구역에 카드 prettylog 1개 · 메뉴 배지 2 (cnn + prettylog. PG G1의 배지 4는 recobell, adriel 발행 뒤, `pg.plan.md` 16행). by: date TBD (owner).
- G-PL2 (DRAFT, owner approval pending): 글의 모든 숫자에 저장된 출처 파일이 있다. measure: 글 8개 `## Sources` 표에 없는 본문 숫자 0개, 출처 경로 `test -e` 실패 0개. by: date TBD (owner).
- S1 → G-PL1, G-PL2: `README.md`를 단일 출처(single source of truth, SST)로 두고 설계 rev1의 글 8개를 쓴다 (오너 #122, #124). listed alternatives: none (설계가 든 A/B/C는 제목 후보다).
- M1 → S1: 데이터와 그림 준비; exit: PS-1-01…04 닫힘 · `S/figures.md`에 PNG 12장, mermaid 6개, 썸네일(thumbnail) 8장이 행마다 출처와 함께 있다 · 고의 파손 1회 기록 · gate 없음 (진행 표시)
- M2 → S1: 글 00–07 작성 + 유일한 검토; exit: PS-2-00…07 닫힘 · md 8개가 "공통 AC" 검사 명령을 모두 통과 · PS-2-08 reviewer 1회 PASS, 지적을 고친 뒤 (설계 D7); cycle 0/2; recovery 0/2
- M3 → S1: 발행과 운영 확인; exit: PS-3-01…07 닫힘 · `deploy/projects/ps-prod-<date>.txt`에 G-PL1 measure 항목마다 결과 줄 · 오너 시각 확인 8쪽 (mermaid가 코드로 남지 않음) · gate 없음, 두 번째 검토 없음
- S1b → G-PL1, G-PL2: 후속 글 08을 `07-alibaba-bot.md`와 저장 JSON으로 쓴다. 자리 A (설계 §9.2). 같은 연재에 한 번 발행한다. P8-09 PASS 뒤 main session이 바로 발행한다 (오너 승인 2026-11-18, #147). listed alternatives: none (설계 §9.2 B–E는 자리 후보다).
- M4 → S1b: 후속 글 08; exit: M4 행 16개 (P8-00…P8-11, P8-01b, P8-02c, P8-04a–c) 모두 닫힘 · `deploy/projects/ps-08-prod-<date>.txt`에 P8-11 항목마다 결과 줄 · P8-09 reviewer 1회 PASS (지적 고친 뒤); cycle 0/2; recovery 0/2
- Gate: 글 00–07에는 reviewer 1회뿐이다. 글 8개를 다 쓴 뒤, 운영 발행 전에 했다 (PS-2-08, 오너 2026-10-18, #124). 글 08은 따로 1회, 발행 전 (P8-09, 같은 연재 규칙). M1, M3 끝에는 검토가 없다. task별 review 행도 없다. 다음 milestone은 앞 exit가 닫혀야 열린다.
- 발행은 오너가 미리 허락했다. 검토 지적을 고치면 main session이 blog_agent로 바로 발행한다 (#124).
- MVP 사다리(MVP ladder)는 적용하지 않는다. 새 스키마, API, 파이프라인이 없다 (설계 §7).

## 그림 나누기 (#124 Q4)

| 종류 | F 번호 (설계 §4.2) | 만드는 이 |
| --- | --- | --- |
| mermaid 블록 6개 | F00a, F01a, F01b, F04a, F05a, F05b | sonnet-writer, 글 안 |
| matplotlib PNG 12장 | F00b, F00c, F02a, F02b, F03a, F03b, F03c, F04b, F06a, F06b, F07a, F07b | developer, `S/fig_NN.py` |
| 썸네일 PNG 8장 | 글마다 `NN-<slug>.png`, 1200×630 | developer, `S/thumbs.py` |

## Tactic: 데이터와 그림 (설계 D1–D3) → M1

- [x] **PS-1-01 (ENG) CSV 모으기 + 발행 스크립트 확인 (D1)** → M1
  - **AC** `S/data/`에 CSV 13개 = PNG 12장의 파일 이름과 같은 stem (예: `fig_00_numbers.csv`) + `thumbs.csv` (8행: NN, slug, 글자, 숫자, source) · 모든 CSV에 `source` 칸, 모든 행이 비어 있지 않음 · `source`의 경로 부분이 저장소 루트에서 `test -e` 통과 (검사 명령과 결과를 `S/figures.md` "Checks"에 적는다) · 잰 적 없는 값은 값 칸 빈칸 + `status` = `not measured` (설계 §6) · `fig_07_timeline.csv` = 설계 §3.1 T1–T10 10행 · `fig_06_decisions.csv` = `decisions.plan.md`의 결정 1개당 1행. 세는 명령과 두 숫자(행 수, 가장 큰 번호)를 "Checks"에 적는다 (오늘 `^> - \*\*#[0-9]+ ` 줄은 81개, 가장 큰 번호는 #124. 둘이 다르다) · `apps/blog_agent/scripts/publish_oneshot.py`를 읽고 "Publish check" 절에 file:line과 함께 적는다: (a) 넘긴 md 1개만 읽는가, (b) 같은 폴더의 어떤 PNG를 올리는가, (c) `S`가 발행되지 않는가. (c)가 아니면 STOP하고 돌려준다 · 실행 없음.
- [x] **PS-1-02 (ENG) `fig_style.py` + 차트 스크립트 6개 (D2)** → M1
  - **AC** `S/fig_style.py` = 글꼴 대체 목록 (`rules/figures.md` §5), `layout="constrained"`, 범례는 축 밖 위 (§2) · 차트가 있는 글마다 `S/fig_NN.py` 1개 (00, 02, 03, 04, 06, 07) · 스크립트가 읽는 경로는 `S/data/*.csv`뿐, 쓰는 경로는 `P/NN-<slug>/fig_NN_*.png`뿐 (grep `open(`, `read_csv`, `savefig`) · 실행 = `apps/blog_agent`에서 `OMP_NUM_THREADS=1 timeout 300 uv run --with matplotlib python <script>` (pyproject 변경 없음), 6개 모두 exit 0 · PNG 12장, 이름 = 설계 §4.2 파일 칸 · F02a 범례 = "cap (config)" / "measured" · F00c 글자 "list price" · F03c 수정 뒤 막대 = "not measured" · 스크립트는 `source` 빈칸 행이 있으면 0이 아닌 값으로 끝난다 · 고의 파손: CSV 한 행의 `source`를 비우면 exit ≠ 0, 되돌린 뒤 exit 0, 결과를 "Checks"에 적는다.
- [x] **PS-1-03 (ENG) 썸네일 8장** → M1
  - **AC** `S/thumbs.py`가 `S/data/thumbs.csv`만 읽는다 · 폴더 8개 = 설계 §3 폴더 칸 (`00-overview` … `07-debugging-timeline`), 폴더마다 `NN-<slug>.png` 정확히 1장 · `sips -g pixelWidth -g pixelHeight` = 1200 × 630 · 글자 = "Prettylog From Scratch · NN" + `thumbs.csv` 숫자 1개 · PS-1-02와 같은 실행 명령, exit 0.
- [x] **PS-1-04 (ENG) `S/figures.md` 그림 표 (D3)** → M1
  - **AC** 표 칸 = F 번호, 파일 (또는 "mermaid in NN"), 핵심 숫자, 출처 파일과 행 · 행 26개 = PNG 12 + mermaid 6 + 썸네일 8 · `P` 아래 PNG 중 표에 없는 파일 0개 (`ls` 결과와 비교, 명령을 "Checks"에) · mermaid 행의 출처 = `README.md` 행 범위 (F00a 38–48, F01a 117–141, F01b 196–223, F04a 155–185, F05a 239–262) 또는 `projects.design.md` §12.1 (F05b).

## Tactic: 글 쓰기 (설계 D4–D6) → M2

### 공통 AC (PS-2-00…07 모두)

- C1 파일 = `P/NN-<slug>/NN-<slug>.md`, 폴더 이름 = 설계 §3 폴더 칸.
- C2 앞머리(front matter) 키 = cnn `00-overview.md` 2–22행과 같다: `title`, `tags`, `desc`, `date`, `priority`, `userId: 1`, `username: taeklim`, `status: 'public'`. `priority` = NN.
- C3 제목 = `Prettylog From Scratch (n/7): <claim>`. 00만 `Prettylog From Scratch: <claim>`. 제목 숫자는 측정값 또는 설정값이다. 정가는 제목에 없다. 설계 §3 제목은 작업용이다. 15단어를 넘으면 writer가 claim을 줄인다. 숫자는 지킨다.
- C4 본문 첫 줄 = `![NN-<slug> thumbnail](NN-<slug>.png)`.
- C5 md가 참조하는 PNG는 모두 폴더에 있다. 폴더의 `fig_*.png`는 모두 md가 참조한다.
- C6 다이어그램은 ```mermaid 블록이다. 첫 줄은 `flowchart`, `graph`, `sequenceDiagram`, `timeline` 중 하나다. 다이어그램 PNG는 0장이다.
- C7 끝에 `## Sources` 표 (number, file, line or tag). 본문 숫자마다 1행. 날짜, 글 번호 n/7, 버전 번호는 뺀다. 경로마다 `test -e` 통과.
- C8 설계 §6 값을 쓰면 그 표의 문구 그대로 쓴다: `not measured`, `at list price (not a bill)`, `one snapshot`, `byte metric broken, no verdict`. §6에서 "쓰지 않는다" 값(egress GB, 방문자 수, 트래픽 양)은 0회.
- C9 영어. 줄표 grep (`rules/writing/style.md` §3) 0건. 코드 블록과 앞머리 밖 `;` 0개. 문장 15단어 이하.
- C10 본문 줄 수(앞머리 제외) ≤ 설계 §3 길이 칸 상한 + 10.
- C11 01–07은 다른 연재 글로 링크하지 않는다. 연재 지도(series map)는 00에만 있다.
- C12 쓰는 이 = `sonnet-writer`. 원본 = 설계 §3 그 행 + `S/figures.md`. 커밋 없음.

### 행

- [x] **PS-2-00 (WRITER) 00 개요 (D4)** → M2
  - **AC** 공통 AC · 제목 줄 아래 첫 문장 = "Every number here comes from a saved file. The README is the single source of truth." · F00a mermaid + `fig_00_numbers.png`, `fig_00_cost.png` · 월 비용 문장에 `at list price (not a bill)` · 연재 지도 표 7행, 링크 = 자리표 `/@taeklim/TBD-NN` (PS-3-04가 바꾼다) · 연재 제목은 기본값이다. 오너가 첫 발행 전에 바꿀 수 있다 (#124 Q1).
- [x] **PS-2-01 (WRITER) 01 요청 경로 (request path)** → M2
  - **AC** 공통 AC · F01a, F01b mermaid (README 117–141, 196–223행) · 한도 70 / 10 s, Cache Rules 4개가 Sources에 README 행으로 있다.
- [x] **PS-2-02 (WRITER) 02 1 GB VM** → M2
  - **AC** 공통 AC · `fig_02_memory_caps.png`, `fig_02_load_test.png` · heap 160 / 256 MB 옆에 "cap" 또는 "config" · p95 626 ms @ 8 rps 출처 = `01.status.md` 55–56행 또는 `07-testing.tex` · 475 MiB 옆에 `one snapshot`.
- [x] **PS-2-03 (WRITER) 03 엣지 캐시 (edge cache)** → M2
  - **AC** 공통 AC · `fig_03_*.png` 3장 · 640 / 640 출처 = `deploy/traffic/review/traffic-debug-evidence.md` [S-TDE-5], [S-TDE-7] · HIT 비율 문장 0개, URL별 "second GET HIT"만 · 스크롤 79 뒤 값 = `not measured`.
- [x] **PS-2-04 (WRITER) 04 Next.js 파이프라인 (pipeline)** → M2
  - **AC** 공통 AC · F04a mermaid (README 155–185행) + `fig_04_cc_units.png` · 19 → 13만 판정값, 13 → 12에는 "no recorded cause" · U1 = `byte metric broken, no verdict` · U4는 prefetch 수(×3)만, 시간 0개.
- [x] **PS-2-05 (WRITER) 05 빌드와 배포 (build and deploy)** → M2
  - **AC** 공통 AC · F05a mermaid (README 239–262행), F05b mermaid (`projects.design.md` §12.1) · workflow 7개, release 3개가 Sources에 README 행으로 있다.
- [x] **PS-2-06 (WRITER) 06 과정 (process)** → M2
  - **AC** 공통 AC · `fig_06_decisions.png`, `fig_06_gates.png` · 제목의 결정 수 = PS-1-01 "Checks"의 행 수 (설계의 121 아님, 같을 때만 121) · 그 수의 Sources 행 = `S/figures.md` "Checks".
- [x] **PS-2-07 (WRITER) 07 디버깅 타임라인 (debugging timeline, D6)** → M2
  - **AC** 공통 AC · `fig_07_timeline.png`, `fig_07_measured.png` · 사건 T1–T10마다 4행 표 Why / What / How / Why it matters (매핑 = 설계 §3.1) · 날짜 출처 없는 사건 0개 · 결론 표 = `books/debugging/15-traffic-overrun.md` §1.1, B7, B9, B10 행 있음 · A1 528 → 12 ms 옆에 "render time" · `## What we never measured` 절에 설계 §6 행 · 제목 숫자 16 / 6 / 2 = `fig_07_measured.csv` 합계.

- [x] **PS-2-08 (REVIEW) reviewer 1회: 글 8개 전체, 발행 전 (설계 D7)** → M2
  - **AC** PS-2-00…07 닫힌 뒤 1회 · 검사 = 공통 AC C1–C12 + 행별 AC + 그림 규칙 (`rules/figures.md` §7) + `S/figures.md` 출처 · 결과 파일 `ps.review.md` (PASS 또는 지적 목록, 지적마다 파일:행) · 지적은 sonnet-writer 또는 developer가 고친다. 고친 것은 main session이 검사 명령으로 확인한다. 두 번째 reviewer 실행은 없다 (#124).

## Tactic: 발행과 확인 (설계 D8) → M3

- [x] **PS-3-01 (MAIN) 발행 전 SELECT (읽기 전용)** → M3
  - **AC** M2 exit 닫힌 뒤 (PS-2-08 지적 고침) · `SELECT count(*) FROM categories WHERE title='prettylog' AND deleted_at IS NULL` = 0 · `my-work` 그룹 행 1개 (id 13–16 중, PG-2-04) · 출력 `deploy/projects/ps-precheck-<date>.txt`.
- [x] **PS-3-02 (MAIN/OWNER) 01 하나만 발행 + 렌더 확인** → M3
  - **AC** 발행은 오너 사전 허락 (#124), main session이 실행 · `apps/blog_agent`에서 `uv run python scripts/publish_oneshot.py --no-llm ./posts/projects/my-work/prettylog/01-request-path/01-request-path.md` 1회 · 글 URL `?probe=$T` 200 · 오너 시각 확인: mermaid 2개가 그림으로 보인다 (코드 블록으로 남지 않음), 썸네일 보임 · 코드로 남으면 STOP. 고칠 행을 새로 연다 · slug를 `deploy/projects/ps-publish-<date>.txt`에 적는다.
- [x] **PS-3-03 (MAIN) 02 → 07 발행** → M3
  - **AC** PS-3-02 PASS 뒤 · 글마다 1회, 순서 02 → 07 · 글마다 URL `?probe=$T` 200 · slug 6개를 같은 publish 파일에 더한다 · 발행 뒤 `prettylog` 카테고리 1행, 부모 = `my-work`.
- [x] **PS-3-04 (WRITER) 00 연재 지도 링크를 실제 slug로** → M3
  - **AC** 원본 = `deploy/projects/ps-publish-<date>.txt` · 00 md의 `TBD-NN` 0개 · 지도 링크 7개 = `/@taeklim/<slug>`, slug가 publish 파일과 글자 단위로 같다.
- [x] **PS-3-05 (MAIN) 00 발행** → M3
  - **AC** PS-3-04 뒤 · 1회 · URL 200 · 지도 링크 7개 모두 `?probe=$T` 200 · slug를 publish 파일에 더한다 (8개).
- [x] **PS-3-06 (MAIN) purge + 운영 확인 (설계 §5.3)** → M3
  - **AC** `_scripts/cloudflare/cf-purge.sh` 1회 · `/@taeklim/projects` HTML에 `id="my-work"` 구역 카드 1개 (prettylog), `id="utrgv"` 카드 1개, `id="my-work"`가 앞 · 배지 2 · `/@taeklim/projects/prettylog` 200, 글 8개, 순서 00 → 07 · `/@taeklim/projects/cnn-from-scratch` 200 · `/@taeklim/projects/my-work` 404 · `sitemap.xml`에 새 URL 8개 · `_scripts/cloudflare/traffic-check.sh` FAIL 0 · 새 글 2개 + `/@taeklim/projects` 둘째 GET `cf-cache-status: HIT` · `prettylog` 카테고리 1행 · 출력 `deploy/projects/ps-prod-<date>.txt`.
- [x] **PS-3-07 (OWNER) 8쪽 시각 확인** → M3 (2026-10-18 오너: mermaid 보임, 8편 ok, #126)
  - **AC** 글 8개마다 한 줄: mermaid 그림으로 보임, 썸네일 보임, 오른쪽 rail에 TOC + tree · main session이 결과 줄을 `ps-prod-<date>.txt`에 더한다.

## Tactic: 후속 글 08, 봇 egress (설계 §9) → M4

- 원본: 설계 §9.7 단계표 + `07-alibaba-bot.md` "수정 전후 흐름" 절 (38–149행: 전, 후, 숫자로 본 차이, 아직 바뀌지 않은 두 줄, 예상 효과). 판정선: #146. 오너 답: #145 (O2–O6, O8 = 설계 §9.9 기본값), #147.
- 줄인 이름: `H` = `deploy/traffic/review/history/`. `AF` = `H/2026-11-18-alibaba-bot/after-2026-11-20/` (#147: "후" 파일은 그 폴더 아래. 하위 폴더라 "전" `*.json`과 섞이지 않는다).
- 실행 (ENG 행): `apps/blog_agent`에서 `OMP_NUM_THREADS=1 timeout 300 uv run --with matplotlib python <script>`. 모델 없음. 테스트 러너 없음.
- 스크립트 입력 = `S/data/*.csv` + `H/2026-11-18-alibaba-bot/*.json` (#145) + `AF/*.json`, `AF/*.txt` (#147)뿐. 그 밖의 `.txt` ("전" `supabase-query-summary.txt`, `error-log.txt`, P8-01b `db-size.txt`)는 developer가 Read로 손으로 모은다: 행마다 `source` = 파일:행, "Checks"에 `grep` 대조 명령과 결과.
- 예상 효과 표의 칸 규칙: 11-19 하루 실측(P8-02, P8-02c, P8-03)이 있으면 실측값. 없으면 "Estimate" + 근거, 또는 `not measured`. "Estimate"는 근거의 입력이 모두 저장 파일일 때만 쓴다 (Q-PS5).
- P8-02b(응답 크기) 행은 열지 않는다. O3 기본값 = 안 잰다 (#145).
- O8은 끝났다: main session이 `07-alibaba-bot.md` §6.1 22:30 403을 107로 고쳤다 (99, 323행).

- [x] **P8-00 (PM) 판정선 기록** → M4 (2026-11-18, #146)
  - **AC** `decisions.plan.md` #146에 V1, V2 칸이 설계 §9.6 표 그대로 · 같은 행에 최소 표본 1,000 (`not comparable`), `none` 미포함, `partial` 줄 · 자리 A, 제목 T1, 발행 규칙은 설계 §9.2, §9.3, §9.6 인용 · P8-02 수집 전에 쓴다.
- [x] **P8-01 (MAIN) 증거 커밋** → M4 (main session, `da7501a`, `e50f89c`)
  - **AC** `git ls-files`에 `deploy/traffic/review/07-alibaba-bot.md`, `H/2026-11-18-alibaba-bot/`의 파일 10개 (`cf-after-*-15min.json`, `cf-after-README.txt` 포함), `tips/bot-egress.tips.html`.
- [x] **P8-01b (MAIN) DB 크기 조회 결과 저장** → M4 (DONE 2026-11-18 `4c0cbb3`: `db-size.txt`. "전" 값은 정리 전 터미널 조회의 옮겨 적은 값이다. 원문 출력은 없다 → 글의 DB size "전" 칸 처리는 P8-04c AC를 따른다)
  - **AC** 지금 가능 · `H/2026-11-18-alibaba-bot/db-size.txt` 1개 · 줄마다 쿼리 원문 (`pg_total_relation_size`, `pg_database_size`), 출력, UTC 시각 · "전" (정리 전) 값 = 그 세션 출력 원문과 그 시각. 원문이 남아 있지 않으면 파일에 "before: output not saved"라고 쓴다. 그때 글의 "전" 칸은 `not measured` · "후" 값 = 읽기 전용 조회 1회 (pooler에서 세션 `SET` 금지) · 근거 문서 = `07-alibaba-bot.md` §9.1 (`error_log` 176 → 22 MB, DB 190 → 35 MB) · 글은 이 파일이 생긴 뒤에만 그 숫자를 쓴다.
- [ ] **P8-02 (MAIN) 11-19 하루 수집 (V1, V2 창)** → M4
  - **AC** 2026-11-20 00:00 UTC 뒤, P8-00 뒤 (`check.md` 14번) · `AF`에 `cf-24h-api.json` (11-19 00:00 ~ 24:00 UTC, host = `blog-api.prettylog.com`, 차원 path + cacheStatus, limit ≥ 100) · `cf-posts-page-daily.json` (차원 date + `edgeResponseStatus`, 11-19 행 필수) · `cf-zone-daily.json` (11-19 행 필수) · `clientIP` 차원 0 · 쿼리 원문 `AF/query.txt` · 보존이나 토큰으로 실패하면 오류 출력을 `AF/query.txt`에 적고 닫는다. 그때 P8-04b의 "후" 칸은 `not measured`.
- [ ] **P8-02c (MAIN) `error_log` 일별 행 수 저장** → M4
  - **AC** 2026-11-20 00:00 UTC 뒤 · 읽기 전용 SELECT 1회 (`error-log.txt` 형식, 일별, 11-12 ~ 11-19) · 출력 `AF/error-log-daily.txt`, 쿼리 원문과 UTC 시각 포함 · 실패하면 오류를 같은 파일에 적고 닫는다. 그때 글의 `error_log` 쓰기 "후" 칸은 `not measured`.
- [ ] **P8-03 (OWNER) WAF Events + Supabase Usage 저장** → M4
  - **AC** 2026-11-20 뒤 · `AF/waf-events.*` (규칙별 차단, Challenge 수). 없으면 글의 그 칸은 `not measured` · (선택, O2) Supabase Usage egress 화면 `AF/supabase-usage.*`, 일별 막대에 11-09 ~ 11-19가 보이게. 없으면 Supabase egress 두 칸은 `not measured` · 오너가 "저장함" 또는 "안 함"을 말하면 main session이 `01.status.md`에 한 줄 적고 닫는다.
- [x] **P8-04a (ENG) "전" CSV + N (11-18 증거만)** → M4 (DONE 2026-11-18: N = 219,372 · V1 전 0.9992 · V2 전 18,107, 실패선 9,053.5 · 고의 파손 1회 exit 1 → 복구 exit 0 · Checks `S/figures.md` §7–§10)
  - **AC** `S/extract_08.py`가 읽는 경로 = `H/2026-11-18-alibaba-bot/*.json`뿐, 쓰는 경로 = `S/data/fig_08_daily_requests.csv`, `fig_08_api_cache.csv`의 `source`가 `H/2026-11-18-alibaba-bot/`인 행뿐 (grep `open(`, `json.load`, `to_csv`) · 다른 `source`의 행은 다시 실행해도 그대로 남는다 · exit 0 · `fig_08_daily_requests.csv`, `fig_08_api_cache.csv` = 설계 §9.5 열. 11-18 행과 22:30 구간 `status` = `partial`. 11-19 "후" 행은 값 빈칸 + `status` = `not measured` · `fig_08_api_cache.csv` 22:30 403 = 107 · `fig_08_supabase_calls.csv` 6행 (#1–#5, #7)과 `fig_08_error_log.csv` (11-16 주 `partial`)는 손으로 (`supabase-query-summary.txt:1-14`, `error-log.txt:1-2`, `error-log.txt:4-12`) · `S/verdict_08.py`가 `S/data/*.csv`만 읽고 `fig_08_verdicts.csv` (id, metric, before, after, ratio, verdict, source)만 쓴다. 이 파일의 유일한 작성자다 · 행 V1, V2, V2b: before 칸 채움, V2 실패선 = 11-09 ~ 11-17 가장 작은 날의 50 % (스크립트가 셈), after 빈칸, verdict `not measured` · N = `H/2026-11-18-alibaba-bot/cf-posts-page-daily.json`의 11-09 ~ 11-17 9행 합, 스크립트가 셈. N은 이 파일로 고정이다. 11-20 재수집은 N을 바꾸지 않는다 · N, V1 전 비율, V2 실패선을 명령과 함께 `S/figures.md` "Checks"에 · 모든 행 `source` 비어 있지 않음, 경로 부분 `test -e` 통과.
- [ ] **P8-04b (ENG) "후" 값 + 판정** → M4
  - **AC** P8-02 닫힌 뒤 (P8-02c, P8-03은 있으면 쓴다) · `extract_08.py`가 `AF/*.json`, `AF/*.txt`도 읽어 11-19 행과 "후" 행을 채운다 (#147). 손으로 넣는 "후" 값 0개 · 쓰는 경로는 P8-04a와 같다 · 다시 실행해도 `source`가 손으로 모은 파일인 행은 그대로 남는다 · `/@taeklim/posts` 11-19 값은 200만 센다 (V2 정의) · `verdict_08.py` 다시 실행, exit 0 · `verdict_08.py`는 `source` 빈칸 행이 있으면 exit ≠ 0 · verdict 칸 = `pass`, `fail`, `partial`, `not comparable`, `not measured` 중 하나. #146 선으로 정한다. 통과 여부와 관계없이 값이 나오면 닫힌다 · V1 4경로 요청 < 1,000이면 `not comparable` · `none`은 따로 행, 오리진 도달에 넣지 않는다 · P8-02가 실패로 닫혔으면 after 빈칸 + `not measured`로 닫는다 · `partial`이면 같은 편집에서 행을 연다 (V1: 캐시 헤더, V2: 규칙 식) · N 불변 (P8-04a "Checks" 값과 같음).
- [ ] **P8-04c (ENG) 예상 효과 표 CSV** → M4
  - **AC** P8-04b, P8-01b 뒤 · `S/impact_08.py`가 `S/data/*.csv`만 읽고 `S/data/impact_08.csv`만 쓴다. exit 0. `source` 빈칸 행이 있으면 exit ≠ 0 · 열 = metric, side (`before` / `after`), value, unit, kind, basis, source · kind = `measured`, `estimate`, `not measured` 중 하나 · 지표 6개 × 2칸 = 12행: SSR page hits (하루), Supabase SQL calls (하루), Supabase egress, VM egress, `error_log` writes (하루), DB size · "전" 날 = 11-17 (조치 전 마지막 온전한 날). DB size만 정리 전후 (P8-01b) · kind 규칙: AF의 11-19 값이 있으면 `measured`. 없으면 basis의 입력이 모두 저장 파일일 때만 `estimate`, 아니면 `not measured` · basis 칸 = 식과 입력 파일. 예: "page hits × SQL per page" · SQL per page의 출처 = 코드 파일:행 또는 저장 파일. 없으면 SQL 두 칸 `not measured` · Supabase egress = P8-03 Usage 파일이 있을 때만 `measured`, 아니면 `not measured` (응답 바이트 파일 없음, O3) · VM egress `estimate`의 근거 = `cf-zone-daily.json`의 `bytes` − `cachedBytes` · DB size 두 칸 = `db-size.txt`. "before: output not saved"이면 "전" 칸 `not measured` · 11-08 1,943 같은 "공격 전" 값은 basis 칸에만 둔다 · 12행 kind와 basis를 "Checks"에 명령과 함께.
- [ ] **P8-05 (ENG) `fig_08.py` + PNG 4장** → M4
  - **AC** P8-04b 뒤 · PS-1-02 AC와 같은 규칙: 읽기 `S/data/*.csv`만, 쓰기 `P/08-bot-egress/fig_08_*.png`만 (grep `read_csv`, `savefig`), `fig_style.py` 사용, 범례 축 밖 위 · PNG 4장 이름 = 설계 §9.5 F08a–F08d 파일 칸 · `not measured` 막대는 빈 막대 · F08a 11-18 빗금, 세로선 1개 (11-18 22:30 ~ 22:35) · 기존 PNG 20장 (차트 12 + 썸네일 8) `shasum` 전후 같음 · 고의 파손: CSV 한 행의 `source`를 비우면 `fig_08.py`, `verdict_08.py` exit ≠ 0, 되돌린 뒤 exit 0. "Checks"에 결과.
- [x] **P8-06 (ENG) 썸네일 08** → M4 (DONE 2026-11-18: `08-bot-egress.png` 1200×630, 기존 PNG 20장 shasum 불변. `thumbs.py`에 NN 인자와 고정 8칸 격자 추가)
  - **AC** P8-04a 뒤 (N만 필요) · `thumbs.csv`에 08 행 1개, 숫자 = "Checks" N · 오늘 `thumbs.py`는 모든 행을 그린다 (`thumbs.py:40` `for row in rows`). 실행 1회가 쓰는 파일 = `08-bot-egress.png` 1장뿐 (실행 전후 `ls -l P/*/*.png` 비교를 "Checks"에) · `P/08-bot-egress/08-bot-egress.png` 1장, `sips` = 1200 × 630 · 위 글자 "Prettylog From Scratch · Follow-up", 격자 8칸 모두 회색 · 기존 썸네일 8장 `shasum` 전후 같음 · exit 0.
- [ ] **P8-07 (ENG) `S/figures.md` 행 + mermaid 원문** → M4
  - **AC** P8-04c, P8-05, P8-06 뒤 · 표에 행 8개 추가 (F08a–F08d, M08a, M08b, M08c, TH08), 행 26개 → 34개 · `S/data/M08a.mmd` = 수정 전 흐름 (핵심 흐름), 첫 줄 `flowchart TD`, 원본 `07-alibaba-bot.md` 15–31, 40–61행 · `S/data/M08c.mmd` = 수정 후 흐름, 첫 줄 `flowchart TD`, 원본 63–90행: WAF 규칙 3개가 엣지에서 끊는 곳, 4경로 (`/profile`, `/tags`, `/categories`, `/users/taeklim/tags`) `HIT`, 바뀌지 않은 두 줄 (`/@taeklim/posts` MISS, `/users/taeklim` MISS) · `S/data/M08b.mmd` 첫 줄 `flowchart LR` · M08a, M08c에 바이트 라벨 0 (KB, GB grep 0, O3) · M08c의 규칙 라벨은 규칙마다 한 줄 설명뿐, 식 0 (O4) · M08c의 `error_log` 22 MB 라벨은 `db-size.txt`에 그 값이 있을 때만 · `P` 아래 PNG 중 표에 없는 파일 0개 (`ls` 비교, 명령을 "Checks"에).
- [ ] **P8-08 (WRITER) 글 08 작성** → M4
  - **AC** P8-07 뒤 · 공통 AC C1, C2, C4–C7, C9, C12 그대로 · C3 대신: 제목 = `Prettylog From Scratch (Follow-up): <N> Feed Page Requests in 9 Days, All Past the Cache`, N = "Checks" 값 · C8 대신: §6 문구 + egress 칸은 `impact_08.csv` kind 그대로 (`measured` 값, "Estimate: <value> (<basis>)", 또는 `not measured`) · C10 대신: 본문 ≤ 110줄 (mermaid 3개 + 예상 효과 표) · C11: 다른 연재 글 링크 0개 · 앞머리 = 설계 §9.3 (`priority` 8, tags 8개, `desc` 170자 이하) · 절 순서 = Results → The core flow (before, M08a) → After the fixes (M08c + "two lines not changed yet" 2행) → Problem → How it was checked → Fixes → Expected impact → What we never measured → Sources · ```mermaid 블록 3개 = M08a, M08b, M08c 원문과 같다 · Expected impact 표: 행 6개 (SSR page hits, Supabase SQL calls, Supabase egress, VM egress, error_log writes, DB size), 열 before / after, 칸 = `impact_08.csv` 그대로 · `estimate` 칸은 "Estimate"와 basis를 함께 쓴다. Q-PS5 답이 D-row로 오기 전에는 `estimate` 칸도 `not measured`로 쓴다 · DB size 행 옆에 "manual cleanup (DELETE + VACUUM FULL), not a fix effect" · 07의 추정 1 GB, 30 GB, "95 %" 0회 (`impact_08.csv`에 없는 값) · Results 숫자 = `fig_08_verdicts.csv`만 · 10-22 시작 옆 "inferred" · "both fixes combined" 1회 이상 · `fig_08_verdicts.csv`에 하루 after 값이 있으면 "one day, one window" 1회 이상 · WAF 규칙 2 식 0회 (O4) · 전체 IP 0회, ASN과 `/16` 대역만 · VM IP 0회 · 38 KB, 11 KB, 50 KB, 11 GB, 157,153 각 0회 · 캡션 두 문장, 둘째 "Why:", 끝 `Data: _series/data/<csv>` · 00 md 변경 0 (O5).
- [ ] **P8-09 (REVIEW) reviewer 1회: 글 08, 발행 전** → M4
  - **AC** P8-08 뒤 1회 · 검사 = PS-2-08 검사 + P8-08 AC + `rules/figures.md` §7 + "Checks" 출처 · 결과 `ps-08.review.md` (PASS 또는 지적 목록, 지적마다 파일:행) · 지적은 sonnet-writer 또는 developer가 고친다. main session이 검사 명령으로 확인한다 · 두 번째 reviewer 실행 없음 (#124와 같은 연재 규칙).
- [ ] **P8-10 (MAIN) 발행 (한 번)** → M4
  - **AC** P8-09 PASS (지적 고침) 뒤 바로 (S1b 승인, #147) · 발행 전 SELECT (읽기 전용): 새 slug 행 0개 · `apps/blog_agent`에서 `uv run python scripts/publish_oneshot.py --no-llm ./posts/projects/my-work/prettylog/08-bot-egress/08-bot-egress.md` 1회. 00–07 다시 발행 0회 · 글 URL `?probe=$T` 200 · SELECT 결과와 slug를 `deploy/projects/ps-08-publish-<date>.txt`에.
- [ ] **P8-11 (MAIN + OWNER) purge + 운영 확인** → M4
  - **AC** P8-10 뒤 · `_scripts/cloudflare/cf-purge.sh` 1회 · `/@taeklim/projects/prettylog` 200, 글 9개, 순서 00 → 08 · 기존 8개 slug 200 · `_scripts/cloudflare/traffic-check.sh` FAIL 0 · 새 글 둘째 GET `cf-cache-status: HIT` · `sitemap.xml`에 새 URL 1개 · 오너 시각 확인: mermaid 3개가 그림, 썸네일 보임 · 출력 `deploy/projects/ps-08-prod-<date>.txt`.

## 열린 질문 (오너)

| # | 질문 | 기본값 |
| --- | --- | --- |
| Q-PS1 | 연재 제목 (#124 Q1 답 없음). PS-3-02 전에 답이 필요하다 | A "Prettylog From Scratch" (확정, #126) |
| Q-PS2 | G-PL1, G-PL2 승인과 날짜. 답은 D-row로 적고 DRAFT를 지운다 | 없음 |
| Q-PS3 | #145 예외를 "후" JSON과 `.txt`까지 넓히나 | 닫힘: 넓힌다. "후" 파일은 `H/2026-11-18-alibaba-bot/` 아래 (#147) |
| Q-PS4 | S1b 승인 (설계 §9.8) | 닫힘: 승인. P8-09 PASS 뒤 바로 발행 (#147) |
| Q-PS5 | 예상 효과 표의 "Estimate" 칸 (근거와 함께)은 Constraints "잰 적 없는 값은 `not measured`"의 예외다. 이 예외를 Constraints에 적나. 답은 D-row로 적는다 | 없음. D-row 전에는 `estimate` 칸도 `not measured` (P8-08) |

- PG G1 날짜는 `pg.plan.md` Q-PG2에 있다. 여기에 다시 적지 않는다.

## 설계 정정 필요 (architect, rev2)

- §4.1 "블로그는 mermaid를 그리지 못한다"는 낡았다. `MermaidDiagram.client.tsx`가 있다 (`5b23750`, #124).
- §4.1 "README 다이어그램은 PNG로 다시 그린다": 이제 mermaid 블록이다. §4.2 F00a, F01a, F01b, F04a, F05a, F05b 행의 `.png` 파일 칸이 없어진다.
- §1 표 "그림" 행과 §8 Q4 기본값: #124로 바뀌었다.
- §8 Q1, Q2 번호가 오너에게 보인 순서와 다르다 (#124).
- §0 G-PL1 배지 2는 연재 끝 값이다. PG G1 배지 4와 다르다 (`pg.plan.md` 16행).
- §6, F06a "결정 121": 행 수와 가장 큰 번호가 다르다 (PS-1-01 "Checks").
- README mermaid는 `<br/>` 줄바꿈을 쓴다. 렌더러는 `securityLevel: 'strict'`다. 운영에서 그려지는지는 PS-3-02가 처음 본다.
- §9.7 P8-04를 P8-04a ("전", 지금 가능)와 P8-04b ("후" + 판정, 11-20 뒤)로 나눴다 (pm, 2026-11-18).
- §9.9 O7은 #145, #147로 닫혔다: 스크립트가 `H/2026-11-18-alibaba-bot/*.json`과 `AF`를 바로 읽는다. 새 스크립트 `extract_08.py`, `verdict_08.py`, `impact_08.py`. `S/data/raw/` 사본은 없다.
- §9.6, §9.7 "후" 폴더 `H/2026-11-20-after/` → `AF` = `H/2026-11-18-alibaba-bot/after-2026-11-20/` (#147).
- §9.4 절 순서와 §9.5 mermaid: 오너 요청(2026-11-18)으로 수정 후 흐름 M08c와 "Expected impact" 표가 더해졌다. M08a = 수정 전 흐름. 본문 상한 80 → 110줄.
- §9.4, §9.6 "egress GB 쓰지 않음"과 예상 효과 표: Supabase egress는 P8-03 파일이 있을 때만 실측. VM egress "Estimate"는 Cloudflare `bytes`를 쓴다. 설계 §6 "byte metric broken" (PS-2-04 U1)과 맞는지 architect가 본다.
- §9.7 P8-01 "9개": 증거 폴더 파일은 10개다 (`cf-after-README.txt` 포함).
- mermaid 원문 이름: §9.5 `S/data/F08*.mmd`, §9.7 `M08a.mmd`. 계획은 `M08a.mmd`, `M08b.mmd`를 쓴다.
- WAF 규칙 수: §9.6과 #146은 "규칙 2개", `check.md` 14번은 "WAF 규칙 3개". P8-03 저장 파일이 실제 수를 보인다.
- §9.7 P8-06 "`thumbs.py`는 지정한 NN만 그린다": 오늘 코드는 모든 행을 그린다 (`thumbs.py:40`). P8-06이 고친다.
