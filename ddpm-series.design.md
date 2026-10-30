# DDPM from scratch 연재(project series) 설계

> 상태: 설계 **rev3.2** (system-architect, 2026-10-29, 인벤토리 3회차). 글, 코드, 그림, 스크립트 실행 없음.
> rev3.2: §4.8. "one draw of z" 새 판 H50 (H43 대신, 07). U06, F07 = 중복. #142로 H09, H11, H46도 오너 재작도. R1 2회째 = 8장. 수: 96 = yes 67 + redraw 7 + dup 22.
> rev3.1 (오너 "now all updated", 18:32). rev3와 달라진 점: §4.7. 단위 96, 내보냄 70 (redraw 4는 표로 대신 가능), 중복 22. 06은 그림 10장. R1 = 조건부 GO (§4.7).
> rev3 (오너 "I updated tip page and add more figures and examples", 2026-10-28). rev2.1과 달라진 점:
> 1. 원본 = 페이지 7개 (홈, U-Net, 어텐션, 수식, 결과, 업로드 평가, 클러스터). 그림 단위 90 (SVG 86 + PNG 4). 중복 20을 빼면 발행 70장 (§4.4, §5.1).
> 2. 글 11 → 12 (00–11). 오너 주제 순서를 따른다. 너무 큰 두 글만 나눈다: U-Net 13장 → 03 + 04, 어텐션 14장 → 05 + 06 (§6.2).
> 3. ID는 페이지 접두어 고정 ID다 (H07, U01, A10, F02, RS1, E05, C01). 번호가 바뀌어도 ID는 그대로다 (§4.5).
> 4. 재동기화: 텍스트 파싱 인벤토리 `data/dd_tips_inventory.csv` + 해시 비교. 다음 갱신은 diff만 본다 (§4.5).
> 5. 홈 임시 한국어 블록 8장은 그림 안 글자가 영어다. 모두 다른 사본의 중복이다. 이제 막는 요인이 아니다 (§4.6).
> 6. 사실 정정: 최종 망 어텐션 head = 1 (4 head 그림은 설명용). 어텐션 자리 = 8×8 (d4, mid) + 32×32 (d2, u2). Block Linear 합 317,856이 맞다. 115,584는 starter 값이다 (§3).
> 7. M00 mermaid를 버린다. 결과 페이지의 같은 흐름 그림(RS3)을 쓴다 (§5.3).
> 8. R1 판정: #138의 1회 허락 문구에 맞는다. 입력이 1쪽 → 7쪽으로 넓어져서 main session이 실행 전에 오너에게 한 줄로 알린다 (§4.2).
> 9. 이 설계 도중 어텐션 페이지(13 → 14, 새 A10)와 홈(46 → 48, 새 H47, H48)이 바뀌었다. 그래서 §4.5 인벤토리가 필요하다. **최종 수: 92 단위, 중복 21, 발행 71장, 캡처 68, 글 PNG 83** (§4.4 첫 diff). 본문의 90/70/67/82는 그 diff 전 수다.
> 10. commit 줄은 셸이 없어 읽지 않았다. E7 때 `dd_tips_source.json`에 적는다.
> 아래 rev2, rev2.1 줄은 기록이다. 숫자가 다르면 rev3가 맞다.
> rev2 (오너가 원본 페이지를 크게 고침, 2026-10-28 13:28). rev1과 달라진 점:
> 1. 원본 그림 27 → 40 (§4.1, §5.1). 모두 아직 SVG다. `<img>` 0. 그래서 래스터 R1은 그대로 필요하다 (§4.2).
> 2. 한국어 임시 블록 8장: 4장은 영어 번역 쌍둥이, 4장은 단독. 발행 이미지 36장 (§5.1).
> 3. 글 10 → 11. 어텐션 글 06을 새로 두고 06–09를 07–10으로 민다 (§6.2).
> 4. 개념 글 뼈대 = `style.md` §5.1 새 순서. 00 = 측정 결과 순서 + "What helped" 표 (§6.3).
> 5. 규모 숫자 = DD-1-02 출력 (§3). Q 전부 닫힘 (#137, #138, §9).
> rev2.1 (DD-1-06, 2026-10-28, 14:05 저장된 페이지, architect Grep). rev2와 달라진 점:
> 1. 그림 40 → 43. 새 그림 3장: Fig 8 (학습 forward와 backward), Fig 39 (`sample()` 한 round), Fig 40 (sampler round 5번, μ + σz). 번호가 뒤로 밀렸다 (§5.1 표에 옛 번호).
> 2. 새 글 절 (그림 없음): "Where μ comes from", "β, x_t, and the paper's x_(t−1)", "Why the sampler adds fresh noise" (Step 16) → 08 Parts. Fig 8 → 02 (§6.2, §6.3).
> 3. "t and t′"는 이 페이지에 없다 (Grep `t′`, `t&#8242;` 0건). U-Net 페이지 쪽이면 §5.4 추가 그림이다.
> 4. **아직 R1 내보내기 준비가 안 됐다** (§4.1 끝 표). 한국어 단독 4장의 영어 판 없음 + 번호 순서 틀림.
> 5. §7.2 sitemap 11.
> 규칙 파일 상태 (작가는 같은 판을 다시 읽는다, 2026-10-28 13:29 이후 판): `.claude/rules/writing/style.md` (§1 형태 순서, §5.1, §5.3 2026-10-28), `.claude/rules/figures.md`, `.claude/rules/visualization.md`, `.claude/rules/writing/tips-page.md`.
> 결정 근거: `decisions.plan.md` #137, #138. 오너 답 2개(발행 문, 코드 공개)는 #137에 있다.
> 위치 근거: 선례 `recobell-series.design.md`와 같은 루트 `*.design.md`다.
> `dd.plan.md`, `decisions.plan.md`는 product-manager(pm)와 main session이 고친다. 이 문서는 고치지 않는다.
> 원본 저장소: `~/Documents/mscs_utrgv/ta_cs6379_deep_learning/` (이하 `TA/`). 읽기 전용.
> 이 문서는 개인 다운로드 URL과 토큰을 담지 않는다 (§8).

## 0. 미션 블록 (인용)

> - Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
> - Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)

- 원본: `rs.plan.md` "Mission block" 14–15행. `dd.plan.md`는 아직 없다.
- 아래 줄은 초안이다. main session이 받아 pm이 `dd.plan.md`에 옮긴다 (`rules/docs.md` §0.1).

Constraints 초안 (DD):

- 결과 숫자는 모두 저장된 파일에서 읽는다. 글마다 `figures.md`에 파일과 칸을 적는다 (`rules/answering.md` §3).
- 결과 차트는 저장된 JSON, Markdown 표만 읽는 스크립트가 만든다. 학습, 추론, 모델 적재 0 (`~/.claude/CLAUDE.md` "No local execution").
- tips 페이지 그림은 그림 자체를 바꾸지 않는다. 캡션만 새로 쓴다 (오너, 2026-10-28). 예외: 그림 안 "Step N →" 링크 글자 (§4.3).
- 개인 다운로드 URL, 토큰, 메일, 다른 학생 자료 0건 (§8).
- 영어 글. 약어는 언급마다 full name (ABBR) (`rules/writing/style.md` §4).
- 줄표 0, 세미콜론 0 (`rules/writing/style.md` §3).

목표(goal) 초안 (오너 승인 전):

- G-DD1: 연재 글 12개가 운영에 있다. measure: `/@taeklim/projects/ddpm-from-scratch` 200, 글 12개, 순서 00 → 11. 메뉴 Projects 배지 +1. by: 날짜 오너. (rev3: 11 → 12)
- G-DD2: 원본 페이지 7개의 그림이 모두 글에 쓰인다. measure: §5.1 그림 단위 92개 모두 "글 · 절" 또는 "중복 = ID"가 있고 (E01–E04는 한 행에 4단위), 발행본의 원본 이미지 합 = 71 (92 − 중복 21, §4.4 첫 diff). 인벤토리가 이 수를 바꾸면 인벤토리 수가 맞다. by: G-DD1과 같다. (rev3: 43 → 92 단위, 39 → 71장)
- G-DD3: 결과 숫자가 모두 근거를 가진다. measure: 글 본문의 숫자마다 `figures.md` 행 (파일 + 칸) · §8.3 grep 0건. by: G-DD1과 같다.
- 전략 A/B/C는 없다. 그룹 모델(#119), 연재 틀(cnn 선례, #137)은 이미 정해졌다.
- 그림 원본 경로는 §4에서 하나로 정한다. 작가가 고르지 않는다.

오너 요구 (verbatim, 2026-10-28):

> I would like to add another project series from utrgv. diffusion(ddpm) and my network from scratch. use images or diagrams as much as possible. write down simple clear explannation. design and plan and dispatch posts

> I love diagrams and I love all figures and I would like to use all if possible in my posts...?

오너 답 (2026-10-28, #137):

> Ps? rs? dispatch.

> this is totally ok

(첫 줄 = 발행 문은 PS식 미리 허락. 둘째 줄 = 과제 설계와 코드 공개 허락.)

## 1. 결과 요약

| 결정 | 권고 |
| --- | --- |
| 프로젝트 경로 | `projects/utrgv/ddpm-from-scratch/` 그대로 (#137). cnn과 짝이다. 바꾸지 않는다 |
| 연재 제목 | "Diffusion From Scratch" (Q-DD4). 제목에 약어만 홀로 두지 않는다 |
| 글 수 | 12개 (00–11). 00 = 결과와 규모. 01–09 = 개념. 10 = 실험. 11 = 과정 공학 (rev3, §6.2) |
| 머리 숫자 | 공개 [프레셰 인셉션 거리(Fréchet Inception Distance, FID)](#term-fid) 30.26 → 6.10, 등급 D → A (`runs/LEADERBOARD.md`) |
| 원본 그림 | 페이지 7개, 90행 모두 글 · 절 또는 중복 표시 (rev3). 버리는 내용 0. 중복 20은 한 사본만 나간다. 발행 이미지 70장 (§5.1) |
| 결과 차트 | 이미 만든 `fig_dd_*.py` 12장. rev3 글에 다시 배정 (§5.2). 스크립트 이름은 바꾸지 않는다 |
| 그림 원본 판정 | tips 도구는 표준 라이브러리만 쓴다. 그래도 그림이 SVG라 래스터(raster) 단계가 필요하다 (§4) |
| 생성 샘플 | 실제 그리드가 로컬에 있다 (#138, Q-DD1 닫힘). 00 "Samples" 절 (R00b) |
| 발행 문 | PS식 미리 허락 (#124 선례, #137). reviewer 1회 뒤 발행 |
| 코드 공개 | 허락 (#137). 비밀 제거는 그대로 한다 (§8) |
| 스키마 | 변경 0. 발행이 프로젝트 행 1개를 만든다. MVP 사다리 적용 안 함 (§7) |

```text
TA/tips/a03/ 7 pages ─► dd_tips_inventory.py (hash) ─► 86 SVG + 4 PNG ─► 70 export ─┐
TA/assignment_03_r1/{runs,analysis}/*.json ─► fig_dd_*.py ─► 12 PNG (done) ──────────┼─► 글 00–11 (+ figures.md, 썸네일 12)
runs/LEADERBOARD.md ──────────────────────────────────────────────────────────────────┘
글 12개 ─► §8.3 grep 0건 ─► reviewer 1회 ─► 발행 01→11, 00 ─► purge ─► 확인
```

## 2. 독자와 틀: 결과 먼저

무엇을 알려고 쓰나: tips 페이지(학생용 설명)를 채용 담당자용 연재로 바꾸는 법.

| 칸 | tips 페이지 | 연재 |
| --- | --- | --- |
| 독자 | 과제를 푸는 학생 | 채용 담당자 먼저, 엔지니어 둘째 (메모리 `blog-series-chart-first`) |
| 첫 화면 | Step 1 "What t is" (개념) | 00: 한 줄 결과 + 결과 표 + 규모 (cnn 00 틀) |
| 그림 | 한 쪽에 40개 (rev2) | 글마다 2–8장. 절마다 그림 1장 + 한 줄 |
| 순서 | Part 1 (망) → Part 2 (확산) | 오너 주제 순서 (rev3, 2026-10-28): 개요 → 배경 → 확산 → U-Net → 시간 → 어텐션 → Q, K, V → 샘플러 → 평가 → 수식 흐름 → 실험 → 과정 |

- 순서를 바꾸는 이유: review F1, F2 (`TA/tips/a03/a03_student_path_review.md` §4.2). 용어를 정의하기 전에 쓰지 않는다.
- rev3 순서의 근거: 오너 제안 "1. overview 2. background 3. diffusion 4. u-net 5. sampler + generation 6. evaluation 7. formular flow 8. ..." (2026-10-28). 나눈 글 둘(04, 06)만 더했다 (§6.2).
- "from scratch"의 뜻: 사전학습 가중치 없이 처음부터 학습했다. 망은 과목 starter U-Net에서 키웠다. 학습 루프(`diffusion.py`)는 과목이 고정했다. 글은 이 셋을 숨기지 않는다 (Q-DD5).

```text
00 결과·규모 ─► 01 배경 ─► 02 확산 (잡음, t, 학습 step) ─► 03 U-Net ─► 04 U-Net 안의 시간
                                                                                  │
08 평가 ◄─ 07 샘플러 ◄─ 06 Q, K, V ◄─ 05 어텐션 ◄─────────────────────────────────┘
  │
  └─► 09 수식 흐름 ─► 10 실험 (starter → final) ─► 11 과정 공학 (클러스터, 판정, 기록)
```

## 3. 측정 사실 (저장된 파일)

- 아래 값은 이 설계 때 파일에서 읽었다. 작가는 다시 읽고 `figures.md`에 적는다. 이 표는 숫자의 원본이 아니다.
- 경로는 `TA/assignment_03_r1/` 기준이다.
- [프레셰 인셉션 거리(Fréchet Inception Distance, FID)](#term-fid) 척도가 셋이다 ([FID@1k, FID@5k](#term-fid-scale)). 글의 FID마다 척도 이름을 붙인다.
- 판정은 [판정 폭(δ)](#term-delta), [거르기(screen)](#term-screen), [스피어만 순위 상관(Spearman rank correlation)](#term-spearman), [외움(memorization)](#term-memo)을 쓴다.

| 척도 | 뜻 | 범위 (예) | 파일 |
| --- | --- | --- | --- |
| 공개(portal) FID | 과목 채점기. 5,000장, 숨은 이미지와 비교 | 30.26 → 6.10 | `runs/LEADERBOARD.md` |
| FID@5k (hold1k) | 우리 측정. 5,000장 대 따로 둔 1,000장 | 12.53–13.75 (업로드 8개, `fid5k_range`) | `runs/*/eval5k.json`, `analysis/portal_fit.json` |
| FID@1k | 우리 빠른 측정. 1,000장 | 17–47 | `runs/*/marks.json`, `analysis/verdicts*.json` |

| 사실 | 값 | 파일 · 칸 |
| --- | --- | --- |
| 데이터 | parrots, 10,000장, 64×64, 컬러 | `README.md` 2행 (URL 줄은 열지 않는다, §8) |
| 채점 | 5,000장, 250 step 샘플러, 고정 seed | `README.md` 14행 |
| 매개변수 상한 | 10,000,000개, 사전학습 가중치 금지 | `docs/design.md` 39행 |
| 확산 일정 | T = 1000, beta 1e-4 → 0.02 선형 | `code/diffusion.py` 16–18행 (review §1.1 PASS) |
| 공개 FID 경로 | base 30.26 (D) → C 9.17 (B) → C3a 7.11 (B) → … → v10136 6.13 (A) → v10142 6.10 (A) | `runs/LEADERBOARD.md` 9–20행 |
| 마지막 업로드 | v10142, 공개 FID 6.10, 규칙 안 | `runs/LEADERBOARD.md` 20행. 성적 = 마지막 제출 (`docs/DECISIONS.md` D-009) |
| 규칙 밖 업로드 | v10090 5.99 등. 고정 학습 루프를 바꿨다 | `docs/DECISIONS.md` D-051. 글은 "outside the course rule"로 표시 (Q-DD2) |
| 최종 망 | 9,832,523 매개변수, base 56, nres 2, dropout 0.1, pre-activation, L40S | `runs/143716_v10142_p10136_t18h/manifest.json` `n_params`, `arch`, `gpu` |
| starter 망 | 3,320,387 매개변수 | `runs/141768_v10000_base/manifest.json` `n_params` (작가가 읽는다) |
| 거르기(screen) | 변경 10개, 3h, 통과 6. 판정선 −1.309 (base SD 0.655의 2배) | `analysis/verdicts.json` `entries[].verdict`, `sd` |
| 판정 폭 δ | 1.5626, seed 0–2 짝 비교 | `analysis/verdicts_c3a.json` `delta`, `pairs` |
| 판정 파일 | 14개 (rev2, DD-1-02 셈. rev1 손 셈 13은 버린다) | `TA/blog_series/data/dd_scale.json` `verdict_files`, `verdict_file_names` |
| FID@1k 대 FID@5k | Spearman 0.90 (6h, n 9) | `analysis/eval5k.json` `groups.6h.spearman_fid1k_vs_fid5k` |
| 공개 대 FID@5k | 공개 ≈ −3.928 + 0.795 × FID@5k, n 8 | `analysis/portal_fit.json` `a`, `b`, `n` |
| 외움(memorization) | 기준 median 6.926, 복사 후보 기대 1% | `analysis/memorization.json` `baseline_holdout_to_train`, run별 `copy_candidate_share` |
| DiT 시도 | 해로움, m +9.41 | `analysis/verdicts_dit.json` `m`, `verdict` |
| 규모 (rev2, DD-1-02) | run 폴더 154개, manifest 있는 run 137개, 뺀 폴더 17개. GPU 시간 879.5 (L40S + A100). 업로드 12회 | `TA/blog_series/data/dd_scale.json` `run_folders`, `manifest_runs`, `excluded_folders`, `gpu_hours`, `gpu_kinds`, `uploads` |
| 업로드 규칙 표 (rev2, DD-1-02) | 업로드마다 `in` / `outside`. 마지막 v10142 6.10 `in` | `TA/blog_series/data/dd_rule_status.csv` |
| 최종 망 코드 (rev3) | v10142는 v10136의 이어 학습이다. 그래서 망 코드 = `code/variants/v10136_p10087_attn32/model.py` | `runs/143716_v10142_p10136_t18h/manifest.json` `kind: continue`, `parent` |
| 어텐션 head (rev3) | **1개**. 4 head 그림(A14, F05)은 설명용이다. 원본 캡션도 "head 수는 설명용"이다 | manifest `arch.heads`, `model.py` 112행, `Attn` 77행 "Single-head" |
| 어텐션 자리 (rev3) | 8×8 (d4, mid, 채널 224) + 32×32 (d2, u2, 채널 112). rev2의 "8×8 바닥에서만"은 틀렸다 | manifest `arch.attn_res` [8, 32], `model.py` 156–157행 |
| 시간 경로 매개변수 (rev3) | 공유 MLP 33,024 = 2 × (128×128 + 128). Block Linear 합 **317,856** = 129 × 2,464 (Block 16개 채널 합) | manifest `tdim` 128, `base` 56, `mults` [1,2,4,4], `nres` 2. `model.py` 49행 `nn.Linear(tdim, cout)`, 129–157행 |
| 115,584의 정체 (rev3) | 129 × 896. starter 망(Block 6개)의 값이다. 896 = 64+128+256+256+128+64 (추정: base 64, mults 1,2,4, nres 1). developer가 starter manifest로 확인한다 | `data/dd_thumbs.csv` 04행 source 칸이 base manifest를 적었다 |

- "162 run folders"와 "460 GPU-h"는 쓰지 않는다. 460은 계획 예산(`docs/PLAN.md` 22행)이고 지출이 아니다.
- GPU 시간 879.5는 manifest 137개의 `gpu_wall_s` 합이다. 뺀 폴더 17개(posthoc 등)는 들어가지 않는다. 글은 "at least 879.5 GPU-hours"로 쓴다.
- `docs/STATUS.md`는 숫자 원본으로 인용하지 않는다. 길잡이로만 쓴다.

## 4. 그림 원본 판정 (figure source)

무엇을 알려고 쓰나: tips 그림을 블로그 이미지로 옮기는 길. 작가는 고르지 않는다.
용어: [확장 가능 벡터 그래픽(scalable vector graphics, SVG)](#term-svg), [래스터(raster)](#term-raster).

### 4.1 사실

| 사실 | 근거 |
| --- | --- |
| ~~그림 단위는 SVG 27개다. 번호 그림 1–27과 1:1~~ <!-- SUPERSEDED 2026-10-28 rev2 --> | ~~페이지의 `<svg viewBox=...>` 27개~~ |
| **판정 규칙 (rev2)**: 그림 = 바로 뒤에 "Figure N." 캡션이 붙은 `<svg viewBox`. 본문 속 "Figure N" 참조와 캡션 없는 아이콘 SVG는 세지 않는다 | DD-1-00 AC |
| rev2 셈 (2026-10-28, architect Grep): 그림 SVG 40개, 캡션 "Figure 1."–"Figure 40.", 19 Step | 페이지 256–314행. pm Grep의 29개는 그 뒤 다시 만들어진 페이지와 다르다 |
| 그중 8개(rev2 Figure 16–23, rev2.1 Figure 17–24)는 임시 한국어 블록이다 (`<h2>시간 MLP와 어텐션 (임시, 한국어)`) | 페이지 282–295행 |
| 한국어 블록의 번호 순서가 틀렸다: 17, 18, …, 23 다음에 16 | 같은 행. §4.3 3단계가 여기서 멈춘다 |
| 한국어 17, 18, 19, 21은 영어 25, 26, 27, 28의 번역 쌍둥이다 (같은 캡션 내용) | 캡션 대조. 18 viewBox 472 대 26 viewBox 496 (높이만 다르다) |
| 한국어 16, 20, 22, 23은 영어 쌍둥이가 없다 | 캡션 대조 |
| 페이지 sha256, ta 저장소 commit | 이 설계는 셸이 없어 재지 못했다. DD-1-01이 `data/dd_tips_source.json`에 적는다 (AC 미충족 1항, 보고함) |
| PNG 114장은 그림 안의 작은 타일(tile)이다. 그림이 아니다 | SVG 안 `<image href="data:image/png;base64,...">` |
| 타일은 실제 앵무새가 아니다. 합성 그림(둥근 몸 + 눈) + 잡음이다 | `tips/a03/tools/a03_student_path_noise.py` `_pattern()` "An illustrative clean image" |
| 도구는 표준 라이브러리만 쓴다. torch, numpy, 모델 적재 0 | `a03_student_path_data.py` 5행 "Stdlib only", `_noise.py` 5–8행 (`math`), `_png()`는 `struct`, `zlib` |
| `from diffusion import feats, fid`는 import가 아니다 | `a03_student_path_log.py` 46행은 `CELL` 문자열 안이다 |
| `diffusion.py`는 글자로만 읽힌다 (assert 대조) | `a03_student_path_log.py` 15행 `read_text()` |
| 그림 색은 CSS 변수다 | 예: `var(--signal-instruction)` (`_sample.py` 343행, `_pipe.py` 15행) |
| 블로그 업로드는 PIL로 webp를 만든다. SVG를 못 연다 | `apps/blog_agent/utils/image_transform.py` 1–24행 (`to_webp`, `NotAnImageError`) |
| 그림 7 안에 "Step N →" 링크 글자 22개가 있다 (rev1 셈) | rev1 페이지 248행 부근 `<a ...><text>Step N &#8594;` |
| 페이지가 지금도 다시 만들어진다 | rev1 중 27 → pm 29 → rev2 40 → rev2.1 43. 위험 §10이 일어났다 |
| **rev2.1 셈 (DD-1-06 결과 1줄)**: 2026-10-28, 14:05 저장 페이지. 그림 SVG 43, 캡션 "Figure 1."–"Figure 43.". 번호 순서 검사 **실패** (위치 18–25의 번호 = 18, 19, 20, 21, 22, 23, 24, 17) | architect Grep, 페이지 256–315행 |
| 캡션 바로 앞의 다른 "Figure N" 글자는 본문 참조다. 그림으로 세지 않는다 (§4.1 판정 규칙). coordinator가 본 "1 4 2 3 … 6 6 25"의 겹침이 이것이다 | 같은 Grep. `<b>Figure N.</b>` 꼴만 캡션이다 |

~~R1 내보내기 준비 판정 (rev2.1): 준비 안 됨. 한국어 단독 4장의 영어 판 필요, 번호 순서 틀림.~~ <!-- SUPERSEDED 2026-10-28 rev3 -->

- rev3: 위 판정 표는 끝났다. 임시 블록 8장은 그림 안 글자가 영어이고, 모두 다른 사본의 중복이다. 새 판정은 §4.6이다.
- rev3 판정 규칙 추가: 그림 = `<svg viewBox` + 바로 뒤 캡션. 캡션 꼴은 페이지마다 다르다. 홈 `<b>Figure N.</b>`, U-Net·어텐션·수식 `<b>그림 N.</b>` (페이지가 `lang="ko"`), 클러스터 `<figcaption>`, 결과·업로드 평가 `<p class="cap">` (번호 없음). 그래서 번호가 아니라 해시로 맞춘다 (§4.5).
- 결과 페이지의 `<img>` 4장(base64 PNG)도 그림 단위로 센다. 래스터가 필요 없다. 원래 파일을 복사한다 (§5.1 RI 행).

판정:

- **tips 그림 = 저장된 HTML에서 SVG 글자를 잘라낸다 (text parsing).** 도구를 다시 실행하지 않는다.
- 도구 실행도 규칙상 허용이다(표준 라이브러리, 저장 파일만). 그래도 필요 없다. 페이지가 이미 저장된 산출물이다.
- **SVG → PNG 래스터 단계가 반드시 필요하다.** "HTML에서 PNG 추출"만으로는 안 된다 (타일만 나온다).
- **결과 차트 = 새 스크립트 `TA/blog_series/fig_dd_NN_*.py`.** 저장된 JSON과 `runs/LEADERBOARD.md`만 읽는다. matplotlib. cnn 선례와 같다.

### 4.2 래스터 길 (Q-DD3 닫힘: R1, 로컬 1회, #138)

| 안 | 방법 | 장점 | 약점 |
| --- | --- | --- | --- |
| **R1 헤드리스 브라우저 (고름, #138)** | 그림 하나씩 단독 HTML (테마 CSS 포함)을 열고 캡처. 배율 2 | 페이지와 같은 글꼴, 색, 클래스. 그림을 바꾸지 않는다는 오너 뜻에 가장 맞다 | 브라우저는 여러 프로세스를 쓴다. "한 코어" 조건을 넘을 수 있다. 오너 1회 허락 |
| R2 cairosvg (버림, #138) | `var(--x)`를 theme 값으로 바꾸고 Python으로 래스터 | 한 프로세스 | 패키지 추가 (`uv add`, 오너 확인). CSS 클래스 지원이 부분적이다. 모양이 달라질 수 있다 |

- 허락 범위: DD-1-01 실행 1회뿐이다 (#138). 다시 돌려야 하면 오너에게 다시 묻는다.
- **rev3 판정: 7쪽을 덮는 한 번의 실행은 #138 문구에 맞는다.** #138 = "R1으로 tips SVG → PNG, 로컬 1회". 7쪽 모두 `tips/a03/`의 tips 페이지이고, 실행은 여전히 1회다.
- 그래도 입력이 넓어졌다: 1쪽 39장 → 7쪽 67장 캡처 (SVG만. PNG 3장은 복사). 오너의 예외는 이름 붙은 run 하나에 준다 (`~/.claude/CLAUDE.md` "No local execution").
- 그래서 main session이 실행 전에 오너에게 한 줄로 알린다: "R1 1회, 입력 7쪽, 캡처 67장, 한 코어 제한 밖 브라우저". 새 D-row는 없다. 오너가 거절할 때만 D-row를 쓴다.
- 실행 시점: §4.5 "고정 조건" 셋이 모두 닫힌 뒤다. #139(페이지 확정 뒤에만)도 그대로다.
- 위험: 67장이 `timeout 300`을 넘을 수 있다. PNG마다 바로 쓴다 (write-first). 시간 초과로 멈추면 남은 그림을 위해 오너에게 다시 묻는다. 말없이 두 번째 실행을 하지 않는다.

- main session 확인 1회 (목록 보기뿐): Playwright Chromium 또는 Chrome이 설치돼 있나. review가 1040px 렌더를 했으니 무언가 있다 (`a03_student_path_review.md` 8행).
- 입력은 저장된 HTML뿐이다. 데이터 전체 읽기, 모델 적재 0.
- ~~출력: `TA/blog_series/out_dd/tips_fig_NN.png` (NN = 원래 그림 번호, rev2.1 = 39장).~~ <!-- SUPERSEDED 2026-10-28 rev3 -->
- 출력 (rev3): `TA/blog_series/out_dd/tips_<ID>.png` (ID = §5.1 고정 ID, 예 `tips_H07.png`, `tips_A10.png`). 내보냄 "예" 행만, 70장. 폭 2000px. 업로드가 긴 변 1600px로 줄인다.
- 파일 이름이 번호가 아니라 ID라서, 작가는 R1 전에도 글에 이미지 이름을 쓸 수 있다.

### 4.3 내보내기 스크립트 `TA/blog_series/dd_export_tips_figs.py`

rev3 판 (아래 rev2.1 단계 1–7을 대신한다):

1. 입력 = `data/dd_tips_inventory.csv` (§4.5) + 그 행이 가리키는 7쪽. 실행 때 ta 저장소 commit과 페이지마다 sha256을 `data/dd_tips_source.json`에 적는다.
2. 페이지를 다시 파싱해서 SVG마다 해시를 잰다. 인벤토리의 "예" 행 해시가 모두 있으면 진행한다. 하나라도 없으면 멈춘다 (페이지가 인벤토리 뒤에 바뀌었다).
3. 번호 순서 검사는 **경고**로 내린다. 해시가 맞으면 번호가 틀려도 그림은 맞다.
4. 그림 안 "Step N →" 글자를 글 번호로 바꾼다 (Step → 글 표는 §4.6 끝). `<a>` 링크는 지운다. 다른 글자, 도형, 타일은 바꾸지 않는다.
5. 페이지의 테마 CSS를 단독 HTML에 넣는다. 다크 블록은 넣지 않는다. R1으로 `tips_<ID>.png`를 쓴다. 한 장마다 바로 쓴다.
6. RI1, RI3, RI4는 래스터하지 않는다. 원래 PNG 파일을 복사한다 (§5.1).
7. 캡션은 쓰지 않는다. 캡션은 글의 Markdown에 있다.

rev2.1 판 (기록):

1. 입력 = `TA/tips/a03/a03_student_tips_path.html` 한 파일. 실행 때 ta 저장소 commit과 파일 sha256을 `data/dd_tips_source.json`에 적는다 (번호 고정).
2. §4.1 판정 규칙으로 그림 SVG를 자른다. 개수가 §5.1 행 수(rev2.1 = 43)가 아니면 멈춘다.
3. 각 SVG 바로 뒤 "Figure N." 번호가 순서와 같은지 확인한다. 다르면 멈춘다. 지금 페이지는 여기서 멈춘다 (rev2.1: 한국어 블록의 17). 그래서 DD-1-01의 1회 실행은 페이지가 고정된 뒤에 한다 (§9 [CLARIFICATION REQUIRED]).
3b. §5.1 "내보냄" 칸이 "아니오"인 4개(한국어 번역 쌍둥이)는 PNG를 쓰지 않는다.
4. 모든 SVG 안의 "Step N →" 링크 글자를 §5.1 표의 글 번호("DD-03 →")로 바꾼다. 지금 확인된 곳은 그림 7 부근 22개다. `<a>` 링크는 지운다. 다른 글자, 도형, 타일은 바꾸지 않는다.
5. 페이지의 테마 CSS를 단독 HTML에 넣는다. 다크 블록은 넣지 않는다.
6. R1(헤드리스 브라우저)로 PNG를 쓴다 (#138).
7. 캡션은 쓰지 않는다. 캡션은 글의 Markdown에 있다.

- 실행: `OMP_NUM_THREADS=1 timeout 300 uv run python blog_series/dd_export_tips_figs.py` (ta 저장소 루트). 허락은 1회뿐이다 (#138). 그래서 2–3단계 검사가 통과하는 고정된 페이지에서만 돌린다.
- 그림 번호가 바뀐 페이지로 다시 실행하면 3에서 멈춘다. 그때 §5.1 표를 고친다.

### 4.4 갱신 분석 (update analysis, rev2.1 → rev3)

무엇을 알려고 쓰나: 오너가 페이지를 고친 뒤, 무엇이 새로 생겼고 어느 글로 가나.
근거: architect Grep, 2026-10-28 17:50 전후 저장 페이지. 셸이 없어 해시와 commit은 재지 못했다 (§4.5가 잰다).

| 페이지 (`TA/tips/a03/`) | 언어 | rev2.1 | rev3 | 새 그림 · 예 | 간 곳 |
| --- | --- | --- | --- | --- | --- |
| `a03_student_tips_path.html` (홈) | 영어 | 43 | 46 | H07, H08: 한 이미지를 t = 250, 750으로. 채널 지도 + 픽셀 4개 숫자 + 식. H43: z 한 번 뽑기, 이미지 셋 | H07, H08 → 02. H43 → 07 |
| `a03_student_tips_unet.html` | 한국어 글, 그림 영어 (U01 빼고) | 없음 | 5 | U01: U-Net 한 번과 바깥 sampler. "x_t′가 다음 t의 입력 x_t" (rev2.1의 "t and t′" 질문의 답). 나머지 4장은 홈 중복 | U01 → 01 |
| `a03_student_tips_attention.html` | 한국어 글, 그림 영어 (A03 빼고) | 없음 | 14 | A04 전체 흐름 (장난감 숫자), A05 GN, A06 W 나누기, A07 초기화, A09 한 픽셀, **A10 query 대 모든 key (설계 도중 생김)**, A11 작은 QKᵀ, A12 학습 step, A13 닿는 범위, A14 head 4개 | A04, A05, A09, A13 → 05. A06, A07, A10, A11, A12, A14 → 06 |
| `a03_student_tips_formulas.html` | 한국어 글, 그림 영어 | 없음 | 6 | F01 수식 흐름, F02 부분마다 수식 (높이 1387), F03 Q, K, V의 forward·backward, F04 X → W 갱신, F05 같은 입력에 head 4개 | 09. F06은 H43 중복 |
| `a03_results_tips.html` | 영어 (RS1, RS2 그림 안 한국어) | §5.4 선택 | SVG 7 + PNG 4 | 점수 경로, 학습 가족 나무, 흐름, 거르기, 시간 곡선, 외움 간격, 다음 실험. 샘플 그리드 3, blk 진행 PNG | 00, 08, 10 (§5.1) |
| `a03_uploads_eval.html` | 영어 | §5.4 선택 | 5 | 곡선 패턴 아이콘 4 + 업로드 망 실제 곡선 1 | 08 |
| `a03_cluster_tips.html` | 영어 + 한국어 절 (610행부터) | §5.4 선택 | 3 | 9단계 지도 (데스크톱, 모바일), job.slurm 흐름 (한국어) | 11 |

홈 번호 옮김 (rev2.1 T → rev3 H):

```text
T01–T06 → H01–H06       (그대로)
새        → H07, H08     (x_t 숫자 예)
T07–T16 → H09–H18       (+2)
T17     → H19           (임시 블록, 위치는 H26 뒤)
T18–T24 → H20–H26       (+2, 임시 블록)
T25–T40 → H27–H42       (+2)
새        → H43          (z 한 번 뽑기, 새 Step 17)
T41–T43 → H44–H46       (+3)
Step 수 19 → 20
```

- rev2.1 §4.1 "한국어 단독 4장은 영어 판 필요": 이제 아니다. H19, H23, H25, H26의 그림 안 글자는 영어다. 같은 그림이 어텐션 페이지에 A09, A05, A13, A14로 있다.
- 홈 임시 블록의 캡션과 글은 아직 한국어다. 캡션은 내보내지 않으니 막지 않는다.
- U-Net 페이지 글 절 셋 ("μ는 어디서 오나", "β, x_t, 논문의 x_(t−1)", "잡음을 다시 넣는 이유")은 rev2.1에서 홈에 있던 내용이다. 이제 U-Net 페이지(한국어)가 원본이다 → 07 Parts. 작가가 영어로 옮긴다.
- 수식 페이지 글 절 (잡음 schedule, x_t, t를 숫자로, Block, 단별, attention, loss, 갱신, 샘플링, 잡음) → 09 Parts 표.
- "x_t callout in Korean" (U-Net, 수식): 페이지 글 상자다. 그림 밖이라 내보내지 않는다. 작가는 뜻만 영어로 쓴다.

첫 diff (설계 마무리 중, 2026-10-28 18시 전후 Grep). §4.5 규칙을 손으로 적용한 예:

| 상태 | 무엇 | 처리 |
| --- | --- | --- |
| NEW | 홈 Figure 32 (Step 12): "One pixel p1: its query is compared with every key" | 새 ID **H47**. A10의 영어 사본이다. 규칙 1로 H47을 낸다. A10 → 중복 = H47 |
| NEW | 홈 Figure 33 (Step 12): "H p1 built one weight at a time: A[p1, j] × …" | 새 ID **H48** → 06 · The output, one weight at a time. illus |
| RENUMBERED | 홈 rev3 H32–H46 (Figure 32–46) → 지금 Figure 34–48 | ID 그대로. §5.1 "원래" 칸만 +2 (E2 첫 실행이 맞춘다) |
| CHANGED | 홈 임시 블록과 A10의 "Figure 4" 글자 → "the full-flow figure of the Attention page" | §4.6 A10 행이 H47에도 적용된다 |

- 이 diff 뒤의 수 (rev3 최종): 홈 48 단위 · 내보냄 40. 어텐션 내보냄 9. **합 92 단위, 중복 21, 내보냄 71, 캡처 68, 글 PNG 83.** 다른 절의 70, 67, 82는 이 diff 전 수다. 이 줄이 맞다.
- 06 그림: A06, A07, **H47** (A10 대신), H48, A11, A12, A14 = 7장.

### 4.7 재동기화 2회차 결과 (rev3.1, 18:32 페이지)

근거: `TA/blog_series/data/dd_tips_inventory.csv`, `dd_tips_diff.md` (main session 실행). architect는 csv의 `cap_head`, `viewbox`, `svg_sha256`를 읽었다.

NEW 배치 (버리는 그림 0):

| ID | 원본 (지금 번호) | 내용 | 글 · 절 | 내보냄 |
| --- | --- | --- | --- | --- |
| H49 | 홈 Fig 31 (408) | 행렬 곱 Q @ Kᵀ / √224, softmax, AV. H31의 새 판 | 05 · The core as matrix products | yes |
| A15 | 어텐션 그림 5 (448) | 그림 4의 2단계(1×1 conv)를 행렬 곱 @로 | 06 · A 1×1 convolution is a matrix product | yes |
| A16 | 어텐션 그림 8 (520) | qkv conv 하나 = 쌓은 W @ X̂ + b | 06 · One stacked weight, one product | yes |
| A19 | 어텐션 그림 9 (530) | 1×1 필터 한 행(W_Q ch1)을 픽셀 4개에 차례로 | 06 · One filter, four pixels | yes |
| A20 | 어텐션 그림 15 (220) | 작은 숫자 Q @ Kᵀ, 위치 3개, d_k 4. A11의 새 판 | 06 · QKᵀ in small numbers | yes |
| A18 | 어텐션 그림 14 (326) | H p1을 가중치 하나씩 쌓기 | 중복 = H48 (해시 같음) | dup |

GONE (글에서 뺀다):

| ID | 처리 |
| --- | --- |
| H31 | 05의 절은 그대로. 그림만 H49로 바꾼다 |
| A11 | 06의 절은 그대로. 그림만 A20으로 바꾼다 |
| A17 | 1회차에만 있던 행. 글에 놓인 적이 없다. 뺄 것 없음 |

해시가 안 맞게 된 중복과 고른 사본:

| 중복 행 | 지금 해시가 같은 것 | 낼 사본 | 이유 |
| --- | --- | --- | --- |
| H21 (472, 임시) | 없음 | H29 (= A02) | 같은 내용의 옛 배치. 오너가 지울 임시 블록이다 (규칙 2) |
| H24 (408, 임시) | H49, A08 | H49 | 영어 Step 사본 (규칙 1). 목표 H31이 GONE이라 다시 묶었다 |
| A08 | H24, H49 | H49 | 위와 같다 |
| A03 (412) | 없음 (H30과 다름) | H30 | A03은 그림 안 "(그림 9)" 한국어 글자만 다르다 (규칙 3) |
| A10 | H47 | H47 | 영어 Step 사본 (규칙 1) |
| A18 | H48 | H48 | 위와 같다 |
| H19, H23, H25, H26 | A09, A05, A13, A14 | 어텐션 사본 | 해시 같음. 임시 블록은 지울 예정 (규칙 2) |

CHANGED 확인 (`cap_head`와 viewBox로 읽음): H04, H28, H29, A06, A14, F02, F03, F04는 주제가 그대로다. 자리를 유지한다. H20, H21, H24, H26, A01, A02, A08은 중복이라 영향 없음. A16은 1회차 NEW였고 위에서 배치했다.

rev3.1 수:

| 페이지 | 단위 | yes | redraw | dup |
| --- | --- | --- | --- | --- |
| 홈 | 48 | 40 | 0 | 8 |
| U-Net | 5 | 0 | 1 | 4 |
| 어텐션 | 18 | 12 | 0 | 6 |
| 수식 | 6 | 5 | 0 | 1 |
| 결과 | 11 | 7 | 2 | 2 |
| 업로드 평가 | 5 | 5 | 0 | 0 |
| 클러스터 | 3 | 1 | 1 | 1 |
| **합** | **96** | **70** | **4** | **22** |

- 캡처 = 67 (yes 70 − PNG 복사 3). 글 PNG = 70 + 결과 12 = 82 (redraw 4를 표로 대신할 때).
- 06 그림 = A06, A16, A15, A19, A07, H47, H48, A20, A12, A14 = 10장. 상한 8을 넘는다. 짝 절 둘로 줄인다: "One weight, three roles" (A06 + A16), "A 1×1 convolution is a matrix product" (A15 + A19). 그러면 절 8개다. 더 나눌지는 pm 행이다.
- 05 그림 = A13, A09, H28, H29, H30, A04 (높이 2026), A05, H49 = 8장.

csv 변경 (developer가 고친다. §4.5에서 architect는 §5.1만 맡는다):

| id | `post` | `section` | `export` |
| --- | --- | --- | --- |
| H49 | 05 | The core as matrix products | yes |
| A15 | 06 | A 1×1 convolution is a matrix product | yes |
| A16 | 06 | One weight, three roles | yes |
| A19 | 06 | A 1×1 convolution is a matrix product | yes |
| A20 | 06 | QKᵀ in small numbers | yes |
| A18 | | | dup:H48 |
| A10 | | | dup:H47 |
| H24, A08 | | | dup:H49 |
| H21 | | | dup:H29 |
| A03 | | | dup:H30 |

R1 판정: **조건부 GO.**

1. yes 70행 모두 `ko_in_svg` 0이다. `redact_hits`가 0인지 main session이 csv에서 한 번 본다.
2. main session이 오너에게 묻는다: "now all updated" = "frozen"인가. 그리고 R1 범위 한 줄 알림 (§4.2).
3. 위 csv 변경 뒤 인벤토리를 한 번 더 돌려 diff 0을 본다. 그 직후 R1 1회.
4. 남은 xref는 R1을 막지 않는다 (아래). redraw 4장은 R1에서 빠진다. 뒤에 오너가 영어로 고치면 그 4장은 R1 2회째라 다시 묻는다.

남은 그림 안 참조:

| ID | 처리 | 캡션 메모 |
| --- | --- | --- |
| H09 "Step N →" 23개 | 내보내기 4단계가 "post N →"로 바꾼다 (Constraints 예외). 블로그 이미지 안에서 받아들일 만하다. 글자가 링크가 아니게 될 뿐이다 | 필요. 이름표 줄 한 줄: "Labels such as 'post 3 →' name the post that explains that box." 남은 "Figure 27"이 있으면 같은 줄에 "Figure numbers inside the drawing refer to the original course page." |
| F02 "(Figure 7)", "(Figure 4)" | 바꾸지 않는다 (예외 밖). 오너가 R1 전에 고치면 가장 좋다 | 안 고치면 필요: "Figure numbers inside the drawing refer to the original course page." 본문에서 그 둘을 "post 2" (학습 step), "post 3" (최종 망)으로 가리킨다 |

redraw 4장의 대안 (계획 AC 허용: 표 + `figures.md` 한 줄):

| ID | 글 · 절 | Markdown 표 | `figures.md` 이유 줄 |
| --- | --- | --- | --- |
| U01 | 01 · The network guesses, the loop removes | 2열: "U-Net, one call" / "sampler, outside". 행: input, output, removes noise?, repeats (250 rounds, x_t′ → next x_t) | "U01 not used: Korean text inside the drawing (114 chars). Content given as a table." |
| RS1 | 10 · Score path | 업로드마다: run, parent, one change, public FID, rule (`runs/LEADERBOARD.md`, `data/dd_rule_status.csv`) | "RS1 not used: Korean labels inside (27 chars)." |
| RS2 | 10 · Every training family | family, seeds, FID@5k mean (`runs/*/eval5k.json`). 길면 상위 8행 + R09c를 가리킨다 | "RS2 not used: Korean labels inside (101 chars), and 2060 px wide." |
| C03 | 11 · One job script run | 번호 목록 8단계: submit, queue (pending → running), resources, run folder, environment and GPU check, notebook run, save results, done | "C03 not used: Korean text inside (32 chars)." |

- RS1, RS2, C03은 오너가 18:32에 손대지 않은 페이지다. 고치려면 오너가 그 페이지를 따로 고쳐야 한다.
- 대안을 쓰면 G-DD2 발행 수는 70이다. redraw를 고치면 74가 된다 (오너가 정한다).

### 4.8 재동기화 3회차 결과 (rev3.2, 2026-10-29)

근거: `TA/blog_series/data/dd_tips_inventory.csv`, `dd_tips_diff.md`. 결정: `decisions.plan.md` #140 (R1 1회 = 18:32 판 70장), #142 (H09, H11, H46 오너 재작도).

| ID | 상태 | 내용 (viewBox) | 처리 |
| --- | --- | --- | --- |
| H50 | NEW | 홈 Fig 45, "one draw of z" 새 판 (1000 × 830) | 07 · Fresh noise, one value per pixel. H43 자리 그대로. yes |
| U06 | NEW | U-Net 그림 5. H50과 해시 같음 | dup:H50 |
| F07 | NEW | 수식 그림 6. H50과 해시 같음 | dup:H50 |
| H43 | GONE | 옛 "one draw of z" (158) | 07에서 H50으로 바꾼다 |
| U05, F06 | GONE | H43의 중복이었다 | 글 변화 없음 |

- 이미지 목록이 바뀌는 글: **07만** (`tips_H43.png` → `tips_H50.png`). F06은 중복이라 어느 글에도 없었다. 다른 글은 그대로다.
- 07 폴더의 `tips_H43.png`는 `x_tips_H43.png`로 이름을 바꾼다 (지우지 않는다).
- H50은 높이 830이라 옛 판(158)보다 크다. 07 절 하나에 그림 하나 규칙은 그대로다.

csv 변경 (developer):

| id | `post` | `section` | `export` |
| --- | --- | --- | --- |
| H50 | 07 | Fresh noise, one value per pixel | yes |
| U06 | | | dup:H50 |
| F07 | | | dup:H50 |
| H09 | 02 | One step through the network | redraw (#142) |
| H11 | 02 | The six lines | redraw (#142) |
| H46 | 11 | How each run was measured | redraw (#142) |

- 이 변경 뒤 수: 96 = yes 67 + redraw 7 + dup 22. C01은 yes 그대로다 (#142 2).

R1 2회째 (1번 실행, 실행 직전 오너 OK, #142):

| ID | 이유 | PNG를 넣을 글 폴더 |
| --- | --- | --- |
| U01 | 그림 안 한국어 → 영어 (#140) | `01-why-diffusion-why-unet/` |
| RS1 | 같은 이유 | `10-experiments-starter-to-final/` |
| RS2 | 같은 이유 + 폭 | `10-experiments-starter-to-final/` |
| C03 | 같은 이유 | `11-engineering-the-process/` |
| H09 | 학생용 말 "(your part)" (#142) | `02-noise-and-one-training-step/` (1회차 PNG를 `x_`로) |
| H11 | 학생용 말 "(yours)" (#142) | `02-noise-and-one-training-step/` (같다) |
| H46 | 학생용 말 "you add it" (#142) | `11-engineering-the-process/` (같다) |
| H50 | 1회차 뒤 새 판 | `07-sampler-250-calls/` |

- 실행 전 조건: 8장 모두 csv `ko_in_svg` 0, `redact_hits` 0. 인벤토리를 한 번 더 돌려 diff 0. 그 뒤 1번만 돌린다.
- 입력은 csv의 이 8행만이다. 나머지 yes 62행은 1회차 PNG를 그대로 쓴다.
- 8행 말고 해시가 바뀐 yes 행이 그때 나오면, 같은 실행에 넣는다. 그 목록을 오너 OK 문장에 함께 적는다.
- 2회째 뒤 오너가 또 고치면 3회째다. 다시 묻는다.

### 4.5 재동기화 절차 (re-sync)

무엇을 알려고 쓰나: 오너가 다음에 페이지를 고칠 때, 설계 전체가 아니라 바뀐 줄만 보는 법.

```text
오너 "updated" ─► dd_tips_inventory.py (텍스트 파싱, 1분 안) ─► dd_tips_diff.md
                                                                   │
            NEW / GONE / CHANGED 0건 ─► 끝 (설계 그대로)             │
            RENUMBERED만 ─► 끝 (ID가 고정이라 §5.1 그대로)           │
            NEW 또는 GONE ─► architect가 그 행만 §5.1에 넣거나 표시 ◄─┘
```

스크립트 `TA/blog_series/dd_tips_inventory.py` (developer가 쓴다):

- 표준 라이브러리만 (`re`, `html.parser`, `hashlib`, `csv`). 저장된 HTML만 읽는다. 모델, 브라우저 0.
- 그래서 로컬 허용이다. 묻지 않고 돌린다: `OMP_NUM_THREADS=1 timeout 300 uv run python blog_series/dd_tips_inventory.py`.
- 입력: §4.4의 7쪽. 출력: `data/dd_tips_inventory.csv`, `data/dd_tips_diff.md` (전 판 csv와 비교).

| 칸 | 뜻 |
| --- | --- |
| `id` | 고정 ID (H07, A10, RS3, RI1 …). 처음 실행은 §5.1 표에서 받는다 |
| `page`, `page_sha256` | 페이지 파일 이름, 페이지 해시 |
| `pos` | 페이지 안 순서 (1부터) |
| `cap_no` | 캡션 번호. 결과·업로드 페이지는 빈칸 |
| `viewbox` | `viewBox` 값. 사람이 빨리 보는 단서 |
| `svg_sha256` | SVG 글자의 해시. 공백을 줄인 뒤 잰다. `<img>`는 base64 글자의 해시 |
| `cap_head` | 캡션 앞 80자 |
| `ko_in_svg` | 그림 안 `<text>`의 한글 글자 수. 0이 아니면 내보낼 수 없다 |
| `xref_in_svg` | 그림 안 "Step N →", "Figure N", "그림 N" 개수 |
| `redact_hits` | 그림 안 글자에 §8.3 패턴이 맞은 수 |
| `post`, `section`, `export` | 글 번호, 절, `yes` / `dup:<ID>` / `redraw` |

맞추는 순서 (전 판 → 새 판):

1. 해시가 같다 → 같은 ID. 번호만 다르면 `RENUMBERED`.
2. 해시가 다르고, 같은 페이지에서 `cap_head`가 같다 → 같은 ID, `CHANGED` (오너가 그림을 고쳤다. 다시 내보낸다).
3. 둘 다 아니다 → `NEW`. architect가 글 · 절을 정한다.
4. 전 판에 있고 새 판에 없다 → `GONE`. 그 그림을 쓰던 글 절을 본다.
5. 같은 해시가 두 페이지에 있다 → 중복. 사본 고르기 규칙 (§5.1 머리)으로 하나만 `yes`.

고정 조건 (R1 실행 전, 셋 다):

1. 오너가 "frozen" (또는 같은 뜻)이라고 말했다.
2. 그 뒤 인벤토리를 한 번 더 돌렸고, diff가 0건이다.
3. `export = yes` 행 모두 `ko_in_svg = 0`, `redact_hits = 0`. 아니면 그 행을 오너가 고치거나, 오너가 "이번에는 뺀다"고 했다.

- R1 뒤에 페이지가 바뀌면: 인벤토리만 다시 돌린다. `CHANGED`나 `NEW`가 내보낼 행이면 R1 2회째가 필요하다. 오너에게 다시 묻는다 (#138은 1회).

### 4.6 내보내기 준비 판정 (페이지별, 그림별)

판정: **아직 R1 준비 안 됨.** 막는 그림 4장, 고칠 글자 3곳, 고정 선언 1개.

| 페이지 | 그림 | 지금 상태 | 오너가 할 일 | 필수? |
| --- | --- | --- | --- | --- |
| U-Net | U01 | 그림 안 `<text>` 한국어 18줄 ("U-Net 밖: sampler", "내려가기: 크기를 줄임" …) | 영어로 바꾼다 | 필수 (아니면 01이 2장) |
| 클러스터 | C03 | job.slurm 흐름, 한국어 8줄 ("sbatch 제출", "SLURM 대기열" …) | 영어로 바꾼다 | 필수 (아니면 11에서 뺀다) |
| 결과 | RS1 | 점수 경로, 한국어 8줄 ("16×16 폭 줄임", "EMA 끔" …) | 영어로 바꾼다 | 필수 |
| 결과 | RS2 | 학습 가족 나무, 한국어 약 40줄 ("표지 gain", "+6h, 고정 LR + EMA" …). 폭 2060 → 1600으로 줄면 글자를 못 읽는다 | 영어로 바꾸고, 둘로 나누거나 폭을 1000 근처로 | 필수 |
| 수식 | F02 | 그림 안 "(Figure 7)", "(Figure 4)": 홈 옛 번호. 지금 홈 Figure 7은 x_t 숫자 예다. 학습 step은 H09다 | "Figure N" 대신 "Step N →" 꼴이나 이름으로 | 필수 |
| 홈 | H09 | 그림 안 "order inside a stage: Figure 27" | "Step 11 →" 꼴로 (그러면 §4.3 4단계가 바꾼다) | 필수 |
| 어텐션 | A10 | 그림 안 "the full-flow figure of the Attention page". 블로그에서 A04는 다른 글(05)이다 | "the full-flow figure"까지만 | 권장 |
| 어텐션 | A03 | 그림 안 "(그림 9)" | 없음. A03은 내보내지 않는다 (H30 중복) | 아님 |
| 홈 | H19–H26 (임시 블록) | 캡션 한국어, 번호 순서 틀림 (H19가 H26 뒤) | 블록을 지운다 (#139). 모두 중복이라 안 지워도 내보내기는 된다 | 권장 |
| 업로드 평가 | E01–E05 | 한국어 0 | 없음 | 아님 |
| 클러스터 | C01 | 그림 안 한국어 0, 호스트 이름 0 ("ssh to the login node"만) | 없음. 페이지 제목의 클러스터 이름은 글에 쓰지 않는다 (§8) | 아님 |
| 전체 | 7쪽 | 오너가 계속 고친다 (설계 도중 A10 생김) | 끝나면 "frozen"이라고 말한다 (§4.5) | 필수 |

- "Figure N"을 스크립트가 바꾸는 길도 있다. 그러나 Constraints의 예외는 "Step N →"뿐이다. 넓히려면 오너 허락이 필요하다. 그래서 오너가 페이지에서 고치는 길을 권한다 (#139와 같은 길).

"Step N →" → 글 번호 (§4.3 4단계):

| 홈 Step | 내용 | rev3 글 |
| --- | --- | --- |
| 5, 7, 8 | 잡음, batch, 이미지마다 t | 02 |
| 10 | 시간 MLP | 04 |
| 11, 14 | 단, skip, 활성 함수 | 03 |
| 16 | 샘플링 | 07 |

## 5. 그림 목록 (figure inventory)

- 종류: **CONCEPT** = tips 그림 또는 새 다이어그램. **RESULT** = 저장된 파일에서 그린 차트.
- 값 표시: **illus** = 그린 값, 캡션 아래 줄에 "Illustrative values". **meas** = 파일에서 읽은 값. **exact** = 공식이나 설정값.
- tips 결함 id는 review 문서의 것이다. review는 옛 번호(23장)다. 아래 "지금 그림"이 현재 번호다.

### 5.1 원본 그림 90개 → 글 (rev3, 버리는 내용 0)

- ID = 페이지 접두어 + 그 페이지의 지금 번호 (17:50 저장). H 홈, U U-Net, A 어텐션, F 수식, RS 결과 SVG, RI 결과 PNG, E 업로드 평가, C 클러스터. 결과·업로드는 번호가 없어 페이지 순서다.
- ID는 고정이다. 오너가 번호를 바꿔도 ID는 그대로다 (§4.5).
- 값: illus = 그린 값 ("Illustrative values"), meas = 파일에서 읽은 값, exact = 식이나 설정값.
- 사본 고르기 규칙 (중복일 때): 1. 영어 페이지의 영어 Step 사본. 2. 없으면 오너가 지우려는 블록이 아닌 사본 (어텐션 페이지). 3. 그림 안 한국어가 없는 사본. 4. 같은 데이터의 차트가 이미 있으면 이미 만든 R 차트.
- 같은 그림 판단 = 같은 viewBox 높이 + 같은 캡션 뜻. §4.5 인벤토리가 해시로 확인한다. 해시가 다르면 diff에 `CHANGED`로 나온다.

#### 홈 `a03_student_tips_path.html` (46 · 내보냄 38)

| ID | 원래 (Step · rev2.1) | 내용 | 글 · 절 | 값 | 내보냄 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| H01 | Fig 1 (Step 2) · T01 | 학습·검증 대 생성, 지도로 | 01 · Two modes | illus | 예 | V5 |
| H02 | Fig 2 (Step 3) · T02 | base → final 망 사다리, 변경별 색 | 00 · How the network grew | meas | 예 | V9 |
| H03 | Fig 3 (Step 4) · T03 | starter U-Net | 10 · The starter | meas | 예 | 약어 줄 GN, SiLU |
| H04 | Fig 4 (Step 4) · T04 | final U-Net, 변경별 색 (높이 1806) | 03 · Structure (the whole network) | meas | 예 | 색 범례 표 (Z1) |
| H05 | Fig 5 (Step 5) · T05 | 누가 잡음을 넣고 누가 맞히나 | 01 · Who adds the noise | illus | 예 | V11 |
| H06 | Fig 6 (Step 5) · T06 | t마다 남은 이미지와 잡음 비율 | 02 · How much image is left | exact | 예 | |
| H07 | Fig 7 (Step 5) · **새** | 한 이미지 t = 250: 채널 지도, 픽셀 4개 숫자, 식 | 02 · x_t in numbers, t = 250 | illus | 예 | 새 예 (rev3) |
| H08 | Fig 8 (Step 5) · **새** | 같은 이미지 t = 750 | 02 · x_t in numbers, t = 750 | illus | 예 | 새 예 (rev3) |
| H09 | Fig 9 (Step 6) · T07 | 핵심 그림: 학습 step 하나 (높이 1614) | 02 · One step through the network | illus | 예 | "Step N →" 25개, "Figure 27" (§4.6) |
| H10 | Fig 10 (Step 6) · T08 | forward와 backward | 02 · How training lowers the error | illus | 예 | U02와 같다 |
| H11 | Fig 11 (Step 6) · T09 | 학습 step 코드 6줄 | 02 · The six lines | illus | 예 | |
| H12 | Fig 12 (Step 6) · T10 | t가 batch에서 모든 픽셀까지 | 04 · From t to every pixel | exact | 예 | |
| H13 | Fig 13 (Step 9) · T11 | 같은 +0.60, 세 t | 02 · Same pixel, three answers | illus | 예 | V15 |
| H14 | Fig 14 (Step 10) · T12 | 시간 경로: 공유 MLP 1개, Block 16개 | 04 · One shared MLP | meas | 예 | 본문 33,024 대 317,856 (§3) |
| H15 | Fig 15 (Step 10) · T13 | t = 250, 251, 980의 MLP 입력·출력 | 04 · Near t and far t | illus | 예 | V5 |
| H16 | Fig 16 (Step 10) · T14 | d3 Block 안 "+ time" | 04 · Adding t inside a Block | illus | 예 | V7 |
| H17 | Fig 17 (Step 10) · T15 | batch 전체 sin/cos, 128행 | 04 · The batch as a heat map | illus | 예 | Z6 색 눈금 |
| H18 | Fig 18 (Step 10) · T16 | 128장 중 3장 | 04 · Three images, three noise levels | illus | 예 | |
| H19 | Fig 19 (임시, H26 뒤) · T17 | 한 채널 어텐션 예 (370) | 중복 = A09 | illus | 아니오 | |
| H20 | Fig 20 (임시) · T18 | 블록 shape (136) | 중복 = H28 | exact | 아니오 | |
| H21 | Fig 21 (임시) · T19 | mid 상자, 옛 판 (472) | 중복 = H29 (새 판 496) | meas | 아니오 | |
| H22 | Fig 22 (임시) · T20 | 한 채널 x + 더하는 값 (412) | 중복 = H30 | illus | 아니오 | |
| H23 | Fig 23 (임시) · T21 | GN과 1×1 conv (330) | 중복 = A05 | illus | 아니오 | |
| H24 | Fig 24 (임시) · T22 | 행렬 곱 (408) | 중복 = H31 | illus | 아니오 | |
| H25 | Fig 25 (임시) · T23 | 닿는 범위 (364) | 중복 = A13 | illus | 아니오 | |
| H26 | Fig 26 (임시) · T24 | head 4개 (612) | 중복 = A14 | illus | 아니오 | |
| H27 | Fig 27 (Step 11) · T25 | down 단, 바닥, up 단, Block | 03 · One stage, step by step | exact | 예 | F3 |
| H28 | Fig 28 (Step 12) · T26 | 어텐션 블록 shape (136) | 05 · Shapes through the block | exact | 예 | = A01, H20 |
| H29 | Fig 29 (Step 12) · T27 | mid 블록 상자 (496) | 05 · Values change, shape stays | meas | 예 | = A02 |
| H30 | Fig 30 (Step 12) · T28 | 한 채널 x, 더하는 값, 합 (412) | 05 · What attention adds | illus | 예 | = A03 (A03은 그림 안 한국어) |
| H31 | Fig 31 (Step 12) · T29 | QKᵀ / √224, softmax, AV (408) | 05 · The core as matrix products | illus | 예 | = A08 |
| H32 | Fig 32 (Step 13) · T30 | 2×2 구석, up 전과 후 | 03 · Upsampling copies values | illus | 예 | |
| H33 | Fig 33 (Step 13) · T31 | up 뒤, skip, 쌓기 | 03 · The skip makes pixels differ | illus | 예 | V5 |
| H34 | Fig 34 (Step 13) · T32 | u3 상자 | 03 · u3 in 3D | meas | 예 | |
| H35 | Fig 35 (Step 13) · T33 | u3 흐름 | 03 · The u3 flow | exact | 예 | |
| H36 | Fig 36 (Step 14) · T34 | ReLU 대 SiLU | 03 · Activation | exact | 예 | "ReLU 판은 돌리지 않았다" |
| H37 | Fig 37 (Step 15) · T35 | 세 t의 두 오차 | 08 · Two errors at three t | meas + illus | 예 | V1 |
| H38 | Fig 38 (Step 15) · T36 | t = 250의 두 오차, 지도 | 08 · The errors as maps | illus + meas | 예 | V5 |
| H39 | Fig 39 (Step 16) · T37 | 500장이 250번 호출을 같이 | 07 · 500 images at a time | illus | 예 | V2 |
| H40 | Fig 40 (Step 16) · T38 | 이미지 하나, 250번 중 6번 | 07 · Noise to image | illus | 예 | 실제 샘플 아님 |
| H41 | Fig 41 (Step 16) · T39 | `sample()` 한 round | 07 · One round of the sampler | exact | 예 | = U03 |
| H42 | Fig 42 (Step 16) · T40 | round 5번, μ + σz | 07 · Mean plus fresh noise | illus | 예 | = U04 |
| H43 | Fig 43 (Step 17) · **새** | z 한 번 뽑기, 이미지 셋 | 07 · Fresh noise, one value per pixel | illus | 예 | 새 (rev3). = U05, F06 |
| H44 | Fig 44 (Step 18) · T41 | 호출 5번 안 | 07 · Inside one call | illus | 예 | V14 |
| H45 | Fig 45 (Step 18) · T42 | batch마다 이미지 하나 | 07 · Batch after batch | illus | 예 | |
| H46 | Fig 46 (Step 19) · T43 | 표시 시각마다 학습 세션 1개 | 11 · How each run was measured | exact | 예 | V22 |

#### U-Net `a03_student_tips_unet.html` (5 · 내보냄 1)

| ID | 그림 | 내용 | 글 · 절 | 값 | 내보냄 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| U01 | 그림 1 (432) | U-Net 한 번 (x_t, t → ε̂) 대 바깥 sampler (250번, x_t′ → 다음 x_t) | 01 · The network guesses, the loop removes | exact | **redraw** | 그림 안 한국어 18줄 (§4.6) |
| U02 | 그림 2 (168) | forward와 backward | 중복 = H10 | illus | 아니오 | |
| U03 | 그림 3 (168) | `sample()` 한 round | 중복 = H41 | exact | 아니오 | |
| U04 | 그림 4 (488) | round 5번 | 중복 = H42 | illus | 아니오 | |
| U05 | 그림 5 (158) | z 한 번 뽑기 | 중복 = H43 | illus | 아니오 | |

#### 어텐션 `a03_student_tips_attention.html` (14 · 내보냄 10)

| ID | 그림 | 내용 | 글 · 절 | 값 | 내보냄 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| A01 | 그림 1 (136) | 블록 shape | 중복 = H28 | exact | 아니오 | |
| A02 | 그림 2 (496) | mid 상자 | 중복 = H29 | meas | 아니오 | |
| A03 | 그림 3 (412) | x, 더하는 값, 합 | 중복 = H30 | illus | 아니오 | 그림 안 "(그림 9)" |
| A04 | 그림 4 (1748) | self-attention 전체 흐름, 노랑 = 짧은 흐름이 빠뜨린 단계, 장난감 숫자 | 05 · The full flow, step by step | illus | 예 | 높이 1748, 데스크톱 기준 |
| A05 | 그림 5 (330) | 224채널 GN, 한 픽셀의 1×1 conv | 05 · Norm and 1×1 conv stay local | illus | 예 | |
| A06 | 그림 6 (291.92) | qkv 가중치를 W_Q, W_K, W_V로 자르기 | 06 · One weight, three roles | exact | 예 | |
| A07 | 그림 7 (60) | 초기화된 가중치가 쓰이는 흐름 | 06 · Where the weights start | exact | 예 | 띠 한 줄 높이 |
| A08 | 그림 8 (408) | 행렬 곱 | 중복 = H31 | illus | 아니오 | |
| A09 | 그림 9 (370) | 픽셀 i가 64픽셀에 가중치 | 05 · One pixel looks at all 64 | illus | 예 | = H19 |
| A10 | 그림 10 (296) · **새** | p1의 query 대 모든 key, 선 굵기 = 가중치 | 06 · A query meets every key | illus | 예 | 설계 도중 생김. 그림 안 "Attention page" (§4.6) |
| A11 | 그림 11 (220) | 작은 숫자 QKᵀ, 위치 3개, d_k 4 | 06 · QKᵀ in small numbers | illus | 예 | |
| A12 | 그림 12 (140) | 어텐션 가중치의 학습 step | 06 · How Q, K, V learn | exact | 예 | |
| A13 | 그림 13 (364) | 3×3 conv 대 self-attention 닿는 범위 | 05 · Reach: convolution vs attention | illus | 예 | = H25 |
| A14 | 그림 14 (612) | head 4개, head마다 채널 56 | 06 · Heads (illustrative) | illus | 예 | 본문: 최종 망은 head 1 (§3). = H26 |

#### 수식 `a03_student_tips_formulas.html` (6 · 내보냄 5)

| ID | 그림 | 내용 | 글 · 절 | 값 | 내보냄 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| F01 | 그림 1 (168) | DDPM 수식 흐름: 학습 줄과 샘플링 줄, 같은 U-Net | 09 · The chain on one line | exact | 예 | |
| F02 | 그림 2 (1387) | 최종 U-Net 학습 step, 부분마다 수식과 바꾼 update | 09 · Every part, its formula | exact | 예 | 그림 안 "(Figure 7)", "(Figure 4)" (§4.6) |
| F03 | 그림 3 (274) | Q, K, V가 식에 들어가는 곳, forward·backward | 09 · Q, K, V in the formula | exact | 예 | |
| F04 | 그림 4 (214) | 입력 X → W_Q, W_K, W_V 갱신 | 09 · From input X to the weight update | exact | 예 | |
| F05 | 그림 5 (226) | 같은 입력, head 4개 | 09 · Heads share softmax, not scores | illus | 예 | head 수 설명용 |
| F06 | 그림 6 (158) | z 한 번 뽑기 | 중복 = H43 | illus | 아니오 | |

#### 결과 `a03_results_tips.html` (SVG 7 + PNG 4 · 내보냄 9)

| ID | 페이지 절 (크기) | 내용 | 글 · 절 | 값 | 내보냄 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| RS1 | Score path (980×754) | 업로드 망 상자, 부모 화살표, 공개 FID | 10 · Score path | meas | **redraw** | 그림 안 한국어 8줄. run 이름(C3a, K1 …)은 캡션 이름표 줄에 풀어 쓴다 |
| RS2 | 가족 나무 (2060×1684) | 학습 가족마다 seed 2개, FID@5k | 10 · Every training family | meas | **redraw** | 한국어 약 40줄, 폭 너무 넓음 |
| RS3 | Flow: how we got to C (760×290) | 확인 → 잡음 → 거르기 → 상한 → 조합 → 확인 | 00 · What was done | meas | 예 | M00을 대신한다 |
| RS4 | Screen (640×338) | 변경 10개, 3h | 중복 데이터 = R09b | meas | 아니오 | 같은 `verdicts.json` |
| RS5 | Time curves (640×340) | FID@1k 대 시간, base 대 C | 08 · Quality over training time | meas | 예 | |
| RS6 | Memorization gap (1000×340) | hold − train 손실 간격 대 FID, 늦은 dropout 생각 | 10 · Memorization signal and late dropout | meas | 예 | |
| RS7 | Running now (760×300) | 더 긴 학습, 두 번째 dropout | 10 · What is next | meas | 예 | "as of 2026-10-27". 그때 숫자가 없으면 "planned" |
| RI1 | Wave blk (PNG) | blk 단계 FID@1k 진행 | 10 · Wave blk (descriptive) | meas | 예 (복사) | `analysis/blk_progress.png` |
| RI2 | Sample grids (PNG) | base 6h 그리드 | 중복 = R00b 왼쪽 (같은 파일) | meas | 아니오 | |
| RI3 | Sample grids (PNG) | C 6h 그리드 | 08 · What a score gap looks like | meas | 예 (복사) | 원래 `runs/*/grid_6h.png` |
| RI4 | Sample grids (PNG) | base 12h 그리드 | 08 · What a score gap looks like | meas | 예 (복사) | 같은 절, RI3 옆 |

#### 업로드 평가 `a03_uploads_eval.html` (5 · 내보냄 5)

| ID | 크기 | 내용 | 글 · 절 | 값 | 내보냄 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| E01–E04 | 110×44 각각 | 곡선 패턴 아이콘 4개 (표 칸 안) | 08 · Four curve patterns | illus | 예 | Markdown 표 한 개에 아이콘 4개 |
| E05 | 958×530 | 업로드 망의 실제 곡선 | 08 · The patterns in my uploads | meas | 예 | run 이름은 이름표 줄에 |

#### 클러스터 `a03_cluster_tips.html` (3 · 내보냄 2)

| ID | 크기 | 내용 | 글 · 절 | 값 | 내보냄 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | 720×378 | 9단계와 각 단계의 기계 | 11 · Nine steps on the cluster | exact | 예 | 캡션의 "Click a box" 빼기 |
| C02 | 340×650 | C01의 모바일 배치 | 중복 = C01 | exact | 아니오 | |
| C03 | 720×180 | job 스크립트 한 번의 흐름 | 11 · One job script run | exact | **redraw** | 그림 안 한국어 8줄 |

합 (rev3):

| 페이지 | 그림 단위 | 중복 | 내보냄 | 그중 redraw 대기 |
| --- | --- | --- | --- | --- |
| 홈 | 46 | 8 | 38 | 0 |
| U-Net | 5 | 4 | 1 | 1 (U01) |
| 어텐션 | 14 | 4 | 10 | 0 |
| 수식 | 6 | 1 | 5 | 0 |
| 결과 | 11 (SVG 7 + PNG 4) | 2 | 9 | 2 (RS1, RS2) |
| 업로드 평가 | 5 | 0 | 5 | 0 |
| 클러스터 | 3 | 1 | 2 | 1 (C03) |
| **합** | **90** | **20** | **70** | **4** |

- 래스터 캡처 = 67 (SVG 내보냄). PNG 3장(RI1, RI3, RI4)은 복사다.
- redraw 4장이 영어로 안 되면: 그 절은 그림 없이 Markdown 표로 쓴다. `figures.md`에 이유를 적는다. 그때 G-DD2 수는 오너가 정한다.
- 그림이 없는 홈 Step 1, 7, 8: 02의 Markdown 표로 (Step 7 = batch 코드, Step 8 = 왜 각 이미지에 t가 필요한가).

### 5.1-old tips 그림 43개 → 글 (rev2.1 기록. SUPERSEDED 2026-10-28 rev3, 위 표가 맞다)

- ID = 지금 페이지(14:05 저장)의 그림 번호 (T01 = Figure 1). "rev2" 칸 = rev2 때 번호.
- "내보냄" 아니오 = 한국어 번역 쌍둥이. 내용은 영어 쌍둥이 한 장으로 같은 절에 나간다. 그래서 내용 손실 0이다.
- 타일 수는 rev1 셈이다. 새 그림은 "확인" (DD-1-01이 센다).
- Step 번호는 지금 페이지의 "Step k of 19"다.
- 페이지가 §4.1 "가장 간단한 길"대로 고쳐지면 번호만 다시 맞춘다. 글 · 절 칸은 그대로 둔다.

| ID | 지금 그림 (Step) · rev2 | 타일 | 내용 | 글 · 절 | 값 | 내보냄 | 고칠 점 (캡션·본문) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | Fig 1 (Step 2) · 1 | 11 | 학습·검증 대 생성, 지도로 | 01 · Two modes | illus | 예 | 캡션 2문장 (V5) |
| T02 | Fig 2 (Step 3) · 2 | 0 | base → final 망 사다리, 변경별 색 | 00 · How the network grew | meas (`manifest.json`) | 예 | 본문에 "one more level" (V9) |
| T03 | Fig 3 (Step 4) · 3 | 0 | starter U-Net | 09 · The starter | meas | 예 | 약어 줄: group normalization (GN), sigmoid linear unit (SiLU) |
| T04 | Fig 4 (Step 4) · 4 | 0 | final U-Net, 변경별 색, 어텐션 하위 단계 판 (높이 1518) | 09 · The final network | meas | 예 | 색 범례를 본문 6행 표로 (Z1) |
| T05 | Fig 5 (Step 5) · 5 | 6 | 누가 잡음을 넣고 누가 맞히나 | 01 · Who adds the noise | illus | 예 | 그림 안 `F.mse_loss(out, eps)`는 줄인 인용 (V11). 본문 한 줄 |
| T06 | Fig 6 (Step 5) · 6 | 0 | t마다 남은 이미지와 잡음 비율 | 01 · How much image is left | exact (일정) | 예 | 없음 |
| T07 | Fig 7 (Step 6) · 7 | 23 | 학습 step 하나가 망을 지나는 길 (핵심 그림, 높이 1468) | 02 · One step through the network | illus | 예 | "Step N →"를 글 번호로 (§4.3) |
| T08 | Fig 8 (Step 6) · **새** | 확인 | 학습 step 하나, forward와 backward. 출력 오차는 ε를 알아서 정확하다 | 02 · How training lowers the error | illus | 예 | 새 그림 (rev2.1). 본문 "the clean image is never fed to the network" 한 줄 |
| T09 | Fig 9 (Step 6) · 8 | 5 | 학습 step 코드 6줄, 이미지 하나 | 02 · The six lines | illus | 예 | 코드 공개 허락 (#137) |
| T10 | Fig 10 (Step 6) · 9 | 0 | t가 batch에서 Block의 모든 픽셀까지 가는 길 | 03 · From t to every pixel | exact | 예 | 없음 |
| T11 | Fig 11 (Step 9) · 10 | 0 | 같은 값 +0.60을 세 t에서 이미지·잡음으로 나눔 | 03 · Same pixel, three answers | illus | 예 | 본문 "noise weight 0.133" (V15) |
| T12 | Fig 12 (Step 10) · 11 | 0 | 시간 경로: 공유 multilayer perceptron (MLP) 1개, Block 16개 | 03 · One shared MLP | meas | 예 | 약어 줄 MLP |
| T13 | Fig 13 (Step 10) · 12 | 0 | t = 250, 251, 980의 MLP 입력과 출력 e | 03 · Near t and far t | illus | 예 | 캡션 7문장 → 2문장 (V5) |
| T14 | Fig 14 (Step 10) · 13 | 0 | d3 Block 안 "+ time", 이미지 두 장 | 04 · Adding t inside a Block | illus | 예 | 세미콜론 없는 캡션 (V7) |
| T15 | Fig 15 (Step 10) · 14 | 2 | batch 전체 sin/cos 입력, 128행 | 04 · The batch as a heat map | illus | 예 | 그림에 범례 없음 (Z6). 캡션 첫 문장에 색 눈금 |
| T16 | Fig 16 (Step 10) · 15 | 0 | 128장 중 3장, 각자의 t, sin/cos 행, e 행 | 04 · Three images, three noise levels | illus | 예 | T10, T14와 일부 겹친다 (R8). 정확한 중복이 아니라 남긴다 |
| T17 | Fig 17 (한국어, 위치는 T24 뒤) · 16 | 확인 | 어텐션 1채널 예: 픽셀 i가 64픽셀에 가중치, v를 섞어 더함 | 06 · One pixel looks at all 64 | illus | 예 (영어 판 필요) | 영어 쌍둥이 없음. 번호 순서 밖 |
| T18 | Fig 18 (한국어) · 17 | 확인 | 입력 feature map → residual, 단계마다 shape | 06 · Shapes through the block (T26과 같은 절) | exact | 아니오 | T26의 번역 쌍둥이 |
| T19 | Fig 19 (한국어) · 18 | 확인 | mid 어텐션 블록 feature map 상자 | 06 · Values change, shape stays (T27과 같은 절) | meas | 아니오 | T27의 번역 쌍둥이 |
| T20 | Fig 20 (한국어) · 19 | 확인 | mid 8×8 한 채널: x, 어텐션이 더하는 값, 합 | 06 · What attention adds (T28과 같은 절) | illus | 아니오 | T28의 번역 쌍둥이 |
| T21 | Fig 21 (한국어) · 20 | 확인 | 224채널 GroupNorm과 한 픽셀의 1×1 conv | 06 · Norm and 1×1 conv stay local | illus | 예 (영어 판 필요) | 영어 쌍둥이 없음 |
| T22 | Fig 22 (한국어) · 21 | 확인 | 세 단계를 행렬 곱으로, 픽셀 i는 파란 줄 | 06 · The core as matrix products (T29와 같은 절) | illus | 아니오 | T29의 번역 쌍둥이 |
| T23 | Fig 23 (한국어) · 22 | 확인 | 한 픽셀이 한 번에 보는 범위: 3×3 conv 대 self-attention | 06 · Reach: conv vs attention | illus | 예 (영어 판 필요) | 영어 쌍둥이 없음 |
| T24 | Fig 24 (한국어) · 23 | 확인 | multi-head self-attention, head 4개 | 06 · Four heads | meas (채널 56 × 4) | 예 (영어 판 필요) | 영어 쌍둥이 없음 |
| T25 | Fig 25 (Step 11) · 24 | 0 | down 단, 바닥, up 단, Block 하나의 단계 | 05 · One stage, step by step | exact | 예 | 이 글이 Block, attention, skip을 정의한다 (F3) |
| T26 | Fig 26 (Step 12) · 25 | 확인 | 어텐션 블록, 입력 → residual, 단계마다 shape | 06 · Shapes through the block | exact | 예 | 약어 없음 확인 |
| T27 | Fig 27 (Step 12) · 26 | 확인 | mid 어텐션 블록 feature map 상자 | 06 · Values change, shape stays | meas | 예 | 없음 |
| T28 | Fig 28 (Step 12) · 27 | 확인 | mid 8×8 한 채널: x, 더하는 값, 합 | 06 · What attention adds | illus | 예 | 없음 |
| T29 | Fig 29 (Step 12) · 28 | 확인 | QKᵀ / √224, 행마다 softmax, AV | 06 · The core as matrix products | illus | 예 | 캡션에 softmax, query, key, value 풀이 |
| T30 | Fig 30 (Step 13) · 29 | 0 | 한 채널 2×2 구석, up 전과 후 | 05 · Upsampling copies values | illus | 예 | 없음 |
| T31 | Fig 31 (Step 13) · 30 | 0 | up 뒤, skip, 쌓기 | 05 · The skip makes pixels differ | illus | 예 | 캡션 6문장 → 2문장 |
| T32 | Fig 32 (Step 13) · 31 | 0 | u3 특징 지도(feature map) 상자 | 05 · u3 in 3D | meas | 예 | 없음 |
| T33 | Fig 33 (Step 13) · 32 | 확인 | u3 흐름: upsample, d3 skip 쌓기, Block 2개, u2로 | 05 · The u3 flow | exact | 예 | 없음 |
| T34 | Fig 34 (Step 14) · 33 | 0 | rectified linear unit (ReLU) 대 SiLU, 기울기 | 05 · Activation | exact | 예 | 본문 "ReLU 판은 돌리지 않았다" 한 줄 |
| T35 | Fig 35 (Step 15) · 34 | 9 | 세 t에서 입력, 맞힐 잡음, 되찾은 이미지, 오차 | 07 · Two errors at three t | 잡음 오차 meas (`val_log.json`), 타일 illus | 예 | **V1**: 본문 한 줄 "At t = 980 the estimate is shown before `diffusion.py` clamps it to [−1, +1]." |
| T36 | Fig 36 (Step 15) · 35 | 6 | t = 250의 두 오차, 지도로 | 07 · The errors as maps | illus + meas | 예 | 캡션 6문장 → 2문장 |
| T37 | Fig 37 (Step 16) · 36 | 12 | 샘플링 batch 하나: 500장이 250번 호출을 같이 지난다 | 08 · 500 images at a time | illus | 예 | **V2**: 본문 "250 steps are set by the course grader", "fixed in diffusion.py"라고 쓰지 않는다 |
| T38 | Fig 38 (Step 16) · 37 | 6 | 이미지 하나, 250번 중 6번 | 08 · Noise to image | illus | 예 | 실제 샘플이 아니라고 캡션에 쓴다. 실제 샘플은 00 (R00b) |
| T39 | Fig 39 (Step 16) · **새** | 확인 | `sample()` 한 round: U-Net이 맞히고 sampler 식이 x를 옮긴다 | 08 · One round of the sampler | exact | 예 | 새 그림 (rev2.1) |
| T40 | Fig 40 (Step 16) · **새** | 확인 | sampler round 5번: x 입력, 평균 μ, x 출력 = μ + σz | 08 · Mean plus fresh noise | illus | 예 | 새 그림 (rev2.1). 이 절 뒤 Parts에 μ 식, β와 x_(t−1) 식 (§6.3) |
| T41 | Fig 41 (Step 17) · 38 | 20 | 호출 5번: x 입력, 잡음 추정, 깨끗한 추정, x 출력 | 08 · Inside one call | illus | 예 | **V14**: 본문 한 줄 "intermediate x is not clamped" |
| T42 | Fig 42 (Step 17) · 39 | 14 | batch마다 이미지 하나, 호출 1, 2, 50, 125, 249, 250 | 08 · Batch after batch | illus | 예 | 없음 |
| T43 | Fig 43 (Step 18) · 40 | 0 | 표시 시각마다 학습 세션 1개, 뒤에 기록 셀 | 10 · How each run was measured | exact | 예 | 그림 안 "notebook Step 5"는 노트북 셀 번호다 (V22). 본문 한 줄 |

- 합 (rev2.1): 43행, 글 · 절 43/43. 내보냄 39 = 영어 35 + 한국어 단독 4 (T17, T21, T23, T24).
- 한국어 단독 4개는 영어 판이 페이지에 생겨야 내보낸다 (§4.1 준비 판정 표).
- 06 어텐션 글은 그림 8장이다. 절마다 그림 1장 + 한 줄이면 읽을 만하다. 넘치면 T23, T24를 05로 옮긴다 (작가 판단 아님, pm 행으로).
- 08 샘플링 글은 그림 7장 + 결과 1장이 된다 (T37, T38, T39, T40, T41, T42, R08a). 절마다 그림 1장이라 나누지 않는다.

- 그림이 없는 Step 1, 7, 8: 02, 03의 Markdown 표로 옮긴다 (Step 7 = batch 코드, Step 8 = 왜 각 이미지에 t가 필요한가).
- Step 18 용어집은 옮기지 않는다. 영어 글은 용어 부록을 두지 않는다 (`rules/writing/style.md` §4.1). 언급마다 풀어 쓴다.
- 캡션 틀 (모든 그림, `rules/figures.md` §3):

```text
*<무엇을 무엇과 비교해 보이나>. Why: <왜 그런가, 왜 중요한가>.*
Illustrative values · Abbreviations: multilayer perceptron (MLP) · group normalization (GN)
```

- 둘째 줄은 이름표 줄이다. 두 문장 제한에 세지 않는다 (`rules/figures.md` §3 약어 줄). "Illustrative values"는 illus 그림에만.
- 캡션에 "Source: diffusion.py / our model.py" 조각을 쓰지 않는다. 출처는 `figures.md`에 둔다 (#135 정신).
- 캡션은 tips 캡션을 옮겨 적지 않는다. tips 캡션은 V5, V7 결함이 있다.

### 5.2 결과 차트 12장 (RESULT, 새 스크립트)

- 위치: `TA/blog_series/`. 이름 규칙: 추출 `extract_dd_*.py` → `data/dd_*.json|csv`, 그림 `fig_dd_NN_*.py` → PNG. README 표에 행을 더한다 (cnn 선례).
- 실행: `OMP_NUM_THREADS=1 timeout 300 uv run python blog_series/<script>.py`. 입력은 JSON, Markdown 표뿐이다. `.pt`, `.npz` 0.
- R00b 입력은 이미 저장된 PNG 그리드다 (#138): `runs/141768_v10000_base/grid_{1h,3h,6h}.png`, `runs/143716_v10142_p10136_t18h/grid_18h.png`. 스크립트는 둘을 나란히 붙이기만 한다. `.npz` 0.
- 칸 이름 중 "확인"은 이 설계 때 열지 않은 파일이다. developer가 열어 `figures.md`에 칸을 적는다.
- rev2: ID 숫자 = 새 글 번호. 스크립트 이름도 같다. rev1 ID는 쓰지 않는다.
- 공용 스타일 모듈 하나: `TA/blog_series/dd_style.py` (색, 축, 범례, 글꼴). 방법 → 색 고정 맵. starter(base)는 늘 회색 (`rules/visualization.md` §5).
- 새 값은 비교 대상 옆, 같은 축과 눈금에 둔다 (`rules/visualization.md` §1). 중요한 숫자(Δ, 판정)는 그림 위에 글자로 쓴다 (§3).

rev3 배정 (12장 모두 만들어졌다. 스크립트와 PNG 이름은 그대로다. ID의 숫자는 rev2 글 번호다):

| ID | rev3 글 · 절 |
| --- | --- |
| R00a | 00 · Conclusion |
| R00b | 00 · Samples |
| R00c | 00 · By the numbers |
| R08a | 07 · What sampling costs |
| R07a | 08 · Measured: noise error by noise level |
| R10b | 08 · Three scales agree |
| R10c | 08 · No copying |
| R09a | 10 · Size |
| R09b | 10 · Screen: 10 changes (RS4와 같은 데이터, 이것만 낸다) |
| R09c | 10 · What each step bought |
| R10d | 10 · Longer training |
| R10a | 11 · Verdicts, written first |

- 보고 메모대로 차트 안에 run 이름(C3a, C6 …)이 라벨로 있다. 캡션 이름표 줄에 풀어 쓴다. 예: "C3a = base + level 4 + attention at 8×8, step a". 뜻은 `figures.md`에 원본 파일과 함께 적는다.
- 아래 표의 "글 · 절" 칸은 rev2 번호다. rev3 글은 위 표가 맞다.

| ID | 글 · 절 | 보이는 것 | 읽는 파일 · 칸 | 스크립트 |
| --- | --- | --- | --- | --- |
| R00a | 00 · Result | 업로드 12개의 공개 FID, 시간 순. `in`은 진하게, `outside`는 회색 | `runs/LEADERBOARD.md` + `data/dd_rule_status.csv` | `fig_dd_00_portal.py` |
| R00b | 00 · Samples | 실제 생성 이미지: starter 6h 대 최종 망 18h | 위 grid PNG 4장 중 `grid_6h.png`, `grid_18h.png` | `fig_dd_00_samples.py` |
| R00c | 00 · By the numbers | run 폴더 154, manifest run 137, GPU 시간 879.5, GPU 종류, 판정 파일 14, 업로드 12 | `data/dd_scale.json` | `fig_dd_00_scale.py` |
| R07a | 07 · Measured | 따로 둔 이미지의 잡음 MSE, t 구간 4개, 12h 동안 (72점) | `runs/*_v10136_*/val_log.json` (EMA 무게) | `fig_dd_07_valbins.py` |
| R08a | 08 · What sampling costs | 5,000장 생성 초: starter 대 최종 망 | `runs/*/eval5k.json` `seeds.0.sample_s`, `gpu` | `fig_dd_08_cost.py` |
| R09a | 09 · Size | 경로 위 망 6개의 매개변수, 10M 상한 선 | `runs/*/manifest.json` `n_params`. 망 6개 = `tips/a03/tools/a03_student_path_data.py` 16행 `RUN_PREFIX` | `fig_dd_09_params.py` |
| R09b | 09 · Screen: 10 changes | 변경 10개의 3h FID@1k 차, 판정선 −1.309 | `analysis/verdicts.json` `entries[].delta`, `threshold`, `verdict` | `fig_dd_09_screen.py` |
| R09c | 09 · What each step bought | 경로 위 망 6개의 FID@5k | `runs/*/eval5k.json` (칸 확인). eval5k가 없는 망은 빈칸 + 이유 | `fig_dd_09_path.py` |
| R10a | 10 · Verdicts | 단계마다 m, ±δ 띠, 판정 글자 | `data/dd_scale.json` `verdict_file_names`의 파일들 `m`, `delta`, `verdict` | `fig_dd_10_verdicts.py` |
| R10b | 10 · Three scales agree | (a) FID@1k 대 FID@5k 순위 (b) 공개 대 FID@5k 점과 직선 | `analysis/eval5k.json` `groups.*.spearman_fid1k_vs_fid5k`, `analysis/portal_fit.json` `points`, `a`, `b` | `fig_dd_10_scales.py` |
| R10c | 10 · No copying | run별 최근접 거리 비율과 복사 후보 비율, 기대 1% 선 | `analysis/memorization.json` | `fig_dd_10_memo.py` |
| R10d | 10 · Longer training | 같은 망 12h 대 18h: FID@5k와 공개 FID | `runs/143621_v10136_*/eval5k.json`, `runs/143716_v10142_*/eval5k.json`, `runs/LEADERBOARD.md` 19–20행 | `fig_dd_10_t18h.py` |

- 결과 숫자를 그림 위에 둘 자리가 없으면 그림 아래 한 줄로 쓴다 (`rules/figures.md` §1).
- 대안 원본: 영어 결과 보드 `TA/tips/a03/a03_results_tips.html`에 같은 JSON에서 만든 SVG 차트가 있다 (§5.4). R09b, R10a가 막히면 그 SVG를 쓴다. 그때는 R1 래스터를 다시 돌려야 하니 오너에게 다시 묻는다 (#138은 1회).

### 5.3 새 다이어그램 (mermaid, 글 안)

| ID | 글 · 절 | 내용 |
| --- | --- | --- |
| ~~M00~~ | ~~00 · What was done~~ | ~~확인 → 잡음 바닥 → 거르기 → 조합 → 확인 → 더 긴 학습 → 업로드~~ <!-- SUPERSEDED 2026-10-28 rev3: 오너 그림 RS3이 같은 흐름 --> |
| M10 | 11 · The loop (rev3: 10 → 11) | 판정 기준 먼저 commit → seed 0–2 학습 → 판정 파일 → 채택 또는 버림 |

- 값이 없는 흐름만 mermaid로 쓴다. 상자 12개 이하.
- 흐름도 상자에 쓰는 도구를 적고, 아래 표에 단계마다 파일과 목적을 둔다 (`rules/visualization.md` §4).

### 5.4 선택 추가 그림 (다른 a03 페이지, 기본은 쓰지 않음)

| 페이지 (`TA/tips/a03/`) | 언어 | 그림 | 쓸 곳 (쓴다면) | 메모 |
| --- | --- | --- | --- | --- |
| ~~`a03_results_tips.html`, `a03_uploads_eval.html`, `a03_cluster_tips.html`~~ | | | | rev3: 본 목록(§5.1)으로 옮겼다 |
| `a03_path_v10136_ko.html` | 한국어 | 확인 필요 | 10 | H02와 겹친다 |
| `a03_model_structure_ko.html`, `a03_diffusion_theory_ko.html`, `a03_time_qa_ko.html`, `a03_conv_skip_qa_ko.html`, `a03_residual_ko.html`, `a03_attention_qa_ko.html` | 한국어 | 확인 필요 | 03–05 | 그림 안 글자가 한국어다. 영어 판을 다시 만들어야 한다 |
| `a03_evaluation_ko.html`, `a03_validation_ko.html`, `a03_fid_rank_ko.html`, `a03_train_basis_ko.html` | 한국어 | 확인 필요 | 09 | 같은 이유 |
| `a03_gen_models_ko/` (21쪽) | 한국어 | 확인 필요 | 새 글 후보 | 생성 모델 지도. 이 연재 밖 |
| `a03_student_tips_ko.html` | 한국어 | 확인 필요 | 없음 | 같은 주제의 한국어 판으로 보인다 |

- 그림 수는 D4 작업이 SVG와 `<img>`를 세어 `data/dd_extras.csv`에 적는다.
- rev3: 기본은 여전히 쓰지 않는다 (Q-DD9). 영어로 다시 그릴 가치가 있는 후보 (선택, 오너가 고를 때만):

| 후보 | 이유 | 갈 글 |
| --- | --- | --- |
| `a03_diffusion_theory_ko.html`의 그림 | 01 배경 글이 그림 3장뿐이다 | 01 |
| `a03_residual_ko.html`의 그림 | 03에 residual 연결 그림이 없다 | 03 |
| `a03_fid_rank_ko.html`의 그림 | 08의 FID 척도 설명을 돕는다 | 08 |

- 그림 수와 한국어 줄 수는 인벤토리 스크립트에 이 페이지를 더해 센다 (§4.5, 선택).
- 한국어 그림은 영어 글에 그대로 넣지 않는다 (`rules/writing/style.md` §4 영어 문서).

### 5.5 썸네일 (글마다 1장)

- 틀: `TA/blog_series/fig_thumb.py`의 `make_thumb(title, big, sub_lines, bars, accent_index, out, preview)`. 새 스크립트 `fig_dd_thumbs.py` + `data/dd_thumbs.csv`.
- 1200×630, `thumb_preview_360.png`로 360px 읽힘을 눈으로 본다.
- 썸네일 글자에 약어를 쓰지 않는다. 풀 이름 자리가 없기 때문이다.
- 라벨: "Diffusion from scratch · NN". 00 썸네일은 카드 그림이다.

rev3 썸네일 12행 (`data/dd_thumbs.csv`를 이 표로 바꾼다. 값은 지금 csv에서 다시 쓴다):

| 글 | slug | big | 아래 줄 | 막대 (원본) |
| --- | --- | --- | --- | --- |
| 00 | `00-overview` | 30.26 → 6.10 | 그대로 | 지금 csv 00행 그대로 |
| 01 | `01-why-diffusion-why-unet` | noise → image | the network only guesses the noise | 지금 01행 (잡음 무게, exact) |
| 02 | `02-noise-and-one-training-step` | 6 lines | one training step | 지금 02행 (`c_step`) |
| 03 | `03-inside-the-unet` | 16 Blocks | down, bottom, up, skip | 지금 05행 (56, 112, 224, 224) |
| 04 | `04-time-inside-the-unet` | 128 noise levels | one batch, one forward pass | **33,024 대 317,856** (최종 망, §3). 지금 04행의 115,584는 starter 값이라 버린다 |
| 05 | `05-attention-what-it-adds` | 64 pixels | every pixel sees every pixel | 지금 06행 (64, 1,024. head 1) |
| 06 | `06-query-key-value-and-heads` | one weight, three roles | query, key and value | 어텐션 블록 하나의 매개변수, 32×32와 8×8 (`model.py` `Attn` 81–83행 식, developer가 센다) |
| 07 | `07-sampler-250-calls` | 250 calls | per image, all 500 at once | 지금 08행 (`sample_s`) |
| 08 | `08-evaluation-two-errors-and-fid` | never zero | noise error by noise level | 지금 07행 (`hold_by_bin`) |
| 09 | `09-formula-flow` | one chain | the same network trains and samples | t = 37, 250, 980의 이미지 무게 (지금 03행, exact) |
| 10 | `10-experiments-starter-to-final` | 3.3M → 9.8M | parameters, cap 10M | 지금 09행 (`n_params`) |
| 11 | `11-engineering-the-process` | 879.5 | graphics-processor hours, every verdict written first | 지금 10행 |

- 썸네일 글자에 약어를 쓰지 않는다 ("MLP", "GPU" 없음).
- rev2 폴더 10개를 `x_`로 바꾼다 (지우지 않는다, `rules/core.md` 소프트 삭제). `00-overview`는 slug가 같아 남긴다.
- §5.4 후보 페이지의 SVG 수 (architect Grep): `a03_diffusion_theory_ko.html` 21, `a03_residual_ko.html` 9, `a03_fid_rank_ko.html` 1.
- 대상 (csv의 rev2 slug. 폴더 안 PNG는 grep에 안 보이니 main session이 `ls`로 확인한다): `01-how-diffusion-adds-noise`, `02-one-training-step`, `03-why-the-network-needs-t`, `04-t-in-one-batch`, `05-inside-the-unet`, `06-attention-mixes-64-pixels`, `07-noise-error-vs-image-error`, `08-sampling-250-calls`, `09-starter-to-final-network`, `10-experiments-and-process`.
- 예: `x_05-inside-the-unet`. 새 `03-inside-the-unet`과 이름이 겹치지 않는다.

rev2 표 (기록):

| 글 | big | 아래 줄 | 막대 (원본) |
| --- | --- | --- | --- |
| 00 | 30.26 → 6.10 | image-quality score, lower is better · grade A | `dd_rule_status.csv`의 `in` 업로드 공개 FID, 마지막 강조 |
| 01 | 1,000 steps | noise added a little at a time | t = 37, 250, 980의 잡음 무게 (일정, exact) |
| 02 | 6 lines | one training step | 1h, 3h, 6h 학습 step 수 (`verdicts_c3a.json` `c_step`) |
| 03 | t = 0 … 999 | the network must know the noise level | t = 37, 250, 980의 이미지 무게 (exact) |
| 04 | 128 levels | one batch, one forward pass | 시간 경로 매개변수: 공유 MLP 대 Block Linear 합 (`manifest.json`, 칸 확인) |
| 05 | 16 Blocks | down, bottom, up, skip | 단별 채널 56, 112, 224, 224 (`manifest.json` `arch`) |
| 06 | 64 pixels | every pixel sees every pixel | head 4개 × 채널 56 (`manifest.json`, 칸 확인) |
| 07 | never zero | noise error by noise level | t 구간 4개의 잡음 MSE (`val_log.json`) |
| 08 | 250 calls | per image, all 500 at once | 5,000장 생성 초, starter 대 최종 (`eval5k.json`) |
| 09 | 3.3M → 9.8M | parameters, cap 10M | 망 6개의 매개변수 (`manifest.json`) |
| 10 | 879.5 GPU-hours | every verdict written first | 단계마다 \|m\| (판정 파일 14개 중 짝 판정) |

## 6. 연재 계획

### 6.1 제목

- 연재 제목: **"Diffusion From Scratch"** (Q-DD4 기본값 확정, #138). slug 경로 `ddpm-from-scratch`는 식별자라 그대로 둔다.
- 글 제목 형식: `Diffusion From Scratch (n/11): <claim>` (rev3). 00 = `Diffusion From Scratch: <claim>`. 15단어 이하.
- 제목 안 약어는 풀어 쓴다. 예: "Fréchet Inception Distance (FID)".
- 날짜 기준: "as of 2026-10-27" (마지막 업로드, Q-DD7).

### 6.2 글 목록 (rev3)

main session의 10개 안을 바탕으로 한다. 두 글만 나눈다.

| 10개 안 | 그림 수 | rev3 | 이유 |
| --- | --- | --- | --- |
| 03 U-Net (구조, 시간 MLP, up, skip, SiLU) | 13 | 03 U-Net (7) + 04 U-Net 안의 시간 (6) | 절마다 그림 1장 규칙 (§6.3). rev2.1 상한 8장 |
| 04 Attention | 14 (중복 뺀 뒤 14) | 05 어텐션이 더하는 것 (8) + 06 Q, K, V와 head (6) | 같은 이유. 05 = 무엇을, 06 = 가중치가 어떻게 |
| 나머지 8개 | | 번호만 밀린다 | 오너 순서 그대로 |

| # | 폴더 | 제목 (작업용) | 한 줄 목적 | 그림 (§5.1 ID) | 원본 쪽 | 길이 |
| --- | --- | --- | --- | --- | --- | --- |
| 00 | `00-overview` | Diffusion From Scratch: Fréchet Inception Distance (FID) 30.26 → 6.10 Under a 10M-Parameter Cap | 결과, 샘플, 규모를 1분에 | R00a, R00b, RS3, R00c, H02 | 결과, 홈 | 70줄 |
| 01 | `01-why-diffusion-why-unet` | (1/11): Why Diffusion, and Why a U-Net | 잡음에서 한 번에 못 만든다. 망은 맞히고 반복이 뺀다 | H01, H05, U01 | 홈, U-Net | 45줄 |
| 02 | `02-noise-and-one-training-step` | (2/11): Noise, the Step t, and One Training Step | 잡음 일정, x_t 숫자, t가 필요한 이유, 학습 step | H06, H07, H08, H13, H09, H10, H11 + Step 7, 8 표 | 홈, 수식 글 | 75줄 |
| 03 | `03-inside-the-unet` | (3/11): Inside the U-Net: Down, Bottom, Up, Skip | 단, up, skip, SiLU | H04, H27, H32, H33, H34, H35, H36 | 홈 | 65줄 |
| 04 | `04-time-inside-the-unet` | (4/11): How the U-Net Knows the Noise Level | 공유 MLP, Block마다 Linear, batch 128개 t | H12, H14, H15, H16, H17, H18 | 홈, 홈 임시 글 표 | 55줄 |
| 05 | `05-attention-what-it-adds` | (5/11): Attention: How One Pixel Sees All 64 | 닿는 범위, 흐름, shape, 더하는 값 | A13, A09, H28, H29, H30, A04, A05, H49 (rev3.1: H31 → H49) | 어텐션, 홈 | 70줄 |
| 06 | `06-query-key-value-and-heads` | (6/11): Query, Key, Value: One Weight, Three Roles | 가중치 나누기, 1×1 conv = 행렬 곱, 시작, 비교, 학습, head | rev3.1: A06 + A16, A15 + A19, A07, H47, H48, A20, A12, A14 (§4.7) | 어텐션, 홈 | 70줄 |
| 07 | `07-sampler-250-calls` | (7/11): 250 Network Calls to Make One Image | round, μ와 새 잡음, t와 t′, 비용 | H39, H40, H41, H42, H50 (rev3.2: H43 → H50), H44, H45, R08a | 홈, U-Net 글 | 75줄 |
| 08 | `08-evaluation-two-errors-and-fid` | (8/11): Noise Error, Image Error and Three FID Scales | 손실이 0이 안 되는 이유, 곡선 패턴, FID 척도, 외움 | H37, H38, R07a, E01–E04, E05, RS5, RI3 + RI4, R10b, R10c | 홈, 업로드 평가, 결과 | 80줄 |
| 09 | `09-formula-flow` | (9/11): The Whole Method as One Chain of Equations | 식 하나하나를 학습과 샘플링에 잇는다 | F01, F02, F03, F04, F05 | 수식 | 60줄 |
| 10 | `10-experiments-starter-to-final` | (10/11): From a 3.3M Starter to a 9.8M U-Net | 무엇을 바꿨고 무엇이 통했나 | H03, R09a, R09b, RS1, RS2, R09c, R10d, RS6, RS7, RI1 | 결과, 홈 | 80줄 |
| 11 | `11-engineering-the-process` | (11/11): Cluster Jobs, Verdicts Written First, Every Run Logged | 클러스터, 판정 먼저, 기록 | C01, C03, M10, R10a, H46 | 클러스터, 홈 | 55줄 |

- 그림 합 (rev3): 원본 70 + 결과 차트 12 = PNG 82장 + mermaid 1 (M10).
- 글마다 PNG: 5, 3, 7, 7, 6, 8, 6, 8, 13 (절 9), 5, 10, 4.
- 08과 10은 8장을 넘는다. 08의 E01–E04는 표 한 개, RI3 + RI4는 절 한 개다. 그래도 길면 pm이 행 하나로 나눈다 (작가 판단 아님).
- 02의 순서: H06 → H07 → H08 (잡음을 넣는 쪽) → H13 (왜 t가 필요한가) → H09 → H10 → H11 (학습 step). "왜"가 "어떻게" 앞이다 (review F2).
- 05의 순서: A13 (왜: 닿는 범위) → A09 (한 픽셀 예) → H28, H29, H30 (shape와 값) → A04 (전체 흐름) → A05 (GN) → H31 (행렬 곱).
- 01은 U01이 영어가 될 때까지 2장이다. 그래도 선다 (§4.6).
- 00만 Series map 링크를 가진다. 다른 글은 "post 5" 글자로 가리킨다.

rev2 목록 (기록. SUPERSEDED 2026-10-28 rev3):

| # | 폴더 | 제목 (작업용) | 한 줄 목적 | 그림 | 길이 |
| --- | --- | --- | --- | --- | --- |
| 00 | `00-overview` | Diffusion From Scratch: Fréchet Inception Distance (FID) 30.26 → 6.10 Under a 10M-Parameter Cap | 결과, 실제 샘플, 규모를 1분에 | R00a, R00b, R00c, T02, M00 | 70줄 |
| 01 | `01-how-diffusion-adds-noise` | (1/10): Noise In, Noise Out: The Two Modes of Diffusion | 학습과 생성, 잡음 일정 | T01, T05, T06 | 50줄 |
| 02 | `02-one-training-step` | (2/10): One Training Step in Six Lines | 잡음 넣기 → 망 → 손실 → 역전파 | T07, T08, T09 + Step 7 표 | 60줄 |
| 03 | `03-why-the-network-needs-t` | (3/10): Why the Network Must Know the Noise Level t | t가 없으면 답이 하나로 안 정해진다 | T11, T10, T12, T13 + Step 8 표 | 60줄 |
| 04 | `04-t-in-one-batch` | (4/10): 128 Noise Levels in One Forward Pass | batch 안에서 이미지마다 다른 t | T14, T15, T16 | 50줄 |
| 05 | `05-inside-the-unet` | (5/10): Inside the U-Net: Down, Bottom, Up, Skip | Block, up, skip, SiLU | T25, T30, T31, T32, T33, T34 | 65줄 |
| 06 | `06-attention-mixes-64-pixels` | (6/10): Attention: How the Bottom Mixes All 64 Pixels | 3×3 conv가 못 닿는 먼 픽셀을 잇는다 | T23, T17, T26, T27, T28, T29, T21, T24 | 70줄 |
| 07 | `07-noise-error-vs-image-error` | (7/10): Why the Training Loss Never Reaches Zero | 잡음 오차와 이미지 오차, 실측 | T35, T36, R07a | 55줄 |
| 08 | `08-sampling-250-calls` | (8/10): 250 Network Calls to Make One Image | 샘플링, μ와 새 잡음, 비용 | T37, T38, T39, T40, T41, T42, R08a | 75줄 |
| 09 | `09-starter-to-final-network` | (9/10): From a 3.3M Starter to a 9.8M U-Net, Side by Side | 무엇을 바꿨고 무엇이 통했나 | T03, T04, R09a, R09b, R09c | 65줄 |
| 10 | `10-experiments-and-process` | (10/10): Pre-Registered Verdicts, Three Seeds, No Copying | 판정 규칙, 척도, 외움, 학습 길이, 시도했으나 안 쓴 것 | R10a, R10b, R10c, R10d, T43, M10 | 70줄 |

- 그림 합 (rev2.1): tips 39 (43행 중 번역 쌍둥이 4 제외) + 결과 12 + mermaid 2 = 53. 글마다 3–8장.
- 03 그림 순서는 T11 → T10이다. "왜"가 "어떻게" 앞이다 (review F2).
- 06 그림 순서: T23 (왜: 먼 픽셀에 닿는 범위) → T17 (한 픽셀 예) → T26–T29 (어떻게) → T21, T24 (부품). "왜" 먼저다.
- 새 내용의 자리 (rev2.1): Fig 8 (forward와 backward) → 02. Fig 39, 40과 μ, β, x_(t−1), 새 잡음 글 → 08. 01은 아니다. 01은 잡음을 넣는 쪽이고 이 식들은 잡음을 빼는 쪽(샘플러)이다.
- 06을 따로 두는 이유: 원본에 새 Step 12와 한국어 블록이 생겼다. 05에 넣으면 그림 14장이 된다.
- 09 제목의 "Side by Side": 원본 Step 4 "The base and the final network, side by side" (T03, T04). T04에는 이제 어텐션 하위 단계 판이 있다 (높이 1506). 09 본문은 "post 6" 글자로 가리킨다. 링크는 00만 가진다 (§6.3).

### 6.3 글마다 절 (영어, 작가는 이 순서로, rev2)

뼈대 둘 (`rules/writing/style.md` §5.1, 2026-10-28):

```text
개념 글 01–09:  Problem → Result → Mission → Vision
                → Per-problem loop:  [figure] → Why → Mission → Vision   (하위 문제마다, 한 줄씩)
                → Structure → Parts → Fit
측정 글 00, 10:  Conclusion → Why we did it → Data → What was done → Result and how to read it
```

- 하위 문제 하나 = 절 하나 = 그림 하나. 그림 다음 줄 셋(Why, Mission, Vision)은 한 줄씩이다.
- 보이는 형태 순서: 그림 → 표 → 수식 → 코드 (`rules/writing/style.md` §1). 수식과 코드는 그림과 표 뒤에만 둔다.
- 쉽게 쓰되 핵심 정보는 뺀다고 줄이지 않는다 (§1, 2026-10-28). 설계마다 "why it was built this way" 한 줄 + 실제 숫자 예 하나 (§5.3).
- Structure: 그 글의 부품 연결 그림. 이미 loop에 쓴 tips 그림을 다시 쓰지 않는다. 작은 mermaid 하나 또는 표.
- Fit: 이 연재(우리 망, 우리 run)에서 왜 이것이 맞나, 한두 줄.
- rev3: 측정 순서 글 = 00, 10, 11. 개념 순서 글 = 01–09.

rev3 개념 글 절 (원본 쪽: H 홈, U U-Net, A 어텐션, F 수식, E 업로드 평가, RS/RI 결과):

| 글 | Problem | Per-problem loop 절 (그림 · 원본) | Structure · Parts · Fit (원본) |
| --- | --- | --- | --- |
| 01 | 잡음에서 이미지를 한 번에 만들 수 없다 | Two modes (H01 · H) · Who adds the noise (H05 · H) · The network guesses, the loop removes (U01 · U) | Structure: 표 "U-Net이 하는 일 / 바깥 반복이 하는 일" (U 표) · Parts: 왜 U-Net인가 (같은 크기 출력, 여러 크기, skip) 한 줄씩 (U 글) · Fit: 과목 starter가 U-Net이다 |
| 02 | 망이 무엇을 맞혀야 배우나 | How much image is left (H06 · H) · x_t in numbers, t = 250 (H07 · H) · x_t in numbers, t = 750 (H08 · H) · Same pixel, three answers (H13 · H) · One step through the network (H09 · H) · How training lowers the error (H10 · H) · The six lines (H11 · H) · One batch, one t per image (Step 7 표 · H) · Why each image needs its t (Step 8 표 · H) | Structure: 학습 step mermaid · Parts: β 일정 표, 식 x_t = √ᾱ x0 + √(1−ᾱ) ε (F "잡음 schedule", "x_t") · Fit: 학습 루프는 과목 고정, 망만 우리 것 |
| 03 | 작은 지도로 줄이면 세부가 사라진다 | The whole network (H04 · H) · One stage, step by step (H27 · H) · Upsampling copies values (H32 · H) · The skip makes pixels differ (H33 · H) · u3 in 3D (H34 · H) · The u3 flow (H35 · H) · Activation (H36 · H) | Structure: 단별 채널 표 56, 112, 224, 224 · Parts: Block 순서 GN → SiLU → conv → + time → GN → SiLU → dropout → conv → + x (F "Block 하나") · Fit: 64×64, 단 4개, 10M 상한 안 |
| 04 | t는 정수 하나인데 그림은 64×64×C다 | From t to every pixel (H12 · H) · One shared MLP (H14 · H) · Near t and far t (H15 · H) · Adding t inside a Block (H16 · H) · The batch as a heat map (H17 · H) · Three images, three noise levels (H18 · H) | Structure: 모양 표 t → sin/cos 128 → e 128 → te C → (C, 1, 1) (H 임시 글 Table 26, F "t를 숫자로") · Parts: 공유 MLP 33,024 대 Block Linear 317,856 (§3), Block마다 MLP면 상한 넘음 (H 임시 글 Table 28, 숫자는 developer가 `param_estimate.py`로 확인) · Fit: 호출 한 번에 잡음 수준 128개 |
| 05 | 3×3 conv는 먼 픽셀에 한 번에 닿지 못한다 | Reach: convolution vs attention (A13 · A) · One pixel looks at all 64 (A09 · A) · Shapes through the block (H28 · H) · Values change, shape stays (H29 · H) · What attention adds (H30 · H) · The full flow, step by step (A04 · A) · Norm and 1×1 conv stay local (A05 · A) · The core as matrix products (H49 · H, rev3.1) | Structure: 자리 표 8×8 (d4, mid) + 32×32 (d2, u2), 픽셀 쌍 4,096과 1,048,576 (§3, H 임시 글 Table 29) · Parts: 식 softmax(QKᵀ/√224)V · Fit: 쌍의 수가 제곱이라 작은 지도에만 둔다 |
| 06 | Q, K, V는 어디서 와서 왜 다른 일을 하나 | rev3.1: One weight, three roles (A06 + A16 · A) · A 1×1 convolution is a matrix product (A15 + A19 · A) · Where the weights start (A07 · A) · A query meets every key (H47 · H) · The output, one weight at a time (H48 · H) · QKᵀ in small numbers (A20 · A) · How Q, K, V learn (A12 · A) · Heads, illustrative (A14 · A) | Structure: W_Q, W_K, W_V 표 (A 표) · Parts: "Q, K, V가 실제로 배우는 것" 표 (A 표 8) · Fit: **최종 망은 head 1** (manifest). 4 head는 설명용 |
| 07 | 한 번의 호출로는 잡음을 다 못 뺀다 | 500 images at a time (H39 · H) · Noise to image (H40 · H) · One round of the sampler (H41 · H) · Mean plus fresh noise (H42 · H) · Fresh noise, one value per pixel (H50 · H, rev3.2) · Inside one call (H44 · H) · Batch after batch (H45 · H) · What sampling costs (R08a) | Parts (그림 뒤, 식은 표 뒤): "Where μ comes from" (U 절), "β, x_t, and the paper's x_(t−1)" 기호 표 (U 절), t와 t′: "x_t′ becomes the next x_t" (U01 그림 글), "Why fresh noise" + 숫자 예 하나 (U 절) · 샘플러 코드 줄 (마지막) · Fit: 채점기가 250 step으로 고정 |
| 08 | 손실이 0이 안 되는데 망이 틀렸나. 점수는 어떻게 믿나 | Two errors at three t (H37 · H) · The errors as maps (H38 · H) · Measured: noise error by noise level (R07a) · Four curve patterns (E01–E04 · E) · The patterns in my uploads (E05 · E) · Quality over training time (RS5 · RS) · What a score gap looks like (RI3, RI4 · RI) · Three scales agree (R10b) · No copying (R10c) | Structure: FID 척도 표 셋 (§3) · Parts: "What you need, and where each value comes from" 표 (E) · Fit: 공개 FID는 업로드 12번뿐이라 FID@1k, FID@5k로 고른다 |
| 09 | 식이 여러 페이지에 흩어져 하나의 흐름이 안 보인다 | The chain on one line (F01 · F) · Every part, its formula (F02 · F) · Q, K, V in the formula (F03 · F) · From input X to the weight update (F04 · F) · Heads share softmax, not scores (F05 · F) | Structure: 식 번호 표, 학습 줄과 샘플링 줄 (F 표 1–23 줄여서) · Parts: loss, 갱신 한 번, 샘플링 식 (F 절) · Fit: 같은 U-Net이 두 줄 모두에 쓰인다 |

rev3 측정 글 절:

| 글 | 절 |
| --- | --- |
| 00 | Conclusion (한 줄 굵게 + R00a) · Samples (R00b) · Why we did it · Data · What was done (RS3) · What helped (표) · By the numbers (R00c) · How the network grew (H02) · Stack · Series map |
| 10 | Conclusion · Why we did it · Data · The starter (H03) · Size (R09a) · Screen: 10 changes (R09b) · Score path (RS1) · Every training family (RS2) · What each step bought (R09c) · Wave blk (RI1) · Longer training (R10d) · Memorization signal and late dropout (RS6) · What is next (RS7) · Tried, not used (표) |
| 11 | Conclusion · Why we did it · Data (판정 파일 14, run 137, GPU 시간) · Nine steps on the cluster (C01) · One job script run (C03) · The loop (M10) · Verdicts, written first (R10a) · How each run was measured (H46) |

- 11의 클러스터 글: "a university SLURM cluster"만 쓴다. 클러스터 이름, VPN 이름, 호스트 0 (§8).
- 아래 rev2 표는 기록이다 (SUPERSEDED 2026-10-28 rev3).

| 글 | Problem (한 줄 뜻) | Per-problem loop 절 (그림) | Structure · Parts · Fit |
| --- | --- | --- | --- |
| 01 | 잡음에서 이미지를 바로 만들 수 없다 | Two modes (T01) · Who adds the noise (T05) · How much image is left at t (T06) | 일정 표 t = 37, 250, 980 · 수식 x_t = √ᾱ x0 + √(1−ᾱ) ε · Fit: T = 1000 선형 일정은 과목이 고정 |
| 02 | 망이 무엇을 맞혀야 배우나 | One step through the network (T07) · How training lowers the error (T08) · The six lines (T09) · One batch, one t per image (Step 7 표, 그림 없음) | 학습 step mermaid · 손실 MSE · Fit: 학습 루프는 고정, 망만 우리 것 |
| 03 | 같은 픽셀 값이 t마다 다른 답을 요구한다 | Same pixel, three answers (T11) · From t to every pixel (T10) · One shared MLP (T12) · Near t and far t (T13) · Why each image needs its t (Step 8 표) | sin/cos → MLP → Block Linear · Fit: 공유 MLP 1개가 10M 상한 안에 든다 |
| 04 | 한 batch 128장이 서로 다른 t를 가진다 | Adding t inside a Block (T14) · The batch as a heat map (T15) · Three images, three noise levels (T16) | 모양 표 e (128, 128) → (128, C, 1, 1) · Fit: 호출 한 번에 잡음 수준 128개 |
| 05 | 작은 지도로 줄이면 세부가 사라진다 | One stage, step by step (T25) · Upsampling copies values (T30) · The skip makes pixels differ (T31) · u3 in 3D (T32) · The u3 flow (T33) · Activation (T34) | 단별 채널 표 56, 112, 224, 224 · Fit: 64×64 이미지, 단 4개 |
| 06 | 3×3 conv는 먼 픽셀에 한 번에 닿지 못한다 | Reach: conv vs attention (T23) · One pixel looks at all 64 (T17) · Shapes through the block (T26) · Values change, shape stays (T27) · What attention adds (T28) · The core as matrix products (T29) · Norm and 1×1 conv stay local (T21) · Four heads (T24) | 수식 softmax(QKᵀ/√224)V · Fit: 8×8 바닥에서만 써서 값이 64×64 = 4,096칸 |
| 07 | 손실이 0이 안 되는데 망이 틀렸나 | Two errors at three t (T35) · The errors as maps (T36) · Measured: noise error by noise level (R07a) | 두 오차 표 · Fit: v10136 실측 값 |
| 08 | 한 번의 호출로는 잡음을 다 못 뺀다 | 500 images at a time (T37) · Noise to image (T38) · One round of the sampler (T39) · Mean plus fresh noise (T40) · Inside one call (T41) · Batch after batch (T42) · What sampling costs (R08a) | Parts (그림 뒤, 수식은 표 뒤): "Where μ comes from" 식, "β, x_t, and the paper's x_(t−1)" 기호 표, "Why fresh noise" 한 줄 + 실제 숫자 예 하나 (§5.3) · 샘플러 코드 줄 (마지막) · Fit: 채점기가 250 step으로 고정 |
| 09 | 3.3M starter는 이미지 품질이 낮았다 (공개 FID 30.26) | The starter (T03) · Size (R09a) · Screen: 10 changes (R09b) · The final network (T04) · What each step bought (R09c) | 변경별 색 표 6행 (Z1) · Fit: 10M 상한 아래 9,832,523 |

측정 글:

| 글 | 절 |
| --- | --- |
| 00 | Conclusion (한 줄 굵게 + R00a) · Samples (R00b) · Why we did it · Data (parrots 10,000장 64×64, 생성 5,000장, 따로 둔 1,000장) · What was done (M00) · What helped (표) · By the numbers (R00c) · How the network grew (T02) · Stack · Series map |
| 10 | Conclusion · Why we did it · Data (판정 파일 14, run 137) · What was done: the loop (M10) · Verdicts (R10a) · Three scales agree (R10b) · No copying (R10c) · Longer training (R10d) · How each run was measured (T43) · Tried, not used (표) |

- 00 "What helped" 표: `rules/writing/tips-page.md` §2 3단계의 칸을 빌린다. What / Where / How / Why it helps. 효과가 큰 순서, 핵심 숫자만, seed 수 (`rules/writing/style.md` §5.2). 행 = 거르기 통과 변경과 조합. 숫자는 R09b, R10a 데이터에서.
- 10 "Tried, not used" 표: DiT (`verdicts_dit.json`), 거르기 탈락 4개 (`verdicts.json`), dropout 0.2 (`analysis/wave_1021.json`, 칸 확인). 줄마다 이유 한 줄. 블로그는 보고 문서라 지우지 않고 표 하나에 모은다 (`rules/writing/style.md` §5.2 표).
- 효과가 seed 흔들림보다 작으면 "effect"라고 쓰지 않는다 (§5.2).
- 00 Series map: 링크 `/@taeklim/<slug>`. 00만 링크를 가진다.

작가 AC 초안 (pm이 `dd.plan.md`에 옮긴다):

| # | 검사 |
| --- | --- |
| W1 | 개념 글의 `##` 절 순서가 위 뼈대와 같다. 측정 글은 측정 순서 |
| W2 | loop 절마다 그림 1장 다음에 "Why", "Mission", "Vision" 줄이 한 줄씩 |
| W3 | 그림 → 표 → 수식 → 코드 순서. 코드 블록이 그림 앞에 없다 |
| W4 | 캡션 2문장, 둘째 문장 "Why:". 이름표 줄은 "Illustrative values"와 "Abbreviations:"만. 캡션에 출처 0 (#138) |
| W5 | 약어 언급마다 풀이. 줄표 0, 세미콜론 0, 문장 15단어 이하 |
| W6 | 숫자마다 `figures.md` 행 (파일 + 칸). FID마다 척도 이름 |
| W7 | §5.1 "고칠 점"의 본문 줄(V1, V2, V14 등)이 있다 |
| W8 | 화자 표현 없음. "my runs"만 (#138) |
| W9 | 그림 안 run 이름(C3a, K1, B3, O, T …)마다 캡션 이름표 줄에 풀이 (rev3) |
| W10 | 어텐션 head: 최종 망 1. 4 head 그림(A14, F05)은 캡션에 "Illustrative values" + 본문 한 줄 (rev3) |
| W11 | 한국어 원본 글(U, A, F 페이지)의 내용은 영어로 새로 쓴다. 한국어 0 (rev3) |

### 6.4 숫자 규칙

| 숫자 | 원본 | 글에 쓰는 법 |
| --- | --- | --- |
| 공개 FID | `runs/LEADERBOARD.md` | "public FID (course grader, 5,000 samples)". 오너가 포털 화면에서 옮긴 값이라고 `figures.md`에 적는다 |
| FID@5k, FID@1k | `eval5k.json`, `marks.json`, `verdicts*.json` | 척도 이름을 매번 붙인다. 공개 FID와 섞어 비교하지 않는다 |
| 규칙 밖 업로드 | `LEADERBOARD.md` + `DECISIONS.md` D-051 | 회색, "outside the course rule". 머리 숫자로 쓰지 않는다 |
| 매개변수 | `manifest.json` `n_params` | 정확한 수. 제목은 3.3M, 9.8M |
| 일정 값 | `diffusion.py` 상수 | "(schedule)" |
| 그린 값 | tips 그림 | "Illustrative values" |
| GPU 시간 | `data/dd_scale.json` | 셈에서 뺀 폴더 수를 함께 쓴다 |
| 예산 460 GPU-h | 계획 줄 | 쓰지 않는다 |
| seed 수 | 판정 파일 `pairs` | 평균마다 seed 수를 쓴다 (`rules/writing/style.md` §5.2) |

### 6.5 폴더, 앞머리, 약어

```text
apps/blog_agent/posts/projects/utrgv/ddpm-from-scratch/     (posts/는 gitignore)
  00-overview/00-overview.md + 00-overview.png + figures.md + 그림 PNG
  01-why-diffusion-why-unet/ ...
  11-engineering-the-process/ ...                    (rev3 slug 12개: §6.2)
  x_01-how-diffusion-adds-noise/ … x_10-experiments-and-process/   (rev2 폴더, 오너가 지운다)
```

- 앞머리는 cnn 00을 복사한다: `title`, `tags`, `desc`, `date`, `priority` (= NN), `userId: 1`, `username: taeklim`, `status: 'public'`.
- 본문 첫 줄: `![NN-<slug> thumbnail](NN-<slug>.png)`.
- `figures.md` 형식: cnn 07 선례 (file · what it shows · key numbers (source) · takeaway). 공개하지 않는 파일이다.
- 뜻 풀이: §12 용어 부록 ([DDPM](#term-ddpm), [EMA](#term-ema), [MLP](#term-mlp), [SiLU](#term-silu), [ReLU](#term-relu), [GN](#term-gn), [AdaGN](#term-adagn), [DiT](#term-dit), [MSE](#term-mse), [GPU](#term-gpu)).
- 약어 (언급마다, 표와 그림 줄 포함): denoising diffusion probabilistic model (DDPM), Fréchet Inception Distance (FID), exponential moving average (EMA), multilayer perceptron (MLP), sigmoid linear unit (SiLU), rectified linear unit (ReLU), group normalization (GN), adaptive group normalization (AdaGN), mean squared error (MSE), graphics processing unit (GPU), standard deviation (SD), diffusion transformer (DiT), learning rate (LR).
- U-Net은 이름이다. 약어로 보지 않는다.

## 7. 카테고리와 발행

- 스키마 변경 0. 코드 변경 0. i18n 변경 0 (`utrgv` 그룹 라벨이 이미 있다).
- 발행 경로 = 카테고리 경로. blog_agent가 `(user_id, parent_id, title)`로 upsert한다 (`projects.design.md` §12.6, `recobell-series.design.md` §2.1 C).
- 그래서 `ddpm-from-scratch` 프로젝트 행은 첫 발행이 자동으로 만든다. SQL이 필요 없다.
- 함정: 경로가 `projects/utrgv/...`가 아니면 새 그룹 행이 생긴다. 발행 AC가 경로 prefix를 검사한다.
- MVP 사다리 적용 안 함. 새 스키마, API, 파이프라인이 없다.

### 7.1 순서 (main session)

```text
1 reviewer 1회 PASS (D9)              오너 폴더 확인 없음: PS식 미리 허락 (#137, #124)
2 사전 SELECT (읽기 전용)             P1–P3. 결과 deploy/projects/dd-pre-<date>.txt
3 발행 01 → 11, 그다음 00             경로 ./posts/projects/utrgv/ddpm-from-scratch/NN-<slug>/NN-<slug>.md
4 Cloudflare purge (웹 + blog-api)     _scripts/cloudflare/cf-purge.sh
5 확인 §7.2                           결과 deploy/projects/dd-prod-<date>.txt
6 루트 CLAUDE.md 그룹 트리             utrgv/ 아래 ddpm-from-scratch/ 한 줄 (저장소 사실 절, 오너 절 아님)
```

- 00을 마지막에 발행한다. Series map 링크 slug가 다 생긴 뒤다 (RS §7.1과 같은 이유).

| # | 확인 | 기대 |
| --- | --- | --- |
| P1 | `projects` 루트 자식 `title='utrgv'`, `deleted_at IS NULL` | 1행, priority 40. 없으면 멈춘다 (루트 `CLAUDE.md`의 PG-2-05 주의) |
| P2 | 사용자 전체 `title='ddpm-from-scratch'`, `deleted_at IS NULL` | 0행 |
| P3 | `utrgv`의 자식 | `cnn-from-scratch` 1행 |

- 되돌리기: 글과 프로젝트 행에 `deleted_at`. hard DELETE 0.

### 7.2 확인

| 확인 | 기대 | 방법 |
| --- | --- | --- |
| `/@taeklim/projects/ddpm-from-scratch` | 200, 글 12개, 순서 00 → 11 | curl + 화면 |
| `/@taeklim/projects` | `id="utrgv"` 구역에 카드 2개 (cnn, ddpm) | curl |
| 글 12개 `/@taeklim/<slug>` | 200, 썸네일, 이미지 수 = §6.2 글마다 PNG 수 (합 82), mermaid 그림 | curl + 오너 화면 |
| sitemap | 새 URL 12개 | `sitemap.xml` |
| 엣지 | 두 번째 GET `cf-cache-status: HIT` | curl 두 번 |
| 비밀 | 운영 HTML에 §8.3 0건 | grep |

## 8. 비밀과 개인 정보 제거 (redaction)

- 코드와 설계 공개는 허락됐다 (#137). 아래는 그래도 지운다.

### 8.1 찾은 것 (값은 적지 않는다)

| 종류 | 어디 | 처리 |
| --- | --- | --- |
| 개인 다운로드 URL과 토큰. 토큰은 base64로 학교 메일을 담는다 | `TA/assignment_03_r1/README.md` 5행 | 열지 않는다. 인용 금지 |
| 포털 화면 글 (제출 횟수, 개인 안내) | 같은 파일 4–9, 20–23행 | 인용 금지. 2, 14행의 데이터·채점 사실만 쓴다 |
| 다른 학생 자료 | `TA/assignment_01_r2_students/`, `TA/**/x_submitted_*` | 열지 않는다 |
| 클러스터 호스트, 노드, 파티션 이름 | `docs/STATUS.md`, `runs/submitted.txt`, `a03_cluster_tips.html` | 글에는 "a university SLURM cluster" + GPU 모델 이름만 |
| 과목 학습 이미지 (앵무새) | `train_images.npy` | 보이지 않는다 (Q-DD6). 생성 이미지만 |
| 메일 주소 | 위 토큰, git 설정 | 0건 |

### 8.2 자리 바꿈

| 원본 | 글 |
| --- | --- |
| 과목 포털 이름, 주소 | "the course grader" |
| 클러스터 이름, 노드 | "a university SLURM cluster" |
| job id, run 폴더 이름 | 쓰지 않는다. run은 "v10142" 같은 짧은 이름만 |
| GPU | 써도 된다: NVIDIA L40S, A100 |

### 8.3 원고 검사 grep

- reviewer가 원고 폴더와 `TA/blog_series/data/dd_*`에 한 번 돌린다. 0건이 통과다. 발행 뒤 운영 HTML에도 돌린다.
- 패턴은 자기 자신과 맞지 않게 썼다 (`[a]` 꼴). 그래서 이 문서에도 돌릴 수 있다.

```bash
rg -n --no-heading \
  -e 'dl[a]rena|azure[w]ebsites' \
  -e 'YTN[8]' \
  -e '/api/a[3]/data' \
  -e 'train_images[.]npy' \
  -e '(?i)utrgv[.]edu|taek[.]lim0' \
  -e '\b[0-9a-f]{32}\b' \
  -e 'assignment_0[0-9]_r[0-9]_studen[t]s|x_submitte[d]_' \
  -e '(?i)personal download lin[k]|submissions lef[t]' \
  -e 'utrgv_cluste[r]|\bgpu0[0-9]{2}\b|\bsxm00[0-9]\b|\bkim[q]\b|\bgpul40[q]\b' \
  -e '\b14[0-9]{4}(_[0-9]+)?\b' \
  -e '(?i)\bcradl[e]\b' \
  apps/blog_agent/posts/projects/utrgv/ddpm-from-scratch/
```

- 마지막 패턴은 SLURM job id(6자리, 14xxxx)다. run 폴더 이름이 그 꼴로 시작한다. 글에 폴더 이름을 쓰지 않으면 0건이다.
- `[0-9a-f]{32}`는 commit hash와도 맞을 수 있다. 맞은 줄마다 reviewer가 사유를 적는다.

### 8.4 점검표

| # | 점검 | 누가 |
| --- | --- | --- |
| R1 | README는 2, 14행만 읽는다 | 작가, developer |
| R2 | 학생 폴더를 열지 않는다 | 작가, developer |
| R3 | 썸네일과 그림 안 글자에 §8.3 항목이 없다 (눈으로) | reviewer |
| R4 | 결과 숫자마다 `figures.md` 행 | reviewer |
| R5 | 캡션 2문장, "Why:", 약어 줄 (`rules/figures.md` §3) | reviewer |
| R6 | 약어 언급마다 풀이, 줄표 0, 세미콜론 0 | reviewer (`rules/writing/style.md` §3 grep) |
| R7 | V1, V2, V14 본문 줄이 있다 | reviewer |

## 9. 열린 질문 (오너)

- 질문마다 기본값이 있다. 답이 없으면 기본값으로 간다. 오너 답은 main session이 D-row로 남긴다.

닫힘 (#137, 2026-10-28):

| # | 질문 | 답 |
| --- | --- | --- |
| Q-DD-a | 발행 문: PS식 미리 허락(#124) 또는 RS식 폴더 확인(#128) | PS식. reviewer 1회 뒤 발행 ("Ps? rs? dispatch.") |
| Q-DD-b | 과제 설계와 코드를 공개해도 되나 (TA 맥락) | 된다 ("this is totally ok"). §8 제거는 그대로 |

닫힘 (#138, 2026-10-28, rev2):

| # | 질문 | 답 |
| --- | --- | --- |
| Q-DD1 | 실제 생성 이미지가 로컬에 있나 | 있다 (main session `ls`): `runs/141768_v10000_base/grid_{1h,3h,6h}.png`, `runs/143716_v10142_p10136_t18h/grid_18h.png`. R00b에 쓴다 |
| Q-DD2 | 업로드별 규칙 상태 | 기본값: v10059, v10064, v10090, v10093 = `outside`, 나머지 `in`. `data/dd_rule_status.csv` (DD-1-02) |
| Q-DD3 | 래스터 길 | R1 헤드리스 브라우저, 로컬 1회 (DD-1-01 실행 1회만). R2 버림 |
| Q-DD4 | 연재 제목 | 기본값 "Diffusion From Scratch" |
| Q-DD5 | "from scratch" 표현 | 기본값 "trained from scratch (no pretrained weights). The network grew from the course starter U-Net." |
| Q-DD6 | 과목 학습 이미지 | 기본값: 보이지 않는다. 생성 이미지만 |
| Q-DD7 | 고정 시점 | 기본값 "as of 2026-10-27", v10142 6.10. 새 업로드가 있으면 00, 10만 고친다 (rev2 번호) |
| Q-DD8 | 과목 이름 | 기본값 "CS 6379 Deep Learning, UTRGV". 포털 이름과 주소는 쓰지 않는다 |
| Q-DD9 | §5.4 추가 그림 | 기본값: 이번 11개 글에는 쓰지 않는다 |
| 화자 | ~~[CLARIFICATION REQUIRED] 학생 또는 TA~~ <!-- SUPERSEDED 2026-10-28 #138 --> | 화자 표현 없음. "my runs"만 |
| 캡션 출처 | 캡션에 출처를 쓰나 | 쓰지 않는다. `figures.md`에만 (#125, #135 선례) |

열림 (rev3):

[CLARIFICATION REQUIRED] 원본 7쪽 고정 시점과 redraw 4장 / 필요한 정보: (a) 오너가 §4.6 "필수" 줄(U01, C03, RS1, RS2 영어화, F02와 H09의 "Figure N" 글자)을 고치는가, 아니면 그 그림을 이번에 빼는가. (b) 고친 뒤 "frozen"이라고 말해 줄 시점. 답 전 기본: R1은 기다린다. 인벤토리, 썸네일, 원고 초안은 먼저 간다 (파일 이름이 ID라 R1을 기다리지 않는다).

R1 범위 알림 (질문 아님, §4.2): main session이 R1 직전에 "1회, 7쪽, 캡처 67장"을 한 줄로 알린다. 거절이면 D-row.

열림 (rev2 항목, rev3에서 위 질문으로 대신함):

[CLARIFICATION REQUIRED] 원본 페이지 고정 시점 / 필요한 정보: 한국어 임시 블록(rev2 Figure 16–23, rev2.1 Figure 17–24. 고칠 목록 = §4.1 준비 판정 표)을 영어로 바꾸고 번호를 바로잡은 판이 언제 고정되나. R1 허락이 1회뿐이라 DD-1-01은 고정된 페이지에서 돌아야 한다. 지금 페이지는 §4.3 3단계(번호 순서)에서 멈춘다. 답 전 기본: DD-1-01은 기다린다. 다른 과제(DD-1-03 이후 결과 차트)는 먼저 간다.

## 10. 위험

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| 토큰 URL이나 메일이 원고에 들어간다 | 개인 정보 공개. 되돌릴 수 없다 | §8.3 grep을 원고, data, 운영 HTML에 각각. README는 2, 14행만 |
| tips 페이지가 다시 만들어져 그림 번호가 바뀐다 (rev2: 이미 두 번 일어났다) | 표 §5.1이 틀린다. R1 1회 허락을 날린다 | §4.3 1–3단계: commit 고정, 개수와 번호 검사에서 멈춤. §9 고정 시점 질문 |
| 한국어 단독 그림 4장(rev2.1: T17, T21, T23, T24)의 영어 판이 안 생긴다 | 06의 절 4개가 빈다 | 06은 영어 그림 4장(T26–T29)만으로도 선다. 빈 절은 빼고 `figures.md`에 이유 |
| SVG 안 "Step N" 글자가 남는다 | 블로그에 없는 Step을 가리킨다 | §4.3 4단계. reviewer R3 |
| 그린 타일을 실제 샘플로 읽는다 | 결과를 부풀린다 | illus 그림마다 "Illustrative values". 실제 샘플은 R00b뿐 |
| FID 척도를 섞는다 | 6.10과 12.53을 같은 수로 읽는다 | §3 척도 표. 숫자마다 척도 이름 |
| 규칙 밖 5.99를 머리에 쓴다 | 과장, 면접에서 반박 | 머리 = 6.10 (규칙 안 마지막 업로드). 5.99는 회색 |
| 작은 SVG 글자 (8–12px) | 모바일에서 못 읽는다 | 배율 2 래스터. 큰 그림(T03, T04, T07)은 데스크톱 기준. 확대 보기는 이 설계 밖 (#134 Rejected) |
| R1 브라우저를 두 번 돌린다 | 허락 밖 실행 (#138은 1회) | 2번째가 필요하면 오너에게 다시 묻는다 |
| 판정 파일 칸 이름 추정 | 차트가 틀린 칸을 읽는다 | "칸 확인" 표시 칸은 developer가 열어 `figures.md`에 적는다 |
| "from scratch" 과장 | 신뢰 손상 | Q-DD5 기본 문장 |
| 오너가 설계 도중에도 페이지를 고친다 (rev3: 어텐션 13 → 14 관찰) | 표 §5.1이 금방 낡는다 | 고정 ID + 해시 인벤토리 (§4.5). diff만 본다 |
| R1 캡처 67장이 `timeout 300`을 넘는다 | 일부만 나온다 | PNG마다 바로 쓴다. 멈추면 오너에게 다시 묻는다 (§4.2) |
| RS2 (2060px)를 1600px로 줄인다 | 글자를 못 읽는다 | §4.6: 오너가 나누거나 폭을 줄인다 |
| 4 head 그림을 최종 망으로 읽는다 | 사실 오류 | W10, §3 head 1 |
| 결과·업로드 그림 안 run 이름, job id | 비밀 규칙 위반 (§8.3 job id 패턴) | 인벤토리 `redact_hits` 칸. 0이 아니면 내보내지 않는다 |

## 11. 설계 단위 (pm용, 크기와 순서만)

rev3 단위 (아래 rev2 표를 대신한다):

| # | 단위 | 크기 | 선행 | 담당 (권고) |
| --- | --- | --- | --- | --- |
| E1 | `dd.plan.md` rev3 맞춤: 글 12개, G-DD1/2 수 (12, 90, 70), 단위 E1–E12, 작가 AC W1–W11 | S | 없음 | product-manager |
| E2 | `dd_tips_inventory.py` + `data/dd_tips_inventory.csv` + `data/dd_tips_diff.md` (§4.5). 첫 실행이 §5.1 ID를 받는다. 로컬 허용 | M | 없음 | developer |
| E3 | rev2 폴더 10개 `ls` 확인 → `x_` 이름 바꾸기 (§5.5) | S | 없음 | main session |
| E4 | `dd_thumbs.csv` 12행 (§5.5, 04행 317,856) + `fig_dd_thumbs.py` 다시 실행 (저장 csv만, 로컬 허용) | S | E3 | developer |
| E5 | `dd_export_tips_figs.py` rev3: 인벤토리 기반, 7쪽, `tips_<ID>.png`, PNG 3장 복사 (§4.3). 코드만, 실행 0 | M | E2 | developer |
| E6 | 오너 고침 + "frozen" (§4.6, §9) | 오너 | 없음 | 오너 (main session이 묻는다) |
| E7 | 인벤토리 다시 실행, diff 0 확인, R1 범위 한 줄 알림, R1 1회 (§4.2) | S | E5, E6 | main session (developer가 쓴 명령) |
| E8 | 원고 00–11 + `figures.md`. 글마다 한 단위. 00, 02, 05, 07, 08, 10 = M, 나머지 S. 이미지 이름은 ID라 E7 전에 시작 가능 | S × 6 + M × 6 | E1, E2, E4 | sonnet-writer |
| E9 | reviewer 1회: §8.3 grep, R1–R7, W1–W11, 숫자 대 파일, 이미지 82장 존재 | M | E7, E8 | reviewer |
| E10 | 사전 SELECT, 발행 01 → 11, 00, purge, 확인 (§7) | S | E9 PASS | main session |
| E11 | 루트 `CLAUDE.md` 그룹 트리 한 줄 | S | E10 | main session |
| E12 | (조건부) 오너 갱신마다 E2 다시 실행, diff의 NEW / GONE 행만 architect가 §5.1에 반영 | S | E2 | developer → architect |

```text
E1 ─┐
E2 ─┼─► E5 ─────────────┐
E3 ─► E4 ───────────────┼─► E8 (원고) ─┐
E6 (오너) ──────────────┴─► E7 (R1) ───┴─► E9 ─► E10 ─► E11
```

- 이미 끝난 것: 결과 차트 12장 (rev2 D6), `dd_scale.json` (D5). 다시 하지 않는다.
- gate 검토는 E9 한 번이다 (#124 선례).

rev2 단위 (기록):

| # | 단위 | 크기 | 선행 | 담당 (권고) |
| --- | --- | --- | --- | --- |
| D1 | 오너 답 Q-DD1–9, D-row. **끝남 (#137, #138)**. 남은 것: 페이지 고정 시점 (§9) | S | 없음 | main session |
| D2 | `dd.plan.md` rev2 맞춤: 글 11개, G-DD1/2 수, 그림 나누기, 작가 AC W1–W8 | S | D1 | product-manager |
| D3 | 렌더러 확인 (목록 보기). grid는 끝남 (#138) | S | D1 | main session |
| D4 | `dd_export_tips_figs.py`: 그림 SVG 판정 (rev2.1 = 43개) → PNG (rev2.1 = 39장), `dd_tips_source.json`, `dd_extras.csv` | M | D3, 페이지 고정 | developer |
| D5 | `extract_dd_scale.py` + 결과 데이터 `data/dd_*.json`, `dd_rule_status.csv`. **끝남 (DD-1-02)** | M | D1 (Q-DD2) | developer |
| D6 | 결과 차트 `fig_dd_*.py` 12장 (R00b는 D3 결과에 따름) | M | D5 | developer |
| D7 | `fig_dd_thumbs.py` + 썸네일 11장 | S | D6 | developer |
| D8 | 원고 00–10 + `figures.md`. 글마다 한 단위. 00, 05, 06, 08, 09, 10 = M, 나머지 S (rev2) | S × 5 + M × 6 | D4, D6, D7 | sonnet-writer |
| D9 | reviewer 1회: §8.3 grep, R1–R7, 숫자 대 파일, 그림 규칙 | M | D8 | reviewer |
| D10 | 사전 SELECT, 발행, purge, 확인 (§7) | S | D9 PASS | main session |
| D11 | 루트 `CLAUDE.md` 그룹 트리 한 줄 | S | D10 | main session |

- D4와 D5는 병렬로 할 수 있다. 모든 스크립트는 `OMP_NUM_THREADS=1 timeout 300 uv run python ...`.
- 원고 작가는 원본 실행(학습, 추론, 노트북)을 하지 않는다 (`~/.claude/CLAUDE.md` "No local execution").
- gate 검토는 D9 한 번이다 (#124 선례). 과제별 검토 행은 두지 않는다.

## 12. 용어 부록 (terms appendix)

- <a id="term-ddpm"></a>잡음 제거 확산 확률 모델(denoising diffusion probabilistic model, DDPM): 이미지에 잡음을 조금씩 넣고, 망이 그 잡음을 빼도록 배우는 생성 모델.
- <a id="term-fid"></a>프레셰 인셉션 거리(Fréchet Inception Distance, FID): 생성 이미지와 실제 이미지의 특징 분포 거리. 낮을수록 좋다.
- <a id="term-fid-scale"></a>FID@1k, FID@5k: 생성 1,000장 또는 5,000장으로 잰 우리 쪽 FID. 공개 FID와 척도가 다르다.
- <a id="term-ema"></a>지수 이동 평균(exponential moving average, EMA): 학습 중 가중치의 느린 평균. 제출 가중치다.
- <a id="term-mlp"></a>다층 퍼셉트론(multilayer perceptron, MLP): 완전 연결 층을 쌓은 작은 망. 여기서는 t를 숫자 벡터로 바꾼다.
- <a id="term-silu"></a>시그모이드 선형 단위(sigmoid linear unit, SiLU): x × sigmoid(x) 활성 함수. 꺾인 점이 없다.
- <a id="term-relu"></a>정류 선형 단위(rectified linear unit, ReLU): max(0, x) 활성 함수.
- <a id="term-gn"></a>그룹 정규화(group normalization, GN): 채널을 묶어 평균과 분산으로 맞춘다.
- <a id="term-adagn"></a>적응 그룹 정규화(adaptive group normalization, AdaGN): t로 GN의 크기와 이동을 바꾸는 GN.
- <a id="term-dit"></a>확산 트랜스포머(diffusion transformer, DiT): U-Net 대신 트랜스포머를 쓰는 확산 망.
- <a id="term-mse"></a>평균 제곱 오차(mean squared error, MSE): 차이 제곱의 평균. 학습 손실이다.
- <a id="term-svg"></a>확장 가능 벡터 그래픽(scalable vector graphics, SVG): 도형을 글자로 적은 그림 형식.
- <a id="term-raster"></a>래스터(raster): 벡터 그림을 픽셀 그림(PNG)으로 바꾸는 일.
- <a id="term-delta"></a>판정 폭(δ): 짝 비교의 평균 차 m이 넘어야 하는 선. 여기서는 1.5626.
- <a id="term-spearman"></a>스피어만 순위 상관(Spearman rank correlation): 두 측정의 순위가 얼마나 같은지. 1이면 같다.
- <a id="term-memo"></a>외움(memorization): 생성 이미지가 학습 이미지를 베끼는 일. 최근접 거리로 잰다.
- <a id="term-screen"></a>거르기(screen): 변경 하나를 짧게(3h) 돌려 판정선을 넘는지 보는 단계.
- <a id="term-gpu"></a>그래픽 처리 장치(graphics processing unit, GPU): 학습과 샘플링을 돌린 계산 장치.
