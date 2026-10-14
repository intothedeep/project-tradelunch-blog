# Phase CC U0b 기준선(baseline) 요약

> 상태: data-analyst, 2026-10-14. 저장된 run 산출물만 읽었다. 코드, git, 네트워크는 쓰지 않았다.
> 판정 기준의 원본: `cc.design.md` §5.3 (decision #88). 이 문서는 공식을 인용만 한다.
> `criteria.md`는 아직 없다. 범위(range) 값은 §2 표에 있다. `criteria.md`에 옮기는 일은 CC-U0b 행의 몫이다.

## 0. 결론

| 단위 | 주 지표 기준선 | 판정선 (지금 계산 가능?) |
| --- | --- | --- |
| QW1 | 없음 (`ssr_fetch` 줄을 세지 않았다) | 바닥값 2. 최종값은 Cloud Logging 집계 뒤 |
| QW2 | 판정 (1) = 거짓. 엣지 rail 폭 버그(D1)를 3/3 재현했다 | 이진. 셋 모두 참 |
| U1b | curl 값 386407 B, 범위 0 (브라우저 HAR 값 아님) | rail 조각 크기 × 0.5. 조각 크기 미측정 |
| U2 | 없음 | needs browser run (cc-browser-measure.yml, pending owner secret) |
| U3 | proxy 423 ms, 범위 123 | proxy 246 ms. 실제 `[nav]` 값은 needs browser run |
| U4 = G-CC | proxy p50 352 ms, 범위 55 (§2.3 읽기 A) | proxy 110 ms. 실제 `[nav]` 값은 needs browser run |
| U5 | 263 ms (세 페이지 합친 p50), 범위 70 (§2.3 읽기 A) | 140 ms. 지금 계산 가능. 읽기 확정 뒤 최종 |

- 측정한 사이트는 세 run 모두 배포 커밋 `19f5e31`이다 (main session dispatch 기준. 저장된 파일에는 이 sha가 없다).
- 폴더 이름의 sha(`b13f4ee`, `b1fcedc`)는 실행 때의 로컬 HEAD다. 배포 커밋이 아니다.
- 측정 코드는 세 run이 같다: `code_sha` `7c45cff7baf1`, `CODE_VERSION` `v1`.
- 429 응답 0, 중단(`aborted`) 0, 요청 수 run마다 212.
- U0b kill 조건(범위 > 중앙값의 50 %)은 지금 잴 수 있는 주 지표에서 모두 통과다(§2.2).

## 1. 무엇을 쟀나 (run 3개)

### 1.1 run 구조

```
run 폴더 1개 (baseline1, 2, 3)
├─ discover: <P>, <S> 찾기 (2 요청)
├─ warmup: W1 익명 1회 (run 0, 요약에서 뺌)
├─ 반복(rep) 1..3 × 팔(arm) anon, auth
│    W1 6 → W2 3 → W3 3 → W4 7 → miss 5 → hit 3 → rsc 6
└─ guards: 404 3개 + rail HTML 3개 (anon 1회)
```

| run | 폴더 | 시작 (UTC) | 로컬 HEAD | git_dirty |
| --- | --- | --- | --- | --- |
| 1 | `runs/20261014T050303Z_baseline1_b13f4ee/` | 05:03:03 | `b13f4ee` | true |
| 2 | `runs/20261014T050727Z_baseline2_b13f4ee/` | 05:07:27 | `b13f4ee` | true |
| 3 | `runs/20261014T051216Z_baseline3_b1fcedc/` | 05:12:16 | `b1fcedc` | true |

- 고정값: `<P>` = `cnn-from-scratch`, `<S>` = `cnn-from-scratch-7-7-139-runs-in-4-days-with-the-rules-written-first` (각 `manifest.json` `params`).
- rail 상태: 모든 팔에서 쿠키 없음, 펼침 (`params.rail_state`).
- 도구: `_scripts/perf/cc-measure.mjs` (Node fetch). 브라우저가 아니다.

### 1.2 이 문서의 "중앙값"과 "범위"

- `summary.csv`의 `median`은 한 run 안 반복 3개의 중앙값이다. 이것을 "run 중앙값"이라 부른다.
- 설계의 "3회"는 run 3개다. 그래서 이 문서의 기준선 = run 중앙값 3개의 중앙값이다.
- 이 문서의 범위 = run 중앙값 3개의 최댓값 − 최솟값이다.
- `summary.csv`의 `range` 칸(한 run 안의 범위)은 판정선에 쓰지 않는다.

## 2. 단위별 주 지표와 판정선

### 2.1 판정선 표

공식은 `cc.design.md` §5.3 표에서 그대로 옮겼다. 산술만 더했다.

| 단위 | 주 지표 (§5.3 원문) | 공식 (§5.3 원문) | run 중앙값 1 / 2 / 3 | 기준선 | 범위 | 계산 | 판정선 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QW1 | 서버 fetch 수 / MISS 렌더 1회 (`ssr_fetch` 줄) | 줄어든 수 ≥ max(범위 × 2, 2) | 없음 | 없음 | 없음 | max(? × 2, 2) | ≥ 2 (바닥값). 최종값 미정 |
| QW2 | 정확성 판정 (이진) 3개 | 셋 모두 참 | (1) 거짓 ×3 | (1) 거짓, (2)(3) 미측정 | 해당 없음 | 해당 없음 | 셋 모두 참 |
| U1b | W1 익명 `text/x-component` 응답 본문 바이트 합 | 줄어든 양 ≥ max(범위 × 2, 기준선 HAR rail 조각 크기 × 0.5) | 386407 / 386407 / 386407 (curl) | 386407 B (curl) | 0 | max(0 × 2, R × 0.5), R 미측정 | R × 0.5. 지금 숫자 없음 |
| U2 | W2 익명, 뒤로 3회 동안의 `_rsc` 요청 수 | 줄어든 수 ≥ max(범위 × 2, 1) | 없음 | 없음 | 없음 | max(? × 2, 1) | needs browser run (cc-browser-measure.yml, pending owner secret) |
| U3 | W1 로그인, 5단계(글 상세) 이동 시간 p50 (`[nav]`) | 줄어든 양 ≥ max(범위 × 2, 기준 p50의 10 %) | proxy 499 / 423 / 376 ms | proxy 423 ms | 123 | max(123 × 2, 423 × 0.1) = max(246, 42.3) | proxy 246 ms. `[nav]` 값은 needs browser run |
| U4 | W1 로그인, 이동 시간 p50 (5단계 전체) | 줄어든 양 ≥ max(범위 × 2, 기준 p50의 10 %) | proxy 352 / 372 / 317 ms | proxy 352 ms | 55 | max(55 × 2, 352 × 0.1) = max(110, 35.2) | proxy 110 ms. `[nav]` 값은 needs browser run |
| U5 | MISS TTFB p50, `/`, `/@taeklim/projects`, `/@taeklim/<S>`, `?cb=` | 줄어든 양 ≥ max(범위 × 2, 50 ms) | 280 / 263 / 210 ms | 263 ms | 70 | max(70 × 2, 50) = max(140, 50) | **140 ms** |
| G-CC | = U4 공식 (`00.tasks.md` CC-U4 "주 지표 = G-CC") | 같음 | 같음 | proxy 352 ms | 55 | 같음 | proxy 110 ms. `[nav]` 값은 needs browser run |

- U3, U4 proxy: `[nav]` 콘솔 줄 대신 curl `total_ms`(요청 시작부터 마지막 바이트)다. hydration과 commit 시간이 빠진다 (`cc-measure.snapshot.mjs` 7–10행). 판정에는 `[nav]` 값을 쓴다.
- U3 proxy: auth `w1.s5_post` `total_ms` run 중앙값.
- U4 proxy: run마다 auth `w1.s2..s6` `total_ms` 15개(5단계 × 반복 3)의 p50이다. 원값은 `summary.csv` `values` 칸.
  - run 1 정렬: 248 256 267 281 297 312 327 **352** 391 393 414 427 449 499 615.
  - run 2 정렬: 266 280 281 297 307 310 320 **372** 383 392 416 418 423 478 598.
  - run 3 정렬: 241 249 263 286 292 303 316 **317** 359 371 372 376 409 420 426.
- U5: run마다 anon `miss.home`, `miss.projects`, `miss.post` `ttfb_ms` 9개의 p50이다.
  - run 1 정렬: 196 246 260 264 **280** 290 392 405 477.
  - run 2 정렬: 183 197 229 257 **263** 290 396 409 421.
  - run 3 정렬: 160 175 186 190 **210** 257 330 337 409.
- U1b의 curl 값은 기준선으로 쓰지 않는다. 이유: curl 요청에는 `Next-Router-State-Tree`가 없다. 그래서 서버가 언제나 전체 트리를 보낸다. 공유 rail의 효과(이미 가진 layout을 다시 안 보냄)가 curl 바이트에 보이지 않을 가능성이 높다(추정). 설계 §5.4도 curl 바이트와 HAR 바이트를 섞지 말라고 적었다.

### 2.2 U0b kill 검사 (범위 ≤ 중앙값의 50 %)

| 주 지표 | 범위 / 기준선 | 비율 | 결과 |
| --- | --- | --- | --- |
| U1b curl 바이트 | 0 / 386407 | 0 % | curl 값만. HAR 기준선은 미검사 |
| U3 proxy | 123 / 423 | 29.1 % | 통과 (proxy. `[nav]`는 미검사) |
| U4 proxy | 55 / 352 | 15.6 % | 통과 (proxy. `[nav]`는 미검사) |
| U5 | 70 / 263 | 26.6 % | 통과 |
| QW1, U2 | 없음 | 없음 | 미검사 |

### 2.3 공식 해석이 갈리는 곳 (`criteria.md` 커밋 전에 정할 것)

공식은 바꾸지 않았다. 다만 "p50"을 무엇의 p50으로 읽는지가 설계에 없다.

| 단위 | 읽기 A (이 문서) | 읽기 B | 읽기 C | 판정선 A / B / C |
| --- | --- | --- | --- | --- |
| U4 | 15개 원값의 p50 | 단계 중앙값 5개의 p50 (327 / 372 / 316 → 327, 범위 56) | 단계 합 (스크립트 `w1_nav_total_ms_s2_s6`: 1835 / 1825 / 1660 → 1825, 범위 175) | 110 / 112 / 350 ms |
| U5 | 세 페이지 9개 원값의 p50 | 페이지마다 따로 (표 §3.5) | 없음 | 140 / 108, 120, 144 ms |

- A의 장점: "p50"이라는 원문에 가장 가깝다. 단점: 단계가 섞여 단계 하나의 변화가 묻힐 수 있다.
- B의 장점: 단계마다 한 표다. 단점: 원값 5개로 p50을 내서 거칠다.
- U4 C의 장점: 스크립트가 이미 낸다. 단점: p50이 아니라 합이다. 원문 공식과 다르다.
- U5 페이지별의 장점: 페이지마다 효과가 보인다. 단점: 판정이 셋이 된다. 주 지표 하나 규칙(`rules/measurement.md` §1)과 어긋난다.
- 고르는 일은 system-architect와 product-manager의 몫이다(decision #88 행 갱신). QW1 측정 전에 정해야 한다.

## 3. 지표 묶음별 기준선

표의 숫자는 run 중앙값 1 / 2 / 3, 기준선(중앙값), 범위다. 단위는 ms.
출처: 각 run 폴더의 `summary.csv` `median` 칸 [S-U0b-1] [S-U0b-2] [S-U0b-3].

### 3.1 W1 이동 (navigation)

**무엇을 알려고 쓰나:** 글 목록, 프로젝트, 글 상세로 옮길 때 응답이 얼마나 걸리나. U3, U4, G-CC의 proxy다.

**표:** `total_ms` (요청 시작부터 마지막 바이트). s1은 HTML, s2–s6은 `_rsc` 요청.

| 단계 | anon run 1 / 2 / 3 | anon 기준선 | anon 범위 | auth run 1 / 2 / 3 | auth 기준선 | auth 범위 |
| --- | --- | --- | --- | --- | --- | --- |
| s1 `/` (HTML) | 86 / 103 / 61 | 86 | 42 | 544 / 630 / 557 | 557 | 86 |
| s2 posts | 61 / 89 / 57 | 61 | 32 | 414 / 418 / 371 | 414 | 47 |
| s3 projects | 53 / 103 / 54 | 54 | 50 | 267 / 307 / 303 | 303 | 40 |
| s4 project | 59 / 95 / 55 | 59 | 40 | 281 / 281 / 263 | 281 | 18 |
| s5 post (U3) | 65 / 61 / 55 | 61 | 10 | 499 / 423 / 376 | 423 | 123 |
| s6 `/` | 62 / 60 / 59 | 60 | 3 | 327 / 372 / 316 | 327 | 56 |
| 합 s2–s6 (기록만) | 439 / 381 / 286 | 381 | 153 | 1835 / 1825 / 1660 | 1825 | 175 |

`ttfb_ms` 기준선 (기록만): anon s1–s6 = 84, 55, 53, 57, 59, 59. auth s1–s6 = 165, 120, 126, 145, 128, 147.

**시각화:** 단계 합 s2–s6 기준선.

```
anon  ███▊                  381 ms   (엣지 HIT)
auth  ██████████████████▎  1825 ms   (오리진, DYNAMIC)
```

**어떻게 하나:**
1. run마다 W1 6단계를 팔마다 3회 보낸다. 요청 사이 1.1초.
2. 단계마다 반복 3개의 중앙값을 낸다 (`summary.csv`).
3. run 3개의 중앙값과 범위를 낸다. 예: auth s5 = 499, 423, 376 → 423, 범위 123.

**읽는 법:**
- anon 값은 엣지 HIT 시간이다. warmup 뒤 `_rsc` 키가 고정이라서다. 오리진 렌더를 재지 않는다.
- auth 값은 매번 오리진이다(`DYNAMIC`). CC 효과는 auth 쪽에서 보인다.
- auth s2와 s5는 `ttfb_ms`(120, 128)와 `total_ms`(414, 423)의 차가 크다. 본문 스트리밍이 길다.

### 3.2 W2 뒤로 가기

**무엇을 알려고 쓰나:** 뒤로 3회가 다시 요청을 보내나. U2의 대상이다.

**표:** `total_ms`. 같은 `_rsc` 값으로 W1의 s5, s4, s3를 다시 보낸다.

| 단계 | anon run 1 / 2 / 3 | anon 기준선 | anon 범위 | auth run 1 / 2 / 3 | auth 기준선 | auth 범위 |
| --- | --- | --- | --- | --- | --- | --- |
| back1 post | 64 / 74 / 57 | 64 | 17 | 412 / 454 / 405 | 412 | 49 |
| back2 project | 58 / 60 / 55 | 58 | 5 | 269 / 271 / 247 | 269 | 24 |
| back3 projects | 53 / 62 / 55 | 55 | 9 | 288 / 291 / 269 | 288 | 22 |
| 요청 수 / run 반복 | 3 (구성상) | 3 | 0 | 3 (구성상) | 3 | 0 |

**시각화:** 없음. 요청 수는 구성상 상수다.

**어떻게 하나:**
1. 브라우저 router cache가 없는 클라이언트를 흉내 낸다.
2. 그래서 요청 수는 언제나 3이다 (`manifest.json` `w2_requests_emulated` = 3).

**읽는 법:**
- U2 주 지표(`_rsc` 요청 수)는 이 run이 재지 못한다. needs browser run (cc-browser-measure.yml, pending owner secret).
- 시간 값은 기록만 한다.

### 3.3 W3 load-more

**무엇을 알려고 쓰나:** 피드 load-more가 엣지 밖으로 나가나. U7과 G-a의 입력이다.

**표:** `total_ms`, 엣지 상태 `cf_cache_status`.

| 요청 | anon run 1 / 2 / 3 | anon 기준선 | anon 범위 | auth run 1 / 2 / 3 | auth 기준선 | auth 범위 | 엣지 상태 (9/9) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| lm1 | 243 / 290 / 195 | 243 | 95 | 143 / 161 / 138 | 143 | 23 | DYNAMIC |
| lm2 | 156 / 160 / 128 | 156 | 32 | 171 / 147 / 126 | 147 | 45 | DYNAMIC |
| lm2_again | 133 / 162 / 117 | 133 | 45 | 130 / 207 / 119 | 130 | 88 | DYNAMIC |

**시각화:** 없음.

**어떻게 하나:**
1. `my.`의 `/api/posts/load-more`를 2회 부른다. 두 번째를 한 번 더 부른다.
2. 응답 헤더 `cf-cache-status`와 `cache-control`을 남긴다 (`raw.jsonl`).

**읽는 법:**
- 모든 load-more 응답이 `DYNAMIC`이다. `cache-control` 헤더는 없다(null).
- 같은 요청을 다시 보내도 HIT가 아니다. U7 (a)안 지표("두 번째 스크롤 HIT 비율") 기준선 = 0 %.
- U7은 (b)안이다(#92 Q11). 판정선 = `my.` load-more 요청 0. 기준선 요청 수는 브라우저 2 스크롤당 2개(구성상).
- 요청 수 판정은 `proxy.ts` 요청 로그 또는 브라우저 run이 필요하다.

### 3.4 W4 prefetch

**무엇을 알려고 쓰나:** 메뉴 링크와 카드 hover의 prefetch 응답이 얼마나 크고 빠른가. G-b의 입력이다.

**표:** `total_ms`.

| 링크 | anon run 1 / 2 / 3 | anon 기준선 | anon 범위 | auth run 1 / 2 / 3 | auth 기준선 | auth 범위 |
| --- | --- | --- | --- | --- | --- | --- |
| card hover | 59 / 100 / 55 | 59 | 45 | 318 / 324 / 301 | 318 | 23 |
| menu home | 58 / 65 / 61 | 61 | 7 | 346 / 313 / 359 | 346 | 46 |
| menu posts | 134 / 63 / 56 | 63 | 78 | 444 / 399 / 399 | 399 | 45 |
| menu projects | 127 / 56 / 107 | 107 | 71 | 268 / 347 / 271 | 271 | 79 |
| menu about | 76 / 52 / 96 | 76 | 44 | 102 / 125 / 91 | 102 | 34 |
| menu resume | 46 / 62 / 51 | 51 | 16 | 114 / 116 / 122 | 116 | 8 |
| menu log | 125 / 61 / 54 | 61 | 71 | 102 / 128 / 93 | 102 | 35 |

**시각화:** 없음. 크기는 §3.8.

**어떻게 하나:**
1. 링크마다 `rsc: 1` + `next-router-prefetch: 1` 요청 1개를 보낸다.
2. 링크당 요청 수는 구성상 1이다.

**읽는 법:**
- G-b(링크당 prefetch 요청 수)는 이 run이 재지 못한다. needs browser run.
- anon 값에는 반복 1의 MISS가 섞인다(§5 항목 2). 범위가 큰 이유다.

### 3.5 MISS 렌더

**무엇을 알려고 쓰나:** 엣지에 없을 때 오리진이 HTML을 얼마나 빨리 내나. U5 주 지표다.

**표:** anon `ttfb_ms`. 반복마다 새 `?cb=` 값이라 9/9가 `MISS`다.

| 페이지 | run 1 / 2 / 3 | 기준선 | 범위 | 페이지별 판정선 (기록만) |
| --- | --- | --- | --- | --- |
| `/` (U5) | 264 / 257 / 210 | 257 | 54 | max(108, 50) = 108 |
| `/@taeklim/posts` | 406 / 389 / 357 | 389 | 49 | U5 밖 |
| `/@taeklim/projects` (U5) | 246 / 197 / 186 | 197 | 60 | max(120, 50) = 120 |
| `/@taeklim/projects/<P>` | 283 / 323 / 210 | 283 | 113 | U5 밖 |
| `/@taeklim/<S>` (U5) | 405 / 409 / 337 | 405 | 72 | max(144, 50) = 144 |
| U5 세 페이지 p50 (주 지표) | 280 / 263 / 210 | **263** | 70 | **140** |

auth 같은 요청의 `ttfb_ms` (기록만, `DYNAMIC`): `/` 158, posts 304, projects 129, project 209, post 314.

**시각화:**

```
U5 페이지 TTFB 기준선 (ms)
/                    █████████████        257
/@taeklim/projects   ██████████           197
/@taeklim/<S>        ████████████████████ 405
```

**어떻게 하나:**
1. 페이지마다 `?cb=cc<runId>_<arm>_<rep>_<page>`로 새 엣지 키를 만든다.
2. 첫 응답 헤더까지의 시간(`ttfb_ms`)을 잰다.
3. U5는 세 페이지 원값 9개의 p50을 run마다 낸다(§2.1).

**읽는 법:**
- 이 묶음만 anon에서 오리진 렌더를 직접 잰다. 그래서 U5 판정선은 지금 확정할 수 있다.
- QW1의 `ssr_fetch` 집계 창(시작, 끝 시각)은 `manifest.json` `metrics.arms.anon.miss_windows`에 있다.

### 3.6 HIT 표본

**무엇을 알려고 쓰나:** 같은 `?cb=` 키를 다시 부를 때 엣지가 얼마나 빨리 내나. 기록만 한다.

**표:** `ttfb_ms`. anon은 9/9 `HIT`. auth는 9/9 `DYNAMIC`이라 HIT가 아니다.

| 페이지 | anon run 1 / 2 / 3 | anon 기준선 | anon 범위 | auth (DYNAMIC) run 1 / 2 / 3 | auth 기준선 | auth 범위 |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 75 / 74 / 61 | 74 | 14 | 143 / 155 / 137 | 143 | 18 |
| `/@taeklim/posts` | 111 / 70 / 64 | 70 | 47 | 330 / 352 / 280 | 330 | 72 |
| `/@taeklim/projects` | 65 / 61 / 63 | 63 | 4 | 186 / 139 / 205 | 186 | 66 |

**시각화:** 없음.

**어떻게 하나:**
1. §3.5의 MISS 요청 바로 뒤에 같은 URL을 다시 보낸다.

**읽는 법:**
- anon: 엣지 HIT `ttfb_ms`는 61–111 ms다. MISS(197–405)보다 3–6배 빠르다.
- auth 행은 오리진을 두 번째로 부른 값이다. "hit"라는 키 이름을 믿지 않는다.

### 3.7 RSC full과 prefetch

**무엇을 알려고 쓰나:** 이동(full)과 prefetch 응답의 크기와 시간 차. 기록만 한다.

**표:** `total_ms`.

| 요청 | anon run 1 / 2 / 3 | anon 기준선 | anon 범위 | auth run 1 / 2 / 3 | auth 기준선 | auth 범위 |
| --- | --- | --- | --- | --- | --- | --- |
| full posts | 60 / 66 / 57 | 60 | 9 | 377 / 407 / 372 | 377 | 35 |
| pref posts | 130 / 75 / 55 | 75 | 75 | 408 / 360 / 344 | 360 | 64 |
| full projects | 133 / 65 / 141 | 133 | 76 | 321 / 283 / 270 | 283 | 51 |
| pref projects | 73 / 61 / 91 | 73 | 30 | 288 / 313 / 246 | 288 | 67 |
| full post | 56 / 153 / 59 | 59 | 97 | 429 / 467 / 369 | 429 | 98 |
| pref post | 60 / 110 / 56 | 60 | 54 | 469 / 411 / 421 | 421 | 58 |

**시각화:** 없음.

**어떻게 하나:**
1. `_rsc` 값을 run마다 하나 정한다(`ccf<runId>`, `ccp<runId>`). 반복 3개가 같은 키를 쓴다.

**읽는 법:**
- anon은 반복 1만 MISS, 반복 2–3은 HIT다. run 중앙값은 엣지 HIT 시간이다.
- auth는 9/9 오리진이다.

### 3.8 응답 바이트

**무엇을 알려고 쓰나:** 응답 본문 크기. U1b 바이트 지표와 rail 반복의 입력이다.

**표:** 디코드된 본문 바이트. 세 run, 반복 3개가 모두 같으면 한 값만 적는다.

| 요청 | anon | auth | 비고 |
| --- | --- | --- | --- |
| W1 s1 `/` HTML | 277882 | 280913 | |
| W1 s2 posts `_rsc` | 108097 | 110251 | |
| W1 s3 projects `_rsc` | 52604 | 52604 | |
| W1 s4 project `_rsc` | 56714 | 56714 | |
| W1 s5 post `_rsc` | 74349 | 74349 | |
| W1 s6 `/` `_rsc` | 94643 | 95720 | |
| W1 `text/x-component` 합 (U1b curl) | 386407 | 389638 | 범위 0, 0 |
| W4 card hover | 48133 | 48133 | |
| W4 menu home / posts / projects | 79560 / 67818 / 47347 | 80637 / 68895 / 47347 | |
| W4 menu about / resume / log | 232 / 233 / 182 | 232 / 233 / 182 | §5 항목 6 |
| rsc full posts / projects / post | 108097 / 52604 / 74349 | 110251 / 52604 / 74349 | |
| rsc pref posts / projects / post | 67818 / 47347 / 46334 | 68895 / 47347 / 46334 | full보다 작다 |
| MISS `/` | 278142 | 281173 | anon run 1 반복 1: 278099 |
| MISS posts | 304625 | 308793 | anon run 2 반복 1: 303892. auth run 2: 308060, 308146 |
| MISS projects / project / post | 104360 / 120353 / 142566 | 104360 / 120353 / 142609 | |

**시각화:**

```
W1 _rsc 바이트 (anon)
s2 posts     ███████████ 108097
s3 projects  █████        52604
s4 project   ██████       56714
s5 post      ███████      74349
s6 /         █████████    94643
```

**어떻게 하나:**
1. 본문을 받은 뒤 바이트 수를 센다 (`--compressed` 없는 curl과 같다).

**읽는 법:**
- W1 `_rsc` 바이트는 run 사이에 변하지 않는다. 결정적 지표다.
- auth가 anon보다 큰 곳은 로그인 전용 UI 몇 KB다(s2 +2154, s6 +1077).
- prefetch는 full보다 작다. 예: post 46334 vs 74349.

## 4. 가드 (guard)

**무엇을 알려고 쓰나:** CC 단위마다 깨지면 안 되는 선의 오늘 값.

**표:**

| ID | 가드 | 기준선 값 | 출처 | 지금 상태 |
| --- | --- | --- | --- | --- |
| G-a | 10초 창 최대 요청 수 | 없음. curl은 1.1초 간격이라 구성상 ≤ 10 | 없음 | needs browser run |
| G-b | 링크 1개당 prefetch 요청 수 | 없음. curl은 구성상 1 | 없음 | needs browser run |
| G-c | `traffic-check.sh` | 0 FAIL ×3 | `traffic-check.txt` ×3 | 통과 |
| G-d | 공개 응답 `set-cookie` | 0줄 ×3 (anon). auth 0 | `manifest.json` `public_set_cookie_lines`, `set_cookie_lines` | 통과 |
| G-e | `/nope`, `/@nope/x` | 404, 404 ×3 (엣지 `BYPASS`) | `raw.jsonl` guards 줄 | 통과 |
| G-e2 | `/@taeklim/nope` | 404 ×3 | 같음 | 기록. 404라서 `cc.plan.md` §4대로 가드(404)로 쓴다 |
| G-f | W1 hydration 오류 | 없음 | 없음 | needs browser run |
| G-g | 비공개 글 익명 404 | 없음 | 없음 | 이번 run에 없다. 브라우저 또는 curl 1회 필요 |
| G-h | prefetch와 이동의 `_rsc` 값이 다름 | curl은 구성상 다름 | 없음 | needs browser run |
| G-i | VM 메모리 최대 < 80 % | 실행 시각 52.1, 52.9, 52.9 %. 24시간 최대 64.2 % (2026-10-13 06시대) | `vm.txt` ×3 | 통과 |
| G-j | 서버 fetch 수 / MISS 렌더 | QW1과 같음 | 없음 | 미측정 |
| G-k | 익명 HTML이 rail 쿠키와 무관 | 거짓 ×3 (D1 재현) | `rail_*.html` ×3 | 기준선은 거짓이 정상. QW2 뒤부터 가드 |
| G-l | 감사 PASS 회귀 없음 | D3만 데이터: `?_rsc=` `text/x-component` PASS, anon W1 `_rsc` 반복 HIT | `traffic-check.txt` 8행, `raw.jsonl` | D3 통과. B1, B3, C5, C6, D2는 코드 grep이라 이 run 밖 |

**시각화:** D1 재현 흐름 (run 3개 모두 같음).

```
rail_plain        /?cb=ccr<id>  쿠키 없음   MISS  → w-64 (펼침)  엣지에 저장
rail_cookie       /?cb=ccr<id>  쿠키 =1     HIT   → w-64         ← 접힌 사용자가 펼친 폭을 받음
rail_cookie_fresh /?cb=ccs<id>  쿠키 =1     MISS  → w-14 (접힘)  ← 오리진은 쿠키로 폭을 바꿈
```

**어떻게 하나:**
1. 저장된 `rail_*.html`에서 rail `<aside>`의 폭 class를 찾았다(`border-r-2 border-primary` 뒤 `w-64` 또는 `w-14`).
2. 예: run 1 `rail_cookie_fresh.html` → `w-14`, `rail_plain.html` → `w-64`.

**읽는 법:**
- QW2 판정 (1)의 기준선 = 거짓. 쿠키에 따라 MISS HTML의 폭이 다르다.
- 같은 키 HIT는 첫 방문자의 폭을 모두에게 낸다. 설계 §1의 버그와 같다.
- `manifest.json`의 `rail_cookie_same_key_same_html: false`는 쓰지 않는다. §5 항목 5.

## 5. 이상한 데이터

| # | 무엇 | 증거 | 영향 |
| --- | --- | --- | --- |
| 1 | 폴더 sha ≠ 배포 sha. 세 폴더 모두 `git_dirty: true` | `manifest.json` `git_sha`, `git_dirty` | 배포 커밋 `19f5e31`은 dispatch에만 있다. 저장 파일에 없다. AC1의 `web_sha` 키도 없다 |
| 2 | anon W4와 rsc의 반복 1은 MISS, 반복 2–3은 HIT | run 1, 3 `raw.jsonl` 21–27행 (W4 MISS). run 2는 W4 모두 HIT | anon W4, rsc 시간은 HIT와 MISS가 섞인다. run 안 범위가 큰 이유다 (예: run 1 `w4.menu_home` 599 ms) |
| 3 | run 3 warmup에서 `_rsc` 키 5개가 다시 MISS. `/`만 HIT (age 41) | run 3 `raw.jsonl` 3–8행. run 2 warmup은 6개 모두 HIT (age 263) | 05:07–05:12 사이에 엣지 항목이 사라졌다. 원인(purge 또는 eviction)은 모른다 |
| 4 | auth 팔의 모든 응답이 `DYNAMIC` (설계 §8.1 표는 `BYPASS`라 적음) | `raw.jsonl` auth 줄, `traffic-check.txt` 5행 | auth `hit.*` 행은 HIT가 아니다. 오리진 2회째 값이다 |
| 5 | HTML HIT 본문의 `body_sha`가 매번 다르다. 길이는 같다. `_rsc` HIT는 sha가 같다 | run 1 `raw.jsonl` 9, 75행 (`s1_home` 277882 B, sha 다름). guards `rail_plain`과 `rail_cookie` (둘 다 278053 B, sha 다름) | 스크립트의 sha 비교 가드(`rail_cookie_*_same_html`)는 쓸 수 없다. 폭 class 비교를 쓴다. 원인은 모른다(엣지가 HTML에 응답마다 다른 같은 길이 값을 넣는 것으로 추정) |
| 6 | W4 about, resume, log prefetch 본문이 232, 233, 182 B. 다른 메뉴는 47–80 KB | `summary.csv` `w4.menu_about/resume/log` `bytes`. 상태 200, `text/x-component` | 본문을 저장하지 않아 내용을 모른다. redirect 또는 빈 segment일 수 있다(추정). 브라우저 run에서 확인 |
| 7 | MISS 바이트가 조금 흔들린다 | anon `miss.home` 278099 vs 278142, `miss.posts` 303892 vs 304625, auth posts 308060–308836 | 렌더마다 바뀌는 내용으로 보인다. W1 `_rsc` 바이트(U1b)는 흔들리지 않는다 |
| 8 | load-more가 엣지 밖이다. `cache-control` 없음 | `raw.jsonl` w3 줄 run마다 18/18 `DYNAMIC` (두 팔) | U7 (a)안 HIT 비율 기준선 0 % |
| 9 | auth MISS `/` `ttfb_ms`(158)가 anon MISS `/`(257)보다 빠르다 | §3.5 | 원인 모름. anon MISS는 엣지 저장 경로를 지난다. 판정에는 영향 없다 |
| 10 | 429 0, 오류 0, 404는 guards 3개뿐 | `raw.jsonl` status 칸, `manifest.json` `aborted: null` | 없음 |
| 11 | 첫 반복의 시간이 자주 크다 (예: run 1 anon `w1.s2_posts` 155 ms, 나머지 54, 55) | `summary.csv` `values` 칸 | run 중앙값이 이것을 걸러 낸다 |

## 6. 빈칸 (gap)

| 빈칸 | 필요한 것 | 누가 |
| --- | --- | --- |
| QW1 주 지표, G-j | `ssr_fetch` 줄을 MISS 창마다 센다. 창 = `manifest.json` `metrics.arms.anon.miss_windows` (run마다 15개). Cloud Logging 질의 | main session |
| U2, U3 `[nav]`, U4 `[nav]`, G-CC, QW2 (2)(3), G-a, G-b, G-f, G-h | needs browser run (cc-browser-measure.yml, pending owner secret `CLERK_SECRET_KEY_PROD`) | main session (오너 secret 뒤) |
| U1b 판정선 | 브라우저 HAR + rail 조각 크기 규칙(설계 §5.4). `har_summary.py`가 `deploy/traffic/review/cc/`에 없다 | developer (스크립트), main session (run) |
| G-g | 비공개 글 URL 익명 요청 1회 | main session |
| CC-U0b AC4 `/@taeklim/about-me` status | 이번 run에 없다. curl 1회 | main session |
| U7 요청 수 | `proxy.ts` 요청 로그 또는 브라우저 run | main session |
| `criteria.md`, `00.runs.md` | 둘 다 없다. 범위 값은 이 문서 §2.1에 있다 | CC-U0b 행 (main session, product-manager) |
| CC-U0b AC1, AC2 파일 | `web_sha`, `unit`, `browser` 키 없음. `*.har`, `nav.log`, `ttfb.txt`, `rsc.txt`, `guards.txt`, `smoke.txt` 없음. 대신 `raw.jsonl`, `summary.csv` | product-manager가 AC를 스크립트 출력에 맞출지 정한다 |
| smoke 15개 (설계 §7.3) | 이번 run에 없다. U1a부터 기준선 `smoke.txt`가 필요하다 | main session |
| p50 해석 (§2.3) | U4, U5 읽기 A/B/C 중 하나. QW1 측정 전 | system-architect, product-manager (#88 갱신) |

## Sources

- [S-U0b-1] baseline1 summary | `deploy/traffic/review/cc/runs/20261014T050303Z_baseline1_b13f4ee/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read
- [S-U0b-2] baseline2 summary | `deploy/traffic/review/cc/runs/20261014T050727Z_baseline2_b13f4ee/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read
- [S-U0b-3] baseline3 summary | `deploy/traffic/review/cc/runs/20261014T051216Z_baseline3_b1fcedc/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read
- [S-U0b-4] raw request logs | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: run 1 lines 1–75 read, guards and status lines grepped in all three
- [S-U0b-5] run manifests | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: params, env, guards keys grepped
- [S-U0b-6] traffic checks | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/traffic-check.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-U0b-7] VM metrics | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/vm.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-U0b-8] rail HTML bodies | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/rail_{plain,cookie,cookie_fresh}.html` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: rail aside width class grepped
- [S-U0b-9] measurement script snapshot | `deploy/traffic/review/cc/runs/20261014T051216Z_baseline3_b1fcedc/cc-measure.snapshot.mjs` | published: 2026-10-14 | accessed: 2026-10-14 | type: code | note: full file read, code_sha 7c45cff7baf1 same in all three manifests
- [S-U0b-10] Phase CC design rev2 §5.3, §7 | `cc.design.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: full file read
- [S-U0b-11] decision #88 pre-registration | `decisions.plan.md` line 157 | published: 2026-10-14 | accessed: 2026-10-14 | type: decision | note: row read
- [S-U0b-12] task rows CC-U0b to CC-U5 | `00.tasks.md` lines 869–958 | published: 2026-10-14 | accessed: 2026-10-14 | type: plan | note: rows read
