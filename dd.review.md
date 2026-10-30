# DD-2-12 관문 검토: 확산 모델(denoising diffusion probabilistic model, DDPM) 연재 12편

- 검토자: `reviewer` 에이전트, 2026-10-28.
- 대상: `apps/blog_agent/posts/projects/utrgv/ddpm-from-scratch/{00..11}-*/` (`.md`, `figures.md`, PNG).
- Read 도구로 읽은 규칙: `rules/writing/style.md`, `rules/figures.md`, `rules/visualization.md`, `ddpm-series.design.md` §4.7, §6.2, §6.3, §8, `decisions.plan.md` #137–#141, 메모리 `blog-series-chart-first`.
- 실행한 것 없음. Python 0, 빌드 0. 쓴 도구는 grep, rg, jq, awk, Read(PNG)뿐이다.
- 열지 않은 것: 학생 자료, `x_submitted_*`, `assignment_03_r1/README.md`.
- 경로 약자: `D` = 글 폴더, `BS` = `~/Documents/mscs_utrgv/ta_cs6379_deep_learning/blog_series`, `A3` = `.../assignment_03_r1`.

## 판정

**ISSUE.**

- 04 글이 W2 한 줄 꼴을 따르지 않는다 (세 줄 목록 18건, 한 줄 꼴 0건). 이것 하나로 ISSUE다.
- 글 폴더에 PNG 6장이 없다. `BS/out_dd/`에는 있다 (DD-1-05 미완).
- 재작도 4장(U01, RS1, RS2, C03)은 오너 대기다. 01과 10은 대체 수단을 아직 쓰지 않았다. 11은 썼다.
- 숫자 대조는 모두 맞았다. 비밀 grep은 글 폴더 0건이다. 데이터 파일 1개에 3건이 있다.

## 지적 표

심각도: high = 발행 불가, med = 발행 전 고침, low = 고치면 좋음.
고칠 길: writer = `sonnet-writer` 글 또는 `figures.md` 수정, developer = 스크립트나 데이터, owner = 오너 재작도 또는 결정, main = main session 또는 pm 문서 수정.

| # | 글 | 항목 | 심각도 | 근거 | 고칠 길 |
| --- | --- | --- | --- | --- | --- |
| 1 | 04 | W2 위반. loop 6절이 모두 `- Why:` 세 줄 목록이다. 한 줄 꼴 0건 | high | `D/04-*/04-time-inside-the-unet.md` 본문 30–32, 42–44, 54–56, 66–68, 78–80, 90–92행. `grep -cE '^- (Why\|Mission\|Vision):'` = 18 | writer |
| 2 | 00, 10 | md가 참조하는 PNG가 폴더에 없다. `BS/out_dd/`에는 있다 | high | 00: `tips_RS3.png`, `tips_H02.png`. 10: `tips_H03.png`, `tips_RI1.png`, `tips_RS6.png`, `tips_RS7.png`. `ls BS/out_dd` 6장 모두 존재 | main (DD-1-05 복사) |
| 3 | 01, 10 | 재작도 미도착인데 대체 수단을 쓰지 않았다. 01은 U01, 10은 RS1, RS2를 참조하고 파일이 없다. 행 AC의 대체(01 그림 2장, 10 Markdown 표 + `figures.md` 이유)는 안 썼다. 11은 C03 절을 빼고 이유를 적었다. 11은 통과다. 알려진 문제, 오너 답 대기 (계획 240행) | high | `D/01-*/*.md` 본문 55행. `D/10-*/*.md` 본문 74, 86행. `D/11-*/figures.md` 446, 452행 | owner (Q-DD12) → writer (대체 적용 또는 그림 삽입) |
| 4 | 04 | 문장 길이. "Mission: the mean difference per number is 0.076 for 250 and 251, and 0.713 for 250 and 980" 18단어 | low | `D/04-*/*.md` 본문 55행 | writer (1번과 함께) |
| 5 | 07, 09 | 샘플러 기호 불일치. 07은 점프 분산을 `β`로, 09는 `β′`로 쓴다 | med | `D/07-*/*.md` 본문 122, 134행 "β = 1 − ā_t / ā_t′". `D/09-*/*.md` 본문 104행 "β′ = 1 − ā_t / ā_t′". 07은 σ를 쓰고 σ²를 정의하지 않는다 (본문 59, 157행). 09는 σ²를 정의한다 (105행). μ는 둘이 같다. `β′`가 일정의 `β_t`와 겹치지 않아 낫다 | writer (07) |
| 6 | 10 | RS7 그림 안 run 이름이 풀이되지 않았다 (W9). 그림에 `attn32`, `drop2late`, `w64h4`, `hold1k`가 있다. 이름표 줄은 FID@5k만 푼다. `w64h4 12 h, over the 10M cap, record-only, mean 12.14`는 본문에 없다 | med | `BS/out_dd/tips_RS7.png` (Read로 봄). `D/10-*/*.md` 본문 163행 | writer + owner (RS7 글, 상한 밖 run을 그림에 둘지) |
| 7 | 00 | RS3 그림 안 run 이름 미풀이 (W9). 그림에 `lvl4`, `attn8`, `tdim256`, `attn16`, `w96`, `rb2`, `t12h`, `floor`, `sanity`, `SD3h`, `FID@1k`가 있다. 이름표 줄은 "C"만 푼다. 캡션 "in six steps"인데 상자는 9개다 | med | `BS/out_dd/tips_RS3.png` (Read로 봄). `D/00-*/*.md` 본문 49, 51행 | writer |
| 8 | 10 | RS6에 범례가 없다. 검정, 파랑, 주황, 실선, 점선의 뜻이 글에 없다. 이름표 줄 "B3, T, O as under the score path chart"인데 RS1 이름표 줄에 T와 O가 없다 | med | `BS/out_dd/tips_RS6.png` (Read로 봄). `D/10-*/*.md` 본문 78, 149행 | writer (출처는 `TA/tips/a03/a03_results_tips.html` "Memorization signal" 절) |
| 9 | 데이터 | 설계 §8.3 grep이 `BS/data/dd_*`에서 3건 맞았다. job id 꼴(`14xxxx`) 패턴. RI2, RI4, RI3 행의 출처 경로에 run 폴더 id가 있다. G-DD3 measure는 0건이다 | med | `BS/data/dd_tips_inventory.csv` 86–88행. 맞은 값 141768, 141836, 141766 | developer (csv 출처 칸에서 폴더 id 제거) |
| 10 | 11 | C01 그림 안 글자 "Connect VPN", "ssh to the login node", "off campus only". 행 AC "VPN, 호스트 0". 이름은 없고 일반 단어뿐이다 | med | `D/11-*/tips_C01.png` (Read로 봄). `dd.plan.md` 208행 | owner (일반 단어 허용 또는 재작도) |
| 11 | 11 | H46 그림 안 "you add it", "notebook Step 5". 수강생 화자 글자. 본문은 Step 5만 설명한다 | med | `D/11-*/tips_H46.png` (Read로 봄). `D/11-*/*.md` 본문 85행 | owner (H09, H11과 같은 묶음) |
| 12 | 00 | 1인칭 문장. "I changed only the network", "a rule that I wrote", "I do not count it". #138은 "my runs"만 허용한다 | med | `D/00-*/*.md` 본문 13, 32, 33행. 08 본문 14행 "my networks", 173행 "My runs" | main (#138 해석) → writer |
| 13 | 01 | W3 위반. 코드 블록이 U01 그림보다 앞에 있다 | med | `D/01-*/*.md` 본문 47–49행 코드, 55행 그림 | writer |
| 14 | 05 | 이름표 줄에 W4 밖 문장. "Step numbers inside the drawing label its own panels/rows" | low | `D/05-*/*.md` 본문 42, 78, 98행. 그림 안 Step 1–5는 자기 패널 번호다 (A09, A04, H49 Read로 확인). 메모가 필요 없다 | writer (문장 삭제) |
| 15 | 02, 06, 09 | 이름표 줄 "Figure numbers inside the drawing refer to the original course page"는 설계 §4.7이 요구한다. W4는 이름표 줄에 두 종류만 허용한다. 규칙 둘이 어긋난다 | low | `dd.plan.md` 150행 W4. 설계 §4.7 379–380행 | main (pm이 W4에 §4.7 메모를 예외로 적는다) |
| 16 | 06 | H47 바닥 글 "the full-flow figure of the Attention page". `figures.md`는 이름표 줄 메모를 더했다고 적었으나 글에는 없다 | low | `D/06-*/tips_H47.png` (Read로 봄). `D/06-*/figures.md` 36행. `D/06-*/*.md` 본문 77행 "Illustrative values."만 | writer (메모 추가 또는 `figures.md` 정정) |
| 17 | 11 | `figures.md`의 R10a 메모가 낡았다. "chart label reads 'same as C3a with base width 56'". PNG는 이미 "C3b: C with 2 residual blocks, base width 56"이다 | low | `D/11-*/figures.md` 454행. `D/11-*/fig_dd_10_verdicts.png` (Read로 봄). `BS` 사본과 `cmp` 동일 | writer (`figures.md`만) |
| 18 | 07 | 0.0121, 0.9766, ε̂ +1.095, μ +1.254의 출처가 "tips unet page Table 11"이다. 손으로 쓴 표다. `dd_schedule.json`에 t = 497, 501 `abar`가 있다 | low | `D/07-*/figures.md` 139–143행. `BS/data/dd_schedule.json` `rows[t=497]`, `rows[t=501]`, `sampler_jump` | writer (`figures.md`에 json 행 + 산수로 바꾼다) |
| 19 | 05 | "dividing by √d keeps scores steady as d grows"에 출처가 없다. 근거 없는 전제다 (`style.md` §2) | low | `D/05-*/*.md` 본문 115행. `D/05-*/figures.md` 395행 | writer ("may"를 넣거나 줄을 뺀다) |
| 20 | 03, 07 | 캡션 첫 문장 16단어. 03 "A down stage (d2), the bottom (d4 to mid), an up stage (u2) and one Block". 07 "Five calls, each as x in, the mean μ, and x out (μ + σ z)" | low | `D/03-*/*.md` 본문 51행. `D/07-*/*.md` 본문 59행 | writer |
| 21 | 02, 03 | W2 한 줄에 문장이 셋을 넘는다. #141은 "세 문장"이다. grep은 통과한다 | low | 02 본문 33, 44, 53, 63, 77, 97, 110행. 03 본문 56, 75, 84, 101행 | main (세 문장이 상한인지 pm이 정한다) → writer |
| 22 | 00–05, 07–09 | 앞머리 `desc`가 15단어를 넘는다. 00 21, 01 17, 02 23, 03 19, 04 21, 05 22, 07 22, 08 25, 09 26단어 | low | 각 글 `desc:` 줄 | main (앞머리 예외 여부) → writer |
| 23 | 00 | "SLURM"이 풀이 없이 나온다. 11은 풀어 쓴다 | low | `D/00-*/*.md` 본문 98행 Stack 표 | writer |
| 24 | 00, 10 | 용어 흔들림. 00 70행 "Fréchet Inception Distance (FID@5k)". 10 154행 "On 5,000 samples (FID@5k) the Fréchet Inception Distance". 다른 곳은 "Fréchet Inception Distance on 5,000 samples (FID@5k)". 00 56행 "base network", 다른 곳 "starter". 08 "held-out", 10 "holdout" | low | 해당 행 | writer |
| 25 | 08 | RS5 그림 안 43.9, 20.9는 seed 3개 평균이다. 글의 RI3 21.16은 seed 0 하나다. `figures.md`에 출처가 없다 | low | `D/08-*/tips_RS5.png` (Read로 봄). `TA/tips/a03/a03_results_tips.html` 188행 "C 6h mean FID@1k 20.93 n = 3 seeds". `D/08-*/figures.md` 216행 | writer (`figures.md` 출처 + 이름표 줄 "3-seed mean") |
| 26 | 10 | RI1, H03 그림 안 약자 미풀이. RI1 `s0`, `s1`, `B arms`, `val_log`. H03 `tdim` | low | `BS/out_dd/tips_RI1.png`, `tips_H03.png` (Read로 봄). `D/10-*/*.md` 본문 40, 118행 | writer |
| 27 | 08 | E01–E04는 표 안 아이콘 4개가 캡션 하나를 나눈다. 행 AC대로다. 아이콘 원본은 2000×800이다. 표 칸 렌더링은 여기서 못 본다 | low | `D/08-*/*.md` 본문 66–73행. `file tips_E01.png` | main (M3 발행 뒤 눈으로 확인) |
| 28 | 계획 | DD-2-06 행이 rev3 그림(A11, 절 7개)을 적는다. 글은 rev3.1(A20, 절 8개)을 따른다. 그림 합도 어긋난다. 계획 83, S1 84, 설계 82, 실제 md 참조 85 (yes 70 + 재작도 3 + 차트 12) | low | `dd.plan.md` 190–191, 226행. 설계 §4.7, §6.2 | main (pm 문서 정정) |
| 29 | 계획 | DD-2-12 AC 선행이 안 닫혔다. DD-2-00…11 `[ ]`, DD-1-05 `[ ]`. M1 exit 미닫힘. 관문이 exit 전에 열렸다 | med | `dd.plan.md` 71, 169–207, 227행 | main (H1, pm) |
| 30 | 08 | R10c 가족 이름 풀이가 부분이다. "C2 to C9 = later variants of C". 11 본문 66행은 C2–C9를 하나씩 푼다 | low | `D/08-*/*.md` 본문 133행 | writer (11의 풀이를 08에 복사) |

## 알려진 문제 분류

| 그림 | PNG 안 글자 | 캡션으로 되나 | 판정 |
| --- | --- | --- | --- |
| H09 제목 "(your part)" | 수강생 화자 | 캡션 메모로는 글자가 남는다 | 오너 결정. (a) 02 이름표 줄 메모, (b) 재작도 + R1 2회째 |
| H09 범례 "Step →" (번호 없음) | 링크 안내 글자. "click one to open its step" | #140이 캡션 메모로 정했다. 메모는 02 본문 71행에 있다 | 닫힘 (캡션) |
| H09 범례 "Figure 27" | 옛 번호 | 02 본문 71행 메모가 덮는다 | 닫힘 (캡션) |
| H11 "the network (yours)" | 수강생 화자 | 글자가 남는다 | 오너 결정 (H09와 같은 묶음) |
| H46 "you add it" | 수강생 화자 | 새로 찾음. 글자가 남는다 | 오너 결정 (같은 묶음) |
| H47 바닥 "the full-flow figure of the Attention page" | 원본 페이지 참조 | 메모 한 줄로 된다. 글에 아직 없다 | writer (지적 16) |
| A09, A04, H49 "Step N" | 그림 자기 패널 번호 | 메모가 필요 없다 | writer가 메모 문장을 지운다 (지적 14) |
| C01 "Connect VPN", "ssh to the login node" | 일반 단어, 이름 없음 | 캡션으로 지울 수 없다 | 오너 결정 (지적 10) |
| F02 "(Figure 7)", "(Figure 4)" | 옛 번호 | 09 본문 45행 메모 + "post 2", "post 3" 대응 | 닫힘 (캡션) |
| F01 "Steps 2, 3, 8, 9" | 원본 페이지 번호 | 09 본문 33행 메모 | 닫힘 (캡션) |
| A19 "Figure 4, step 2" | 원본 페이지 번호 | 06 본문 59행 메모 | 닫힘 (캡션) |
| 04 `desc` 21단어 | | 글 고침 | writer (지적 22) |
| 04 H12 exact, H17 illus | 설계 §5.1과 같다 | 맞다. H12는 t = 243 실제 값, H17은 batch t가 예시다 | 통과 |
| 05 √d 문장 | 출처 없음 | "may" 또는 삭제 | writer (지적 19) |
| 07 0.0121, 0.9766 | json 키 없음 | `figures.md` 출처를 json 행 + 산수로 | writer (지적 18) |
| 08 R10c 가족 이름 | "C2 to C9 = later variants of C" | 11 본문 66행의 풀이를 그대로 쓰면 된다 | writer (지적 30) |
| 08 E01–E04 캡션 하나 | 행 AC대로 | 통과. 렌더링은 M3에서 본다 | 지적 27 |
| 08 RS5 43.9, 20.9 | 출처 없음 | `figures.md`에 결과판 kpi, 이름표 줄 "3-seed mean" | writer (지적 25) |
| 10 RS7 글 | 오너 대기 | 그림에 숫자가 있어 "planned"는 필요 없다. run 이름 풀이는 필요하다 | 오너 + writer (지적 6) |
| 10 본문 119 / 120 | | 통과. 더하는 줄은 기존 이름표 줄에만 넣는다 | 통과 |
| DD-2-06 행 A11 | 계획 낡음 | pm 정정 | 지적 28 |
| R10a 라벨, R09b 이름 | 오늘 고침 | PNG가 새 라벨이다. `BS` 사본과 동일. R09b 10개 이름은 manifest `change`에서 왔다. `prereg_c3.md` §1.1의 rb2 −22.97, lvl4 −22.42, attn8 −3.00과 일치한다. 나머지 7개는 prereg §1 표에 없다 (단일 변경 run) | 통과. `figures.md` 11 메모만 낡음 (지적 17) |

## 숫자 대조 (글마다 3개 이상, jq 또는 grep)

| 글 | 대조한 숫자 | 원본 파일 + 칸 | 결과 |
| --- | --- | --- | --- |
| 00 | 30.26, 6.10, 7.11, 5.99 | `A3/runs/LEADERBOARD.md` 9, 20, 11, 16행 | 일치 |
| 00 | 3,320,387, 9,832,523 | 두 `manifest.json` `n_params` | 일치 |
| 00 | −1.31, 0.655, 6 pass 4 fail | `A3/analysis/verdicts.json` `entries[].threshold` −1.3091, `sd` 0.6546, `verdict` | 일치 |
| 00 | −22.99, 6,997,315, −3.66, −3.46, 8,494,403, 1.56, −0.21 mixed | `verdicts_comb.json`, `verdicts_c3b.json`, `verdicts_c3a.json` `m`, `pairs[0].c_n_params`, `delta`. `verdicts_waves.json` `a18.m`, `.label` | 일치 |
| 00 | 154, 137, 17, 879.5, 14, 12 | `BS/data/dd_scale.json` | 일치 |
| 01 | 3,320,387, 9,832,523, `F.mse_loss(out, eps)` | 두 manifest, `A3/code/diffusion.py` 150행 (`out.float()` 줄임) | 일치 |
| 02 | 0.722, 0.692 (t 250), 0.057, 0.998 (t 750), 0.133 (t 37), T 1000, 1e-4, 0.02, BATCH 128 | `BS/data/dd_schedule.json` `rows[]`, `diffusion.py` 16–17, 22행 | 일치 |
| 02 | β, ā 표 6행 | `dd_schedule.json` `rows[]` t = 0, 100, 250, 500, 750, 999 | 일치 (3자리 반올림) |
| 03 | 16 Blocks, 56/112/224/224, attn_res [8, 32], dropout 0.1, base 56 | `dd_time_params.json`, 최종 manifest `arch` | 일치 |
| 04 | 33,024, 317,856, 10,360,907, 16, tdim 128 | `dd_time_params.json`, manifest `arch.tdim` | 일치 |
| 05 | 50,848, 202,048, head 1, 4,096, 1,048,576, 112/224 | `dd_time_params.json` `attention_params`, `heads`, `attention_blocks` | 일치 |
| 06 | 224, 672, head 1, 202,048, 50,848 | 같은 파일 | 일치 |
| 07 | 284.5, 642.3, 5000, NVIDIA L40S | 두 `eval5k.json` `seeds.0.sample_s`, `.n`, `gpu` | 일치 |
| 07 | bs 500, linspace 순서, clamp, mean 식, β 0.0396 | `diffusion.py` 35, 38, 46–49행. `dd_schedule.json` `sampler_jump.beta_prime` 0.039598 | 일치 |
| 08 | 0.0807, 0.0136, 0.00285, 0.000209, 72점, 512, 4구간 | `A3/runs/143621_v10136_*/val_log.json` `points[-1].ema.hold_by_bin`, `n_hold`, `t_bins` | 일치 |
| 08 | 21.16, 42.51, 0.90 n 9, −3.93, 0.80, 8, 74, 30 above 0.01, max 0.02 | `marks.json` 두 run, `eval5k.json` `groups.6h`, `portal_fit.json`, `memorization.json` `summary.per_run_last_mark` | 일치 |
| 09 | lr 2e-4, warmup 1000, clip 1.0, EMA 0.999, 0.722/0.692 | `diffusion.py` 23–26행, `dd_schedule.json` | 일치 |
| 10 | 40.60, 16.68, 13.38, 13.07, 12.99, 12.62, 12.38 | 6개 run `eval5k.json` `fid5k_hold1k_mean` | 일치 |
| 10 | −22.97, −22.42, −1.49, −0.63, +0.20, +0.82, +1.40, −0.14 | `verdicts.json` `entries[].delta`, `verdicts_c4.json` `m` | 일치 |
| 10 | +0.635, +0.126, −0.226, 0.0008, −0.00005, 0.00162 | `blk_progress.json` `labels`, `ema_hold_d_last2h`, `ema_gap_6h` | 일치 |
| 10 | −0.187 mixed, −0.21, −0.003 flat, +0.71 loss, 0.2149, +9.41 harmful | `b3_12h.json` `compare["b3x (b)"]`, `verdicts_waves.json`, `summary_c10.json` `lambda5k`, `verdicts_dit.json` | 일치 |
| 11 | 879.5, 3,166,174.5, 154, 137, 14, 12 | `dd_scale.json` | 일치 |
| 11 | δ 1.5626, m −3.46, t −9.05, effect, 48,550, 51.69 | `verdicts_c3a.json`, `A3/runs/141768_v10000_base/manifest.json` `marks[0]` | 일치 |
| 11 | 규칙 줄, commit 선행, slurm 주석 | `A3/docs/design.md` 323, 328, 343행. `prereg_c3.md` 5행. `cluster/a3_array.slurm` 2, 9행 | 일치 |

## 공통 AC 판정

| AC | 판정 | 근거 |
| --- | --- | --- |
| C1 파일, 폴더 이름 | PASS | 12 폴더 = 설계 §6.2 rev3 |
| C2 앞머리 키 | PASS | 12편 모두 `title`, `desc`, `date`, `priority`, `userId`, `username`, `status` |
| C3 제목 | PASS | 15단어 이하. 약어 풀이 있음. 00 "Public"이 설계와 다르나 뜻은 같다 |
| C4 첫 줄 썸네일 | PASS | 12편 |
| C5 그림 집합 | ISSUE | 지적 2, 3. 나머지 9편은 md = 폴더 = `figures.md` |
| C6 캡션 2문장 + Why: | PASS | 이미지 다음 줄 93개 (굵은 문구 줄 12개 포함) + mermaid 캡션 2개. 정규식 불일치는 모두 소수점 때문이다 |
| C7 약어 | ISSUE (low) | 지적 23. 다른 12편 0건 |
| C8 숫자 출처 | PASS (low 2) | 위 표. 지적 18, 25 |
| C9 영어, 줄표, 세미콜론, 15단어 | ISSUE (low) | 한국어 0, 줄표 0, 세미콜론 0. 15단어 초과 4문장 (지적 4, 20) |
| C10 비밀 grep | ISSUE (med) | 글 폴더 0건. `BS/data/dd_tips_inventory.csv` 3건 (지적 9) |
| C11 기본 문구 | ISSUE (med) | 문구 12편 있음. 1인칭 문장 (지적 12) |
| C12 링크 | PASS | 00만 11개. 01–11 0개 |
| C13 줄 수 | PASS | 00 74/95, 01 48/64, 02 97/109, 03 77/96, 04 65/83, 05 68/104, 06 83/110, 07 105/109, 08 102/129, 09 75/85, 10 119/120, 11 62/77 |
| C15 `figures.md` | PASS (low 2) | 12편 있음. 지적 16, 17 |
| W1 절 순서 | PASS | 12편 설계 §6.3 rev3 순서. 06은 rev3.1 |
| W2 한 줄 loop | ISSUE | 04 (지적 1). 나머지: 01 3, 02 9, 03 7, 05 8, 06 8, 07 8, 08 9, 09 5 |
| W3 그림 → 표 → 수식 → 코드 | ISSUE (med) | 01 (지적 13) |
| W4 캡션, 이름표 줄 | ISSUE (low) | 지적 14, 15 |
| W5 약어, 줄표, 세미콜론, 15단어 | C7, C9와 같다 | |
| W6 숫자마다 행, FID 척도 | PASS | FID 언급마다 척도 이름 있음 |
| W7 고칠 점 본문 줄 | PASS | V1 08 38행, V2 07 172행, V14 07 85행, V22 11 85행, H36 ReLU 03 101행 |
| W8 화자 | ISSUE (med) | 지적 12 |
| W9 run 이름 풀이 | ISSUE (med) | 지적 6, 7, 8, 26 |
| W10 head 1 | PASS | A14, F05 "Illustrative values" + 본문 한 줄. manifest `arch.heads` 1 |
| W11 한국어 0 | PASS | 글 12편, `figures.md` 12편 0건 |
| 설계 §8.4 R1–R7 | R3 ISSUE (지적 10, 11), 나머지 PASS | R1, R2 writer 보고에 있음 |
| `rules/figures.md` §7 차트 12장 | PASS | 범례 축 위, 겹침 없음, 단위 있음. Read로 본 것: R00a, R00c, R09b, R10a, R10c. 나머지 7장은 writer 진술 |
| 미션 적합 (#79) | PASS | 00 Conclusion 굵은 줄 + R00a + 썸네일 "30.26 → 6.10, grade A". 규모는 R00c |

PNG 열람 범위: Read로 본 PNG = H09, H11, H47, A09, H49, C01, A14, A19, F01, F02, E05, RS5, H46, RS7, RS3, H02, RS6, RI1, H03, R00a, R00c, R09b, R10a, R10c, 썸네일 00, 01, 05, 08, 10, 11. 나머지 58장은 writer 진술에 기댄다.

## 사다리 검사 (L1–L4)

적용 안 함. 계획 미션 블록 마지막 줄. 새 스키마, API, 파이프라인 없음.

## 계층 검사 (H1, H2)

- H1: ISSUE. 미션 블록 있음, M1–M3 `cycle 0/2; recovery 0/2` 있음, `budget:` 없음. G-DD1–3은 DRAFT, 오너 승인 대기다. DD-2-12 AC 선행(DD-2-00…11, DD-1-05, M1 exit)이 안 닫혔다 (지적 29). 그림 합이 문서마다 다르다 (지적 28). 경로: `product-manager`.
- H2: PASS. #137–#141이 있다. Why 칸이 미션 블록 줄을 가리킨다. R10a 라벨 고침은 선택이 아니라 수정이라 행이 필요 없다.

## 오너 결정 목록

1. Q-DD12. U01, RS1, RS2, C03을 영어로 다시 그리는가. 아니면 표로 대신하고 그림 줄을 빼는가.
2. H09 "(your part)", H11 "(yours)", H46 "you add it". (a) 캡션 메모로 둔다. (b) 다시 그리고 R1 2회째를 허락한다 (#140).
3. C01 "Connect VPN", "ssh to the login node". 일반 단어라 허용하는가. 아니면 다시 그리는가.
4. RS7 글. 그림의 `w64h4` (상한 밖, 기록용)를 그대로 두는가. 본문에 한 줄 넣는가.
5. G-DD1–3 승인.
6. #138 "my runs만"이 "I ..." 문장도 막는가 (지적 12).
7. 앞머리 `desc`도 15단어 규칙을 받는가 (지적 22).

## 용어 부록 (terms appendix)

- 프레셰 인셉션 거리(Fréchet Inception Distance, FID): 생성 이미지 품질 점수. 낮을수록 좋다. FID@1k는 1,000장, FID@5k는 5,000장 기준이다.
- 확산 모델(denoising diffusion probabilistic model, DDPM): 잡음을 단계별로 빼서 이미지를 만드는 모델.
- 지수 이동 평균(exponential moving average, EMA): 가중치의 느린 평균.
- 그룹 정규화(group normalization, GN): 채널을 묶어 정규화하는 층.
- 시그모이드 선형 유닛(sigmoid linear unit, SiLU): 활성 함수 x·σ(x).
- 다층 퍼셉트론(multilayer perceptron, MLP): 선형 층을 쌓은 작은 망.
- 그래픽 처리 장치(graphics processing unit, GPU): 학습에 쓴 연산 장치.
- 가상 사설망(virtual private network, VPN): 학교 밖에서 클러스터에 붙는 통로.
- 작업 스케줄러(Simple Linux Utility for Resource Management, SLURM): 대학 클러스터의 job 관리기.
- 이식 가능 그래픽 형식(portable network graphics, PNG): 그림 파일 형식.
- 자바스크립트 객체 표기(JavaScript Object Notation, JSON): 저장된 결과 파일 형식.
- 쉼표 구분 값(comma-separated values, CSV): 표 파일 형식.
- 수용 기준(acceptance criteria, AC): 계획 행마다 적힌 통과 조건.
