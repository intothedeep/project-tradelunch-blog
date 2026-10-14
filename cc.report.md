# Phase CC 단계 보고 (Cache and Cost)

요약: MVP1(M-CC1, 운영 `my.prettylog.com`) 단위 9개를 아래에 적었다. 판정 통과 2개(QW1, U2), 실패 1개(U3, 가드가 통과해 코드 유지), 판정 불가 1개(U1), 판정 미완 1개(QW2)다. U0a, U0b, U1a, U1b는 판정 없는 계측과 구조 단위다. U4는 MVP2이고 대기 중이다. 절: [MVP1](#mvp1-2026-10-14).

## MVP1 (2026-10-14)

이 절은 M-CC1 gate must-fix M1을 닫는다 (`cc.m1-gate.review.md` §1).
숫자는 저장된 run 폴더, `criteria.md`, `00.runs.md`, `u1-verdict.md`, `01.status.md`에서 옮겼다. 다시 계산하지 않았다.
출처 경로의 기준 폴더: `deploy/traffic/review/cc/` (이하 `cc/`).

### 요약

운영에 배포한 단위를 순서대로 쟀다. 세 단위만 사전 등록(pre-registration) 판정이 났다. QW1은 통과, U2는 통과, U3는 실패다. U3는 가드(guard)가 모두 통과해 코드를 남겼다. U1은 측정 결함으로 판정을 못 냈다. QW2는 셋 중 하나가 미측정이다. 가드 G-g, G-h, G-l과 smoke 15개는 어느 단위에도 기록이 없다.

| 단위 | 배포 sha | 판정 | 한 줄 결과 | 절 |
| --- | --- | --- | --- | --- |
| U0a 계측 | 없음 (smoke는 로컬) | 없음 | 계측 코드와 측정 스크립트 동작 확인 | [U0a](#u0a-계측-instrumentation) |
| U0b 기준선 | `19f5e31` | 없음 | curl 3 run, 브라우저 1 폴더 | [U0b](#u0b-기준선-baseline) |
| QW1 | `61d48bc` | 통과 | 서버 fetch 19 → 13 | [QW1](#qw1-서버-fetch-중복-제거) |
| QW2 | `61d48bc` | 미완 | 참 2개, 미측정 1개 | [QW2](#qw2-rail-접힘-상태-정확성) |
| U1a | `3596e4c` | 없음 | 컴포넌트 위치 이동 | [U1a](#u1a-컴포넌트-위치-이동) |
| U1b | `3596e4c` | 판정 불가 | 왼쪽 rail을 한 번만 그림 | [U1b](#u1b-왼쪽-rail-공유-layout) |
| U1c | `3596e4c` | 판정 불가 | 오른쪽 rail 하나 | [U1c](#u1c-오른쪽-rail-공유) |
| U2 | `c26c69d` | 통과 | `_rsc` 비prefetch 1 1 1 → 0 0 0 | [U2](#u2-staletimes) |
| U3 | `0ac938c` | 실패 (코드 유지) | 글 이동 317 → 174 ms | [U3](#u3-잎-정리-leaf-cleanup) |
| U4 | 없음 | 대기 | MVP2, branch `cc-u4` | [U4](#u4-mvp2-대기) |

### 흐름 (ASCII 그림 1장)

```
smoke(local) -> U0b 기준선 -> [61d48bc QW1+QW2] -> [3596e4c U1a/b/c]
   -> [c26c69d U2] -> [0ac938c U3] -> M-CC1 gate (ISSUE, cycle 1/2) -> U4 (MVP2)
판정:  없음         없음            통과 / 미완        판정 불가        통과      실패(유지)
```

### 열린 것 (모든 단위 공통)

- 가드 G-g, G-h, G-l(B1, B3, C5, C6, D2)과 smoke 15개는 기록이 없다. 기준선 `smoke.txt`도 없다 (`cc/criteria.md` §3 6번).
- `cc/00.runs.md`는 11행에서 멈췄다. U2, U3 행과 판정이 없다. [확인 필요: data-analyst가 갱신 중이면 그 행으로 바꾼다]
- G-j(QW1 지표)는 QW1 뒤 단위에서 기록이 없다 (`cc/criteria.md` §2). 저장 파일에는 U2, U3 curl run마다 12가 있다. 아래 U2 절 참고. [확인 필요: 판정 칸]

---

### U0a 계측 (instrumentation)

- What: 브라우저 `[nav]` 줄, 서버 `ssr_fetch` 줄, 측정 스크립트 2개를 만들었다.
- Why: 뒤 단위의 주 지표(primary metric)를 잴 도구가 필요했다.
- Input data: 로컬 dev 서버 `local.prettylog.com` 1회. 운영이 아니다.
- Output data: `cc/runs/20261014T045840Z_smoke_560f941/` (smoke run 1개).
- Result: 아래 표.
- 좋은 점: gate AC1–AC7이 모두 PASS다. `check-types` 0, `lint` 0. 나쁜 점: AC2 문구가 코드와 다르다 (로거 키 8개, 비밀 0).
- Status: ran. 판정 입력 아님.

| 항목 | 값 |
| --- | --- |
| 요청 수 | 29 |
| `aborted` | null |
| 404 응답 | 3개 |
| `set-cookie` | 0 |
| 단위 행 수 (AC5) | 9 |

```
브라우저 [nav] --> nav.log                      (cc-browser.mjs)
서버 ssr_fetch --> blog-web-log.json --> ssr_fetch_summary.txt   (cc-measure.mjs)
```

증거: `cc/runs/20261014T045840Z_smoke_560f941/`, `cc/00.runs.md` 1행, `cc.m1-gate.review.md` §3.1.

---

### U0b 기준선 (baseline)

- What: 배포 `19f5e31`을 curl 3 run과 브라우저 1 폴더로 쟀다.
- Why: 뒤 단위의 판정선(threshold)을 잡음(range)에서 유도한다 (`rules/measurement.md` §1).
- Input data: 운영 `my.prettylog.com`. curl run 3개(run마다 반복 3), 브라우저 run 3개.
- Output data: `baseline1..3` 폴더 3개, `baseline_19f5e31_browser` 폴더 1개, 요약 `cc/baseline.md`.
- Result: 아래 표.
- 좋은 점: 범위가 중앙값의 50 % 이하여서 kill 조건을 통과했다 (`cc/baseline.md` §2.2). 나쁜 점: curl manifest에 `web_sha`가 없다. `criteria.md`는 QW1 배포 뒤에 썼다.
- Status: ran. 판정 없음.

| 지표 | run 1 / 2 / 3 | 출처 |
| --- | --- | --- |
| QW1 지표 (서버 fetch 수) | 19 / 19 / 19 | `ssr_fetch_summary.txt` |
| U5 값 (MISS TTFB, ms) | 280 / 263 / 210 | `cc/baseline.md` §2.1 |
| VM 메모리 (%) | 52.1 / 52.9 / 52.9 | `vm.txt` |
| G-c (traffic-check) | 0 FAIL ×3 | `traffic-check.txt` |

브라우저 기준선 (run 3개, 단위 ms):

| 칸 | 값 | 중앙값 | 범위 |
| --- | --- | --- | --- |
| 익명 expanded s6 `_rsc` 비prefetch | 1 1 1 | 1 | 0 |
| 로그인 expanded s5 글 이동 | 473 347 379 | 379 | 126 |
| 로그인 expanded s2–s6 합 | 679 561 585 | 585 | 118 |
| hydration 오류 | 0 0 0 | 0 | 0 |

```
QW1 지표 (서버 fetch / MISS 렌더)
run 1  ███████████████████  19
run 2  ███████████████████  19
run 3  ███████████████████  19
```

증거: `cc/baseline.md`, `cc/runs/20261014T050303Z_baseline1_b13f4ee/`, `cc/runs/20261014T050727Z_baseline2_b13f4ee/`, `cc/runs/20261014T051216Z_baseline3_b1fcedc/`, `cc/runs/20261014T052554Z_baseline_19f5e31_browser/summary.csv`.

---

### QW1 서버 fetch 중복 제거

- What: MISS 렌더 1회의 서버 fetch 수를 줄였다 (`cache(`, Suspense 분리).
- Why: 사전 등록 주 지표다. 페이지 3개 합: `/`, `/@taeklim/posts`, `/@taeklim/<S>`.
- Input data: curl run 3개(`qw1_1..3`), 배포 `61d48bc`. 기준은 U0b 19 / 19 / 19.
- Output data: `ssr_fetch_summary.txt` 3개, `manifest.json` 3개.
- Result: 19 → 13. 줄어든 수 6. 판정선 max(0 × 2, 2) = 2. 통과.
- 좋은 점: 기준과 QW1 모두 범위 0이다. 나쁜 점: run 1은 valid 2/3이다 (오염 창 3개). 가드 칸 전부와 smoke 15개는 기록이 없다.
- Status: ran. 판정 통과.

| run | 값 | valid | VM (%) |
| --- | --- | --- | --- |
| qw1_1 | 13 | 2/3 | 53.4 |
| qw1_2 | 13 | 3/3 | 53.4 |
| qw1_3 | 13 | 3/3 | 53.8 |

```
기준선 ███████████████████  19
QW1    █████████████       13   (판정선: 2 이상 감소)
```

증거: `cc/runs/20261014T053805Z_QW1_qw1_1_61d48bc/`, `cc/runs/20261014T054229Z_QW1_qw1_2_61d48bc/`, `cc/runs/20261014T054651Z_QW1_qw1_3_61d48bc/`, `cc/criteria.md` §1 QW1 행.

---

### QW2 rail 접힘 상태 정확성

- What: 왼쪽 rail 폭이 쿠키 `railCollapsed` 유무와 무관하게 HTML에서 같은지 본다.
- Why: 엣지 캐시가 한 사용자의 rail 폭을 다른 사용자에게 주는 버그(D1)를 막는다.
- Input data: QW1 curl run 3개와 `after_qw` 브라우저 run 1회. 같은 배포 `61d48bc`.
- Output data: `manifest.json`의 `rail_width_same`, 브라우저 `summary.csv`.
- Result: 판정 (1) 참 3/3, (3) 참, (2) 미측정. 판정 미완.
- 좋은 점: 기준선 (1)은 거짓 ×3이었고 배포 뒤 참 3/3이 됐다. 나쁜 점: (2) 첫 paint 스크린샷이 없다.
- Status: ran, 일부 미측정 (CC-QW2-2).

| 판정 | 기준선 | QW2 뒤 |
| --- | --- | --- |
| (1) rail 폭 class가 쿠키와 무관 | 거짓 ×3 | 참 3/3 |
| (2) 쿠키 1인의 첫 paint가 접힘 | 미측정 | 미측정 |
| (3) hydration 오류 0 | 0, 네 그룹 | 0, 네 그룹 (run 1회) |

```
(1) ■■■ 참   (2) □ 미측정   (3) ■ 참     셋 모두 참이어야 통과 -> 미완
```

증거: `cc/runs/*_QW1_qw1_{1,2,3}_61d48bc/manifest.json`, `cc/runs/20261014T053859Z_QW1_after_qw_61d48bc_browser/summary.csv`, `cc/criteria.md` §1 QW2 행.

---

### U1a 컴포넌트 위치 이동

- What: `app/[handle]` 아래 컴포넌트를 `components/projects/`로 옮겼다.
- Why: U1b의 공유 layout을 만들기 전에 import 방향을 정리한다.
- Input data: 코드 grep(gate review), 운영 GET 11회 (1초 간격).
- Output data: `components/projects/` 파일 11개.
- Result: AC1–AC3 PASS. AC4는 일부다. smoke 15개 전체는 미측정이다.
- 좋은 점: `@/app/[handle]` import가 0이다. 나쁜 점: 운영 smoke 15개 기록이 없다 (CC-U1a-2).
- Status: ran. 판정 없음. 코드 `df11372`, 운영 `3596e4c`.

| 확인 | 값 |
| --- | --- |
| `@/app/[handle]` import | 0 |
| `app/[handle]/components/` | 없음 |
| `/@nouser/posts` | 404 |
| `/@taeklim/about-me` | 404 (BYPASS) |

```
app/[handle]/components/*  -->  components/projects/* (11파일)
```

증거: `cc.m1-gate.review.md` §3.5, §5 (운영 GET 표).

---

### U1b 왼쪽 rail 공유 layout

- What: 왼쪽 rail을 `(shell)/layout.tsx`에서 한 번만 그린다.
- Why: 페이지를 옮길 때 rail을 다시 만들고 다시 받는 일을 줄인다.
- Input data: 코드 grep, 운영 GET, U1 브라우저 run 3개 (`3596e4c`).
- Output data: `cc/u1-verdict.md`, `cc/runs/20261014T055732Z_U1_u1_3596e4c_browser/`.
- Result: AC1–AC6 PASS. 주 지표(AC7)는 판정 불가. 아래 "U1 판정" 절 참고.
- 좋은 점: 200 페이지 7개 모두 `<aside>` 1개, 404 페이지 0개다. 나쁜 점: 바이트 지표 결함 때문에 효과를 못 쟀다.
- Status: ran. 판정 불가.

| 확인 | 값 |
| --- | --- |
| `RailFrame` 사용 | `(shell)/layout.tsx` 1개 |
| `BlogShell` (test 제외) | 0 |
| `<aside>` (200 페이지 7개) | 각 1 |
| `<aside>` (404 페이지) | 0 |

```
(shell)/layout.tsx  --> LeftRail 1회
   +-- (feed)   +-- [handle]   (이동해도 rail 다시 안 그림)
```

증거: `cc.m1-gate.review.md` §3.5, `cc/u1-verdict.md`.

---

### U1c 오른쪽 rail 공유

- What: 오른쪽 rail을 `(feed)`와 `[handle]/(rail)` layout에서 하나로 쓴다 (`HomeRightRail`).
- Why: 홈, 프로젝트, 저장, 내 블로그가 같은 오른쪽 rail을 쓰게 한다 (D #93, #94).
- Input data: 코드 grep, 운영 GET 11회, U1 브라우저 run 3개.
- Output data: 코드 `e05cec6`, 운영 `3596e4c`.
- Result: AC1, AC1b, AC2 PASS. AC3는 익명 부분만 PASS. AC4, AC5는 미측정.
- 좋은 점: `data-right-rail="shared"`가 5개 페이지에서 각 1이다. 나쁜 점: 프로필 카드 순서는 HTML 바이트로 판정할 수 없다.
- Status: ran. 판정 불가.

| 경로 (익명) | `data-right-rail="shared"` |
| --- | --- |
| `/` | 1 |
| `/tags/rust` | 1 |
| `/@taeklim/posts` | 1 |
| `/@taeklim/projects` | 1 |
| `/@taeklim/projects/cnn-from-scratch` | 1 |
| `/@taeklim/<S>` | 0 |
| `/@taeklim/about` | 0 |

```
HomeRightRail:  (feed)/layout.tsx  +  [handle]/(rail)/layout.tsx   (2곳)
UserContextRail: [slug]/layout.tsx                                  (1곳)
```

증거: `cc.m1-gate.review.md` §3.6, §5.

---

### U1 판정 (U1a, U1b, U1c 공통)

- What: 세 단위는 한 배포 `3596e4c`다. 익명 W1 `text/x-component` 바이트로 함께 판정한다.
- Why: 사전 등록 공식은 줄어든 양 ≥ max(범위 × 2, rail 조각 크기 × 0.5)다.
- Input data: after-QW 브라우저 run 1회와 U1 브라우저 run 3회.
- Output data: `cc/u1-verdict.md`.
- Result: 판정 불가. 기준 run이 1개라 범위가 없다. rail 조각 크기 R은 미측정이다. 바이트 지표가 null 응답을 0으로 센다.
- 좋은 점: 가드 G-f, G-a, G-b가 통과했다. 나쁜 점: 재구성 값은 사후에 고른 방법이라 판정에 쓰지 않는다.
- Status: ran. 판정 불가. main session이 선택지 B(운영 재배포 없이 가드로 닫음)를 골랐다. 오너 확인이 남았다 (gate M5).

| 칸 | 값 |
| --- | --- |
| G-f hydration 오류 | 0 |
| G-a 10초 최대 요청 수 | 최대 36 (한도 50) |
| G-b prefetch 최대 | 익명 2, 로그인 2 |
| 익명 expanded s6 `_rsc` 비prefetch | 1 1 1 |
| `rsc_bytes_w1` 익명 expanded | 270469 / 270469 / 10641 B (null을 0으로 셈) |
| 재구성 합 (기록만) | 317713 → 289489 B (−28224) |

```
rsc_bytes_w1 (U1 익명 expanded)
run 1  ██████████████████████████▉  270469   (null 1)
run 2  ██████████████████████████▉  270469   (null 1)
run 3  █                             10641   (null 9, 엣지 MISS)
```

증거: `cc/u1-verdict.md` §0, §1.2, §2.2, §3.2, `cc/criteria.md` §1 U1 행, `01.status.md` 87행.

---

### U2 staleTimes

- What: `next.config.ts`에 `staleTimes: { dynamic: 30 }`을 넣었다.
- Why: 홈으로 돌아올 때 다시 받는 `_rsc` 요청을 없앤다 (D #96).
- Input data: 브라우저 run 3개, curl run 3개. 배포 `c26c69d`. 기준은 U1 브라우저 run.
- Output data: `cc/runs/20261014T070608Z_U2_u2_c26c69d_browser/`, `cc/runs/*_U2_u2_{1,2,3}_c26c69d/`.
- Result: 익명 expanded `w1_s6_home_rsc_nonprefetch` 1 1 1 → 0 0 0. 판정선 max(0 × 2, 1) = 1. 통과.
- 좋은 점: `w2_back3_rsc` 0을 유지했다. 로그인 팔도 1 → 0이다 (기록만). 나쁜 점: 같은 배포에 header tone 15 %와 filter chips가 들어갔다. 고의 확인(AC3) 기록이 없다.
- Status: ran. 판정 통과.

| 칸 | U1 (`3596e4c`) | U2 (`c26c69d`) |
| --- | --- | --- |
| 익명 expanded s6 `_rsc` 비prefetch | 1 1 1 | 0 0 0 |
| 로그인 expanded s5 글 이동 (ms) | 401 338 341 | 317 403 307 |
| 로그인 expanded s2–s6 합 (ms) | 607 533 541 | 527 (500–591) |
| hydration 오류 | 0 | 0 |
| G-a (익명 / 로그인) | 최대 36 | 22 / 35 |
| traffic-check | 미측정 | 0 FAIL ×3 |
| VM 메모리 (%) | 미측정 | 53.3 / 51.6 / 51.6 |
| curl 서버 fetch 수 (기록) | 미측정 | 12 / 12 / 12 |

```
s6 홈 _rsc 비prefetch (익명 expanded)
U1  1 1 1  ███
U2  0 0 0           (판정선: 1 이상 감소 -> 통과)
```

- 유효 조건: run마다 s1 → s6 간격 < 25 s다. 간격 값이 문서마다 다르다. `01.status.md`는 8.2–9.5 s, gate review는 8.25–8.30 s다. [확인 필요: 어느 값이 `raw.jsonl`과 맞는지]
- 서버 fetch 수 12는 `{"home":3,"posts":5,"post":4}`다. QW1은 posts 6이었다. 판정은 아직 없다. [확인 필요]

증거: `cc/runs/20261014T070608Z_U2_u2_c26c69d_browser/summary.csv`, `cc/runs/20261014T065206Z_U2_u2_1_c26c69d/`, `cc/runs/20261014T065629Z_U2_u2_2_c26c69d/`, `cc/runs/20261014T070051Z_U2_u2_3_c26c69d/`, `01.status.md` 88행, `cc.m1-gate.review.md` §3.7.

---

### U3 잎 정리 (leaf cleanup)

- What: layout의 데이터 읽기를 Suspense 잎으로 옮기고 빌드 점검 잡을 만들었다.
- Why: U4(`cacheComponents`)를 켜기 전에 layout을 정리한다. 주 지표는 로그인 expanded `w1_s5_post_nav_ms`다 (§17).
- Input data: 브라우저 run 3개, curl run 3개. 배포 `0ac938c`. 기준은 U2 브라우저 run.
- Output data: `cc/runs/20261014T073207Z_U3_u3_0ac938c_browser/`, `cc/runs/*_U3_u3_{1,2,3}_0ac938c/`, `cc/u4-preview.md`.
- Result: 317 → 174 ms. 줄어든 양 143. 판정선 max(96 × 2, 31.7) = 192. **실패**. 가드가 통과해 코드를 남겼다.
- 좋은 점: 기록값이 모두 줄었다 (아래 표). 나쁜 점: `[slug]/layout.tsx` 40–46행이 아직 맨 위에서 `auth()`와 글 읽기를 await한다 (AC2 미충족, gate M4).
- Status: ran. 판정 실패, 코드 유지.

| 칸 | U2 (`c26c69d`) | U3 (`0ac938c`) |
| --- | --- | --- |
| 로그인 expanded s5 글 이동 (ms) | 317 403 307 → 317 | 176 174 169 → 174 |
| 범위 (ms) | 96 | 7 |
| 로그인 expanded s2–s6 합 (ms) | 527 | 343 (338–348) |
| 익명 expanded s5 (ms) | 73 | 45 |
| hydration 오류 | 0 | 0 |
| G-a (익명 / 로그인) | 22 / 35 | 22 / 35 |
| traffic-check | 0 FAIL ×3 | 0 FAIL ×3 |
| VM 메모리 (%) | 53.3 / 51.6 / 51.6 | 52.6 / 52.8 / 53.9 |
| curl 서버 fetch 수 (기록) | 12 / 12 / 12 | 12 / 12 / 12 |

```
s5 글 이동 (로그인 expanded, ms)
U2  █████████████████████████████▌  317
U3  ████████████████▎               174
판정선: 192 이상 감소 필요.  실제 감소: 143 -> 실패
```

증거: `cc/runs/20261014T073207Z_U3_u3_0ac938c_browser/summary.csv`, `cc/runs/20261014T071810Z_U3_u3_1_0ac938c/`, `cc/runs/20261014T072233Z_U3_u3_2_0ac938c/`, `cc/runs/20261014T072654Z_U3_u3_3_0ac938c/`, `cc/u4-preview.md`, `01.status.md` 89행, `cc.m1-gate.review.md` §3.8.

---

### U4 (MVP2, 대기)

U4는 MVP2다. 이 절의 단계가 아니다. M-CC1 gate가 PASS해야 M-CC2가 열린다.

- 코드는 branch `cc-u4`, `cc-u4-soft404`에만 있다. main과 운영에는 없다.
- 비교 기준은 U3 뒤 로그인 expanded `w1_nav_ms_s2_s6` 343 ms (338–348, 범위 10)다.
- 판정선은 max(20, 34.3) = 34.3 ms다. 통과는 308 ms 이하다 (`01.status.md` 89행).
- 빌드 점검: flag를 켠 잡 3회에서 오류 11개, 6개, 그다음 prerender의 blocking-route 오류가 났다 (`cc/u4-preview.md`).
- D #97(404는 proxy gate), D #98(로그인 사용자의 RSC 이동은 HTTP 200 not-found)은 오너 고지가 남았다 (`01.status.md` 90–91행).

증거: `cc/u4-preview.md`, `01.status.md` 89–91행, `cc.m1-gate.review.md` §8.
