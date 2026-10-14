# U4 판정 (attempt 2, 배포 `f122265`)

- 작성: data-analyst, 2026-10-14. 저장된 run 파일만 읽었다. 코드, git, 네트워크는 쓰지 않았다.
- 숫자는 모두 아래 Sources의 파일에서 읽었다. 손으로 고른 값이 아니다.
- 배포 `f122265`는 측정 뒤 `7b1d1c9`로 되돌려졌다 (dispatch 사실).

## 0. 결론

| 항목 | 값 | 판정 |
| --- | --- | --- |
| 주 지표 `w1_nav_ms_s2_s6`, 로그인(auth) expanded | 329 → **434 ms** (+105) | **FAIL**. 판정선 ≤ 261 ms |
| 느려진 곳 | s4 (프로젝트 상세) +34, s5 (글 상세) +95 ms, 단계 중앙값 | s2, s3, s6은 변화 없음 (−2 … 0) |
| G-a 10초 창 최대 요청 수 | 로그인 35 → 53 / 50 / 50 | **FAIL**. #68 한도 50 / 10 s에 닿는다 |
| G-b 메뉴 링크 1개당 prefetch | 최댓값 2 → 6 | **FAIL** |
| 판별 | 느려짐은 prefetch 폭증 단계가 아니다. 오리진(origin)으로 가는 로그인 상세 이동에만 있다 | 구조 쪽 가설(H-S)이 우세. 단 H-C(오리진 경합)는 열려 있다 |

## 1. 사전 등록 판정

**무엇을 알려고 쓰나:** cacheComponents가 로그인 사용자의 걸음 전체(s2–s6) 시간을 줄였는가.

| 칸 | 값 | 출처 |
| --- | --- | --- |
| 주 지표 | `w1_nav_ms_s2_s6`, 로그인(auth) expanded, run 값 3개의 중앙값 | [S-U4-1] U4 행 |
| 비교 기준 | `0ac938c` 위 하네스(harness) v2 3회: 295 / 329 / 329, 중앙값 329, 범위 34 | [S-U4-2] 49행 |
| 판정선 | max(34 × 2, 329 × 0.1) = 68 ms. 통과 조건 = U4 중앙값 ≤ 261 ms | [S-U4-1] |
| U4 값 | 482 / 421 / 434, 중앙값 **434**, 범위 61 | [S-U4-3] 49행 |
| 판정 | 감소 = 329 − 434 = **−105 ms**. 판정선 68 ms에 못 미친다. **FAIL** | |
| 조건 확인 | 두 폴더 모두 하네스 `code_sha` `2d5f4acc0be4`, `v2`, `linux 6.17.0-1022-azure`, chromium `156.0.8078.4` | [S-U4-4], [S-U4-5] |
| 결과 조치 | 사전 등록 kill: U4 되돌림 + `recover`. 되돌림은 이미 `7b1d1c9` | [S-U4-1] U4 행 kill 칸 |

- 실패의 종류: 사전 등록 실패 조건은 "미달"이다. 이번 결과는 미달이 아니라 **회귀(regression)**다. 지표가 105 ms 늘었다.
- 이 구분은 `recover`에 중요하다. "효과가 작다"가 아니라 "반대 방향 효과가 있다"이다.

## 2. 단계별 표 (s2…s6)

**무엇을 알려고 쓰나:** 늘어난 105 ms가 어느 단계에 있는가. prefetch가 많은 단계인가, 글 상세인가.

### 2.1 단계 중앙값과 차이

- 값 = 단계별 `nav_ms`(`[nav]` 콘솔 줄) run 3개의 중앙값 [S-U4-2], [S-U4-3].
- 주의: 단계 중앙값의 합은 단위 값(합의 중앙값)과 다르다. 단위 값은 2.2의 run 합을 본다.

| 팔(arm) | 단계 | 기준 v2 (ms) | U4 (ms) | 차이 |
| --- | --- | --- | --- | --- |
| 로그인 expanded | s2 posts | 20 | 18 | −2 |
| | s3 projects | 21 | 21 | 0 |
| | s4 project | 105 | 139 | **+34** |
| | s5 post | 142 | 237 | **+95** |
| | s6 home | 21 | 20 | −1 |
| | 합 (단위 값) | 329 | 434 | **+105** |
| 로그인 collapsed | s2 / s3 / s4 / s5 / s6 | 20 / 22 / 101 / 143 / 23 | 18 / 20 / 143 / 278 / 20 | −2 / −2 / **+42** / **+135** / −3 |
| | 합 (단위 값) | 307 | 472 | +165 |
| 익명 expanded | s2 / s3 / s4 / s5 / s6 | 69 / 19 / 34 / 74 / 22 | 60 / 19 / 31 / 72 / 19 | −9 / 0 / −3 / −2 / −3 |
| | 합 (단위 값) | 218 | 201 | −17 |
| 익명 collapsed | s2 / s3 / s4 / s5 / s6 | 77 / 18 / 34 / 66 / 22 | 64 / 19 / 30 / 65 / 19 | −13 / +1 / −4 / −1 / −3 |
| | 합 (단위 값) | 218 | 196 | −22 |

### 2.2 run별 분해 (로그인 팔)

- 값 = `raw.jsonl`의 `kind:"step"` 줄 [S-U4-6], [S-U4-7]. run 합은 `summary.csv` `values`와 맞는다.
- 칸 형식: `nav_ms (rsc / prefetch)`. rsc = 그 단계의 `_rsc` 요청 수, prefetch = 그중 `next-router-prefetch` 요청 수.

| 팔 | 배포 | run | s1 prefetch | s2 | s3 | s4 | s5 | s6 | s4+s5 | s2+s3+s6 | 합 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 로그인 expanded | 기준 | 1 | 13 | 20 (2/1) | 21 (1/0) | 105 (3/2) | 128 (3/2) | 21 (0/0) | 233 | 62 | 295 |
| | 기준 | 2 | 13 | 20 (2/1) | 21 (1/0) | 125 (3/2) | 142 (3/2) | 21 (0/0) | 267 | 62 | 329 |
| | 기준 | 3 | 13 | 20 (2/1) | 22 (1/0) | 98 (3/2) | 167 (3/2) | 22 (0/0) | 265 | 64 | 329 |
| | U4 | 1 | **32** | 18 (1/0) | 21 (1/0) | 174 (5/4) | 249 (5/4) | 20 (0/0) | **423** | 59 | 482 |
| | U4 | 2 | **32** | 18 (1/0) | 21 (1/0) | 134 (**2/1**) | 228 (5/4) | 20 (0/0) | **362** | 59 | 421 |
| | U4 | 3 | **32** | 18 (1/0) | 21 (1/0) | 139 (**2/1**) | 237 (5/4) | 19 (0/0) | **376** | 58 | 434 |
| 로그인 collapsed | 기준 | 1 | 13 | 20 (2/1) | 21 (1/0) | 101 (3/2) | 134 (3/2) | 23 (0/0) | 235 | 64 | 299 |
| | 기준 | 2 | 13 | 19 (2/1) | 44 (1/0) | 103 (3/2) | 170 (3/2) | 22 (0/0) | 273 | 85 | 358 |
| | 기준 | 3 | 13 | 21 (2/1) | 22 (1/0) | 98 (3/2) | 143 (3/2) | 23 (0/0) | 241 | 66 | 307 |
| | U4 | 1 | **32** | 18 (1/0) | 20 (1/0) | 143 (5/4) | 271 (5/4) | 20 (0/0) | **414** | 58 | 472 |
| | U4 | 2 | **32** | 18 (1/0) | 20 (1/0) | 150 (**2/1**) | 278 (5/4) | 26 (0/0) | **428** | 64 | 492 |
| | U4 | 3 | **32** | 18 (1/0) | 20 (1/0) | 132 (**2/1**) | 283 (5/4) | 19 (0/0) | **415** | 57 | 472 |

- 익명 팔의 `_rsc` 모양: s1 prefetch 7 → 20, s2 2/1 → 1/0, s4 2/1 → 2/1, s5 3/2 → 5/4. 모든 run이 같다 [S-U4-6], [S-U4-7].
- W1 `_rsc` 합: 로그인 22 → 41–44, 익명 15 → 29 [S-U4-2], [S-U4-3].

### 2.3 이동 요청의 엣지 캐시 상태

| 팔 | s4, s5 이동 요청 `cf_cache_status` | 기준 | U4 |
| --- | --- | --- | --- |
| 익명 (두 rail) | 엣지 HIT | HIT | HIT |
| 로그인 (두 rail) | 오리진 렌더 | DYNAMIC | DYNAMIC |

- 로그인 s2, s3 이동 요청도 두 배포 모두 DYNAMIC이다. 그런데 `[nav]`는 18–22 ms다 [S-U4-8].
- 추정: s2, s3은 s1의 메뉴 prefetch로 화면을 먼저 바꾼다. 그래서 `[nav]`가 오리진 응답을 기다리지 않는다 (inference).
- 그 결과 오리진 응답을 기다리는 `[nav]`는 로그인 s4, s5 두 개뿐이다.

### 2.4 s4, s5 안의 prefetch 시각 (로그인 expanded)

- 시각 = 이동 요청 `at` 기준, `raw.jsonl` [S-U4-6], [S-U4-7].

| 배포 | 단계 | `/_tree` | 두 번째 묶음 | 두 번째 묶음의 내용 |
| --- | --- | --- | --- | --- |
| 기준 | s4 | +14, +15, +14 ms | +65, +88, +72 ms | 전체 prefetch 1개 (segment 없음) |
| 기준 | s5 | +16, +16, +15 ms | +62, +74, +70 ms | 전체 prefetch 1개 |
| U4 | s4 | +14 ms (run 1) | +168 ms (run 1). run 2, 3은 없음 | `/_head`, 상세 segment, `__PAGE__` 3개 |
| U4 | s5 | +17, +17, +17 ms | +143, +154, +137 ms | `/_head`, `$d$slug`, `__PAGE__` 3개 |

- 모든 prefetch는 이동하는 그 URL로 간다. 메뉴나 카드 `Link`의 prefetch가 아니다. 라우터(router)가 이동 중에 낸다.
- 카드 링크 prefetch는 두 배포 모두 0이다 (`g_b_card_prefetch_total`) [S-U4-2], [S-U4-3].

## 3. 가드

**무엇을 알려고 쓰나:** U4가 다른 선을 깼는가. 하나라도 깨지면 되돌림이다 (criteria §2).

| ID | 통과 기준 | 기준 값 | U4 값 | 판정 | 출처 |
| --- | --- | --- | --- | --- | --- |
| G-a | U0b + 20 % 이하: 로그인 expanded 45.6, collapsed 46.8, 익명 27.6 | v2 기준: 로그인 35, 익명 22 | 로그인 expanded **53 / 50 / 50**, collapsed **53 / 50 / 50**, 익명 **36 / 36 / 36** | **FAIL** (모든 팔) | [S-U4-1] 58행, [S-U4-2], [S-U4-3] 54, 122, 18, 91행 |
| G-a 참고 | #68 Cloudflare 한도 50 / 10 s | 35 | 로그인 50–53 | 한도에 닿거나 넘는다. 실제 로그인 사용자가 막힐 수 있다 | [S-U4-9] |
| G-b | 링크 1개당 prefetch, 기준보다 늘지 않음 (U0b 최댓값 익명 2, 로그인 5) | v2: 최댓값 2 / 2, 평균 1.75 / 1.86, 합 7 / 13 | 최댓값 익명 6 / 7 / 6, 로그인 6 / 6 / 5. 평균 5 / 4.57. 합 20 / 32 | **FAIL** | [S-U4-2], [S-U4-3] 24–26, 60–62행 |
| G-c | traffic-check 0 FAIL | 0 FAIL | 0 FAIL × 3 | 통과 | [S-U4-10] |
| G-d | 공개 응답 `set-cookie` 0줄 | 0 | 0 × 3 | 통과 | [S-U4-11] |
| G-e, G-e2 | `/nope`, `/@nope/x`, `/@taeklim/nope` → 404 | 404 | 404 / 404 / 404 × 3 | 통과 | [S-U4-11] |
| G-f | hydration 오류 0, 네 그룹 | 0 | 0, 네 그룹 × 3 run | 통과 | [S-U4-3] 35, 71, 103, 134행 |
| G-g | 비공개 글 404 | 미측정 | 미측정 (manifest 경고) | 미측정 | [S-U4-5] |
| G-h | prefetch와 이동의 `_rsc` 값이 다름 | | 이 메모에서 계산하지 않았다 | 미확인 | |
| G-i | VM 메모리 < 80 % | | `vm.txt`를 읽지 않았다 | 미확인 | |
| G-j | 서버 fetch / MISS 렌더 ≤ 13 | 12 (U2, U3) | 12 / 12 / 12, 범위 0, valid 3/3 | 통과 | [S-U4-12] |
| G-k | 익명 HTML이 rail 쿠키와 무관 | 참 | `rail_width_same: true` × 3 | 통과 | [S-U4-11] |

- 기록만: `w2_back3_rsc` 0 → 3 (익명 3 / 3 / 3, 로그인 0 / 3 / 3). 뒤로 가기에서 `_rsc` prefetch가 새로 생겼다. `w2_back3_rsc_nonprefetch`는 0 유지 [S-U4-3] 16, 52행.
- `step_errors` 1 (expanded 팔)은 기준과 U4가 같다. U4가 만든 것이 아니다 [S-U4-2], [S-U4-3].

## 4. 판별: prefetch 폭증인가, 구조인가

**무엇을 알려고 쓰나:** #70 방식(메뉴 링크를 hover 전용 또는 `prefetch={false}`)으로 회귀를 고칠 수 있는가.

```
prefetch 폭증이 있는 곳        느려진 곳
s1 (메뉴, 13→32) ─────────►  s2 18 ms, s3 21 ms : 변화 없음
W4 (메뉴 링크 2→6)  ─────────►  주 지표에 들어가지 않는다
s4, s5 (라우터 segment)  ────►  로그인 +34 / +95 ms, 익명 −3 / −2 ms
                                └ 차이는 이동 요청이 DYNAMIC(오리진)인가 HIT(엣지)인가
```

### 4.1 가설

| ID | 가설 | 맞으면 고치는 길 |
| --- | --- | --- |
| H-P | 메뉴 prefetch 폭증이 이동을 느리게 한다 | #70: 메뉴 링크 hover 전용 (`cc.design.md` §8 491행의 첫 처방) |
| H-S | cacheComponents에서 로그인 상세 route의 오리진 렌더(dynamic hole)가 느려졌다 | 구조. prefetch로는 못 고친다 |
| H-C | s4, s5에서 라우터가 같은 URL로 내는 segment prefetch 3–4개가 오리진에서 이동 렌더와 경합한다 | prefetch 계열이나 Link 설정 밖. 라우터 segment 요청이다 |
| H-G | `f122265`의 proxy 404 gate가 로그인 이동에 비용을 더했다 | proxy 쪽 |

### 4.2 근거

1. **H-P 기각.** s1 prefetch는 로그인 13 → 32로 폭증했다. 그 바로 다음 s2, s3은 변화가 없다 (20 → 18, 21 → 21). s2+s3+s6 run 합은 62–64 → 58–59다 (2.2).
2. **회귀 전부가 s4+s5에 있다.** 로그인 expanded s4+s5 run 합 233 / 267 / 265 → 423 / 362 / 376. 나머지 단계 합은 오히려 3–5 ms 줄었다 (2.2).
3. **prefetch 수가 기준보다 적어도 느리다.** U4 로그인 s4 run 2, 3은 prefetch 1개다. 기준은 2개다. 그래도 134, 139 ms로 기준 98–125 ms보다 느리다. collapsed run 2, 3도 같다 (150, 132 대 98–103).
4. **같은 prefetch 모양, 다른 결과.** 익명 s5도 3/2 → 5/4로 똑같이 늘었다. 그러나 익명 s5는 74 → 72 ms다. 익명 이동 요청은 엣지 HIT, 로그인은 DYNAMIC이다 (2.3).
5. **H-G는 설계상 0이다.** `cc.design.md` §18.1은 "로그인 RSC 이동은 검사하지 않는다"고 적는다 [S-U4-13]. 이 메모는 배포 코드 `f122265`와 그 문장이 같은지 확인하지 않았다 (git 금지). 설계 주장이고 미검증이다.

### 4.3 판별 결론

- 느려짐은 prefetch 폭증 단계에 있지 않다. 오리진으로 가는 로그인 상세 이동(s4, s5)에만 있다.
- 그래서 #70 방식(메뉴 hover 전용, `prefetch={false}`)은 **G-a, G-b를 고칠 수는 있다**. 그러나 주 지표 `w1_nav_ms_s2_s6`는 거의 움직이지 않을 것이다 (H-P 기각, 근거 1–3).
- 우세 가설은 **H-S**다. cacheComponents + 로그인 dynamic hole의 오리진 렌더 비용이다.
- **열린 것: H-C.** U4 s5에서 segment prefetch 3개가 이동 시작 뒤 +137–154 ms에 오리진으로 간다. 이동은 228–249 ms다. 그래서 이동 후반과 겹친다. #68 기록은 웹 오리진 MISS 용량을 약 2 rps로 적는다 [S-U4-9]. 근거 3은 s4의 기본 렌더 비용이 올랐다고 말한다. 그러나 s5의 +95 ms 중 일부가 경합인지는 이 데이터로 가를 수 없다.
- H-S와 H-C를 가르는 측정: s4, s5 이동 하나에서 라우터 segment prefetch가 없는 조건의 run, 또는 오리진 쪽 요청별 렌더 시간. 라우터 segment 요청이 `Link`의 `prefetch={false}`로 꺼지는지는 이 데이터에 없다 (inference). 측정 설계는 system-architect의 몫이다.
- 판정은 H-S, H-C 어느 쪽이든 FAIL 그대로다. 갈림은 `recover`가 어느 선택지를 먼저 시도하느냐다.

## 5. `recover`에 넘기는 선택지 (data-analyst 범위: 측정과 분석 방법)

| 선택지 | 무엇을 아는가 | 대가 |
| --- | --- | --- |
| A. 오리진 요청별 시간 수집 (VM의 blog-web 로그, curl run의 `blog-web-log.json`과 같은 출처) | H-S와 H-C를 직접 가른다 | 그 로그에 요청 지연 필드가 있는지 이 메모는 확인하지 않았다. 하네스 변경이 필요할 수 있다 |
| B. 두 가드(G-a, G-b)를 주 지표와 따로 판정 | #70 tactic의 효과를 G-a, G-b에서만 잰다 | 주 지표 회귀는 그대로 남는다 |
| C. 판정 없이 닫고 U4 설계로 돌아감 | 측정 비용 0 | H-C가 맞으면 구조를 버릴 이유가 약해진다 |

- 아키텍처 선택(U4를 다시 어떻게 만들지)은 system-architect의 몫이다. 최종 선택은 오너다.

## Sources

- [S-U4-1] CC criteria | `deploy/traffic/review/cc/criteria.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: §1 U4 (rev2.2) row and §2 guard table read in full
- [S-U4-2] U4 v2 baseline summary | `deploy/traffic/review/cc/runs/20261014T074439Z_U4_u4base_v2_0ac938c_browser/summary.csv`, `browser_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-U4-3] U4 attempt 2 browser summary | `deploy/traffic/review/cc/runs/20261014T092201Z_U4_u4_f122265_browser/summary.csv`, `browser_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-U4-4] U4 v2 baseline manifest | `deploy/traffic/review/cc/runs/20261014T074439Z_U4_u4base_v2_0ac938c_browser/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: code_version, code_sha, env, warnings grepped
- [S-U4-5] U4 attempt 2 browser manifest | `deploy/traffic/review/cc/runs/20261014T092201Z_U4_u4_f122265_browser/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: code_version, code_sha, env, warnings grepped
- [S-U4-6] U4 v2 baseline raw | `deploy/traffic/review/cc/runs/20261014T074439Z_U4_u4base_v2_0ac938c_browser/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: `kind:"step"` lines for walk w1 runs 1 to 3 read in full; s4 and s5 `_rsc` request lines grepped for `at`, `prefetch`, `segment`, `cf_cache_status`
- [S-U4-7] U4 attempt 2 raw | `deploy/traffic/review/cc/runs/20261014T092201Z_U4_u4_f122265_browser/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: same greps as S-U4-6
- [S-U4-8] s2 and s3 cache status | same files as S-U4-6 and S-U4-7 | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: auth expanded non-prefetch `_rsc` lines at s2, s3 grepped
- [S-U4-9] Decision #68 | `decisions.plan.md` 137행 | published: 2026-10-13 | accessed: 2026-10-14 | type: design | note: grep of the decision line only
- [S-U4-10] U4 traffic checks | `deploy/traffic/review/cc/runs/*_U4_u4_{1,2,3}_f122265/traffic-check.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: run 1 file read in full; FAIL lines grepped in all three
- [S-U4-11] U4 curl manifests | `deploy/traffic/review/cc/runs/*_U4_u4_{1,2,3}_f122265/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: guard keys grepped (status_nope*, public_set_cookie_lines, rail_width_same, code_sha)
- [S-U4-12] U4 QW1-metric counts | `deploy/traffic/review/cc/runs/*_U4_u4_{1,2,3}_f122265/ssr_fetch_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-U4-13] CC design | `cc.design.md` §17 (917–969행), §18.1 (979–992행), §8 491행 | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: sections read; deployed commit not compared (no git)
- [S-U4-14] browser harness snapshot | `deploy/traffic/review/cc/runs/20261014T092201Z_U4_u4_f122265_browser/cc-browser.snapshot.mjs` | published: 2026-10-14 | accessed: 2026-10-14 | type: code | note: lines 150 to 470 read; used to confirm step records, warmup runs labelled run 0, and metric definitions
