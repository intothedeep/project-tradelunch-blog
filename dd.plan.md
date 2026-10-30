# Phase DD: Diffusion From Scratch 연재 (series)

> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.

- 상태: PLANNED, rev3 맞춤 (2026-10-28). 산 행 36개 + 줄 그은 행 1 (DD-1-06). 닫힘 9 (DD-1-00, 02, 03, 04, 07, 08, 09, 10, 11). M1 9/12, M2 0/17, M3 0/7. C13 = 그림 수 공식, loop 한 줄 (#141). 고침 행 DD-2-13…16. reviewer는 DD-2-12 1회뿐 (발행 전, #124 선례, #137). 발행 = PS식 미리 허락 (#137). 열린 오너 질문 2개 (Q-DD12 고침 목록과 "frozen", Q-DD10 G-DD 승인).
- 막는 사실: R1 1회는 끝났다 (DD-1-11, #140, 70장). 남은 막음 = redraw 4장 (U01, RS1, RS2, C03) + 작은 두 번째 실행의 오너 OK (#140) → DD-1-05 → DD-2-12. DD-2-12 전에 DD-1-12, DD-2-13…16도 닫힌다 (#141). PNG 이름이 그림 ID로 고정이다 (설계 §4.2).
- 설계: `ddpm-series.design.md` rev3 (system-architect, 2026-10-28). 결정: `decisions.plan.md` #137, #138, #139. 선례: `ps.plan.md` (#124), `rs.plan.md` (공통 AC 틀).
- 수는 설계 §4.4 첫 diff 뒤 수를 쓴다: 그림 단위 92, 중복 21, 발행 71, 캡처 68, 글 PNG 83. §5.1 합 표, §6.2, §11 E1의 90/70/67/82는 diff 전 수다 (설계 머리 9항).
- 설계와 #137이 다르면 #137을 따른다. 다른 곳은 아래 "설계 정정 필요" 절에 적는다.
- 줄인 이름: `TA` = `~/Documents/mscs_utrgv/ta_cs6379_deep_learning/` (읽기 전용 원본, 스크립트 출력만 `BS` 아래). `A3` = `TA/assignment_03_r1/`. `BS` = `TA/blog_series/`. `D` = `apps/blog_agent/posts/projects/utrgv/ddpm-from-scratch/`. `S` = `D/_series/`.
- 글 폴더: `D/NN-<slug>/` 12개 (00–11). 폴더 이름 = 설계 §6.2 rev3 폴더 칸. rev2 폴더 10개는 `x_<name>`으로 바꾼다 (DD-1-09).

## Mission block

- Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
- Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)
- Constraints: 글은 영어 (#137) · 결과 숫자는 모두 저장된 파일에서 읽는다. 글마다 `figures.md`에 파일과 칸 (`rules/answering.md` §3) · 스크립트 실행 = `~/.claude/CLAUDE.md` "Allowed locally": `OMP_NUM_THREADS=1 timeout 300 uv run python ...`, 입력 = 저장된 JSON, Markdown 표, HTML, PNG만. 학습, 추론, 모델 적재(torch, sklearn) 0 · 300 s를 넘으면 멈추고 main session에 돌려준다 · R1 헤드리스 브라우저(headless browser)는 DD-1-11 실행 1회만 (#138). 두 번째는 오너에게 다시 묻는다. R2 cairosvg는 버림 (#138) · tips 그림 자체는 바꾸지 않는다. 캡션만 새로 쓴다. 예외: 그림 안 "Step N →" 글자 (설계 §4.3) · 개인 다운로드 URL, 토큰, 메일, 다른 학생 자료 0건. `A3/README.md`는 2, 14행만 읽는다 (설계 §8) · 과목 학습 이미지 0장 (Q-DD6) · 약어는 언급마다 full name (ABBR) (`rules/writing/style.md` §4) · 줄표 0, 세미콜론 0 (`rules/writing/style.md` §3) · `posts/`는 gitignore. 오래 남길 증거는 커밋되는 `deploy/projects/dd-*.txt` · 발행, 운영 SQL, purge, 운영 curl = main session만 · 발행 경로는 `projects/utrgv/ddpm-from-scratch/`만 (설계 §7) · soft-delete만 · 테스트 러너 금지. 검증 = 검사 명령 + 고의 파손(deliberate breakage) + 운영 curl · agent 커밋 0.
- G-DD1 (DRAFT, owner approval pending): 연재 글 12개가 운영에 있다. measure: `/@taeklim/projects/ddpm-from-scratch` 200, 글 12개, 순서 00 → 11 · `/@taeklim/projects` `id="utrgv"` 구역 카드 2개 (cnn, ddpm) · 메뉴 Projects 배지 = 발행 전 값 + 1 (DD-3-01이 적는다). by: date TBD (owner).
- G-DD2 (DRAFT, owner approval pending): 원본 7쪽의 그림이 모두 글에 쓰인다. measure: `BS/data/dd_tips_inventory.csv` 행마다 `post` + `section` 또는 `export = dup:<ID>` (rev3 = 92 단위) · 운영 글 12개의 원본 이미지 합 = `export = yes` 행 수 (rev3 = 71). 인벤토리 수가 설계와 다르면 인벤토리 수가 맞다. redraw 4장이 영어가 안 되면 수는 오너가 정한다 (설계 §5.1). by: G-DD1과 같다.
- G-DD3 (DRAFT, owner approval pending): 결과 숫자가 모두 근거를 가진다. measure: 글 본문 숫자마다 그 글 `figures.md` 행 (파일 + 칸) · 설계 §8.3 grep 0건 (원고, `BS/data/dd_*`, 운영 HTML). by: G-DD1과 같다.
- S1 → G-DD1, G-DD2, G-DD3: 설계 rev3의 글 12개 (오너 주제 순서), 그림 = 원본 71 + 결과 차트 12 + mermaid 1 (M10) = 84. listed alternatives: none (그룹 모델 #119, 연재 틀 cnn 선례 #137).
- M1 → S1: 그림과 데이터 준비; exit: DD-1-00…05, 07…12 닫힘 (DD-1-06 줄 그음) · 인벤토리 csv + 마지막 `dd_tips_diff.md` 0건 · `BS/out_dd/tips_<ID>.png` = `export = yes` 행 수 (rev3 71 = 캡처 68 + 복사 3) + 결과 PNG 12장 · 썸네일 12장 (rev3 폴더) · rev2 폴더 10개 `x_` · `S/redaction-check.md` 고의 파손 1회 기록 · gate 없음 (진행 표시); cycle 0/2; recovery 0/2
- M2 → S1: 글 12개 + 유일한 검토; exit: DD-2-00…11, 13…16 닫힘 · md 12개가 공통 AC (C0–C15, W1–W11) 검사 명령을 모두 통과 · DD-2-12 reviewer 1회, 지적을 고친 뒤 main session이 검사 명령으로 확인; cycle 0/2; recovery 0/2
- M3 → S1: 발행과 운영 확인; exit: DD-3-01…07 닫힘 · `deploy/projects/dd-prod-<date>.txt`에 G-DD1 measure 항목과 G-DD3 운영 grep 결과 줄 · gate 없음, 두 번째 검토 없음; cycle 0/2; recovery 0/2
- Gate: 연재 전체에 reviewer 1회뿐이다. 글 12개를 다 쓴 뒤, 발행 전에 한다 (DD-2-12, #124 선례). M1, M3 끝에는 검토가 없다. task별 review 행도 없다. 다음 milestone은 앞 exit가 닫혀야 열린다.
- 예외 1개 (rev3, 설계 E8): M2 글 행은 DD-1-08, DD-1-10 뒤에 연다. M1 exit는 DD-2-12의 선행이다. 이유: R1은 오너 답을 기다리고, 글은 그림 ID만 있으면 된다.
- 발행은 오너가 미리 허락했다 (#137: "Ps? rs? dispatch."). 오너 폴더 확인 단계는 없다 (RS #128과 다르다). 검토 지적을 고치면 main session이 바로 발행한다.
- 과제 설계와 코드 공개 허락 (#137: "this is totally ok"). 설계 §8 제거는 그대로 한다.
- MVP 사다리(MVP ladder)는 적용하지 않는다. 새 스키마, API, 파이프라인이 없다 (설계 §7).

## 그림 나누기

오너: "I love diagrams and I love all figures and I would like to use all if possible in my posts" (2026-10-28). tips 그림은 버리지 않는다.

| 종류 | ID (설계) | 만드는 이 | 출력 |
| --- | --- | --- | --- |
| 원본 SVG, PNG → PNG | 설계 §5.1 rev3 고정 ID (H, U, A, F, RS, RI, E, C). 92 단위, 중복 21, 내보냄 71 = 캡처 68 + 복사 3 (RI1, RI3, RI4) | developer 코드 (DD-1-01), main session 실행 1회 (DD-1-11) | `BS/out_dd/tips_<ID>.png` |
| 결과 차트 PNG 12장 | R00a–c, R07a, R08a, R09a–c, R10a–d. 끝 (DD-1-03). 글 배정 = 설계 §5.2 rev3 표. 이름은 그대로 | 끝 | `BS/out_dd/fig_dd_NN_*.png` |
| mermaid 1개 | M10 → 11 (설계 §5.3). M00은 버림, RS3이 대신 | sonnet-writer, 글 안 | 없음 |
| 썸네일 12장 | 글마다 `NN-<slug>.png`, 1200×630 (설계 §5.5 rev3) | developer, `BS/fig_dd_thumbs.py` (DD-1-10) | `D/NN-<slug>/` |

- ~~한국어 단독 4장 (T16, T20, T22, T23)은 영어 판이 페이지에 생겨야 내보낸다 (Q-DD11).~~ <!-- SUPERSEDED 2026-10-28 rev3: 4장은 어텐션 페이지 영어 사본의 중복 (설계 §4.4) -->
- redraw 4장 (U01, RS1, RS2, C03)은 오너가 영어로 고친다 (Q-DD12). 안 되면 그 절은 Markdown 표로 쓰고 `figures.md`에 이유 (설계 §5.1).
- 06 그림 = A06, A07, H47, H48, A11, A12, A14 (설계 §4.4 첫 diff). §6.2의 A10 칸은 diff 전이다. A10 = 중복 H47.
- 글 PNG 수 (00 → 11): 5, 3, 7, 7, 6, 8, 7, 8, 13, 5, 10, 4 = 83. 썸네일 12장은 따로.

## Tactic: 그림과 데이터 준비 (설계 rev3 E2–E7, rev2 D3–D7) → M1

- [x] **DD-1-00 (ARCH) 설계 §5.1 표를 지금 tips 페이지에 다시 맞춘다** → M1 · DONE 2026-10-28 (설계 rev2), **AC PARTIALLY MET**
  - 닫힘 근거: 설계 §4.1 판정 규칙 1줄 · §5.1 40행, 행마다 글 · 절, 값, 내보냄, 고칠 점 · 버린 행 0 · §6.2 그림 칸과 합 50, §0 G-DD2 = 40행, 36장 · rev2 표시. pm이 "그림 나누기"와 G-DD2를 맞췄다 (이 edit).
  - 못 맞춘 1항: 페이지 sha256과 ta 저장소 commit을 §4.1에 (설계가 셸이 없어 재지 못했다, §4.1). → DD-1-01 코드가 쓰고 DD-1-11 실행이 닫는다 (`dd_tips_source.json` `commit`, 페이지마다 `sha256`, rev3).
  - 옛 AC (rev1 기준) 이유: pm Grep (2026-10-28) `a03_student_tips_path.html`에 `<svg viewBox` 29개 (248–323행), 캡션 번호 "Figure 29."까지. 설계 rev1은 27개 (설계 §10 "페이지가 다시 만들어진다" 위험이 일어났다) · 그림 SVG = 바로 뒤 "Figure N." 캡션이 붙은 SVG. 본문 속 "Figure N" 참조와 아이콘 SVG는 세지 않는다. 판정 규칙을 설계 §4.1에 1줄 · §5.1 표 행 수 = 그 수. 행마다 글 · 절, 값(illus/meas/exact), 고칠 점. 버리는 행 0 (오너 "use all") · 그 페이지 sha256과 ta 저장소 commit을 §4.1에 · §6.2 그림 칸, §6.2 "그림 합", §0 G-DD2 수를 같은 edit에서 고친다 · 설계 rev2로 표시. pm이 이 plan의 "그림 나누기"와 G-DD2를 맞춘다.
- [x] **DD-1-01 (ENG) `BS/dd_export_tips_figs.py` rev3: 코드만, 실행 0 (설계 §4.3 rev3, E5)** → M1
  - **AC** 선행 DD-1-08 닫힘 · 이 행은 R1 브라우저를 한 번도 띄우지 않는다. 실행은 DD-1-11 1회뿐 (#138) · 입력 = `BS/data/dd_tips_inventory.csv` + 그 행이 가리키는 7쪽뿐 (grep `open(`, `read_text`).
  - 실행 때 `BS/data/dd_tips_source.json`에 ta 저장소 commit + 페이지마다 sha256 · 페이지를 다시 파싱해 `export = yes` 행 해시가 하나라도 없으면 exit ≠ 0. 번호 순서는 경고만 (설계 §4.3 2–3단계).
  - 중간 SVG: `Step [0-9]+ (→|&#8594;)` 0건, 글 번호 = 설계 §4.6 끝 표 · `<a ` 0개 · 다크 테마 블록 0 · 그 밖의 글자, 도형, 타일 변경 0 · 한 장마다 바로 쓴다 (write-first) · RI1, RI3, RI4는 원래 PNG 복사.
  - 출력 `BS/out_dd/tips_<ID>.png`, `export = yes` 행만, 폭 2000px. 중복 행 PNG 0.
  - 고의 파손 = 정적만: scratchpad 사본 페이지에서 `yes` SVG 1개를 지우고 해시 검사 함수만 부른다 → exit ≠ 0. TA 원본은 고치지 않는다.
  - 보고에 DD-1-11이 그대로 쓸 명령 1줄: ta 저장소 루트에서 `OMP_NUM_THREADS=1 timeout 300 uv run python blog_series/dd_export_tips_figs.py`.
- [x] **DD-1-02 (ENG) `BS/extract_dd_scale.py` + 업로드 규칙 표 (설계 §3, §5.2, D5)** → M1 · DONE 2026-10-28 (developer)
  - 결과: `BS/extract_dd_scale.py`, `BS/data/dd_scale.json`, `BS/data/dd_rule_status.csv`, `BS/README.md` 행. 고의 파손 했음. 판정 파일 14 (설계 rev1 13은 버림, 설계 §3).
  - 참고: source 칸의 D-id (D-051, D-052)와 `outside` 4개는 스크립트 상수 `SOURCE`, `OUTSIDE`다. AC 입력 목록이 세 파일뿐이라 `A3/docs/DECISIONS.md`를 읽지 않았다. 기본값은 Q-DD2 (#138).
  - **AC** 입력 = `A3/runs/*/manifest.json`, `A3/runs/LEADERBOARD.md`, `A3/analysis/verdicts*.json` 목록뿐 · `BS/data/dd_scale.json` 키: run 폴더 수, manifest 있는 수, 셈에서 뺀 폴더 수와 이름 목록 (posthoc 등), `gpu_wall_s` 합 (시간), GPU 종류 목록, 판정 파일 수 (설계는 13), 업로드 수 (설계는 12) · "460", "162"를 상수로 쓰지 않는다 (grep 0) · `BS/data/dd_rule_status.csv` = `LEADERBOARD.md` 업로드 행마다 1행: run, public FID, grade, rule (`in` / `outside`), source (`A3/docs/DECISIONS.md` D-id) · 기본값 (Q-DD2): v10059, v10064, v10090, v10093 = `outside`, 나머지 `in` · v10142 행 = `in`, public FID 6.10 (`LEADERBOARD.md` 20행) · 같은 실행 명령, exit 0.
- [x] **DD-1-03 (ENG) 결과 차트 12장 `BS/fig_dd_NN_*.py` (설계 §5.2, D6)** → M1
  - rev3: 12장 그대로 쓴다. 글 배정만 바뀐다 (설계 §5.2 rev3 표). 다시 만들지 않는다.
  - **AC** 선행 DD-1-02 (닫힘). 페이지 고침을 기다리지 않는다 · 스크립트 이름과 ID = 설계 §5.2 rev2 표 12행 (R00a–c, R07a, R08a, R09a–c, R10a–d). rev1 ID (R06a 등) 0개 · 읽는 경로 = 그 행 "읽는 파일" + `BS/data/dd_*`뿐 (grep `open(`, `json.load`, `read_text`, `imread`, `savefig`) · `import torch`, `sklearn`, `np.load`, `.npz`, `.pt` 0개 · R00b = `A3/runs/141768_v10000_base/grid_6h.png` 대 `A3/runs/143716_v10142_p10136_t18h/grid_18h.png`, 나란히 붙이기만, 같은 타일 수, 패널 제목에 학습 시간 (6h, 18h) (#138) · R00a: v10142 6.10을 굵게, `outside` 행은 회색 (`dd_rule_status.csv`) · R00c 값 = `dd_scale.json` 키 · 판정선, δ, 상관, 직선, 규모 값은 파일에서 읽는다. 스크립트에 `1.309`, `1.5626`, `0.795`, `3.928`, `879.5`, `154`, `137` 상수 0개 (grep) · 설계 "칸 확인" 칸은 developer가 열어 실제 칸 이름을 보고에 적는다 (DD-1-05가 `figures.md`에 옮긴다) · 공용 스타일 모듈 `BS/dd_style.py` 하나 (설계 §5.2). 방법 → 색 고정 맵, starter(base)는 회색 (`rules/visualization.md` §5) · `rules/figures.md`: `layout="constrained"`, 범례는 축 밖 위 (`fig.legend(loc="outside upper center")`), 글꼴 대체 목록 §5, 축 라벨에 양과 단위, 7 pt 이상 · 중요한 숫자 (Δ, 판정)는 그림 위 글자 (`rules/visualization.md` §3) · 저장 뒤 12장을 열어 겹침 없음을 보고에 1줄씩 · 같은 실행 명령, 12개 모두 exit 0.
- [x] **DD-1-04 (ENG) 썸네일 11장 `BS/fig_dd_thumbs.py` (설계 §5.5, D7)** → M1
  - rev2 폴더 11개 기준으로 닫혔다. rev3 폴더 12개와 csv 04행 고침은 DD-1-10이다.
  - **AC** 선행 DD-1-02 (닫힘). 설계 §11 D7은 D6 뒤지만, 막대 값은 차트가 아니라 저장 파일에서 읽어 DD-1-03을 기다리지 않는다 · `BS/fig_thumb.py`의 `make_thumb(...)`를 import한다 · 읽는 경로 = `BS/data/dd_thumbs.csv`뿐. 11행 (00–10, 설계 §5.5 표): NN, slug, big, sub, bars, source (파일 + 칸). source 빈칸 0. 막대 값은 developer가 source 파일에서 읽어 csv에 적는다 · 10 big 기본값 = "879.5 graphics-processor hours" (설계 §5.5 "GPU-hours"는 약어 0 규칙과 어긋난다. architect가 바꿀 수 있다) · 출력 `D/NN-<slug>/NN-<slug>.png`, 폴더 = 설계 §6.2 rev2 폴더 칸, 폴더마다 1장 · `sips` = 1200 × 630 · 라벨 "Diffusion from scratch · NN" · csv 글자에 약어 grep `\b(DDPM|FID|EMA|MLP|SiLU|ReLU|GN|AdaGN|MSE|GPU|SD|DiT|LR)\b` 0건 · `thumb_preview_360.png`를 열어 읽힘을 보고에 · 같은 실행 명령, exit 0.
- [ ] **DD-1-05 (ENG) 글 폴더에 PNG 놓기 + `S/redaction-check.md` (rev3)** → M1
  - **AC** 선행 DD-1-10, DD-1-11 · 폴더마다 PNG = 위 "그림 나누기"의 그 글 ID 파일 (`tips_<ID>.png`, `fig_dd_NN_*.png`, 이름 그대로 복사) + 썸네일. 그 밖의 PNG 0 · 12개 폴더 PNG 합 = 83 + 12 = 95 (`ls D/[01][0-9]-*/*.png | wc -l`) · `dup:` 행 PNG 0.
  - `figures.md`는 글 행(C15)이 쓴다. 이 행은 쓰지 않는다. 이미 있으면 폴더 PNG 집합 = `figures.md` file 칸 집합인지 보고에 1줄.
  - `S/redaction-check.md` = 설계 §8.3 grep 명령 글자 그대로 + §8.2 자리 바꿈 표 · 고의 파손: scratchpad 사본에 32자 hex 1줄 → 1건, 지우면 0건. 결과를 "Checks"에 · `D/`와 `BS/data/dd_*`에 1회, 0건 또는 줄마다 사유 · 보고에 2줄: "README: lines 2, 14 only", "student folders: not opened".
- [ ] ~~**DD-1-06 (ARCH) 오너가 고친 페이지로 설계 §5.1 다시 맞추기 (Grep만)** → M1~~ <!-- SUPERSEDED 2026-10-28 rev3: 인벤토리 DD-1-08 + 재동기화 설계 §4.5 (E12) -->
  - ~~**AC** 선행: Q-DD11 오너 답 (페이지 고침 끝) · 판정 규칙 (설계 §4.1)으로 그림 SVG 수와 "Figure N." 순서를 Grep으로 센다. 실행 0 · 영어 판이 생긴 T16, T20, T22, T23의 번호와 §5.1 행을 맞춘다. 행 수가 바뀌면 §5.1, §6.2 그림 칸과 합, §0 G-DD2를 같은 edit에서 고친다 · 결과 1줄을 설계 §4.1에: 셈, 번호 순서 통과, 날짜 · 바뀐 수는 main session이 pm에 넘겨 이 plan의 G-DD2, M1 exit, DD-1-05 합을 고친다.~~
- [x] **DD-1-07 (MAIN) 렌더러 확인, 목록 보기만 (설계 §4.2, D3)** → M1
  - **AC** Playwright Chromium 또는 Chrome 설치 여부를 목록 보기로 확인한다 (예: `ls`, `which`). 브라우저 실행 0 · 결과 1줄 (경로와 판, 또는 "없음")을 `01.status.md`에 · 없으면 DD-1-01 전에 오너에게 설치를 묻는다.
  - 결과 (2026-10-28): `/Applications/Google Chrome.app` 156.0.8078.49. Playwright Chromium 없음.
- [x] **DD-1-08 (ENG) 인벤토리 `BS/dd_tips_inventory.py` (설계 §4.5, E2). 먼저 한다** → M1
  - **AC** 표준 라이브러리만 (`re`, `html.parser`, `hashlib`, `csv`). `torch`, `numpy`, `playwright`, `selenium` import 0 · 입력 = 설계 §4.4 표의 7쪽 (`TA/tips/a03/`) + 전 판 csv뿐. 페이지 경로는 인자로 바꿀 수 있다 (고의 파손용).
  - 출력 `BS/data/dd_tips_inventory.csv`, 칸 = 설계 §4.5 표 순서 그대로 (`id` … `export`) · `BS/data/dd_tips_diff.md` (전 판이 없으면 "first run" 1줄).
  - 캡션 판정 = 설계 §4.1 rev3 줄 (페이지마다 캡션 꼴이 다르다) · 맞추기 = §4.5 규칙 1–5 · 첫 실행의 `id`, `post`, `section`, `export` = 설계 §5.1 rev3 표 + §4.4 첫 diff (H47, H48 새 행, A10 = `dup:H47`).
  - 셈을 보고에: 단위 수, `yes` 수, `dup` 수, `redraw` 수 (첫 실행 기대 92, 67, 21, 4). 다르면 행마다 이유. 인벤토리 수가 G-DD2의 수다.
  - `redraw` 행이 `ko_in_svg = 0`, `redact_hits = 0`이 되면 다음 실행에서 `yes`로 바꾼다. 4장 모두 고치면 `yes` = 71.
  - 보고에 `yes`/`redraw` 행 중 `ko_in_svg`, `redact_hits`, `xref_in_svg`가 0이 아닌 행 목록. Q-DD12 고침 목록 (U01, C03, RS1, RS2, F02, H09)과 대조 1줄.
  - 고의 파손: scratchpad 사본 페이지에서 SVG 글자 1개를 바꿔 다시 돌린다 → diff `CHANGED` 1행. 되돌리면 0건. TA 원본은 고치지 않는다.
  - 실행 = ta 저장소 루트에서 `OMP_NUM_THREADS=1 timeout 300 uv run python blog_series/dd_tips_inventory.py`, exit 0. 저장된 HTML 글자만 읽어 로컬 허용이다 (`~/.claude/CLAUDE.md` "Allowed locally"). `BS/README.md`에 행 1.
- [x] **DD-1-09 (MAIN) rev2 폴더 10개 → `x_<name>` (설계 §5.5, E3)** → M1
  - **AC** 먼저 `ls D/` 1회. 이름 10개 = 설계 §5.5 "대상" 목록 (`01-how-diffusion-adds-noise` … `10-experiments-and-process`). 다르면 STOP, 보고 · `mv D/<name> D/x_<name>` 10회. `rm` 0 (soft delete) · `00-overview`는 그대로 (slug가 같다) · 뒤 `ls D/` 결과 1줄을 `01.status.md`에.
- [x] **DD-1-10 (ENG) 썸네일 12장 rev3 + `dd_thumbs.csv` 12행 + 시간·어텐션 매개변수 (설계 §5.5 rev3, §3, E4)** → M1
  - **AC** 선행 DD-1-09 · `BS/data/dd_thumbs.csv` = 설계 §5.5 rev3 표 12행 (NN, slug, big, sub, bars, source). source 빈칸 0.
  - 04행 bars = 33,024 대 317,856 (최종 망). csv에 `115584`, `115,584` 0 (grep) · 115,584가 starter 값인지 `A3/runs/141768_v10000_base/manifest.json` `arch`로 확인해 보고에 1줄.
  - 새 `BS/extract_dd_time_params.py` → `BS/data/dd_time_params.json`. 키: 공유 MLP, Block Linear 합, Block마다 MLP일 때 합 (설계 §6.3 04행), starter Block Linear 합, 어텐션 블록 하나의 매개변수 (32×32, 8×8), 자리마다 채널 수.
  - 입력 = manifest 2개 (`A3/runs/141768_v10000_base/`, `A3/runs/143716_v10142_p10136_t18h/`) + `A3/code/variants/v10136_p10087_attn32/model.py` 글자(`read_text`)뿐. 산수만. `import torch` 0, 모델 생성 0, `param_estimate.py` 실행 0.
  - 06행 bars = 위 json 어텐션 키 · 출력 `D/NN-<slug>/NN-<slug>.png` 12장, 폴더 = 설계 §6.2 rev3 폴더 칸 · `sips` 1200 × 630 · 라벨 "Diffusion from scratch · NN".
  - csv 글자 약어 grep `\b(DDPM|FID|EMA|MLP|SiLU|ReLU|GN|AdaGN|MSE|GPU|SD|DiT|LR)\b` 0건 · `thumb_preview_360.png`를 열어 읽힘을 보고에 · 스크립트 2개 모두 같은 실행 명령, exit 0.
- [x] **DD-1-11 (MAIN) 고정 확인 + R1 1회 (설계 §4.2, §4.5 고정 조건, E7)** → M1
  - **AC** 선행 DD-1-01, DD-1-08 닫힘 · Q-DD12 오너 답 둘: 설계 §4.6 "필수" 고침 끝 + 오너 "frozen" (또는 같은 뜻).
  - 고침 목록 (설계 §4.6): U01, C03, RS1, RS2 그림 안 한국어 → 영어 · RS2 폭 2060px → 나누거나 1000px 근처 · F02 그림 안 "(Figure 7)", "(Figure 4)", H09 "Figure 27" → 이름이나 "Step N →" 꼴. 오너가 "이번에는 뺀다"고 한 행은 뺀다.
  - "frozen" 뒤 인벤토리 1회. diff = Q-DD12 고침 행의 `CHANGED`만, 또는 0건. 그 밖의 행이 있으면 STOP, 오너에게 · 한 번 더 돌려 diff 0건 · `yes` 행 모두 `ko_in_svg` 0, `redact_hits` 0. 아니면 STOP, 오너에게.
  - R1 직전 오너에게 한 줄: "R1 1회, 입력 7쪽, 캡처 68장, 한 코어 제한 밖 브라우저". 거절이면 D-row (설계 §4.2).
  - DD-1-01 보고의 명령으로 1회 (#138, #139). 시간 초과면 멈추고 오너에게 다시 묻는다. 두 번째 실행 0.
  - 결과: `BS/out_dd/tips_*.png` 수 = `yes` 행 수 (rev3 71), 폭 2000px (`sips -g pixelWidth`) · `dd_tips_source.json` commit, sha256 → DD-1-00 못 맞춘 1항 닫힘 · 1줄 `01.status.md`.
- [x] **DD-1-12 (ENG) 잡음 일정 값 `BS/extract_dd_schedule.py` → `BS/data/dd_schedule.json` (#141)** → M1
  - 이유: 02의 β, ᾱ 표는 tips Table 11에서 옮겼다. 데이터 파일 근거가 없다 (G-DD3).
  - **AC** 입력 = `A3/code/diffusion.py` 글자(`read_text`)뿐. 16–18행의 T, β 시작, β 끝을 정규식으로 읽는다. 상수로 쓰지 않는다 (grep `1000`, `1e-4`, `0.02` 0건, 주석 제외).
  - 표준 라이브러리만 (`math`, `json`, `re`). `torch`, `numpy` import 0. 모델 생성 0.
  - json 키: `T`, `beta_start`, `beta_end`, `source` (경로 + 행), `rows` = t마다 β_t, ᾱ_t, √ᾱ_t, √(1−ᾱ_t).
  - t 목록 = 02 초안의 β, ᾱ 표의 t 전부 + 250, 750 + H13 절의 t 셋. t는 developer가 초안과 `figures.md`에서 읽어 인자 목록으로 준다. 보고에 목록 1줄.
  - 대조: 02 초안 숫자 (표, 0.722, 0.692, 0.057, 0.998, H13 0.133)와 json 값 (같은 자리수 반올림). 다른 값은 줄마다 보고. 초안은 고치지 않는다 (DD-2-13이 고친다).
  - 고의 파손: scratchpad 사본 `diffusion.py`에서 β 끝 줄을 지운다 → exit ≠ 0. 원본은 고치지 않는다.
  - 실행 = ta 저장소 루트에서 `OMP_NUM_THREADS=1 timeout 300 uv run python blog_series/extract_dd_schedule.py`, exit 0 · `BS/README.md`에 행 1.

## Tactic: 글 쓰기와 유일한 검토 (설계 rev3 E8, E9) → M2

### 공통 AC (DD-2-00…11 모두)

검사 명령은 writer가 돌리고 결과를 보고에 적는다.

- C0 writer는 쓰기 전에 Read 도구로 다시 읽는다 (2026-10-28 판): `.claude/rules/writing/style.md` (§1 형태 순서, §5.1, §5.2, §5.3), `.claude/rules/figures.md` §3, `.claude/rules/visualization.md`, `.claude/rules/writing/tips-page.md` §2 (00 "What helped" 표 칸).
- C1 파일 = `D/NN-<slug>/NN-<slug>.md`. 폴더 이름 = 설계 §6.2 rev3 폴더 칸.
- C2 앞머리(front matter) 키 = cnn 00 글과 같다: `title`, `tags`, `desc`, `date`, `priority` (= NN), `userId: 1`, `username: taeklim`, `status: 'public'` (설계 §6.5).
- C3 제목 = `Diffusion From Scratch (n/11): <claim>`. 00만 `Diffusion From Scratch: <claim>` (설계 §6.1 rev3, #138). 15단어 이하. 제목 안 약어는 풀어 쓴다.
- C4 본문 첫 줄 = `![NN-<slug> thumbnail](NN-<slug>.png)`.
- C5 그림: md가 참조하는 PNG = 그 행의 그림 ID 전부 (빠짐 0, 남음 0). 파일 이름 = `tips_<ID>.png`, `fig_dd_NN_*.png` (DD-1-03 이름 그대로), 썸네일. R1 전이면 파일이 폴더에 아직 없어도 된다. 폴더와 맞는지는 DD-2-12가 본다 · mermaid 블록 = 그 행의 M ID + Structure 절 mermaid 1개까지, 노드 12개 이하. Structure mermaid는 writer가 `figures.md`에 행 1을 더한다 · 그림 순서 = 설계 §6.3 rev3 절 순서.
- C6 캡션: 이미지와 mermaid마다 이탤릭 캡션 1줄, 2문장, 둘째는 `Why:`로 시작 (`rules/figures.md` §3). 그 아래 이름표 줄 (세지 않는다). 이름표 줄은 "Illustrative values"와 "Abbreviations:"만 · "Illustrative values" = 설계 §5.1 rev3 값 칸에 illus가 있는 그림마다 있음, meas/exact만인 그림과 R 차트에는 0 · 캡션에 "Source:"와 경로 0. 출처는 `figures.md`에만 (#138. `rules/figures.md` §3 "출처 폴더"를 이 연재는 `figures.md`로 대신한다).
- C7 약어: 설계 §6.5 목록의 약어는 언급마다 full name (ABBR). 검사: 앞머리와 코드 블록 밖에서, 약어 `\bABBR\b`가 있고 그 full name이 없는 줄 = 0. 표 칸, 이름표 줄 포함. U-Net, 코드 식별자는 예외.
- C8 숫자: 본문 숫자마다 그 글 `figures.md` 행 (파일 + 칸). 빼는 것: 날짜, 글 번호 n/11, run 이름 (v10142). 새 숫자는 writer가 행을 더한 뒤 넘긴다 · FID는 언급마다 척도 이름 (public FID, FID@5k, FID@1k). 공개 FID와 FID@5k를 같은 척도로 비교하지 않는다 (설계 §6.4) · `5.99`는 "outside the course rule"가 있는 줄에만 · "460" GPU-h 0회 · 평균마다 seed 수.
- C9 영어. `[가-힣]` 0건. 줄표 grep (`rules/writing/style.md` §3) 0건. 앞머리와 코드 블록 밖 `;` 0개. 문장 15단어 이하.
- C10 비밀: 설계 §8.3 grep (글자 그대로, `S/redaction-check.md`가 있으면 그것)을 그 폴더에 돌려 0건. 맞은 줄은 줄마다 사유를 보고에. run 폴더 이름, job id, 클러스터 이름 0 (설계 §8.2). 과목 학습 이미지 0장.
- C11 기본 문구 (설계 §9, #138): "from scratch" = Q-DD5 문장 · 과목 = "CS 6379 Deep Learning, UTRGV" (Q-DD8) · 시점 = "as of 2026-10-27" (Q-DD7, 00과 10) · 화자 표현 없음, "my runs"만 (#138). `(?i)as (a|the) (student|TA)\b` 0건.
- C12 00만 다른 글로 링크한다. 연재 지도 링크 = `/@taeklim/TBD-NN` (DD-3-03이 바꾼다). 01–11은 연재 글 링크 0개. 다른 글을 말할 때는 "post 6" 같은 글자만.
- C13 (#141) 본문 줄 수 ≤ 설계 §6.2 rev3 길이 칸 + 10 + 3 × N.
  - 본문 줄 = 앞머리 뒤의 빈 줄이 아닌 줄: `awk 'c>=2 && NF {n++} /^---$/ && c<2 {c++} END {print n}' <md>`.
  - N = 썸네일을 뺀 PNG 참조 + mermaid 블록: `grep -oE '\((tips_|fig_dd_)[^)]*\.png\)' <md> | wc -l` + ``grep -c '^```mermaid' <md>``.
  - 3 = 그림 절 하나의 고정 줄 (제목, 이미지, 캡션). 그림은 글 예산을 쓰지 않는다. 글 예산은 §6.2 그대로다.
  - 넘으면 글을 줄인다: 절마다 그림 + 한 줄, 핵심 단어와 숫자만 (메모리 `blog-series-chart-first`). 그림은 빼지 않는다 (G-DD2).
  - 그래도 넘으면 보고한다. 행 AC의 표 때문이면 main session이 D-row를 쓴다 (#125 선례). 글 나누기는 S1, G-DD1을 바꾸므로 오너만 정한다 (#141). writer와 pm은 나누지 않는다.
- C14 쓰는 이 = `sonnet-writer`. 원본 = 설계 §6.2 rev3 그 행, §6.3 rev3 그 행, §5.1, §5.2의 그 그림 행, `BS/data/dd_tips_inventory.csv` 그 글 행, 원본 7쪽의 그 절 글 (읽기만, 한국어 글은 영어로 새로 쓴다, W11), 거기 적힌 저장 파일. TA 코드, 노트북 실행 0. 보고에 2줄: "README: lines 2, 14 only", "nothing run". 커밋 없음.
- C15 writer가 `D/NN-<slug>/figures.md`를 쓴다 (설계 §6.5, cnn 07 선례). 칸 = ID, file, what it shows, key numbers (원본 파일 + 칸 또는 행), value kind (illus / meas / exact), takeaway · 행 = 그 글 그림 ID마다 1 + 썸네일 1 + mermaid마다 1. 12개 합 = 83 + 12 + 1 (M10) + Structure mermaid 수 · key numbers 경로마다 `test -e`. 명령과 결과를 "Checks" 절에 · 공개 FID 행에 "owner copied from the grader screen" (설계 §6.4).

작가 AC W1–W11 (설계 §6.3, 글자 그대로). 행마다 W 줄이 그 글의 W1 절과 W7 항목을 채운다.

| # | 검사 |
| --- | --- |
| W1 | 개념 글의 `##` 절 순서가 위 뼈대와 같다. 측정 글은 측정 순서 |
| W2 | (#141) loop 절마다 그림 1장과 캡션 다음에 한 줄: `**Why** … . **Mission** … . **Vision** … .` 굵은 라벨, 콜론 0. 마침표로 끝나는 세 문장, 문장마다 15단어 이하. 세 줄 목록 꼴 0 (grep `^- (Why|Mission|Vision):` 0건). 한 줄 꼴 수 = loop 절 수: `grep -cE '^\*\*Why\*\* .*\. \*\*Mission\*\* .*\. \*\*Vision\*\* .*\.$'` (01: 3, 02: 9, 03: 7, 04: 6) |
| W3 | 그림 → 표 → 수식 → 코드 순서. 코드 블록이 그림 앞에 없다 |
| W4 | 캡션 2문장, 둘째 문장 "Why:". 이름표 줄은 "Illustrative values"와 "Abbreviations:"만. 캡션에 출처 0 (#138) |
| W5 | 약어 언급마다 풀이. 줄표 0, 세미콜론 0, 문장 15단어 이하 |
| W6 | 숫자마다 `figures.md` 행 (파일 + 칸). FID마다 척도 이름 |
| W7 | §5.1 "고칠 점"의 본문 줄(V1, V2, V14 등)이 있다 |
| W8 | 화자 표현 없음. "my runs"만 (#138) |
| W9 | 그림 안 run 이름(C3a, K1, B3, O, T …)마다 캡션 이름표 줄에 풀이 (rev3) |
| W10 | 어텐션 head: 최종 망 1. 4 head 그림(A14, F05)은 캡션에 "Illustrative values" + 본문 한 줄 (rev3) |
| W11 | 한국어 원본 글(U, A, F 페이지)의 내용은 영어로 새로 쓴다. 한국어 0 (rev3) |

- 뼈대 (`rules/writing/style.md` §5.1): 개념 글 01–09 = Problem → Result → Mission → Vision → loop (절마다 [그림] → Why → Mission → Vision) → Structure → Parts → Fit. 측정 글 00, 10, 11 = Conclusion → Why we did it → Data → What was done → Result and how to read it.
- 설계마다 "why it was built this way" 1줄 + 실제 숫자 예 1개 (`rules/writing/style.md` §5.3).
- 뒤 글 행 DD-2-04…09, 11은 첫 초안부터 새 C13과 W2 (#141)를 따른다. 04는 지금 쓰는 중이다. main session이 그 writer에게 #141을 전하고, writer는 넘기기 전에 맞춘다. 별도 고침 행은 없다.

### 행

선행: DD-1-08 (그림 ID), DD-1-10 (썸네일) 닫힘. R1 (DD-1-11)은 기다리지 않는다 (설계 E8). 그림 ID = 위 "그림 나누기" (설계 §6.2 rev3, 06만 §4.4 첫 diff).
rev3 번호 (2026-10-28): 글 12개, 오너 주제 순서. 열린 행이라 제자리에서 고쳤다. 옛 DD-2-11 (REVIEW) → DD-2-12. rev2 내용은 설계 §6.2 rev2 표 (기록)에 있다.
행마다 W 줄 = W1–W11 전부 + C10 비밀 grep 0. 아래 W 줄에는 그 글의 W1 순서와 W7 항목만 적는다. 크기 M = 00, 02, 05, 07, 08, 10 (설계 E8).

- [ ] **DD-2-00 (WRITER) 00 개요 (overview)** → M2
  - **AC** 공통 AC · R00a, R00b, RS3, R00c, H02. M00 0 (설계 §5.3) · 머리 숫자 = public FID 30.26 → 6.10, grade D → A (`A3/runs/LEADERBOARD.md` 9, 20행) · 매개변수 3,320,387 → 9,832,523 (두 `manifest.json` `n_params`) · R00b 캡션 = 실제 생성 이미지, 학습 시간 6h 대 18h · "By the numbers" = `BS/data/dd_scale.json`: run 폴더, manifest run, 뺀 폴더 수, "at least" GPU 시간, GPU 종류, 판정 파일, 업로드 · "What helped" 표 칸 = What / Where / How / Why it helps (`tips-page.md` §2 3단계). 행 = 거르기 통과 변경과 조합, 효과 큰 순서, 평균마다 seed 수, 숫자는 R09b, R10a 데이터 (`style.md` §5.2) · Stack에 GPU 이름만 (설계 §8.2) · 연재 지도 11행 (01–11).
  - **W** W1 측정 순서 = 설계 §6.3 rev3 00행: Conclusion (한 줄 굵게 + R00a) → Samples (R00b) → Why we did it → Data → What was done (RS3) → What helped → By the numbers (R00c) → How the network grew (H02) → Stack → Series map · W7 V9 ("one more level") · W9 RS3 상자의 run 이름.
- [ ] **DD-2-01 (WRITER) 01 왜 확산, 왜 U-Net (why diffusion, why a U-Net)** → M2
  - **AC** 공통 AC · H01, H05, U01 · Structure = 표 "what the U-Net does / what the outer loop does" (U 페이지 표) · Parts = 왜 U-Net인가 한 줄씩 (같은 크기 출력, 여러 크기, skip) · Fit: 과목 starter가 U-Net이다 · U01이 영어가 안 되면 그림 2장으로 선다. `figures.md`에 이유 1줄 (설계 §6.2).
  - **W** W1 loop = Two modes (H01) → Who adds the noise (H05) → The network guesses, the loop removes (U01) · W7 V5 (H01 캡션), V11 (H05: `F.mse_loss(out, eps)`는 줄인 인용).
- [ ] **DD-2-02 (WRITER) 02 잡음, t, 학습 step 하나 (noise and one training step)** → M2
  - **AC** 공통 AC · 그림 순서 H06 → H07 → H08 → H13 → H09 → H10 → H11 + Step 7 표 (batch 코드) + Step 8 표 ("왜" 먼저, review F2) · 일정 값 T = 1000, beta 1e-4 → 0.02 + "(schedule)", 출처 `A3/code/diffusion.py` 16–18행 · H07, H08 = illus, "Illustrative values".
  - Structure = 학습 step mermaid · Parts = β 일정 표, 그 뒤 식 x_t = √ᾱ x0 + √(1−ᾱ) ε (F 페이지 글) · Fit: 학습 루프는 과목 고정, 망만 우리 것 · 코드 인용 10줄 이하, 그림과 표 뒤에만 · H09 그림 안 "Step N" 0은 DD-2-12가 PNG로 본다.
  - **W** W1 loop = How much image is left (H06) → x_t in numbers, t = 250 (H07) → t = 750 (H08) → Same pixel, three answers (H13) → One step through the network (H09) → How training lowers the error (H10) → The six lines (H11) → One batch, one t per image (Step 7 표) → Why each image needs its t (Step 8 표) · W7 V15 (H13 "noise weight 0.133").
- [ ] **DD-2-03 (WRITER) 03 U-Net 안 (inside the U-Net)** → M2
  - **AC** 공통 AC · H04, H27, H32, H33, H34, H35, H36 · Block, attention, skip을 처음 쓰기 전에 정의한다 (F3) · H34 숫자 = `figures.md` meas 행 · Structure = 단별 채널 표 56, 112, 224, 224 (`manifest.json` `arch`) · Parts = Block 순서 GN → SiLU → conv → + time → GN → SiLU → dropout → conv → + x (F 페이지 "Block 하나") · Fit: 64×64, 단 4개, 10M 상한 안.
  - **W** W1 loop = The whole network (H04) → One stage, step by step (H27) → Upsampling copies values (H32) → The skip makes pixels differ (H33) → u3 in 3D (H34) → The u3 flow (H35) → Activation (H36) · W7 F3, Z1 (H04 색 범례 = 본문 표), V5 (H33), H36 본문 1줄 "the rectified linear unit (ReLU) version was not trained".
- [ ] **DD-2-04 (WRITER) 04 U-Net 안의 시간 (time inside the U-Net)** → M2
  - **AC** 공통 AC · H12, H14, H15, H16, H17, H18 · Structure = 모양 표 t → sin/cos 128 → e 128 → te C → (C, 1, 1) · Parts = 공유 MLP 대 Block Linear 합 대 "Block마다 MLP" 합. 숫자 = `BS/data/dd_time_params.json` (DD-1-10). 115,584 0 · Fit: 호출 한 번에 잡음 수준 128개.
  - **W** W1 loop = From t to every pixel (H12) → One shared MLP (H14) → Near t and far t (H15) → Adding t inside a Block (H16) → The batch as a heat map (H17) → Three images, three noise levels (H18) · W7 V5 (H15), V7 (H16 캡션 `;` 0), Z6 (H17 캡션 첫 문장 = 색 눈금) · W11 홈 임시 글 표 (Table 26, 28).
- [ ] **DD-2-05 (WRITER) 05 어텐션이 더하는 것 (what attention adds)** → M2
  - **AC** 공통 AC · 그림 순서 A13 → A09 → H28 → H29 → H30 → A04 → A05 → H31 ("왜" 먼저, 설계 §6.2) · Structure = 자리 표 8×8 (d4, mid) + 32×32 (d2, u2), 픽셀 쌍 4,096과 1,048,576 (manifest `arch.attn_res`, `dd_time_params.json`) · "8×8 bottom only" 같은 글 0 (설계 §3 정정).
  - Parts = softmax(QKᵀ/√d)V, 그림과 표 뒤. d = 그 자리 채널 수 (`dd_time_params.json`) · Fit: 쌍의 수가 제곱이라 작은 지도에만 둔다 · A04 (높이 1748)는 데스크톱 기준.
  - **W** W1 loop = 설계 §6.3 rev3 05행 순서 (Reach … The core as matrix products) · W10 head 1 · W11 A 페이지 글.
- [ ] **DD-2-06 (WRITER) 06 Q, K, V와 head (query, key, value and heads)** → M2
  - **AC** 공통 AC · A06, A07, H47, H48, A11, A12, A14 (설계 §4.4 첫 diff. A10 = 중복 H47, 쓰지 않는다) · Structure = W_Q, W_K, W_V 표 (A 페이지 표) · Parts = "what Q, K, V actually learn" 표 (A 페이지 표 8) · Fit: 최종 망은 head 1 (manifest `arch.heads`). A14는 설명용 (W10) · 숫자 = `dd_time_params.json` 어텐션 키.
  - **W** W1 loop = One weight, three roles (A06) → Where the weights start (A07) → A query meets every key (H47) → The output, one weight at a time (H48) → QKᵀ in small numbers (A11) → How Q, K, V learn (A12) → Heads, illustrative (A14) · W7 캡션이 softmax, query, key, value를 풀이 · W10, W11.
- [ ] **DD-2-07 (WRITER) 07 샘플러 250번 (sampler, 250 calls)** → M2
  - **AC** 공통 AC · H39, H40, H41, H42, H43, H44, H45, R08a · H40 캡션: 실제 샘플이 아니다, 실제 샘플은 00 · R08a 초 = `eval5k.json` `seeds.0.sample_s`.
  - Parts (그림 뒤, 식은 표 뒤): "Where μ comes from", "β, x_t, and the paper's x_(t−1)" 기호 표, "x_t′ becomes the next x_t", "Why fresh noise" + 숫자 예 1개 (U 페이지 글) · 샘플러 코드 줄이 글의 마지막 형태 (W3) · Fit: 채점기가 250 step으로 고정.
  - **W** W1 loop = 설계 §6.3 rev3 07행 (500 images at a time … What sampling costs) · W7 V2 ("250 steps are set by the course grader" 있음, "fixed in diffusion.py" 0), V14 (H44 "intermediate x is not clamped") · W11 U 페이지 글.
- [ ] **DD-2-08 (WRITER) 08 평가: 두 오차와 FID 척도 셋 (evaluation)** → M2
  - **AC** 공통 AC · H37, H38, R07a, E01–E04, E05, RS5, RI3, RI4, R10b, R10c · E01–E04 = Markdown 표 1개 안 아이콘 4개 · RI3 + RI4 = 한 절 · R07a 숫자 = `val_log.json` (exponential moving average (EMA) 가중치) 칸.
  - Spearman 0.90 (6h, n 9, `analysis/eval5k.json`) · portal fit a, b, n (`analysis/portal_fit.json`) · 외움 기대 1% 선 (`analysis/memorization.json`) · Structure = FID 척도 표 셋 (설계 §3) · Parts = E 페이지 "What you need" 표 · Fit: 공개 FID는 업로드 12번뿐.
  - **W** W1 loop = 설계 §6.3 rev3 08행 (Two errors at three t … No copying) · W7 V1 본문 1줄 그대로 "At t = 980 the estimate is shown before `diffusion.py` clamps it to [−1, +1].", V5 (H38) · W9 E05, RS5, R10b run 이름.
- [ ] **DD-2-09 (WRITER) 09 수식 흐름 (formula flow)** → M2
  - **AC** 공통 AC · F01, F02, F03, F04, F05 · Structure = 식 번호 표, 학습 줄과 샘플링 줄 (F 페이지 표 1–23 줄여서) · Parts = loss, 갱신 한 번, 샘플링 식 · Fit: 같은 U-Net이 두 줄 모두에 쓰인다 · F02 (높이 1387)는 데스크톱 기준.
  - **W** W1 loop = The chain on one line (F01) → Every part, its formula (F02) → Q, K, V in the formula (F03) → From input X to the weight update (F04) → Heads share softmax, not scores (F05) · W10 F05 · W11 F 페이지 글.
- [ ] **DD-2-10 (WRITER) 10 실험: starter에서 final까지 (experiments)** → M2
  - **AC** 공통 AC · H03, R09a, R09b, RS1, RS2, R09c, R10d, RS6, RS7, RI1 · R09b 판정선 −1.309와 통과 6/10 = `A3/analysis/verdicts.json` · R09c에 eval5k 없는 망은 빈칸 + 이유 1줄 · RS7 = "as of 2026-10-27", 그때 숫자가 없으면 "planned".
  - "Tried, not used" 표 = diffusion transformer (DiT), 거르기 탈락 4개, dropout 0.2. 줄마다 이유 1줄 (`style.md` §5.2) · 효과가 seed 흔들림보다 작으면 "effect" 0 · 규칙 밖 업로드는 회색 표기만 (C8) · RS1, RS2가 영어가 안 되면 Markdown 표 + `figures.md` 이유.
  - **W** W1 측정 순서 = 설계 §6.3 rev3 10행 (Conclusion … Tried, not used) · W7 H03 이름표 줄 group normalization (GN), sigmoid linear unit (SiLU) · W9 RS1, RS2, R09b, R09c run 이름 (C3a …).
- [ ] **DD-2-11 (WRITER) 11 과정 공학 (engineering the process)** → M2
  - **AC** 공통 AC · C01, C03, M10, R10a, H46 · δ 1.5626, seed 0–2 (`verdicts_c3a.json` `delta`, `pairs`) · R10a 판정 파일 = `dd_scale.json` `verdict_file_names` · 클러스터 = "a university SLURM cluster"만. 클러스터 이름, VPN, 호스트 0 (설계 §8) · C01 캡션에 "Click a box" 0 · C03이 영어가 안 되면 절을 빼고 `figures.md`에 이유.
  - **W** W1 측정 순서 = 설계 §6.3 rev3 11행 (Conclusion … How each run was measured) · W7 V22 (H46 "notebook Step 5" = 노트북 셀 번호, 본문 1줄).
- [x] **DD-2-13 (WRITER) 02 초안 고침: C13, W2, 일정 숫자 (#141)** → M2
  - **AC** 선행 DD-1-12 · 초안 `02-noise-and-one-training-step.md`를 제자리에서 고친다. 그림 7장, mermaid 1, Step 7, 8 표는 그대로 둔다 (빠짐 0).
  - loop 9개 = W2 한 줄 꼴 · C13 상한 = 75 + 10 + 3 × 8 = 109 (명령으로 N을 다시 센다). 결과 줄 수를 보고에.
  - β, ᾱ 표와 √ᾱ 숫자 (0.722, 0.692, 0.057, 0.998, 0.133)의 `figures.md` 행 = `BS/data/dd_schedule.json` + 키. tips Table 11을 가리키는 행 0. json과 다른 값은 json 값으로 고친다. 그림 안에 보이는 숫자와 다르면 고치지 않고 보고한다.
  - 이 행이 닫히면 main session이 DD-2-02를 공통 AC로 닫는다.
- [x] **DD-2-14 (WRITER) 03 초안 고침: W2 (#141)** → M2
  - **AC** 초안 `03-inside-the-unet.md` 제자리 · 그림 7장 그대로 · loop 7개 = W2 한 줄 꼴 · C13 상한 = 65 + 10 + 3 × 7 = 96. 결과 줄 수를 보고에.
  - 이 행이 닫히면 main session이 DD-2-03을 공통 AC로 닫는다.
- [x] **DD-2-15 (WRITER) 10 초안 고침: C13 (#141)** → M2
  - **AC** 초안 `10-experiments-starter-to-final.md` 제자리 · 그림 10장 그대로 · C13 상한 = 80 + 10 + 3 × 10 = 120 (초안 124).
  - 절마다 그림 + 한 줄, 핵심 단어와 숫자만 (메모리 `blog-series-chart-first`). 줄이는 곳 = 산문 줄. 행 AC 표 ("Tried, not used")와 숫자는 남긴다.
  - 뺀 숫자가 있으면 `figures.md`의 그 행도 뺀다 (C8, C15 집합 일치). 결과 줄 수를 보고에.
  - 이 행이 닫히면 main session이 DD-2-10을 공통 AC로 닫는다.
- [x] **DD-2-16 (WRITER) 01 초안 고침: W2 (#141)** → M2
  - 이유: 01은 C13 안이지만 (54 / 64), loop 3개가 세 줄 꼴이라 새 W2에 걸린다 (pm 추가).
  - **AC** 초안 `01-why-diffusion-why-unet.md` 제자리 · 그림 3장 그대로 · loop 3개 = W2 한 줄 꼴 · C13 상한 64 · 이 행이 닫히면 main session이 DD-2-01을 공통 AC로 닫는다.
- [ ] **DD-2-12 (REVIEW) reviewer 1회: 글 12개 + 썸네일 12장 + 그림 PNG 83장, 발행 전 (설계 E9)** → M2
  - **AC** DD-2-00…11, 13…16 닫힘 + M1 exit 닫힘 (R1, DD-1-05) 뒤 1회 · 검사 = 공통 AC C0–C15 + W1–W11 + 행별 AC + 설계 §8.4 R1–R7 + `rules/figures.md` §7 (차트 12장). §7 캡션 행의 "출처 폴더" 항목은 C6이 대신한다 (#138).
  - 폴더마다 PNG 집합 = md 참조 집합 = `figures.md` file 칸 집합. 합 83 + 썸네일 12 · 설계 §8.3 grep을 `D/`와 `BS/data/dd_*`에 1회, 맞은 줄마다 판정 · 썸네일과 그림 안 글자를 눈으로 (R3). 그림 안 한국어 0, "Step N" 0.
  - 머리 숫자 30.26, 6.10, 3,320,387, 9,832,523, −1.309, 1.5626, 0.90, 879.5, 33,024, 317,856, head 1을 원본 파일과 대조 · 결과 파일 `dd.review.md` (PASS 또는 지적 목록, 지적마다 파일:행) · 지적은 sonnet-writer 또는 developer가 고친다. main session이 검사 명령으로 확인한다. 두 번째 reviewer 실행은 없다 (#124 선례).
  - 알려진 그림 문제 (메모만, 정하지 않음, 2026-10-28). PNG 안 수강생용 글자다. 다시 내보내지 않으면 고칠 수 없다.

    | 그림 | PNG 안 글자 | 상태 |
    | --- | --- | --- |
    | H09 범례 | "Step →" (N 없음) | #140이 정함: 캡션 메모 |
    | H09 범례 | "Figure 27" (옛 번호) | 열림 |
    | H09 제목 | "(your part)" | 열림 |
    | H11 | "the network (yours)" | 열림 |

  - 열린 3개의 고칠 길: (a) 캡션 메모 (02 캡션 이름표 줄, 다시 내보냄 0). (b) 오너가 tips 페이지에서 다시 그림 + 두 번째 R1 실행. (b)는 오너 OK가 다시 필요하다 (#138, #140, 설계 §4.7).
  - reviewer는 이 행들을 `dd.review.md`에 "알려진 문제, 오너 답 대기"로 적는다. 오너 답이 오면 main session이 D-row를 쓴다.

## Tactic: 발행과 확인 (설계 §7, rev3 E10, E11) → M3

선행: M2 exit 닫힘 (DD-2-12 지적 고침). 오너 폴더 확인 없음 (#137). rev3: 글 12개, 01 → 11 다음 00 (설계 §7.1).
증거 파일: `deploy/projects/dd-pre-<date>.txt`, `dd-publish-<date>.txt`, `dd-prod-<date>.txt`.

- [x] **DD-3-01 (MAIN) 사전 SELECT P1–P3 (읽기 전용, 설계 §7.1)** → M3
  - **AC** P1 `projects` 루트 자식 `title='utrgv'`, `deleted_at IS NULL` = 1행, priority 40 · P2 사용자 전체 `title='ddpm-from-scratch'` 살아 있는 행 0 · P3 `utrgv` 자식 = `cnn-from-scratch` 1행. 0행이면 PG-2-05가 아직이다 (루트 `CLAUDE.md` Projects 절): STOP, 오너에게 보고 · 지금 메뉴 Projects 배지 값 1줄 · 하나라도 다르면 STOP · 출력 `dd-pre-<date>.txt`.
- [x] **DD-3-02 (MAIN) 01 → 11 발행** → M3
  - **AC** 발행 전 경로 검사: md 경로 11개가 모두 `./posts/projects/utrgv/ddpm-from-scratch/`로 시작. `x_` 폴더 경로 0 · `apps/blog_agent`에서 `uv run python scripts/publish_oneshot.py --no-llm ./posts/projects/utrgv/ddpm-from-scratch/<NN-slug>/<NN-slug>.md` 글마다 1회, 순서 01 → 11 · 글마다 URL `?probe=$T` 200 · slug 11개를 `dd-publish-<date>.txt`에 · 발행 뒤 `ddpm-from-scratch` 1행, 부모 = `utrgv` 행 · 새 그룹 행 0.
- [x] **DD-3-03 (WRITER) 00 연재 지도 링크를 실제 slug로** → M3
  - **AC** 원본 = `dd-publish-<date>.txt` · 00 md의 `TBD-NN` 0개, 링크 11개 = `/@taeklim/<slug>`, slug가 publish 파일과 글자 단위로 같다 · 고치기 전 사본과 비교해 바뀐 줄 = 링크 줄만 · 그 폴더에 §8.3 grep 다시 0건.
- [x] **DD-3-04 (MAIN) 00 발행** → M3
  - **AC** DD-3-03 뒤 1회 · URL 200 · 지도 링크 11개 모두 `?probe=$T` 200 · slug를 publish 파일에 더한다 (모두 12개).
- [x] **DD-3-05 (MAIN) purge + 운영 확인 (설계 §7.2)** → M3
  - **AC** `_scripts/cloudflare/cf-purge.sh` 1회 · `/@taeklim/projects/ddpm-from-scratch` 200, 글 12개, 순서 00 → 11 · `/@taeklim/projects` `id="utrgv"` 구역 카드 2개 (cnn, ddpm) · 배지 = DD-3-01 값 + 1 · 글 12개 200, 글마다 이미지 수 = 그 폴더 PNG 수 (그림 합 83 + 썸네일), 11에 mermaid 있음 · `sitemap.xml` 새 글 URL 12개 · 새 글 2개 둘째 GET `cf-cache-status: HIT` · 운영 HTML 12쪽에 §8.3 패턴 grep 0건 · 출력 `dd-prod-<date>.txt`.
- [ ] **DD-3-06 (OWNER) 12쪽 시각 확인, 발행 뒤** → M3
  - **AC** 글마다 한 줄: 그림 보임, 작은 SVG 글자 읽힘 (데스크톱), mermaid가 그림으로 보임, 썸네일 보임 · main session이 결과 줄을 `dd-prod-<date>.txt`에 더한다 · 고칠 점은 새 행으로 연다 (발행을 막지 않는다, #137).
- [x] **DD-3-07 (MAIN) 루트 `CLAUDE.md` 그룹 트리 사실 줄 (설계 D11)** → M3
  - **AC** DD-3-05 뒤 · "Projects: categories as groups" 트리의 `utrgv/` 아래 `ddpm-from-scratch/` 1줄 · 오너 규칙 절은 고치지 않는다 (`rules/docs.md` §6) · 그 밖의 diff 0.

## 열린 질문 (오너)

- 질문 원문과 기본값 전문 = 설계 §9. 여기에는 짧은 이름만 적는다.
- "default, owner may override": 답이 없으면 기본값으로 간다. 오너가 바꾸면 main session이 D-row를 쓰고 pm이 막는 행을 고친다.

| # | 질문 (짧게) | 상태 | 막는 행 |
| --- | --- | --- | --- |
| Q-DD-a | 발행 문 | 닫힘: PS식 미리 허락 (#137) | 없음 |
| Q-DD-b | 과제 설계와 코드 공개 | 닫힘: 허락, §8 제거는 유지 (#137) | 없음 |
| Q-DD1 | 실제 생성 이미지가 로컬에 있나 | 닫힘 (main session, 2026-10-28): `A3/runs/141768_v10000_base/grid_{1h,3h,6h}.png`, `A3/runs/143716_v10142_p10136_t18h/grid_18h.png`, `samples5k_seed{0,1}.npz`. Cradle 회수 없음 | 없음 |
| Q-DD2 | 업로드별 규칙 상태 | 닫힘 (#138, 기본값): v10059, v10064, v10090, v10093 회색 | 없음 |
| Q-DD3 | 래스터 길 | 닫힘 (#138): R1 헤드리스 브라우저, DD-1-01 실행 1회만. R2 버림 | 없음 |
| Q-DD4 | 연재 제목 | 닫힘 (#138, 기본값): "Diffusion From Scratch" | 없음 |
| Q-DD5 | "from scratch" 표현 | 닫힘 (#138, 기본값): 설계 §9 문장 | 없음 |
| Q-DD6 | 과목 학습 이미지 | 닫힘 (#138, 기본값): 보이지 않는다 | 없음 |
| Q-DD7 | 고정 시점 | 닫힘 (#138, 기본값): "as of 2026-10-27", v10142 6.10. 새 업로드면 00, 10만 고친다 | 없음 |
| Q-DD8 | 과목 이름 | 닫힘 (#138, 기본값): "CS 6379 Deep Learning, UTRGV" | 없음 |
| Q-DD9 | 설계 §5.4 추가 그림 | 닫힘 (#138, 기본값): 쓰지 않는다 | 없음 |
| 화자 | 글의 화자 | 닫힘 (#138): 화자 표현 없음, "my runs"만 | 없음 |
| Q-DD10 | G-DD1–3 승인과 날짜. 답은 D-row로 적고 DRAFT를 지운다 | 열림 | 없음 (진행 표시) |
| ~~Q-DD11~~ | ~~원본 페이지 고침: 한국어 그림 16, 20, 22, 23의 영어 판 + 그림 번호를 순서대로~~ | 닫힘 (rev3, 2026-10-28): 4장은 어텐션 페이지 영어 사본의 중복이다 (설계 §4.4). 번호 검사는 해시 검사로 바뀌었다 (§4.3) | 없음 |
| Q-DD13 | 02 β, ᾱ 표 (tips Table 11에서 옮김)에 데이터 근거가 필요한가 | 닫힘 (#141, pm): 예. DD-1-12가 `dd_schedule.json`을 쓴다 | DD-2-13 |
| Q-DD12 | 원본 7쪽 고침 + "frozen": 설계 §4.6 "필수" 줄 (U01, C03, RS1, RS2 영어화, RS2 폭 2060px, F02와 H09의 옛 "Figure N" 글자). 고칠지, 이번에 뺄지 (설계 §9 rev3 [CLARIFICATION REQUIRED]) | **열림.** 답 전 기본: R1은 기다린다. 인벤토리, 썸네일, 원고 초안은 먼저 간다 | DD-1-11 → DD-1-05 → DD-2-12. 글 행은 막지 않는다 |

## 설계 정정 필요 (architect)

- ~~§4.1, §5.1, §6.2, §0 G-DD2 "27장": 지금 페이지는 `<svg` 29개, 캡션 "Figure 29."까지 (pm Grep 2026-10-28, 248–323행). → DD-1-00.~~ <!-- SUPERSEDED 2026-10-28 rev2 (40행) -->
- ~~§9 Q-DD1: 닫힘. starter는 `grid_1h/3h/6h`만, 최종은 `grid_18h`다. 학습 시간이 같지 않다. R00b는 6h 대 18h를 라벨로 밝힌다 (DD-1-03). npz는 쓰지 않는다.~~ <!-- SUPERSEDED 2026-10-28 rev2 §5.2, #138 -->
- ~~§5.1 캡션 틀 "Source 조각 0"은 `rules/figures.md` §3 "캡션 끝에 출처 폴더"와 글자로 다르다. 이 plan은 블로그 선례 #125, #135를 따른다 (출처 = `figures.md`). main session 확인 필요.~~ <!-- SUPERSEDED 2026-10-28 #138 -->
- ~~§11 D1 "오너 답 Q-DD1–9 D-row": Q-DD2, Q-DD4–9 기본값 확정과 Q-DD1 닫힘은 #137 뒤 새 D-row 1개로 main session이 쓴다. 이 plan에는 행이 없다.~~ <!-- SUPERSEDED 2026-10-28 #138 -->
- ~~§7.2 sitemap "새 URL 10개": 글이 11개다. 이 plan은 11개로 검사한다 (DD-3-05).~~ <!-- SUPERSEDED 2026-10-28 rev3 §7.2 = 12 -->
- ~~§5.5 썸네일 10 big "879.5 GPU-hours": §5.5 "썸네일 글자에 약어 0"과 어긋난다.~~ <!-- SUPERSEDED 2026-10-28 rev3 §5.5 11행 "graphics-processor hours" -->
- ~~§11 D7 선행 D6: 이 plan은 DD-1-04 선행을 DD-1-02로 둔다.~~ <!-- SUPERSEDED 2026-10-28 rev3 E4 선행 = E3 -->
- §4.1 sha256, commit: 원본 = `BS/data/dd_tips_source.json` (DD-1-11 실행). 설계 §4.1 "AC 미충족 1항" 문구는 DD-1-11 뒤 architect가 지운다.
- rev3 §5.1 합 표, §6.2 "그림 합"과 글마다 PNG, §11 E1 (90, 70)은 §4.4 첫 diff 전 수다. 이 plan은 92, 71, 68, 83을 쓴다. architect가 맞춘다.
- rev3 §6.2 06 그림 칸 A10: §4.4 첫 diff로 H47 + H48이다 (7장). §6.3 06행도 같다. 이 plan은 §4.4를 따른다.
- rev3 §6.3 04행 "developer가 `param_estimate.py`로 확인": 모델을 만들면 로컬 금지다 (`~/.claude/CLAUDE.md`). 이 plan은 산수로 한다 (DD-1-10 `dd_time_params.json`).
- §6.3 "그림 다음 줄 셋(Why, Mission, Vision)은 한 줄씩이다"와 W2 초안: #141로 한 줄 꼴이다. §6.2 길이 칸은 글 예산이다. 상한 = 길이 + 10 + 3 × N (C13). architect가 맞춘다.
- rev3 §6.3 05행 식 `softmax(QKᵀ/√224)V`: 224는 8×8 자리 채널이다. 32×32 자리 (채널 112)는 다를 수 있다 (추정). 이 plan은 √d로 쓰고 d를 json에서 읽는다 (DD-2-05).
