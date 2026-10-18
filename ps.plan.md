# Phase PS: Prettylog From Scratch 연재 (series)

> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.

- 상태: PLANNED (2026-10-18). 행 20개, 모두 열림. M1 0/4, M2 0/9, M3 0/7. reviewer는 PS-2-08 1회뿐 (발행 전, #124). 오너 질문 2개.
- 설계: `prettylog-series.design.md` rev1 (system-architect). 오너 답: `decisions.plan.md` #122, #124.
- 설계와 #124가 다르면 #124를 따른다. 다른 곳은 아래 "설계 정정 필요" 절에 적는다.
- 줄인 이름: `P` = `apps/blog_agent/posts/projects/my-work/prettylog/`. `S` = `P/_series/`.

## Mission block

- Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
- Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)
- Constraints: 글은 영어 (#124 Q2) · 글의 숫자는 모두 저장된 파일에서 온다. 잰 적 없는 값은 "not measured"로 쓴다 · `posts/`와 `S`는 gitignore다. 커밋하지 않는다 (#124 Q3, `apps/blog_agent/.gitignore` 213행) · 오래 남길 증거(사전 SELECT, slug, 운영 curl)는 커밋되는 `deploy/projects/ps-*.txt`에 쓴다 (`pg-2-prod-2026-10-18.txt` 선례) · 다이어그램(diagram) = 글 안 ```mermaid 블록. 데이터 차트(chart)만 matplotlib PNG (#124 Q4) · 로컬 실행 = `~/.claude/CLAUDE.md` "Allowed locally" (입력 = `S/data/*.csv`만, 한 코어, 300 s) · 발행(publish), 운영 SQL, purge, 운영 curl = main session 또는 오너만 · 프로젝트 이름 `prettylog`는 그룹 사이에서도 하나뿐 (#121) · 발행 순서 = 01 → 07, 00 마지막 (설계 §5.2) · 테스트 러너 금지, 검증 = 검사 명령 + 고의 파손(deliberate breakage) + 운영 curl.
- G-PL1 (DRAFT, owner approval pending): 연재 글 8개가 운영에 있다. measure: `/@taeklim/projects/prettylog` 200, 글 8개, 순서 00 → 07 · Projects 화면 `id="my-work"` 구역에 카드 prettylog 1개 · 메뉴 배지 2 (cnn + prettylog. PG G1의 배지 4는 recobell, adriel 발행 뒤, `pg.plan.md` 16행). by: date TBD (owner).
- G-PL2 (DRAFT, owner approval pending): 글의 모든 숫자에 저장된 출처 파일이 있다. measure: 글 8개 `## Sources` 표에 없는 본문 숫자 0개, 출처 경로 `test -e` 실패 0개. by: date TBD (owner).
- S1 → G-PL1, G-PL2: `README.md`를 단일 출처(single source of truth, SST)로 두고 설계 rev1의 글 8개를 쓴다 (오너 #122, #124). listed alternatives: none (설계가 든 A/B/C는 제목 후보다).
- M1 → S1: 데이터와 그림 준비; exit: PS-1-01…04 닫힘 · `S/figures.md`에 PNG 12장, mermaid 6개, 썸네일(thumbnail) 8장이 행마다 출처와 함께 있다 · 고의 파손 1회 기록 · gate 없음 (진행 표시)
- M2 → S1: 글 00–07 작성 + 유일한 검토; exit: PS-2-00…07 닫힘 · md 8개가 "공통 AC" 검사 명령을 모두 통과 · PS-2-08 reviewer 1회 PASS, 지적을 고친 뒤 (설계 D7); cycle 0/2; recovery 0/2
- M3 → S1: 발행과 운영 확인; exit: PS-3-01…07 닫힘 · `deploy/projects/ps-prod-<date>.txt`에 G-PL1 measure 항목마다 결과 줄 · 오너 시각 확인 8쪽 (mermaid가 코드로 남지 않음) · gate 없음, 두 번째 검토 없음
- Gate: 연재 전체에 reviewer 1회뿐이다. 글 8개를 다 쓴 뒤, 운영 발행 전에 한다 (PS-2-08, 오너 2026-10-18, #124). M1, M3 끝에는 검토가 없다. task별 review 행도 없다. 다음 milestone은 앞 exit가 닫혀야 열린다.
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
- [ ] **PS-3-07 (OWNER) 8쪽 시각 확인** → M3
  - **AC** 글 8개마다 한 줄: mermaid 그림으로 보임, 썸네일 보임, 오른쪽 rail에 TOC + tree · main session이 결과 줄을 `ps-prod-<date>.txt`에 더한다.

## 열린 질문 (오너)

| # | 질문 | 기본값 |
| --- | --- | --- |
| Q-PS1 | 연재 제목 (#124 Q1 답 없음). PS-3-02 전에 답이 필요하다 | A "Prettylog From Scratch" |
| Q-PS2 | G-PL1, G-PL2 승인과 날짜. 답은 D-row로 적고 DRAFT를 지운다 | 없음 |

- PG G1 날짜는 `pg.plan.md` Q-PG2에 있다. 여기에 다시 적지 않는다.

## 설계 정정 필요 (architect, rev2)

- §4.1 "블로그는 mermaid를 그리지 못한다"는 낡았다. `MermaidDiagram.client.tsx`가 있다 (`5b23750`, #124).
- §4.1 "README 다이어그램은 PNG로 다시 그린다": 이제 mermaid 블록이다. §4.2 F00a, F01a, F01b, F04a, F05a, F05b 행의 `.png` 파일 칸이 없어진다.
- §1 표 "그림" 행과 §8 Q4 기본값: #124로 바뀌었다.
- §8 Q1, Q2 번호가 오너에게 보인 순서와 다르다 (#124).
- §0 G-PL1 배지 2는 연재 끝 값이다. PG G1 배지 4와 다르다 (`pg.plan.md` 16행).
- §6, F06a "결정 121": 행 수와 가장 큰 번호가 다르다 (PS-1-01 "Checks").
- README mermaid는 `<br/>` 줄바꿈을 쓴다. 렌더러는 `securityLevel: 'strict'`다. 운영에서 그려지는지는 PS-3-02가 처음 본다.
