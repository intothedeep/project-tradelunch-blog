# Phase CC 단계 보고 (Cache and Cost)

요약: MVP1(M-CC1, 운영 `my.prettylog.com`) 단위 9개를 아래에 적었다. 판정 통과 2개(QW1, U2), 실패 1개(U3, 가드가 통과해 코드 유지), 판정 불가 1개(U1), 판정 미완 1개(QW2)다. U0a, U0b, U1a, U1b는 판정 없는 계측과 구조 단위다. MVP2(U4)는 시도 2번이 모두 되돌려졌다. 시도 1은 운영 500, 시도 2는 판정 실패(329 → 434 ms)다. K3에서 멈췄고 오너 선택을 기다린다(D #102). MVP3는 U7만 통과했다(`my.` load-more 요청 12 → 0). U5, U6은 U4에 막혀 있다. 절: [MVP1](#mvp1-2026-10-14), [MVP2](#mvp2-u4), [MVP3](#mvp3-u7).

## MVP1 (2026-10-14)

이 절은 M-CC1 gate must-fix M1을 닫는다 (`cc.m1-gate.review.md` §1).
숫자는 저장된 run 폴더, `criteria.md`, `00.runs.md`, `u1-verdict.md`, `smoke-0ac938c.txt`, `01.status.md`에서 옮겼다. 다시 계산하지 않았다.
출처 경로의 기준 폴더: `deploy/traffic/review/cc/` (이하 `cc/`).

### 요약

운영에 배포한 단위를 순서대로 쟀다. 세 단위만 사전 등록(pre-registration) 판정이 났다. QW1은 통과, U2는 통과, U3는 실패다. U3는 가드(guard)가 모두 통과해 코드를 남겼다. U1은 측정 결함으로 판정을 못 냈다. QW2는 셋 중 하나가 미측정이다. 가드 G-h, G-j, G-l과 smoke 15개는 이제 기록이 있다(아래 "열린 것").

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
| U4 | `535b931`, `f122265` (둘 다 되돌림) | 실패 | MVP2 절을 본다 | [MVP2](#mvp2-u4) |

### 흐름 (ASCII 그림 1장)

```
smoke(local) -> U0b 기준선 -> [61d48bc QW1+QW2] -> [3596e4c U1a/b/c]
   -> [c26c69d U2] -> [0ac938c U3] -> M-CC1 gate (ISSUE 1/2, PASS 2/2) -> U4 (MVP2)
판정:  없음         없음            통과 / 미완        판정 불가        통과      실패(유지)
```

### 열린 것 (모든 단위 공통)

- `cc/00.runs.md`는 19행까지 있다. U2, U3, U4 기준(v2) 행과 단위별 가드 표(§2.1)가 들어 있다.
- G-h는 통과다. 폴더 6개에서 이동 `_rsc` 359건의 값 12개가 prefetch 요청에 0건 나왔다 (`cc/criteria.md` §2).
- G-j(QW1 지표)는 U2, U3에서 통과다. run마다 12, 한도 13이다 (`cc/criteria.md` §2).
- smoke 15개는 `0ac938c`에서 1회 잼. 모두 기대와 같다. 이 파일이 기준선이다 (`cc/smoke-0ac938c.txt`, D #101).
- G-g는 통과다. 익명이 비공개 글을 요청하면 404이고 본문이 없다 (`body_has_title=0`). `0ac938c`에서 1회 잼.
- G-l: B1, B3, C6, D3 통과. D2 `prefetch=` 줄은 13이고 `19f5e31`부터 같다. C5는 통과다 (SSR 본문 있음, 홈 글 링크 14).
- 단위별 smoke는 없다. 기준선 하나만 있다. 열린 것은 U1 오너 확인(#99)과 QW2 (2)다.

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
- 좋은 점: 기준과 QW1 모두 범위 0이다. 나쁜 점: run 1은 valid 2/3이다 (오염 창 3개). 가드 칸은 `cc/00.runs.md` §2.1에 채웠다. smoke 15개는 이 배포에서 잰 적이 없다.
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
- Result: AC1–AC3 PASS. AC4는 일부다. 이 배포의 GET은 11회다.
- 좋은 점: `@/app/[handle]` import가 0이다. 나쁜 점: 이 배포에서 smoke 15개를 잰 적이 없다 (CC-U1a-2). 뒤 배포 `0ac938c`의 smoke는 기대와 같다.
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

- 유효 조건: run마다 s1 → s6 간격 < 25 s다. 익명 expanded는 8.25–8.30 s, 로그인 expanded는 9.14–9.40 s다 (`cc/00.runs.md` 14행). run 3개 모두 유효하다.
- 서버 fetch 수 12는 `{"home":3,"posts":5,"post":4}`다. QW1은 posts 6이었다. G-j는 통과다 (한도 13). 줄어든 원인은 기록이 없다 (`cc/00.runs.md` §2.1).

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

U4는 MVP2다. 아래 "MVP2 (U4)" 절에 적었다.

---

## MVP2 (U4)

M-CC2의 단위다. `cacheComponents`를 켜서 로그인 사용자의 이동 시간을 줄이려 했다.
시도 2번 모두 운영에서 되돌렸다. 지금 운영은 U3 상태(`7b1d1c9`)다.
숫자는 `cc/u4-verdict.md`, `cc/u4-recover/diagnosis-architect.md`, `cc/00.runs.md`, `cc/criteria.md`, `01.status.md`의 2026-10-14 CC 줄에서 옮겼다.

### 요약

| 시도 | 배포 sha | 무엇이 났나 | 판정 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | `535b931` | 알 수 없는 최상위 경로가 HTTP 500 | 실패 (404 회귀) | `7b4a138`로 되돌림, recovery 1/2 열림 |
| 2 | `f122265` | 경로표 25행 모두 맞음. 이동 시간 329 → 434 ms | 실패 (주 지표, G-a) | `7b1d1c9`로 되돌림, K3 정지 |

```
535b931 (시도 1) -> 운영 500 -> 7b4a138 되돌림 -> 원인 진단 -> A2 수정 (Actions 24/25 통과)
                                                                   |
f122265 (시도 2) -> 경로표 25행 OK -> 판정 FAIL 329 -> 434 ms -> 7b1d1c9 되돌림
                 -> K3 정지 -> D #102 -> 오너에게 (a)/(b)/(c)
```

### 시도 1 (`535b931`, 운영 500)

- What: `cacheComponents`를 켜고 proxy에 진짜 404 gate를 넣어 배포했다.
- Why: U4의 주 지표는 로그인 expanded 이동 시간 합(`w1_nav_ms_s2_s6`)이다. 사전 등록 정의는 `cc/criteria.md` §1 U4 행이다.
- Input data: 운영 `my.prettylog.com`의 경로 점검. 개발 서버(`next dev`)에서는 404였다.
- Output data: `blog-web-errors.json`, 진단 `cc/u4-recover/diagnosis-architect.md`.
- Result: 아래 표. 알 수 없는 최상위 경로 `/nope`, `/zzz-unknown`, `/foo/bar`가 HTTP 500 (본문 21 B, cf BYPASS)이었다.
- 좋은 점: 되돌린 뒤 `/nope`가 다시 404다. 나쁜 점: 개발 서버가 이 실패를 재현하지 못했다.
- Status: ran. 판정 실패, 되돌림.

| 경로 종류 | 운영 결과 |
| --- | --- |
| 없는 사용자, 프로젝트, 글 (문서와 `_rsc`) | 진짜 404 |
| 익명의 `me`, `saved`, 비공개 글 | 진짜 404 |
| 실제 페이지, 공유 rail 수 | 200, 정상 |
| `/nope`, `/zzz-unknown`, `/foo/bar` | **500** (21 B) |

원인 (진단 §0):

1. `/nope`는 `(shell)/[handle]`에 맞는다. `generateStaticParams`가 있어 증분 정적 생성(ISR) 경로로 렌더된다.
2. `HandleLayout`이 Suspense 밖에서 `notFound()`를 던진다. Next가 404 화면을 `prerender-legacy` 저장소로 다시 렌더한다.
3. 거기서 `TagCloud`의 `no-store` fetch가 `revalidate = 0`을 남긴다. `TagCloud`의 catch가 신호 오류를 삼킨다.
4. 핸들러가 ISR 경로에서 `revalidate 0 < 1`을 보면 오류 E22를 던진다. 응답은 500이다.
5. `next dev`는 이 검사 블록을 건너뛴다(`app-page.js:982`). 그래서 개발에서는 404가 나왔다.

수정 A2 (진단 §7):

- proxy가 점이 든 경로를 처리한다. 최상위 segment 허용 목록을 둔다. 주인이 아닌 handle의 `/about`, `/resume`은 proxy에서 404로 보낸다(S0).
- 검사: 운영과 같은 standalone `server.js`를 GitHub Actions에서 돌린다. 음성 대조(`efe7eed`)는 `/nope` 500을 재현했다.
- 후보 A (허용 목록만)는 10/11이었다. `/xmlrpc.php`가 500이었다 (run 38538786010).
- A2는 24/25행 통과, 로그의 `Invalid revalidate` 0건, 정적 검사 통과다 (run 38539359383, `cc-u4` `3369fe8`).
- 빠진 1행은 `/@taeklim/<slug>/opengraph-image`다. 기대 200, 결과 404다. 이전 운영(`7b4a138`)도 같은 404여서 회귀가 아니다. 기대값이 틀렸다. 정정 뒤 A2는 통과다.

증거: `cc/u4-recover/diagnosis-architect.md` §0, §1, §7, `01.status.md` 2026-10-14 CC-U4 attempt 1, recover 1/2 줄.

### 시도 2 (`f122265`, 판정 실패)

- What: A2를 합친 `cc-u4`를 배포하고 경로표와 브라우저 run으로 쟀다.
- Why: 사전 등록 판정이다. 로그인 expanded `w1_nav_ms_s2_s6` 중앙값이 261 ms 이하여야 통과다.
- Input data: 비교 기준은 `0ac938c` 위 하네스 v2 브라우저 3회다. 값 295 / 329 / 329, 중앙값 329, 범위 34다. 이전 v1 기준 343은 이 판정에 쓰지 않는다 (`cc/criteria.md` §1 U4 행).
- Output data: `cc/runs/20261014T092201Z_U4_u4_f122265_browser/`, `cc/runs/*_U4_u4_{1,2,3}_f122265/`, `cc/u4-verdict.md`.
- Result: 329 → 434 ms (run 값 482 / 421 / 434, 범위 61). 판정선 max(34 × 2, 32.9) = 68 ms. 통과선 261 ms. **실패**. 지표가 105 ms 늘었다.
- 좋은 점: 경로표 25행이 모두 맞다 (진짜 404 포함). 나쁜 점: 효과가 없는 정도가 아니라 반대 방향이다(회귀). G-a도 실패다.
- Status: ran. 판정 실패, 되돌림 `7b1d1c9`.

가드 (`cc/u4-verdict.md` §3):

| 가드 | 기준 | U4 | 판정 |
| --- | --- | --- | --- |
| G-a 로그인 10초 최대 요청 수 | 35 (한도 45.6, CF 한도 50) | 53 / 50 / 50 | 실패 |
| G-b 메뉴 링크당 prefetch 최댓값 | 2 | 6 | 실패 |
| G-f hydration 오류 | 0 | 0 | 통과 |
| G-j 서버 fetch | 12 (한도 13) | 12 | 통과 |
| G-c traffic-check | 0 FAIL | 0 FAIL × 3 | 통과 |
| G-g | 미측정 | 미측정 | 미측정 |

단계별 발견 (로그인 expanded, 단계 중앙값, ms, `cc/u4-verdict.md` §2.1):

| 단계 | 기준 v2 | U4 | 차이 |
| --- | --- | --- | --- |
| s2 posts | 20 | 18 | −2 |
| s3 projects | 21 | 21 | 0 |
| s4 project | 105 | 139 | **+34** |
| s5 post | 142 | 237 | **+95** |
| s6 home | 21 | 20 | −1 |
| 합 (단위 값) | 329 | 434 | **+105** |

```
단계 중앙값 차이 (ms)   s2 -2 | s3 0 | s4 +34 ███ | s5 +95 ████████ | s6 -1
```

- 느려진 곳은 s4와 s5뿐이다. 로그인 이동 요청은 오리진 렌더(`DYNAMIC`)다. 익명 이동 요청은 엣지 HIT이고 익명 합은 218 → 201 ms로 줄었다.
- 메뉴 prefetch 폭증(s1 prefetch 13 → 32)은 s2, s3을 늦추지 않았다. 그래서 prefetch를 줄이는 처방(#70)은 G-a, G-b만 고치고 주 지표는 못 고칠 가능성이 크다.
- 우세 가설은 H-S다 (`cacheComponents`에서 로그인 상세 route의 오리진 렌더가 느려졌다). H-C (라우터 segment prefetch가 오리진에서 이동 렌더와 경합)는 열려 있다. 이 데이터로는 가를 수 없다.

증거: `cc/u4-verdict.md` §0–§4, `cc/runs/20261014T092201Z_U4_u4_f122265_browser/summary.csv`, `01.status.md` 2026-10-14 CC-U4 attempt 2 줄.

### 정지 (K3, D #102)

- 이 접근은 주 지표와 가드가 둘 다 실패해 K3로 멈췄다. recovery는 1/2다.
- 오너 질문 (`01.status.md`): 다음 길 하나를 골라줘.
  - (a) S-CC B를 다시 본다. `cacheComponents`는 끄고 로그인 속도는 다른 단위로 찾는다.
  - (b) recovery 2/2를 연다. flag 아래 hover 전용 prefetch(#70 c)와 H-C 측정을 한다.
  - (c) Phase CC를 MVP1 뒤에서 멈추고 U7로 닫는다.
- 판별과 이유: D #102, `cc/u4-verdict.md` §4.
- D #97(404는 proxy gate), D #98(로그인 사용자의 RSC 이동은 HTTP 200 not-found)은 오너 고지가 남았다 (`01.status.md`).

---

## MVP3 (U7)

M-CC3 중 U7만 열렸다. U5와 U6은 U4에 막혀 있어 시작하지 않았다.

- What: `my.`의 load-more가 `blog-api`를 직접 부르게 했다 (Q11 (b)안).
- Why: `my.`에 오는 `/api/posts/load-more` 요청을 없애는 것이 목표다. 사전 판정선은 0이다 (`cc/criteria.md` §1 U7 행).
- Input data: 운영 브라우저 run 1폴더, 배포 `964c9f8`.
- Output data: `cc/runs/20261014T095432Z_U7_u7_964c9f8_browser/`.
- Result: `my.`의 load-more 요청 12 → 0. `blog-api` feed 요청은 12, 모두 200. **통과**.
- 좋은 점: 가드가 모두 통과다. 나쁜 점: AC4 (로그인 오너의 draft가 2쪽에 보임)는 측정하지 못했다.
- Status: ran. 판정 통과.

| 칸 | 값 |
| --- | --- |
| `my.` load-more 요청 | 12 → 0 |
| `blog-api` feed 요청 | 12 (모두 200) |
| hydration 오류 | 0 |
| G-a (익명 / 로그인) | 22 / 35 (< 50) |
| traffic-check | 0 FAIL |
| AC4 | 미측정 |

```
my. load-more 요청 (run 중)
이전  ████████████  12
U7                   0     (판정선 0, 통과)
```

- 기록만: 로그인 W1 s2–s6 합은 500 ms (454–609, 범위 155)였다. `0ac938c`의 기준은 329 ms다. W1은 load-more를 쓰지 않는다. 원인은 정해지지 않았다.

증거: `01.status.md` 2026-10-14 CC-U7 PASS 줄, `cc/runs/20261014T095432Z_U7_u7_964c9f8_browser/`.
