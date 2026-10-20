# Phase RS: Recobell 프로젝트 연재 (series)

> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.

- 상태: PLANNED (2026-10-19). 행 25개, 모두 열림. M1 0/4, M2 0/11, M3 0/10. reviewer는 RS-2-20 1회뿐 (발행 전, #124 선례). 오너 보안 확인 RS-3-00 전에는 발행과 카테고리 SQL이 없다 (#128). 오너 질문 17개.
- 설계: `recobell-series.design.md` rev1 (system-architect, 2026-10-19). 오너 결정: `decisions.plan.md` #127, #128. 선례: `ps.plan.md` (#124–#126).
- 설계와 #127, #128이 다르면 결정 행을 따른다. 다른 곳은 아래 "설계 정정 필요" 절에 적는다.
- 줄인 이름: `R` = `apps/blog_agent/posts/projects/recobell/`. `S` = `R/_series/`. `SRC` = `~/Desktop/_job_recobell/` (읽기 전용).
- 프로젝트 폴더: `R/rec-solution/NN-<slug>/` (글 7), `R/knn-demo/NN-<slug>/` (글 3). 폴더 이름 = 설계 §6.2 폴더 칸.

## Mission block

- Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
- Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)
- Constraints: 글은 영어 (#124 선례) · 공개 범위 = 구조만, 비밀 제거 (#127, 설계 §8) · `SRC`는 읽기만 한다. 빌드, 테스트, 스크립트 실행 0 (`~/.claude/CLAUDE.md` "No local execution") · 설계 §8.1 "고객 데이터" 행의 파일은 아무도 열지 않는다 · 비밀 값은 노트에도 옮기지 않는다. 노트는 `R` 안에만 (gitignore) · 숫자 = 코드의 설정값만, 이름표를 붙인다 (설계 §6.3). 측정값(트래픽, 지연, 비용, 정확도)은 0개 · 인프라 상자마다 [F]/[R]/[M] (설계 §3) · 다이어그램 = 글 안 mermaid 블록. 차트 PNG 0장 (설계 §6.2) · 썸네일 실행 = `~/.claude/CLAUDE.md` "Allowed locally" (입력 = `S/data/thumbs.csv`만, 한 코어, 300 s) · `posts/`는 커밋하지 않는다. 오래 남길 증거는 커밋되는 `deploy/projects/rb-*.txt`에 쓴다 · **오너 보안 확인 전 발행 0, 카테고리 SQL 0 (#128).** main session은 검토 지적을 고친 뒤 멈추고 폴더를 오너에게 넘긴다 · 카테고리 SQL U1은 첫 발행 전 (설계 §7.1 3단계) · 발행, 운영 SQL, purge, 운영 curl = main session 또는 오너만 · 발행 순서 = 프로젝트마다 01 → 마지막, 00은 끝 (설계 §7.1) · soft-delete만, hard DELETE 0 · 테스트 러너 금지. 검증 = 검사 명령 + 고의 파손(deliberate breakage) + 운영 curl.
- G-RB1 (DRAFT, owner approval pending): 연재 글 10개가 운영에 있다. measure: `/@taeklim/projects/rec-solution` 200, 글 7개, 순서 00 → 06 · `/@taeklim/projects/knn-demo` 200, 글 3개, 순서 00 → 02 · `/@taeklim/projects` HTML에 `id="recobell"` 구역 카드 2개, 위치 `id="my-work"` < `id="recobell"` < `id="utrgv"` · 메뉴 배지 4. by: date TBD (owner).
- G-RB2 (DRAFT, owner approval pending): 모든 인프라 상자에 출처가 있다. measure: 설계 C번호 상자를 그린 mermaid 블록(아래 그림 표 "F/R/M" 칸 = 예)의 노드(node) 줄마다 `[F]`, `[R]`, `[R+F]`, `[M]` 중 하나 · `[F]`, `[R]` 상자의 출처 경로가 `S/figures.md`에 있고 `SRC` 아래에서 `test -e` 통과 · `[M]` 상자는 설계 §9 질문 번호가 있다. by: date TBD (owner).
- G-RB3 (DRAFT, owner approval pending): 비밀이 공개되지 않는다. measure: 발행 전 `R` 전체에 설계 §8.3 grep 0건 (또는 맞은 줄마다 사유) · 오너 보안 확인 10폴더 OK (#128) · 발행 뒤 운영 HTML 10쪽에 같은 grep 0건. by: date TBD (owner).
- S1 → G-RB1, G-RB2, G-RB3: 설계 rev1의 글 10개를 코드 근거로 쓴다. 그룹 행 = `company` 행 이름 바꾸기 (설계 §2.1 A, 오너 OK 대기). listed alternatives: none (그룹 모델은 #119, 공개 범위는 #127. 설계 §6.1 A/B는 제목 후보다).
- M1 → S1: 준비; exit: RS-1-01…04 닫힘 · `decisions.plan.md`에 Q1–Q15 답 또는 "default" D-row · i18n 키 커밋이 main에 있고 GH Actions build 초록 · `S/figures.md` 행 35개 · 썸네일 10장 · `S/redaction-check.md` 고의 파손 1회 기록 · gate 없음 (진행 표시); cycle 0/2; recovery 0/2
- M2 → S1: 글 10개 + 유일한 검토 + 오너에게 넘김; exit: RS-2-00…06, RS-2-10…12 닫힘 · md 10개가 공통 AC 검사 명령을 모두 통과 · RS-2-20 reviewer 1회, 지적을 고친 뒤 main session이 검사 명령으로 확인 · main session이 폴더 10개 목록을 오너에게 넘김 (#128). 발행 없음; cycle 0/2; recovery 0/2
- M3 → S1: 오너 보안 확인, 카테고리, 발행, 운영 확인; exit: RS-3-00…09 닫힘 · RS-3-00 오너 OK 10폴더 (#128) · `deploy/projects/rb-pre-<date>.txt`에 P1–P4 + U1 영향 행 1 · `deploy/projects/rb-prod-<date>.txt`에 G-RB1 measure 항목과 G-RB3 운영 grep 결과 줄 · 오너 시각 확인 10쪽 · gate 없음, 두 번째 검토 없음; cycle 0/2; recovery 0/2
- Gate: 연재 전체에 reviewer 1회뿐이다. 글 10개를 다 쓴 뒤, 오너 보안 확인 전에 한다 (RS-2-20, #124 선례, 설계 §11 D7). M1, M3 끝에는 검토가 없다. task별 review 행도 없다. 다음 milestone은 앞 exit가 닫혀야 열린다.
- PS와 다른 점: PS는 발행을 오너가 미리 허락했다 (#124). RS는 아니다. 발행 행마다 RS-3-00 오너 OK가 선행 AC다 (#128).
- MVP 사다리(MVP ladder)는 적용하지 않는다. 새 스키마, API, 파이프라인이 없다. 데이터 1행 UPDATE와 발행뿐이다 (설계 §7).

## 그림 나누기

F 번호와 원본 = 설계 §6.2 "핵심 그림·표" 칸. 그림 원본 절 = 설계 §3.2, §3.3, §3.4, §4, §5.2, §5.3.

| 종류 | F 번호 | F/R/M 표시 | 만드는 이 |
| --- | --- | --- | --- |
| mermaid, 구성 요소 그림 10개 | F-RS00a, F-RS01a, F-RS02a, F-RS03a, F-RS03c, F-RS04b, F-RS05a, F-RS06a, F-RS06b, F-KD00a | 예 (노드마다) | sonnet-writer, 글 안 |
| mermaid, 단계·알고리즘 그림 5개 | F-RS03e, F-RS04a, F-KD01a, F-KD02a, F-KD02b | 아니오 (출처는 Sources 표) | sonnet-writer, 글 안 |
| Markdown 표 10개 | F-RS00b, F-RS01b, F-RS02b, F-RS03b, F-RS03d, F-RS04c, F-RS05b, F-RS06c, F-KD00b, F-KD01b | 출처 칸 | sonnet-writer, 글 안 |
| 썸네일 PNG 10장 | 글마다 `NN-<slug>.png`, 1200×630 | 없음 | developer, `S/thumbs.py` |
| 차트 PNG | 0장. 측정 데이터가 없다 (설계 §6.2) | | |

## Tactic: 준비 (설계 D1, D3, D4) → M1

- [ ] **RS-1-01 (MAIN/OWNER) 오너 답 Q1–Q15, Q-RB16 받기 + D-row (설계 D1)** → M1
  - **AC** 아래 "열린 질문" 표의 질문마다 오너 답 또는 "default" 1줄을 `decisions.plan.md` 새 D-row에 적는다 (main session) · 그룹 행 결정(설계 §2.1 A, `company` → `recobell` 이름 바꾸기)에 오너 OK 원문이 있다. 없으면 RS-3-02가 열리지 않는다 · Q1 답에 오너가 "built"라고 부를 부분 목록이 있거나, "default (maintained only)" · Q15 답 = 연재 제목 1개 · `01.status.md` 1줄 (D-id만).
- [ ] **RS-1-02 (ENG) i18n 그룹 키 2개 (설계 §7.2, D3)** → M1
  - **AC** `apps/dashboard_client_web/messages/en/blog.json`, `messages/ko/blog.json`의 `projects.groups`에 `"recobell": { "short": "Recobell" }`, `"adriel": { "short": "Adriel" }` (오늘 두 파일 101–102행에 `my-work`, `company`만 있음) · `company` 키 남음 · `git diff` = 파일마다 추가 줄 2개, 지운 줄 0개 (쉼표 1개 바뀐 줄은 허용) · Express, 웹 코드 diff 0 · GH Actions `pnpm check-types`, build 초록 · 커밋은 main session.
- [ ] **RS-1-03 (ENG) 썸네일 10장 (설계 §6.4, D4)** → M1
  - **AC** RS-1-01의 Q15 답 뒤 · `S/thumbs.py` = `apps/blog_agent/posts/projects/my-work/prettylog/_series/thumbs.py` 복사 후 수정 · `S/data/thumbs.csv` 10행: project, NN, slug, 글자, 설정값 1개, source (설계 C번호 또는 §절) · 스크립트가 읽는 경로는 `S/data/thumbs.csv`뿐 · 폴더 10개 = 설계 §6.2 폴더 칸, 폴더마다 `NN-<slug>.png` 1장 · `sips -g pixelWidth -g pixelHeight` = 1200 × 630 · 글자 = 연재 이름 · NN + 설정값 1개 (예: "30 min · 80 MB"). 측정값처럼 보이는 숫자 0, 버킷·호스트·cuid 0 (설계 §8.4 R12) · 실행 = `apps/blog_agent`에서 `OMP_NUM_THREADS=1 timeout 300 uv run --with matplotlib python <script>`, exit 0.
- [ ] **RS-1-04 (WRITER) `S/figures.md` + `S/redaction-check.md`** → M1
  - **AC** `S/figures.md` 표 칸 = F 번호, 글, 종류 (mermaid, 표, 썸네일), 상자마다 [F]/[R]/[M], 출처 (`SRC` 아래 상대 경로 + 행), 설계 절 · 행 35개 = 위 "그림 나누기" 표의 25 + 썸네일 10 · `[F]`, `[R]` 출처 경로마다 `test -e "$HOME/Desktop/_job_recobell/<path>"` 통과, 명령과 결과를 "Checks" 절에 · `[M]` 행마다 설계 §9 Q번호 · `S/redaction-check.md` = 설계 §8.3 grep 명령 글자 그대로 + 자리표 사전 §8.2 표 · 고의 파손: `S/figures.md` 끝에 가짜 키 줄 `AKIA` + 대문자 16자 1줄을 넣으면 grep 1건, 줄을 지우면 0건. 결과를 "Checks"에 · 설계 문서에도 grep 1회, 결과 줄 수를 "Checks"에 · 원본 값(버킷, 호스트, cuid)은 이 두 파일에 0개.

## Tactic: 글 쓰기와 유일한 검토 (설계 D5–D7) → M2

### 공통 AC

RS-2-00…06, RS-2-10…12 모두에 적용한다. 검사 명령은 writer가 돌리고 결과를 보고에 적는다.

- C1 파일 = `R/<project>/NN-<slug>/NN-<slug>.md`. `<project>` = `rec-solution` 또는 `knn-demo`. 폴더 이름 = 설계 §6.2 폴더 칸.
- C2 앞머리(front matter) 키 = prettylog `03-edge-cache.md` 1–20행과 같다: `title`, `tags`, `desc`, `date`, `priority`, `userId: 1`, `username: taeklim`, `status: 'public'`. `priority` = NN.
- C3 제목: rec-solution = `<series> (n/6): <claim>`, 00만 `<series>: <claim>`. knn-demo = `Recobell kNN Demo (n/2): <claim>`, 00만 `Recobell kNN Demo: <claim>`. `<series>` = RS-1-01 Q15 답. 제목 15단어 이하 (공백 토큰). 넘으면 writer가 claim을 줄인다. 숫자는 지킨다. 제목 숫자 = 설정값만.
- C4 `desc` = 한 줄, 15단어 이하.
- C5 본문 첫 줄 = `![NN-<slug> thumbnail](NN-<slug>.png)`. 폴더의 PNG = 그 썸네일 1장뿐 (`ls *.png` 1개).
- C6 다이어그램 = ```mermaid 블록. 첫 줄 `flowchart`, `graph`, `sequenceDiagram` 중 하나. 블록마다 노드 12개 이하 (설계 §10 모바일 위험). F-RS00a, F-RS01a는 블록 둘로 나눠도 된다.
- C7 F/R/M: "그림 나누기" 표에서 "예"인 블록은 노드 줄마다 라벨 끝이 `[F]`, `[R]`, `[R+F]`, `[M]` 중 하나다. 값은 `S/figures.md` 그 행과 같다. 블록 아래 범례 1줄: `[F] code fact · [R] README only · [M] from memory (owner)`.
- C8 숫자: 본문 숫자마다 설계 §6.3 이름표 하나 (`(config)`, `(job config)`, `(create script)`, `code comment, not measured`, `owner claim, not in the code`, `illustrative`). 날짜, 글 번호, 버전 번호는 뺀다. 트래픽, 지연, 비용, 정확도 숫자 0개. `$500M` 0회 (Q14 기본값). `20M`은 RS-2-00에만.
- C9 끝에 `## Sources` 표 (claim, path, lines). path = `SRC` 기준 상대 경로. UUID 폴더 경로는 `base/` 경로로 바꾼다 (설계 §8.4 R7). 경로마다 `test -e` 통과.
- C10 비밀: `S/redaction-check.md`의 grep을 그 글 폴더에 돌려 0건. 맞은 줄이 있으면 줄마다 "placeholder" 또는 "not a value"와 이유를 보고에 쓴다. 이름, 값은 설계 §8.2 자리표만. 발췌 10줄 이하, 설정 발췌는 키 이름만 (R1, R2).
- C11 grep 오탐(false positive) 피하기: pseudo-code의 접속 문자열은 `<rds-host>` 꼴만. `jdbc:` 뒤 실제 호스트, `localhost` 0개. "평문 키" 교훈은 글로 쓴다 ("credentials sat in plain config files"). `password=`, `secretKey` 같은 키 글자는 0개.
- C12 쓰지 않는 것 (R3, R5, R6, R8): 계정 번호, IP, AMI, 보안 그룹, 인스턴스 id, 키 이름 · 사용자 id, pc_id, 세션 id, 주문 id, 상품 이름, 상품 이미지 URL · 동료 이름 · 내부 wiki, git URL. 예시 행은 지어낸 값 + `illustrative`.
- C13 귀속(attribution): RS-1-01 Q1 답의 목록에 없는 부분은 "maintained" 또는 "inherited and maintained"로 쓴다. 주어 "I" + `built`, `designed`, `created`는 그 목록 안에서만.
- C14 영어. 한글 grep `[가-힣]` 0건 (prettylog `03-edge-cache.md`와 같다). 약어는 글마다 처음 한 번 풀어 쓴다 (예: Kinesis Client Library (KCL)). 줄표 grep (`rules/writing/style.md` §3) 0건. 코드 블록과 앞머리 밖 `;` 0개. 문장 15단어 이하.
- C15 다이어그램 캡션 2문장 이하, 둘째 문장은 `Why:`로 시작 (`rules/figures.md` §3).
- C16 본문 줄 수(앞머리 제외) ≤ 설계 §6.2 길이 칸 + 10. 행 AC가 요구하는 표만으로 넘으면 writer가 보고하고, main session이 D-row를 쓴다 (#125 선례).
- C17 00만 다른 글로 링크한다. 연재 지도 링크 = 자리표 `/@taeklim/TBD-NN` (RS-3-05가 바꾼다). 01 이후는 링크 0개.
- C18 쓰는 이 = `sonnet-writer`. 원본 = 설계 §6.2 그 행 + 그 행이 가리키는 설계 절 + `S/figures.md` + 설계가 적은 `SRC` 경로. 커밋 없음.
- C19 금지 목록: 설계 §8.1 "고객 데이터" 행의 파일 (`Warren/knn-data-importer/` 루트의 `pc_neighbor`, `user_item_view`, `pc_item_knn`, `RBLogger/rblogger-validator-core/src/test/resources/`, `RBLogger/rblogger-file-validator/src/test/resources/`, `Warren/rb-rec-api/src/test/resources/sample_*`)는 열지 않는다. `SRC`에서 빌드, 테스트, 스크립트를 돌리지 않는다. 보고에 두 줄을 쓴다: "customer data files: not opened", "SRC: read only, nothing run".

### 행

선행: M1 exit 닫힘. 특히 RS-1-01 (Q1, Q2, Q15 답)과 RS-1-04 (`S/figures.md`).

rec-solution (`R/rec-solution/`):

- [ ] **RS-2-00 (WRITER) 00 개요 (overview)** → M2
  - **AC** 공통 AC · 절 순서 = 설계 §6.2 RS-00 행 · F-RS00a (설계 §3.2) + F-RS00b (C1–C27 축약 표) · "My part" 표 = RS-1-01 Q1 답의 행만. 답이 default면 표에 "maintained" 1행 · "Warren" 0회 (Q4 기본값) · `20M daily events` 옆에 `owner claim, not in the code` (Q14) · 연재 지도 표 6행 (01–06), 링크 = `/@taeklim/TBD-NN`.
- [ ] **RS-2-01 (WRITER) 01 AWS 인프라 (infrastructure)** → M2
  - **AC** 공통 AC · F-RS01a (설계 §3.3), F-RS01b 사실/기억 표 = 설계 §3.3 아래 표의 행 · Beanstalk 운영 인스턴스 값, DNS, TLS, CDN, VPC = `[M]` + "?" (Q6, Q7 기본값). Route 53, CloudFront 같은 짐작 이름 0개 · t2.micro, t2.nano 옆에 "test profile only" · Lambda 1536 MB, 300 s 옆에 `(create script)`.
- [ ] **RS-2-02 (WRITER) 02 RBLogger 수집 (collection)** → M2
  - **AC** 공통 AC · F-RS02a `sequenceDiagram` (C1 → C3 → C4 → C5) · F-RS02b 로그 5종 × 필수 칸 표 (C11) · 설계 작업용 제목은 C3 접두를 붙이면 16단어다. claim을 줄여 15단어 이하로 · at-least-once 절은 체크포인트(checkpoint)가 S3 쓰기 뒤라는 사실 1개 (설계 §4.1 설계 이유 4번째 줄).
- [ ] **RS-2-03 (WRITER) 03 S3 로그: 저장, 압축, 검색 (save, zip, search)** → M2
  - **AC** 공통 AC · 오너 요청 "how to save logs in s3, zip them, search them"을 이 글 하나가 담는다 (설계 §4) · F-RS03a 키 배치 · F-RS03b 회전 조건 표 (30 min, 80,000,000 bytes, 60,000 records, 모두 `(config)`) · F-RS03c 병합 순서도 · F-RS03d 검색 방식 S1–S6 표 · F-RS03e 해시 묶음. N = 1,000 예 옆에 `illustrative` · 압축률 "about 1/10" 옆에 `code comment, not measured`, 제목에 0회 · Dual 쓰기는 "existed in code" 1줄 (Q8) · Athena는 보고서 표 1줄만 (Q10) · "What I'd change" 표 = 설계 §4.1 함정 3개 · 본문 75 + 10줄 이하.
- [ ] **RS-2-04 (WRITER) 04 두 시대의 배치 (batch, two eras)** → M2
  - **AC** 공통 AC · F-RS04a (설계 §3.4 1세대 그림), F-RS04b (COPY → SQL → UNLOAD → formatter, 출처 설계 §6.2 아래 둘째 줄), F-RS04c 비교 표 (설계 §3.4 표) · 바뀐 연도 0개. 두 시대는 순서로만 (Q5 기본값) · Airflow는 "later workflow manager" 1줄 `[R]` · 로그 창 7, 30, 7일과 결과 상한 40, 40, 1000 옆에 `(config)`.
- [ ] **RS-2-05 (WRITER) 05 rec-api 서빙 (serving)** → M2
  - **AC** 공통 AC · F-RS05a 요청 순서도 (API → 결과 zip + MySQL 최근 항목, C22, C23) · F-RS05b 추천 종류 접두사 표 · zip 안 키 찾기 = 설계 §4.4 "읽기" 행 · JSONP, gzip 응답 절 · C24 노출 로그는 "code exists, no caller found" 1줄.
- [ ] **RS-2-06 (WRITER) 06 관리와 운영 (management and ops)** → M2
  - **AC** 공통 AC · F-RS06a 등록부 폴링 (C15, 5 min `(config)`), 등록부를 쓰는 화면 = `[M]` 상자 (Q3 기본값) · F-RS06b 검사 경로 2개 (C9, C10) · F-RS06c "What I'd change" 표 = 설계 §6.2 아래 셋째 줄 (함정 3개 + 평문 키 + 하드코딩 상수), 평문 키는 C11대로 글로만 · 캐시 만료 삭제는 "TTL expiry in the old system" · `## Never measured here` 절 1줄 (설계 §6.3 마지막 행).

knn-demo (`R/knn-demo/`):

- [ ] **RS-2-10 (WRITER) knn 00 개요** → M2
  - **AC** 공통 AC · F-KD00a 데이터 흐름 (설계 §5.3), F-KD00b 저장소 표 (설계 §5.1) · 프로젝트 소개에 "kNN + keyword demos" (Q11) · 데모 화면은 구조 그림만. 실제 화면 캡처 0장 · 호스트 이름 0개 (설계 §5.3 아래 첫 줄) · 연재 지도 2행, 링크 = `/@taeklim/TBD-NN`.
- [ ] **RS-2-11 (WRITER) knn 01 Redshift SQL 속 kNN** → M2
  - **AC** 공통 AC · F-KD01a 두 갈래 순서도 (p003, p015, 설계 §5.2) · F-KD01b 단계 비교 표 (설계 §5.2 표) · `$KNN_*` 상수는 이름과 역할만, 값 0개 (Q13) · `cs_score`는 "v0.0.1 schema only".
- [ ] **RS-2-12 (WRITER) knn 02 교보 키워드 TF-IDF** → M2
  - **AC** 공통 AC · 제목에 "Keyword"와 "TF-IDF" (Q11) · 본문 첫 절에 "not kNN" 1문장 · F-KD02a 점수 순서도 (`Warren/rb-logic-rec/kyobo/03scoring.sql`), F-KD02b 데모 화면 구조 · 교보 인프라(ELB, EC2, RDS)는 `[R]` · 매출 숫자 0개 (Q14).

검토:

- [ ] **RS-2-20 (REVIEW) reviewer 1회: 글 10개 + 썸네일 10장, 오너 보안 확인 전 (설계 D7)** → M2
  - **AC** RS-2-00…06, RS-2-10…12 닫힌 뒤 1회 · 검사 = 공통 AC C1–C19 + 행별 AC + 설계 §8.4 R1–R12 + `rules/figures.md` §7 캡션 행 · 설계 §8.3 grep을 `R` 전체에 1회, 맞은 줄마다 판정 · 썸네일 10장 글자를 눈으로 확인 (R12) · 결과 파일 `rs.review.md` (PASS 또는 지적 목록, 지적마다 파일:행) · 지적은 sonnet-writer 또는 developer가 고친다. main session이 검사 명령으로 확인한다. 두 번째 reviewer 실행은 없다 (#124 선례) · 고친 뒤 main session은 멈추고 폴더 10개 경로 목록을 오너에게 넘긴다 (#128). 발행하지 않는다.

## Tactic: 카테고리, 발행, 확인 (설계 D8, D9) → M3

선행: M2 exit 닫힘 (RS-2-20 지적 고침, 폴더 목록을 오너에게 넘김).
증거 파일: `deploy/projects/rb-pre-<date>.txt`, `rb-u1.sql`, `rb-publish-<date>.txt`, `rb-prod-<date>.txt` (설계 §7.1).

- [ ] **RS-3-00 (OWNER) 폴더별 보안 확인 10개, 업로드 전 (#128)** → M3
  - **AC** 폴더마다 md 1개 + PNG 전부를 오너가 본다 · 목록 10행 (폴더 경로, OK 또는 고칠 점, 날짜) = `deploy/projects/rb-owner-check-<date>.txt`, main session이 오너 말을 옮긴다 · 고칠 점이 있으면 그 폴더는 OK 아님. 고친 뒤 그 폴더를 다시 오너에게 보인다 · 10폴더 모두 OK 전에는 RS-3-01…07 시작 0 · 오너 OK 뒤 md나 PNG가 바뀌면 (RS-3-05 링크 줄 빼고) 그 폴더는 다시 확인한다.
- [ ] **RS-3-01 (MAIN) 사전 SELECT P1–P4 (읽기 전용, 설계 §7.1)** → M3
  - **AC** RS-3-00 10폴더 OK 뒤 · P1 `company` 행 1개, id = 14, priority 20 · P2 자식 카테고리 0, 글 0 · P3 사용자 전체 `title IN ('recobell','rec-solution','knn-demo')` 살아 있는 행 0 · P4 루트 직계 자식 = `my-work` 10, `company` 20, `gatech` 30, `utrgv` 40 · 기대와 하나라도 다르면 STOP, 오너에게 보고 · 출력 `deploy/projects/rb-pre-<date>.txt`.
- [ ] **RS-3-02 (MAIN/OWNER) SQL U1: `company` → `recobell` (설계 §7.1 3단계)** → M3
  - **AC** RS-3-01 기대 모두 맞음 · RS-1-01 D-row에 그룹 행 결정 오너 OK가 있다 · `deploy/projects/rb-u1.sql` = UPDATE 1문 (조건 id + `title='company'` + `deleted_at IS NULL`, 칸 `title`, `updated_at`만) + 되돌리기 블록 (title을 `company`로, 자식 0일 때만, `DELETE` 0개) · 한 트랜잭션, 영향 행 수 ≠ 1이면 ROLLBACK 후 STOP · 실행 뒤 SELECT: id 14 title `recobell`, priority 20 · `/@taeklim/projects/recobell?probe=$T`, `/@taeklim/projects/company?probe=$T` 404 · 결과를 `rb-pre-<date>.txt`에 더한다.
- [ ] **RS-3-03 (MAIN) rec-solution 01 → 06 발행** → M3
  - **AC** 선행 AC: `rb-owner-check-<date>.txt` 10폴더 OK · `rb-pre-<date>.txt`에 U1 영향 행 1 · `apps/blog_agent`에서 글마다 `uv run python scripts/publish_oneshot.py --no-llm ./posts/projects/recobell/rec-solution/<NN-slug>/<NN-slug>.md` 1회, 순서 01 → 06 · 글마다 URL `?probe=$T` 200 · slug 6개를 `deploy/projects/rb-publish-<date>.txt`에 · 발행 뒤 `rec-solution` 1행, 부모 = id 14 · `recobell` 1행 (새 행 0).
- [ ] **RS-3-04 (MAIN) knn-demo 01 → 02 발행** → M3
  - **AC** RS-3-03 뒤 · RS-3-03과 같은 명령, 경로 `./posts/projects/recobell/knn-demo/...`, 순서 01 → 02 · 글마다 200 · slug 2개를 publish 파일에 더한다 · `knn-demo` 1행, 부모 = id 14.
- [ ] **RS-3-05 (WRITER) 00 두 개의 연재 지도 링크를 실제 slug로** → M3
  - **AC** 원본 = `rb-publish-<date>.txt` · rec-solution 00의 `TBD-NN` 0개, 링크 6개 · knn-demo 00의 `TBD-NN` 0개, 링크 2개 · 링크 = `/@taeklim/<slug>`, slug가 publish 파일과 글자 단위로 같다 · `git diff --no-index` 또는 고치기 전 사본과 비교해 바뀐 줄 = 링크 줄만 · 두 폴더에 설계 §8.3 grep 다시 0건.
- [ ] **RS-3-06 (MAIN) 00 두 개 발행** → M3
  - **AC** RS-3-05 뒤 · rec-solution 00, knn-demo 00 각 1회 · URL 200 · 지도 링크 8개 모두 `?probe=$T` 200 · slug 2개를 publish 파일에 더한다 (모두 10개).
- [ ] **RS-3-07 (MAIN) purge + 운영 확인 (설계 §7.3)** → M3
  - **AC** `_scripts/cloudflare/cf-purge.sh` 1회 · 설계 §7.3 표의 행마다 결과 1줄: `id="recobell"` 구역 카드 2개, 순서 `id="my-work"` < `id="recobell"` < `id="utrgv"`, `id="company"` 0개 · 구역 제목 글자 "Recobell" · 배지 4 · `/@taeklim/projects/rec-solution` 200, 글 7개, 00 → 06 · `/@taeklim/projects/knn-demo` 200, 글 3개, 00 → 02 · `/@taeklim/projects/recobell`, `/@taeklim/projects/company` 404 · 글 10개 200 · `sitemap.xml`에 새 URL 10개 · 새 글 2개 + `/@taeklim/projects` 둘째 GET `cf-cache-status: HIT` · `recobell`, `rec-solution`, `knn-demo` 각 1행 · 운영 HTML 10쪽에 설계 §8.3 패턴 grep 0건 · 출력 `deploy/projects/rb-prod-<date>.txt`.
- [ ] **RS-3-08 (OWNER) 10쪽 시각 확인** → M3
  - **AC** 글 10개마다 한 줄: mermaid가 그림으로 보임 (코드 블록 아님), 썸네일 보임, 모바일 폭에서 가로 넘침 없음 · main session이 결과 줄을 `rb-prod-<date>.txt`에 더한다.
- [ ] **RS-3-09 (MAIN) 루트 `CLAUDE.md` 그룹 트리 사실 줄 (설계 D9)** → M3
  - **AC** RS-3-07 뒤 · "Projects: categories as groups" 트리의 `company/` 줄 → `recobell/` (아래 `rec-solution/`, `knn-demo/`) · 그 절의 "State" 줄을 오늘 상태로 · 오너 규칙 절은 고치지 않는다 (`rules/docs.md` §6) · 그 밖의 diff 0.

## 열린 질문 (오너)

- 질문 원문과 기본값 전문 = 설계 §9. 여기에는 짧은 이름만 적는다.
- 답이 없으면 기본값으로 간다 (설계 §9). 답 또는 "default"는 RS-1-01 D-row에 적는다.
- "막는 행" = 답(또는 default 확정) 전에 시작하지 않는 행. 모두 RS-1-01을 거친다.

| # | 질문 (짧게) | 기본값 (설계 §9) | 막는 행 | 언제까지 |
| --- | --- | --- | --- | --- |
| Q1 | 귀속: 내가 만든 부분과 물려받은 부분 | "maintained"만 | RS-2-00 "My part", 모든 writer 행 (C13) | M2 writer 첫 dispatch 전 |
| Q2 | 보조 저장소 6개를 근거로 쓰나 | 쓴다 | RS-1-04, RS-2-00, 01, 03, 04, 05, 06 (C15, C19–C21, C25가 보조) | RS-1-04 전 |
| Q3 | 등록부, 검사 통계 관리 화면이 있었나 | `[M]` 상자 1개 | RS-2-06, RS-2-00 (C16 상자) | M2 전 |
| Q4 | "Warren"은 제품 이름인가 | 글에 쓰지 않는다 | 모든 writer 행 | M2 전 |
| Q5 | 1세대 → 2세대, Airflow 시기 | 연도 없이 순서만 | RS-2-04, RS-2-00 | M2 전 |
| Q6 | 운영 Beanstalk 값, 소비자 호스트 | "?" + `[M]` | RS-2-01 | M2 전 |
| Q7 | DNS, TLS, CDN, VPC | `[M]` 상자 1개 | RS-2-01 | M2 전 |
| Q8 | S3 쓰기 Single 또는 Dual | Single | RS-2-03 | M2 전 |
| Q9 | "zip"의 뜻 | 로그 gzip과 결과 zip 둘 다 | RS-2-03, RS-2-05 | M2 전 |
| Q10 | 원시 로그를 Athena로 찾았나 | prefix 읽기 + COPY, Athena 1줄 | RS-2-03 | M2 전 |
| Q11 | 교보 TF-IDF를 knn-demo 아래 둘까 | 둔다 (#127) | RS-2-10, RS-2-12 | M2 전 |
| Q12 | adriel 그룹 priority | 25 | 없음 (PG-OWN-2, `pg.plan.md`) | adriel 설계 때 |
| Q13 | kNN 상수 값을 쓸까 | 쓰지 않는다 | RS-2-11 | M2 전 |
| Q14 | 이력서 숫자 20M, $500M | 20M은 00에만 owner claim, $500M 0회 | RS-2-00, RS-2-12 (C8) | M2 전 |
| Q15 | 연재 제목 A 또는 B | A "Recobell From the Logs Up" | RS-1-03 (썸네일 글자), 모든 writer 행 (C3) | RS-1-03 전 |
| Q-RB16 | 그룹 행 결정 설계 §2.1 A (`company` 이름 바꾸기) OK | 기본값 없음. 오너 OK 필요 | RS-3-02 | RS-3-01 전 |
| Q-RB17 | G-RB1–3 승인과 날짜. 답은 D-row로 적고 DRAFT를 지운다 | 없음 | 없음 (진행 표시) | 연재 끝 전 |

- 보안 확인(#128)은 질문이 아니라 행이다: RS-3-00.

## 설계 정정 필요 (architect, rev2)

- §6.2 RS-02 작업용 제목은 접두를 붙이면 16단어다. 15단어 상한을 넘는다 (C3, RS-2-02).
- §7.1 순서에 오너 보안 확인(#128)이 없다. 발행과 U1 앞에 RS-3-00을 둔다.
- §11 D7 "검토 횟수는 오너가 정한다": #124 선례대로 1회로 계획했다. 오너가 다르게 말하면 고친다.
- §7.4 끝 "그룹 행 결정만 새 D-row": RS-1-01이 맡는다. 아직 없다.
- §6.5 "pm이 prettylog 글 하나를 열어 병기 방식을 AC에 적는다": `03-edge-cache.md`에는 한글과 병기가 없다. C14에 적었다.
- §7.2 i18n 커밋은 `pg.plan.md` M3 exit와 PG-OWN-1의 "코드 커밋 0"과 글자로 부딪친다. 두 줄에 RS-1-02 예외를 적었다 (#127).
- §7.2 아래 "`projects.design.md` §12.5 `company` 행이 낡는다": 그 문서 소유자(architect) 몫이다. 이 plan에 행이 없다.
