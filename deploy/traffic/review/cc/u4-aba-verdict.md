# U4 A-B-A 판정 (recovery 2/2, T 배포 `7977436`)

- 작성: data-analyst, 2026-10-14. 저장된 run 파일만 읽었다. run, git, 네트워크는 쓰지 않았다.
- 숫자는 아래 Sources의 파일에서 읽었다. 이 메모는 정렬, 중앙값, 시각 변환만 계산했다.
- 사전 등록 규칙은 `cc.design.md` §19.4다 [S-ABA-1]. 이 메모는 규칙을 고치지 않는다.
- 저장 파일이 없는 사실은 "dispatch 기록"으로 표시한다.

## 0. 결론

**결과: 주 지표 `w1_nav_ms_s2_s6`(로그인 expanded)는 무효, 판정 없음.**
A-A 차 d = 534 ms가 0.10 × c̃ = 89.75 ms를 넘는다 (§19.4 1단계).
가드 G-a, G-b는 T 5 run 모두 통과다. G-b에는 측정 범위 한계가 있다 (§3.4).

| 항목 | 값 | 판정 |
| --- | --- | --- |
| 유효 검사 (§19.4 1단계) | d = \|643 − 1177\| = 534. 한도 0.10 × 897.5 = 89.75 | **무효, 판정 없음** |
| 묶음 시간 (§19.3) | 58분 41초. 첫 warmup부터 재면 59분 34초 | 60분 이내 |
| G-a, 10초 창 최대 요청 수 | T 로그인 20 / 25 / 21 / 28 / 27 (한도 45.6). T 익명 23 / 23 / 22 / 24 / 22 (한도 27.6) | **통과** 5/5 |
| G-b, 메뉴 링크 1개당 prefetch 최댓값 | T 두 팔 모두 0 × 5 (한도 익명 2, 로그인 5) | **통과** 5/5. 측정 범위 주의 (§3.4) |
| §19.6 읽기 | 무효 (d > 10 %) | 그 시간대가 흔들렸다. 판정 없이 다른 조용한 시각에 다시 |

```
UTC 시각 (raw.jsonl `at`에서 변환. 끝 시각은 추정, §5.2)

16:43:40     C1 첫 줄 (warmup run 0)
16:44:33  ┐  C1 첫 집계 run 시작
17:01:15  │  C1 끝
17:01:48  │  T 배포 + purge (17:01:55까지, dispatch 기록)
17:03:09  │  T 첫 줄 (warmup run 0)
17:04:07  │  T 첫 집계 run 시작
17:22:41  │  T 끝
          │  대기 약 9.7분 (main session 대기 루프 버그, dispatch 기록)
17:32:21  │  C 되돌림 + purge (17:32:30까지). 직후 `/` 502 1회 (dispatch 기록)
17:34:04  │  C2 첫 줄 (warmup run 0)
17:35:03  │  C2 첫 집계 run 시작
17:43:14  ┘  C2 끝          묶음 창 = 58분 41초
```

## 1. 사전 등록 판정 (§19.4)

**무엇을 알려고 쓰나:** 같은 대조 build의 두 블록(C1, C2)이 같은 값을 내는가. 같아야 T를 그 시간대와 비교할 수 있다.

### 1.1 표

| 칸 | 값 | 출처 |
| --- | --- | --- |
| 주 지표 | `w1_nav_ms_s2_s6`, 로그인(auth) expanded, run마다 값 1개, 블록마다 5 run | [S-ABA-1] 1173행 |
| C1, 운영 `964c9f8` | 643 / 1134 / 526 / 560 / 1307. m(C1) = **643** | [S-ABA-4] 49행 |
| C2, 운영 `964c9f8` | 661 / 2278 / 528 / 1946 / 1177. m(C2) = **1177** | [S-ABA-6] 13행 |
| 대조 10 run 정렬 | 526, 528, 560, 643, 661, 1134, 1177, 1307, 1946, 2278 | 위 두 행 |
| c̃ | (661 + 1134) / 2 = **897.5** | |
| 0.10 × c̃ | **89.75** | |
| d | \|643 − 1177\| = **534**. c̃의 59.5 % | |
| 1단계 결과 | 534 > 89.75. **무효** | [S-ABA-1] 1177행 |
| 2–4단계 | 계산하지 않는다. 무효 묶음에는 판정선, 통과, 회귀가 없다 | [S-ABA-1] 1201행 |

### 1.2 시각화

```
대조 10 run (ms), c̃ = 897.5

 500      700      900     1100     1300  ...  1900     2300
  │ C1 526 │        │        │ C1 1134│        │        │
  │ C2 528 │        │        │ C2 1177│        │ C2 1946│ C2 2278
  │ C1 560 │        │        │ C1 1307│        │        │
  │ C1 643 │        │        │        │        │        │
  │ C2 661 │        c̃        │        │        │        │
  └─ 낮은 쪽 5개 ──┘          └──── 높은 쪽 5개 ────────────┘
```

### 1.3 어떻게 하나

1. 블록마다 run 값 5개의 중앙값을 잡는다. C1 643, C2 1177.
2. 두 중앙값의 차를 잰다. d = 534.
3. 대조 10개 전체의 중앙값 c̃를 잡는다. 짝수 개라 가운데 두 값의 평균이다. 897.5.
4. d를 0.10 × c̃와 비교한다. 534 > 89.75라서 묶음은 무효다.

### 1.4 읽는 법

| 경우 | 뜻 |
| --- | --- |
| d ≤ 0.10 × c̃ | 유효. 2단계 판정선 L로 간다 |
| d > 0.10 × c̃ (이번) | 같은 build의 두 블록이 달랐다. 주 지표 판정 없음 |

### 1.5 퍼짐 기록 (§19.4, 판정에 쓰지 않음)

| 값 | 계산 | 결과 |
| --- | --- | --- |
| Q1, Q3 | 정렬한 10개를 반으로 나눠 각 반의 중앙값 (median of halves) | Q1 560, Q3 1307 |
| IQR | Q3 − Q1 | 747 |
| trimmed 범위 | 최솟값 526, 최댓값 2278을 뺀 528–1946 | 1418 |

- 관찰: 대조 10개가 두 무리로 갈린다. 낮은 쪽 526–661 (5개), 높은 쪽 1134–2278 (5개).
- c̃ 근처 값은 없다. C1은 높은 쪽이 2개, C2는 3개다.
- 그래서 블록 중앙값이 어느 무리에 떨어지느냐가 d를 정한다.

## 2. 단계별 관찰 (OBSERVATION, 판정 아님)

**무엇을 알려고 쓰나:** 세 블록의 차이가 어느 단계에 있는가. 다음 길 설계의 입력이다. 묶음이 무효라 이 절은 판정이 아니다.

### 2.1 단계 중앙값과 run 값 (로그인 expanded, `[nav]` ms)

- 값 = `summary.csv`의 단계 행. 칸 형식: `중앙값 (run 1 … 5)`.
- 단계 중앙값의 합은 합의 중앙값(단위 값)과 다르다.

| 단계 | C1 `964c9f8` | T `7977436` | C2 `964c9f8` | 출처 행 C1 / T / C2 |
| --- | --- | --- | --- | --- |
| s2 posts (메뉴 링크) | 21 (21 22 21 21 21) | **468** (463 1118 405 468 1131) | 21 (21 379 19 95 21) | 39 / 39 / 3 |
| s3 projects (메뉴 링크) | 23 (22 21 24 23 23) | **250** (208 803 249 250 557) | 22 (22 20 23 20 22) | 41 / 41 / 5 |
| s4 project (본문 링크) | 186 (143 296 143 186 309) | 196 (196 830 172 185 605) | **444** (262 896 143 444 453) | 43 / 43 / 7 |
| s5 post (본문 링크) | 431 (431 773 315 304 930) | 428 (341 1302 418 428 894) | **657** (333 959 320 1365 657) | 45 / 45 / 9 |
| s6 home (메뉴 링크) | 24 (26 22 23 26 24) | 20 (21 20 21 20 20) | 23 (23 24 23 22 24) | 47 / 47 / 11 |
| 합 (단위 값) | 643 | 1351 | 1177 | 49 / 49 / 13 |

출처: [S-ABA-4], [S-ABA-5], [S-ABA-6]. 메뉴 링크와 본문 링크의 구분은 하네스 `goTo` scope다 [S-ABA-13] 264–268행.

### 2.2 단계별 `_rsc` 요청 모양 (로그인 expanded)

- 값 = `raw.jsonl`의 `kind:"step"` 줄. 칸 형식: `rsc / prefetch`.
- 대조 두 블록은 10 run 모두 같은 모양이다 [S-ABA-10], [S-ABA-12].

| 단계 | C1, C2 (10 run 모두) | T run 1 / 2 / 3 / 4 / 5 |
| --- | --- | --- |
| s1 home | 13 / 13 | 0 / 0 × 5 |
| s2 posts | 2 / 1 | 2/1, 9/8, 2/1, 9/8, 9/8 |
| s3 projects | 1 / 0 | 8/7, 6/5, 8/7, 6/5, 2/1 |
| s4 project | 3 / 2 | 5/4, 5/4, 5/4, 5/4, 8/7 |
| s5 post | 3 / 2 | 2/1, 5/4, 2/1, 5/4, 5/4 |
| s6 home | 0 / 0 | 3/3 × 5 |

출처: T [S-ABA-11] 456–2568행.

### 2.3 관찰

1. **s1 prefetch가 사라졌다.** 대조는 첫 화면에서 prefetch 13개를 낸다. T는 0개다. hover 전용 prefetch(#102 b)가 viewport prefetch를 껐다 [S-ABA-3].
2. **s2, s3은 두 대조 블록에서 안정적이다.** 중앙값 21–23 ms다. s3은 대조 10 run이 모두 20–24 ms다.
3. C2 s2에는 튀는 run이 2개 있다 (379, 95 ms). 중앙값은 21로 C1과 같다.
4. **T만 s2, s3이 다르다.** s2 405–1131 ms, s3 208–803 ms다.
5. 앞 메모의 추정: 대조 s2, s3이 약 20 ms인 것은 s1 메뉴 prefetch 덕이다 [S-ABA-15] §2.3. T에는 그 prefetch가 없다. 그래서 s2, s3 이동이 오리진 응답을 기다린다 (inference).
6. **s4, s5는 흔들림과 섞였다 (confounded).** T 중앙값 196, 428은 C1 186, 431에 가깝다.
7. 그러나 같은 build인 C2가 s4 +258, s5 +226 ms 움직였다 (중앙값, C1 대비).
8. 그래서 이 데이터로 cacheComponents가 s4, s5에 중립이라고 말할 수 없다. 느리다고도 말할 수 없다.
9. s6은 세 블록 모두 20–26 ms다.
10. 기록만: T s2 prefetch가 run마다 1 또는 8로 갈린다 (run 1, 3 대 run 2, 4, 5). 원인은 이 데이터에 없다.
11. 기록만: T s6에 prefetch 3개가 생겼다. 대조는 0개다. 원인은 이 데이터에 없다.

### 2.4 구조: 합 지표와 메뉴 prefetch

```
w1_nav_ms_s2_s6 = s2 + s3 + s4 + s5 + s6
                  └─┬──┘   └──┬──┘
       메뉴 prefetch로 가려짐   본문 링크 (대조에서도 오리진 대기)
       hover 전용이면 이 비용이 합에 그대로 더해진다
```

- 주 지표는 s2–s6의 합이다. s2, s3은 메뉴 링크 이동이다.
- 메뉴 prefetch를 없애면 s2, s3의 오리진 대기 비용이 합에 직접 더해진다.
- 단계 중앙값으로 본 s2 + s3: C1 44, C2 43, T 718 ms. 차이는 약 675 ms다.
- 그래서 hover 전용 prefetch 아래에서 이 합 지표가 줄려면, 다른 단계가 s2 + s3 증가보다 더 줄어야 한다.
- 이것은 지표 정의에서 나오는 사실이다. 판정이 아니다.

## 3. 가드 (판정)

**무엇을 알려고 쓰나:** T가 요청 수의 선을 깼는가. 요청 수는 지연 흔들림과 무관하다 (§19.2) [S-ABA-1] 1149행. 그래서 무효 묶음에서도 판정한다.

### 3.1 표

| 가드 | 팔 | 한도 (U0b 기준) | C1 run 값 | T run 1–5 | C2 run 값 | T 판정 | 출처 행 C1 / T / C2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-a `g_a_max_10s` | 익명 expanded | ≤ 27.6 | 27 25 22 22 22 | 23 23 22 24 22 | 없음 (팔 제외) | **통과** 5/5 | 18 / 18 / 없음 |
| G-a `g_a_max_10s` | 로그인 expanded | ≤ 45.6 | 35 33 35 34 31 | 20 25 21 28 27 | 35 31 35 33 33 | **통과** 5/5 | 54 / 54 / 18 |
| G-b `g_b_prefetch_per_menu_link_max` | 익명 expanded | ≤ 2 | 2 × 5 | 0 × 5 | 없음 (팔 제외) | **통과** 5/5 | 24 / 24 / 없음 |
| G-b `g_b_prefetch_per_menu_link_max` | 로그인 expanded | ≤ 5 | 2 × 5 | 0 × 5 | 2 × 5 | **통과** 5/5 | 60 / 60 / 24 |

- 한도 출처: `criteria.md` §2 G-a, G-b 행 [S-ABA-2] 61, 62행. U4 행은 그것을 가리킨다 [S-ABA-2] 46행.
- G-a 참고: 30 초과는 오너 경보선이다 (되돌림 조건 아님). T 로그인 20–28은 그 아래다. 대조 로그인 31–35는 그 위다.
- G-a는 W1 이동 중 hover로 나간 prefetch도 센다. 집계 대상이 W1, W3, W4 요청 전부라서다 [S-ABA-13] 340–343행.

### 3.2 어떻게 하나

1. T 블록 `summary.csv`에서 가드 행의 run 값 5개를 읽는다.
2. run마다 한도와 비교한다. G-a 한도는 로그인 45.6, 익명 27.6이다. G-b 한도는 로그인 5, 익명 2다.
3. 예: T 로그인 run 4의 G-a는 28이다. 28 ≤ 45.6이라서 그 run은 통과다.

### 3.3 읽는 법

| 경우 | 뜻 |
| --- | --- |
| 5 run 모두 한도 이하 (이번) | 통과 |
| 한 run이라도 한도 초과 | FAIL. 주 지표와 무관하게 되돌림 (§19.4 가드 행) |

### 3.4 G-b 측정 범위 (판정은 바뀌지 않음)

- 하네스는 W4 `first_screen`에서 `/`를 열고 4초 기다린다. 그동안의 viewport prefetch만 메뉴 링크별로 센다 [S-ABA-13] 290–297, 345–352행.
- W4는 메뉴 링크를 hover하지 않는다. 그래서 hover 전용 build의 G-b는 구성상 0이다.
- hover로 나가는 prefetch는 G-b에 없다. W1 단계 줄에는 보인다. T s2 최대 8개, s3 최대 7개다 (2.2).
- `card_hover`는 세 블록 모든 run에서 8000 ms timeout이다. 그래서 `step_errors` = 1이다 [S-ABA-10], [S-ABA-11], [S-ABA-12].
- 그래서 카드 prefetch(`g_b_card_prefetch_total` 0)도 실제로는 재지 않았다.
- 통과는 사전 등록 셈 그대로다. 이 한계를 어떻게 다룰지는 system-architect의 몫이다.

### 3.5 기록만 (판정 대상 아님)

| 지표 | C1 | T | C2 | 출처 |
| --- | --- | --- | --- | --- |
| `w2_back3_rsc` 익명 | 0 × 5 | 7 4 7 7 7 | 없음 | [S-ABA-4], [S-ABA-5] 16행 |
| `w2_back3_rsc` 로그인 | 0 × 5 | 10 4 10 4 4 | 0 × 5 | [S-ABA-4], [S-ABA-5] 52행, [S-ABA-6] 16행 |
| `w2_back3_rsc_nonprefetch` | 0 | 0 | 0 | 같은 파일 17, 53행 |
| `auth_signed_in` 로그인 | 1 × 5 | 1 × 5 | 1 × 5 | 72 / 72 / 36행 |

- `w2_back3_rsc`는 U2 행이 "0이 아니면 가드처럼 보고"라고 적는다 [S-ABA-2] 42행. 그래서 보고한다.
- 뒤로 가기 3회에서 prefetch가 새로 생겼다. 이동 요청(`_nonprefetch`)은 0 그대로다.
- T manifest 경고: 로그인 warmup run 0에서 `window.Clerk.user` 미확인 [S-ABA-8] 39행. 집계 run 5개는 모두 로그인 확인이다.

## 4. 하네스 가정 (architect에게, 풀지 않음)

**무엇을 알려고 쓰나:** 이 하네스가 hover 전용 prefetch의 실제 이득을 잴 수 있는가.

| 사용자 | hover 시간 | hover 전용 prefetch의 이득 |
| --- | --- | --- |
| 하네스 (Playwright `click()`) | 수 ms. 포인터를 옮기고 곧 누른다 | 거의 없음 |
| 마우스 사용자 | 하네스보다 길다 | 하네스 값보다 클 수 있다 |
| 터치 사용자 | 없음 | 없음. 하네스 값에 가깝다 |

- 하네스 이동은 `link.click()`이다 [S-ABA-13] 243행.
- 위 hover 시간은 Playwright 동작에 대한 이 메모의 가정이다. 저장 파일로 잰 값이 아니다.
- 이 가정은 이 메모가 풀지 않는다. 측정 설계는 system-architect의 몫이다.

## 5. 묶음 기록 (§19.3 "기록" 칸)

**무엇을 알려고 쓰나:** 이 묶음이 §19.3의 조건을 지켰는가. 어디서 벗어났는가.

### 5.1 폴더와 실행 조건

| 블록 | 폴더 | web build | 팔 (`arms`) | rail | run | 하네스 `code_sha` / `harness_sha` |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | `deploy/traffic/review/cc/runs/20261014T164336Z_U4_u4abaC1_964c9f8_browser/` | `964c9f8` | anon, auth | expanded | 5 | `2d5f4acc0be4` / `a05a301` |
| T | `deploy/traffic/review/cc/runs/20261014T170302Z_U4_u4abaT_7977436_browser/` | `7977436` (branch `cc-u4-t`) | anon, auth | expanded | 5 | `2d5f4acc0be4` / `a05a301` |
| C2 | `deploy/traffic/review/cc/runs/20261014T173359Z_U4_u4abaC2_964c9f8_browser/` | `964c9f8` | **auth만** | expanded | 5 | `2d5f4acc0be4` / `56f6906` |

- 출처: [S-ABA-7] 2–35행, [S-ABA-8] 2–35행, [S-ABA-9] 2–34행.
- 세 블록 모두 `v2`, node `v24.3.0`, chromium `156.0.8078.4`, `linux 6.17.0-1022-azure`다.
- 하네스 스크립트 해시(`code_sha`)는 셋이 같다. `harness_sha` 차이의 내용은 이 메모가 확인하지 않았다.
- T build 구성: cacheComponents + proxy 실제 404 gate + 메뉴 링크 hover 전용 prefetch (#102 b) + 로그인 RSC gate (#103) [S-ABA-3].

### 5.2 시각 (UTC)

| 사건 | epoch ms | UTC | 출처 |
| --- | --- | --- | --- |
| C1 첫 줄 (warmup) | 1791996220402 | 16:43:40.4 | [S-ABA-10] 1행 |
| C1 첫 집계 run 시작 | 1791996273059 | 16:44:33.1 | [S-ABA-10] 158행 |
| C1 끝 (추정) | 1791997262403 + 4973 + 8020 = 1791997275396 | 17:01:15.4 | [S-ABA-10] 2749, 2801, 2802행 |
| T 배포 + purge | | 17:01:48–17:01:55 | [S-ABA-14] |
| T 첫 줄 (warmup) | 1791997388633 | 17:03:08.6 | [S-ABA-11] 1행 |
| T 첫 집계 run 시작 | 1791997447218 | 17:04:07.2 | [S-ABA-11] 166행 |
| T 끝 (추정) | 1791998547995 + 5305 + 8020 = 1791998561320 | 17:22:41.3 | [S-ABA-11] 2622, 2658, 2659행 |
| C 되돌림 + purge | | 17:32:21–17:32:30 | [S-ABA-14] |
| C2 첫 줄 (warmup) | 1791999243898 | 17:34:03.9 | [S-ABA-12] 1행 |
| C2 첫 집계 run 시작 | 1791999303084 | 17:35:03.1 | [S-ABA-12] 174행 |
| C2 끝 (추정) | 1791999780959 + 5257 + 8015 = 1791999794231 | 17:43:14.2 | [S-ABA-12] 1510, 1562, 1563행 |

- 변환: 2026-10-14 00:00:00 UTC = epoch 1791936000 s. UTC = (`at` / 1000 − 1791936000)을 시:분:초로 바꾼 값이다.
- 끝 시각 공식: 마지막 단계 W4 `first_screen`의 첫 요청 `at` + 그 단계 `wall_ms` + `card_hover` `wall_ms`.
- 저장 파일에 run 끝 시각 필드는 없다. manifest에는 `env.started`만 있다.
- 단계 시작은 첫 요청보다 몇 ms 앞이다. 브라우저 종료 시간은 들어가지 않는다. 그래서 끝 시각은 근사다.

### 5.3 60분 창

| 읽기 | 시작 | 끝 | 길이 |
| --- | --- | --- | --- |
| §19.3 그대로: 첫 집계 C1 run 시작 → 마지막 C2 run 끝 | 16:44:33.1 | 17:43:14.2 | 3521172 ms = **58분 41초** |
| 엄격한 읽기: C1 첫 warmup → 마지막 C2 run 끝 | 16:43:40.4 | 17:43:14.2 | 3573829 ms = 59분 34초 |

- 어떻게 하나: 끝 시각(5.2 공식)에서 시작 시각을 뺀다. 예: 1791999794231 − 1791996273059 = 3521172 ms.
- 두 읽기 모두 60분 이내다. 여유는 1분 19초, 엄격한 읽기로는 26초다.

| 경우 | 뜻 |
| --- | --- |
| 창 ≤ 60분 (이번, 두 읽기 모두) | §19.3 시간 조건 충족 |
| 창 > 60분 | 묶음 전체가 판정 불가 |

### 5.4 §19.3과 다른 점

| 항목 | §19.3 | 이번 | 영향 |
| --- | --- | --- | --- |
| 시각 | 조용한 시각 (기본 UTC 05–07) | 16:43–17:43 UTC | 사전 등록 이탈 1개 (#104). 이유: G-CC 날짜가 오늘 (#103) [S-ABA-3] |
| 팔 | 블록마다 같은 팔 | C1, T = anon + auth. C2 = auth만 | 아래 5.5 |
| warmup | 블록 앞 W1 1회 | 집계 run마다 팔마다 run 0 1회 + 시작에 익명 collapsed 1회. C1, T 11회, C2 6회 | 세 블록이 같은 하네스 규칙이다. 설명과 실제의 차이이고 블록 사이 차이는 아니다 |
| 전환 뒤 대기 | purge 뒤 60초 | 배포 끝 → T 첫 줄 73.6초. 되돌림 끝 → C2 첫 줄 93.9초 [S-ABA-14] | 배포 끝 기준 값이다. purge 끝 시각은 기록이 없다. 60초 대기 충족은 확인 불가 |
| T 끝 → 되돌림 | 이어서 | 약 9분 40초 대기, main session 대기 루프 버그 [S-ABA-14] | 창 여유를 줄였다. 운영은 그동안 T build였다 |
| 되돌림 직후 | | dispatch 원문: "one transient 502 on `/` right after rollback, 200 seconds later" [S-ABA-14] | C2 첫 줄(17:34:03.9)의 `/` document는 200이다 [S-ABA-12] 1행. 세 `raw.jsonl`에 5xx 응답 0줄. 집계 요청에 들어가지 않았다 |
| VM 메모리 | < 80 % | 시작 전 약 40 % [S-ABA-14] | 저장 파일 없음 |
| 다른 배포, purge, workflow | 없음 | dispatch에 다른 배포, purge, workflow 언급이 없다 [S-ABA-14] | 이 메모는 확인하지 않았다 |

- warmup 횟수 출처: 세 `raw.jsonl`의 `"run":0,"walk":"w1","step":"s1_home"` 단계 줄 수.

### 5.5 C2 팔 변경의 무게

```
C1, T (run마다):  익명 warmup → 익명 run → 로그인 warmup → 로그인 run
C2    (run마다):                          로그인 warmup → 로그인 run
```

- C1 집계 구간은 16:44:33 → 17:01:15, 약 16.7분이다. C2는 17:35:03 → 17:43:14, 약 8.2분이다.
- 그래서 C2의 로그인 run은 C1보다 약 두 배 촘촘히 돌았다. 로그인 run 앞에 익명 run도 없었다.
- 가능한 영향 두 개: 익명 run이 엣지와 오리진을 데웠을 수 있다. 로그인 run이 몰려 오리진 부하가 늘었을 수 있다.
- 어느 쪽이 얼마인지 이 데이터로 읽을 수 없다.
- 그래서 d = 534의 원인을 시간대 흔들림 하나로 단정하지 않는다. 팔 변경과 섞였다.
- 어느 원인이든 §19.4 1단계는 d만 본다. 무효는 바뀌지 않는다.

## 6. 읽는 법 (§19.6)

| 경우 | 뜻 | 이번 |
| --- | --- | --- |
| 유효 + 통과 + 가드 통과 | U4 효과 확인. G-CC 판정 근거 | |
| 유효 + 회귀 | U4가 로그인 상세 이동을 느리게 한다. `u4-verdict.md` §4 H-S, H-C 판별로 | |
| 유효 + 미달 | 효과 없음. 되돌림 | |
| 무효 (d > 10 %) | 그 시간대가 흔들렸다. 판정 없이 다른 조용한 시각에 다시 | **해당**. d = c̃의 59.5 % |
| 가드 FAIL | 주 지표와 무관하게 되돌림 | 해당 없음. G-a, G-b 통과 |

출처: [S-ABA-1] 1194–1202행.

## 7. 다음 길 입력 (사실만)

- 이 절은 system-architect에게 넘기는 사실 목록이다. 선택지 추천은 하지 않는다.

1. §19.6 무효 행은 "판정 없이 다른 조용한 시각에 다시"라고 적는다 [S-ABA-1] 1201행.
2. #104는 조용한 시각 이탈을 사전에 적었다. "흔들리면 d > 10 %로 무효"라고 적었다. 그 경우가 일어났다 [S-ABA-3].
3. #103은 G-CC 날짜를 2026-10-14로 적는다. 이 결과를 그 줄에 어떻게 적용할지는 pm과 오너의 몫이다 [S-ABA-3].
4. attempt 2를 막은 두 가드 G-a, G-b는 T에서 통과했다 (§3). G-b는 hover prefetch를 재지 않는다 (§3.4).
5. 대조 10 run이 두 무리(526–661, 1134–2278)로 갈렸다. 블록 중앙값 차가 무리 배분에 달려 있다 (§1.5).
6. 주 지표는 s2–s6 합이다. hover 전용 prefetch 아래에서 s2 + s3이 대조보다 약 675 ms 크다 (단계 중앙값, §2.4).
7. s4, s5는 C1과 C2가 달라서 T의 효과를 이 묶음으로 가를 수 없다 (§2.3).
8. 하네스 click은 hover 시간이 수 ms다 (가정, §4).
9. 이번 묶음은 블록 사이 팔이 달랐다 (C2 auth만, §5.5).
10. 60분 창 여유는 1분 19초였다. T 끝과 되돌림 사이 약 9분 40초 대기가 있었다 (§5.4).

## Sources

- [S-ABA-1] CC design §19 | `cc.design.md` 1121–1211행 | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: §19.1 to §19.7 read in full
- [S-ABA-2] CC criteria | `deploy/traffic/review/cc/criteria.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: §1 table lines 36 to 50 and §2 guard rows 61, 62 read
- [S-ABA-3] Decisions #102, #103, #104 | `decisions.plan.md` 171–175행 | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: three rows read in full
- [S-ABA-4] C1 summary | `deploy/traffic/review/cc/runs/20261014T164336Z_U4_u4abaC1_964c9f8_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read
- [S-ABA-5] T summary | `deploy/traffic/review/cc/runs/20261014T170302Z_U4_u4abaT_7977436_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read
- [S-ABA-6] C2 summary | `deploy/traffic/review/cc/runs/20261014T173359Z_U4_u4abaC2_964c9f8_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read
- [S-ABA-7] C1 manifest | `deploy/traffic/review/cc/runs/20261014T164336Z_U4_u4abaC1_964c9f8_browser/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read
- [S-ABA-8] T manifest | `deploy/traffic/review/cc/runs/20261014T170302Z_U4_u4abaT_7977436_browser/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: lines 1 to 41 read (identity, params, env, warnings)
- [S-ABA-9] C2 manifest | `deploy/traffic/review/cc/runs/20261014T173359Z_U4_u4abaC2_964c9f8_browser/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: lines 1 to 40 read (identity, params, env, warnings)
- [S-ABA-10] C1 raw | `deploy/traffic/review/cc/runs/20261014T164336Z_U4_u4abaC1_964c9f8_browser/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: first line, auth expanded W1 step lines runs 1 to 5, run 0 step lines, last W4 step lines grepped. 5xx status grepped (0)
- [S-ABA-11] T raw | `deploy/traffic/review/cc/runs/20261014T170302Z_U4_u4abaT_7977436_browser/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: same greps as S-ABA-10
- [S-ABA-12] C2 raw | `deploy/traffic/review/cc/runs/20261014T173359Z_U4_u4abaC2_964c9f8_browser/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: same greps as S-ABA-10. Last lines 1561 to 1564 read
- [S-ABA-13] Browser harness snapshot | `deploy/traffic/review/cc/runs/20261014T170302Z_U4_u4abaT_7977436_browser/cc-browser.snapshot.mjs` | published: 2026-10-14 | accessed: 2026-10-14 | type: code | note: lines 225 to 359 read (goTo, walks, metricsOf). Same code_sha in all three folders
- [S-ABA-14] Main-session dispatch | dispatch message to data-analyst, 2026-10-14 | published: 2026-10-14 | accessed: 2026-10-14 | type: dispatch | note: switch times, purge, transient 502, idle wait bug, VM memory. No saved file
- [S-ABA-15] U4 attempt 2 verdict | `deploy/traffic/review/cc/u4-verdict.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read. §2.3 inference on s2 and s3 cited, not re-measured
