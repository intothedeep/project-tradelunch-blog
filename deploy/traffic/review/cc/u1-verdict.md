# Phase CC U1 (U1a + U1b + U1c) 판정 메모

> 상태: data-analyst, 2026-10-14. 저장된 run 산출물만 읽었다. 코드, git, 네트워크는 쓰지 않았다.
> 배포 커밋: `3596e4c` (`manifest.json` `web_sha`) [S-U1-3].
> 판정 기준의 원본: `cc.design.md` §5.3 U1 행, §15.2 [S-U1-10]. 이 문서는 공식을 인용만 한다.

## 0. 결론

| 질문 | 답 |
| --- | --- |
| 사전 등록 판정을 낼 수 있나 | **판정 불가(not judgeable).** 대체 판정을 만들지 않는다 |
| 빠진 입력 | (a) 비교 기준 run 3회의 바이트 값 (b) rail 조각(rail fragment) 크기 (c) 바이트 지표 자체가 null 응답을 0으로 센다 |
| 데이터가 보이는 것 (기록만) | 재구성한 익명 W1 RSC 바이트: after-QW 317713 B → U1 289489 B (−28224 B). 줄어든 곳은 주로 prefetch 응답이다 |
| U1c가 노린 s3 | 줄지 않았다. 17548 B (U1) vs 16727 B (after-QW), +821 B |
| 가드(guard) | G-f 수화 오류(hydration error) 0. G-a 10초 최대 요청 수 최대 36 (< 50, 기준선 + 20 % 이내) |
| 익명 이동 시간 회귀 | run 3의 1434 ms는 엣지 MISS 때문이다. run 1, 2의 380 ms는 16/16 HIT인데도 높다. 원인 미확인 |
| 다음 측정 | 스크립트 고침(바이트 null 제거, 본문 저장) → 비교 기준 3회 + U1 3회. 기준 쪽은 선택지 A/B (§5) |

## 1. 판정을 낼 수 있나

### 1.1 무엇을 알려고 쓰나

U1이 익명 W1 이동의 RSC 바이트를 판정선 이상 줄였는지 안다.

### 1.2 표: 공식에 필요한 입력

공식(§5.3 U1 행): 줄어든 양 ≥ max(범위 × 2, 기준선 HAR rail 조각 크기 × 0.5) [S-U1-10].
주 대비(§5.3): 직전 단위 뒤 3회 중앙값 vs 이 단위 뒤 3회 중앙값 [S-U1-10].

| 입력 | 필요한 것 | 저장된 것 | 상태 |
| --- | --- | --- | --- |
| 직전 단위(QW) 뒤 바이트, 3회 | `rsc_bytes_w1` 3개 | after-QW 브라우저 run 1회. 값 251151 B, null 1개 포함 [S-U1-2] | 없음 (n = 1) |
| U0b 기준선 브라우저 바이트 | `rsc_bytes_w1` | 열 자체가 없다. `raw.jsonl`에 `bytes`, `xcomponent` 키가 없다 [S-U1-1] | 없음 |
| 범위(range) | 기준 run 3개의 최댓값 − 최솟값 | 기준 run이 1개뿐 | 계산 불가 |
| rail 조각 크기 R | 기준 RSC 본문에서 rail 구간 바이트 (§5.3 아래 규칙) | 브라우저 스크립트가 RSC 본문을 저장하지 않는다 [S-U1-4]. `har_summary.py`는 만들지 않았다(§14.3) | 측정한 적 없음 |
| U1 뒤 바이트, 3회 | `rsc_bytes_w1` 3개 | 270469 / 270469 / 10641 B [S-U1-3]. 셋 모두 null을 0으로 셌다 (§2) | 값은 있으나 측정 결함 |

### 1.3 시각화

```
판정선 = max( 범위 × 2 , R × 0.5 )
              │            │
              │            └─ R: 측정한 적 없음
              └─ 범위: 기준 run 1개 → 계산 불가
줄어든 양 = 기준 3회 중앙값 − U1 3회 중앙값
              │                  │
              │                  └─ null 응답을 0으로 셈 → 값이 틀림
              └─ 기준 run 1개, 그것도 null 1개 포함
```

### 1.4 어떻게 하나

1. §5.3 공식의 두 항을 하나씩 채운다.
2. 범위 항: 기준 run이 1개라 범위가 없다.
3. R 항: 저장된 본문이 없어 0.5 × R을 낼 수 없다.
4. §5.3 바닥값 규칙(잡음 0이면 바닥값)도 쓸 수 없다. U1의 바닥값이 R × 0.5 자체이기 때문이다.

### 1.5 읽는 법

- 판정선이 없으므로 통과도 실패도 적지 않는다.
- §2의 재구성 값은 사후에 고른 방법이다. 판정에 쓰지 않는다 (`rules/measurement.md` §1).

## 2. 바이트 지표의 결함: null 응답을 0으로 센다

### 2.1 무엇을 알려고 쓰나

`rsc_bytes_w1` 값이 run마다 크게 다른 이유가 엣지 상태인지 측정 결함인지 안다.

### 2.2 표: W1 익명 RSC 응답 16개 중 null 수

스크립트는 `res.body()`가 실패하면 `bytes = null`로 두고, 합계에서 `?? 0`으로 0을 더한다 (`cc-browser.snapshot.mjs` 155, 323–324행) [S-U1-4].

| run 폴더 | rail | run | W1 RSC 응답 | `cf-cache-status` | null 수 | null인 요청 | `rsc_bytes_w1` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| after-QW | expanded | 1 | 16 | 16 HIT | 1 | s2 posts 이동 | 251151 |
| after-QW | collapsed | 1 | 16 | 16 HIT | 2 | s1 projects prefetch, s5 글 이동 | 220593 |
| U1 | expanded | 1 | 16 | 16 HIT | 1 | s6 `/` 이동 | 270469 |
| U1 | expanded | 2 | 16 | 16 HIT | 1 | s6 `/` 이동 | 270469 |
| U1 | expanded | 3 | 16 | **16 MISS** | 9 | s1 2개, s2 2개, s3, s4 이동, s5 2개, s6 | 10641 |
| U1 | collapsed | 1 | 16 | 16 HIT | 2 | s2 posts 이동, s6 | 208312 |
| U1 | collapsed | 2 | 16 | 16 HIT | 3 | s2 posts 이동, s2 `/` prefetch, s6 | 168469 |
| U1 | collapsed | 3 | 16 | 16 HIT | 2 | s1 projects prefetch 2개 | 246444 |

출처: after-QW `raw.jsonl` 116–149, 513–546행 [S-U1-2]. U1 `raw.jsonl` 115–147, 651–683, 1191–1227, 483–515, 1021–1053, 1563–1595행 [S-U1-3].

### 2.3 시각화

```
U1 anon expanded rsc_bytes_w1
run 1  ██████████████████████████▉  270469   (HIT, null 1)
run 2  ██████████████████████████▉  270469   (HIT, null 1)
run 3  █                             10641   (MISS, null 9)
재구성 ████████████████████████████▉ 289489   (null 0)
```

### 2.4 어떻게 하나

1. 응답마다 `bytes`가 null인지 센다.
2. null이 아닌 값을 더해 `rsc_bytes_w1`과 맞는지 확인한다.
3. 예: U1 expanded run 3의 null 아닌 값 7개 = 258 + 257 + 448 + 4124 + 4653 + 479 + 422 = 10641. 요약 값과 같다.

### 2.5 읽는 법

- 10641 B는 페이로드가 작아서가 아니다. 응답 9개가 0으로 세어진 값이다.
- MISS 응답의 본문 크기는 HIT와 같다. 예: `_tree` prefetch 448, 479, 422 B는 MISS와 HIT에서 같다.
- null은 MISS에서 많지만 HIT에서도 난다. 그래서 270469 B도 s6 하나(19020 B)를 빠뜨린 값이다.
- 로그인 arm의 바이트(1294–15062 B)는 쓰지 않는다. `DYNAMIC` 이동 응답이 모두 null이다 (예: U1 `raw.jsonl` 302, 579, 838행) [S-U1-3].
- null의 원인(Playwright `response.body()` 실패 조건)은 확인하지 못했다. 추정이다.

## 3. 데이터가 보이는 것 (기록만, 판정 아님)

### 3.1 무엇을 알려고 쓰나

null을 채우면 U1 전후 익명 W1 바이트가 어디서 얼마나 바뀌었는지 본다.

### 3.2 표: 단계별 재구성 바이트, 익명

재구성 규칙: HIT 본문은 같은 (경로, `_rsc`) 키에서 run마다 같은 바이트다. null은 같은 배포의 다른 run 또는 다른 rail의 같은 키 값으로 채운다. 두 rail은 같은 `_rsc` 키를 쓴다.

| 단계 | 요청 | after-QW (`61d48bc`) | U1 (`3596e4c`) | 차 |
| --- | --- | --- | --- | --- |
| s1 | prefetch 7개 (`_tree` 3, resume, about, `/`, projects) | 59398 | 56950 | −2448 |
| s2 | posts 이동 | 66562 (collapsed 값으로 채움) | 62157 | −4405 |
| s2 | `/` prefetch | 53178 | 39843 | −13335 |
| s3 | projects 이동 | 16727 | 17548 | **+821** |
| s4 | project 이동 + `_tree` | 26038 + 374 | 26690 + 479 | +757 |
| s5 | 글 이동 | 52177 | 47401 | −4776 |
| s5 | `_tree` + 글 prefetch | 369 + 23731 | 422 + 18979 | −4699 |
| s6 | `/` 이동 | 19159 | 19020 (collapsed run 3 값) | −139 |
| **합 (16개)** | | **317713** | **289489** | **−28224 (−8.9 %)** |
| 이동 응답만 (5개) | | 180663 | 172816 | −7847 |
| prefetch 응답만 (11개) | | 137050 | 116673 | −20377 |

검산: 재구성 합에서 null 값만 빼면 요약 값이 그대로 나온다.

| run | 계산 | 결과 | 요약 값 |
| --- | --- | --- | --- |
| after-QW expanded | 317713 − 66562 | 251151 | 251151 |
| after-QW collapsed | 317713 − 44943 − 52177 | 220593 | 220593 |
| U1 collapsed run 1 | 289489 − 62157 − 19020 | 208312 | 208312 |
| U1 collapsed run 2 | 289489 − 62157 − 39843 − 19020 | 168469 | 168469 |
| U1 collapsed run 3 | 289489 − 448 − 42597 | 246444 | 246444 |

### 3.3 시각화

```
익명 W1 RSC 바이트, 재구성 (KB)
after-QW  이동 ████████████████████ 180.7 | prefetch ███████████████ 137.1
U1        이동 ███████████████████  172.8 | prefetch █████████████   116.7
```

### 3.4 어떻게 하나

1. 단계마다 W1 RSC 요청을 (경로, `_rsc`) 키로 묶는다.
2. null이 아닌 값을 가진 run에서 그 키의 바이트를 읽는다.
3. 예: U1 s6 `/?_rsc=9YKVqisRPhZ20BWR`는 expanded 1–3과 collapsed 1–2에서 null이다. collapsed run 3에서 19020 B다.

### 3.5 읽는 법

- 줄어든 28224 B 중 20377 B(72 %)는 prefetch 응답에서 왔다. 가장 큰 것은 s2의 `/` prefetch(−13335)다.
- §15.2가 기대한 s3 감소(posts → projects에서 오른쪽 rail 유지)는 바이트에 보이지 않는다. s3은 +821 B다.
- s3이 원래 작은 이유: s1의 projects prefetch(44943 → 42597 B)가 이미 대부분을 받는다. 이것은 추정이다.
- 비교 대상이 after-QW 1회뿐이다. 범위가 없어 잡음보다 큰지 말할 수 없다.
- 바이트는 HIT에서 결정적이다. 그래도 R이 없으면 판정선이 없다.
- curl W1 바이트(전체 트리, 판정에 안 씀): U0b 386407 B → QW1 399320 B (run 3개 같음) [S-U1-5] [S-U1-6]. U1 curl run은 없다.

## 4. 이동 시간과 가드

### 4.1 무엇을 알려고 쓰나

익명 이동 시간이 왜 늘었는지, 그리고 가드가 깨졌는지 안다. 익명 이동 시간은 §5.3에서 기록만 하는 지표다. 판정을 막지 않는다.

### 4.2 표: W1 `[nav]` ms, 단계별

U0b 기준선은 run 하나 안의 반복 3개 중앙값이다 [S-U1-1]. after-QW는 1회다 [S-U1-2]. U1은 run 1 / 2 / 3이다 [S-U1-3].

| arm, rail | 단계 | U0b 기준선 | after-QW | U1 run 1 / 2 / 3 |
| --- | --- | --- | --- | --- |
| anon expanded | s2 posts | 73 | 91 | 133 / 126 / 465 |
| anon expanded | s3 projects | 18 | 20 | 18 / 26 / 17 |
| anon expanded | s4 project | 25 | 35 | 70 / 68 / 272 |
| anon expanded | s5 글 | 56 | 74 | 140 / 141 / 661 |
| anon expanded | s6 `/` | 21 | 21 | 19 / 19 / 19 |
| anon expanded | **합 s2–s6** | **190** (170–291) | **241** | **380 / 380 / 1434** |
| anon expanded | W1 RSC 엣지 상태 | 16 HIT ×3 | 16 HIT | HIT / HIT / **MISS** |
| anon collapsed | 합 s2–s6 | 176 (172–186) | 212 | 340 / 351 / 306 |
| anon collapsed | W1 RSC 엣지 상태 | HIT | HIT | HIT / HIT / HIT |
| auth expanded | 합 s2–s6 | 585 (561–679) | 556 | 607 / 533 / 541 |
| auth collapsed | 합 s2–s6 | 559 (557–666) | 428 | 569 / 668 / 774 |

### 4.3 시각화

```
anon expanded 합 s2–s6 (ms)
U0b       ███▊                         190   HIT
after-QW  ████▊                        241   HIT
U1 run 1  ███████▌                     380   HIT
U1 run 2  ███████▌                     380   HIT
U1 run 3  ████████████████████████████ 1434  MISS
```

### 4.4 어떻게 하나

1. 단계 줄의 `nav_ms`를 읽는다 (`kind: step`).
2. 같은 단계의 요청 줄에서 `cf_cache_status`를 읽는다.
3. 예: U1 run 3 s5는 `nav_ms` 661이다 (`raw.jsonl` 1226행). 그 이동 요청은 `MISS`다 (1217행).

### 4.5 읽는 법

- run 3의 1434 ms는 엣지 MISS 때문이다. W1 RSC 16개가 모두 MISS다.
- 그 MISS는 purge 직후가 아니다. purge 직후는 warmup(run 0)이다. warmup은 16/16 MISS다 (`raw.jsonl` 34–71행).
- run 3은 warmup s2 요청 뒤 약 405초에 MISS를 받았다. 기준선 run 3은 warmup 뒤 약 402초에 HIT였다 [S-U1-1]. 원인(만료, 축출, 다른 PoP, 중간 배포)은 저장 파일로 가릴 수 없다.
- run 1, 2의 380 ms는 MISS로 설명되지 않는다. 16/16 HIT다. s2, s4, s5가 약 2배다. s3, s6은 그대로다.
- collapsed도 같은 모양이다. 세 run 모두 HIT인데 306–351 ms다 (after-QW 212).
- 원인은 미확인이다. 후보 둘이다.
  - U1의 클라이언트 렌더 비용. 예: 새 `(rail)` layout이 이동마다 다시 mount된다.
  - 측정 환경 차이. 예: GitHub Actions runner와 Cloudflare PoP 사이 거리.
- 하네스(harness)도 바뀌었다. 기준선 `code_sha` `df24dbc8d070`, after-QW와 U1은 `224ea49e90b9`다. `CODE_VERSION`은 셋 다 `v1`이다 [S-U1-1] [S-U1-2] [S-U1-3]. 재현 검사가 없다 (`rules/measurement.md` §2.4 2번).
- 로그인 collapsed 합이 559 → 668 ms(중앙값)로 늘었다. 범위가 569–774로 넓다. 기록만 한다.

### 4.6 표: 가드

| ID | 가드 (§5.3) | U0b 기준선 | U1 run 1 / 2 / 3 | 결과 |
| --- | --- | --- | --- | --- |
| G-f | W1 수화 오류(hydration error), 두 rail | 0 | 0, 12개 세션 모두 | 통과 |
| G-a | 10초 창 최대 요청 수, anon expanded | 23 (23–24) | 23 / 23 / 27 | 통과. 한도 23 × 1.2 = 27.6 |
| G-a | anon collapsed | 23 | 23 / 23 / 23 | 통과 |
| G-a | auth expanded | 38 (37–39) | 34 / 35 / 34 | 통과. 한도 45.6 |
| G-a | auth collapsed | 39 | 34 / 36 / 36 | 통과. 한도 46.8 |
| G-a | #68 차단선 50 / 10 s | | 최대 36 | 통과 |
| G-a | 30 초과 오너 경보 | 38, 39 (이미 초과) | 34–36 | U1이 만든 것이 아니다. 기준선부터 있다 |
| G-b | 메뉴 링크당 prefetch 최대 | anon 2, auth 5 | anon 2, auth 2 | 통과. auth 총 16 → 13 |
| 기타 | G-c, G-d, G-e, G-g, G-i, G-k | | U1 curl run 없음 | 미측정 |

- 출처: 각 run 폴더의 `summary.csv` `g_a_max_10s`, `g_f_hydration_errors`, `g_b_*` [S-U1-1] [S-U1-3].
- `step_errors` 1은 expanded arm마다 W4 `card_hover` 타임아웃이다 (U1 `raw.jsonl` 248, 448행 등). 기준선에도 같은 1이 있다. U1 탓이 아니다.

## 5. 유효한 판정에 필요한 다시 측정

### 5.1 무엇을 알려고 쓰나

어떤 run을 더 돌리면 §5.3 공식으로 U1 판정을 낼 수 있는지 정한다.

### 5.2 표: 고칠 것과 선택지

먼저 스크립트를 고친다 (developer). 그 뒤 run은 main session이 `cc-browser-measure.yml`로 돌린다.

| # | 스크립트 고침 (`_scripts/perf/cc-browser.mjs`) | 이유 |
| --- | --- | --- |
| 1 | `CODE_VERSION`을 올리고 `CHANGELOG.md` 한 줄 | 이미 한 번 바뀌었는데 `v1` 그대로다 |
| 2 | null 바이트를 0으로 세지 않는다. `rsc_bytes_null_count`를 남긴다. null이 1개라도 있으면 그 run의 바이트 값을 비운다 | §2 결함 |
| 3 | 바이트 출처를 `body()` 대신 `request.sizes()`의 `responseBodySize`로 바꿀지 확인한다 | null을 없앨 후보. 효과는 미확인 |
| 4 | W1 이동 RSC 본문을 run 폴더에 파일로 저장한다 | R(rail 조각 크기)을 §5.3 규칙으로 잴 수 있다 |
| 5 | warmup을 run 0만이 아니라 매 run 앞에 둔다. W1에 MISS가 하나라도 있으면 그 run을 표시한다 | run 3 같은 MISS run을 가려낸다 |

| 선택지 | 기준 쪽 | U1 쪽 | 얻는 것 | 비용과 위험 |
| --- | --- | --- | --- | --- |
| **A** | `61d48bc` 다시 배포 → purge → 고친 스크립트 3회 | `3596e4c` 다시 배포 → purge → 3회 | 사전 등록 공식대로 판정. R도 기준 본문에서 잰다 | 운영 배포 2번과 purge 2번. 오너 OK 필요 |
| **B** | 다시 배포하지 않는다 | `3596e4c`에서 고친 스크립트 3회 | U1은 "사전 등록 판정 없음"으로 닫는다. §3 재구성은 기록만. 이 3회가 다음 단위의 기준이 된다 | U1 바이트 효과는 끝내 판정되지 않는다 |

### 5.3 시각화

```
A:  배포 61d48bc → purge → warmup → run ×3 ─┐
    배포 3596e4c → purge → warmup → run ×3 ─┴→ §5.3 공식 → U1 판정
B:  (3596e4c 그대로) → warmup → run ×3 → U1 "판정 없음" + 다음 단위 기준
```

### 5.4 어떻게 하나

1. developer가 표의 1–5를 고친다. 코드 실행은 하지 않는다.
2. 오너가 A 또는 B를 고른다. 운영 되돌림이 들어가므로 이 메모가 고르지 않는다.
3. main session이 run을 돌리고 회수한다.
4. data-analyst가 null 수 0, W1 MISS 0인 run만 써서 §5.3 공식을 계산한다.
5. 예 (A의 경우): 기준 3회 중앙값 317713, 범위 0, R = 20000이면 판정선 = max(0, 10000) = 10000 B. 이 숫자는 설명용이다. 측정값이 아니다.

### 5.5 읽는 법

- A를 고르면 판정이 나온다. 통과, 실패 둘 다 가능하다.
- B를 고르면 U1은 "바이트 판정 없음, 가드 통과"로 기록된다. §5.3 실패 조건대로 U1 코드는 남는다(구조 정리).
- 어느 쪽이든 익명 이동 시간 회귀(§4.5)는 고친 스크립트 3회에서 다시 본다. 두 run이 다시 HIT로 380 ms 근처면 U1 탓을 의심한다.

## 6. 빈칸

| 빈칸 | 필요한 것 | 누가 |
| --- | --- | --- |
| R (rail 조각 크기) | RSC 본문 저장 + §5.3 측정 규칙 적용 | developer (저장), data-analyst (계산) |
| run 3 MISS 원인 | 05:57–06:05 UTC 사이 배포 기록, Cloudflare `_rsc` edge TTL 설정 | main session |
| 하네스 재현 검사 | `df24dbc8d070` → `224ea49e90b9` 차이가 `[nav]`를 바꾸는지 | developer, main session |
| U1 curl run과 `ssr_fetch` | G-c, G-d, G-e, G-j, G-k와 §15.2 서버 비용 기록 | main session |
| `_rsc` 키 재사용 | 기준선과 after-QW가 같은 `_rsc` 키를 쓴다 (예: `xJMQPe9f5aJDWLZ4`). route 트리가 같으면 배포 사이에 키가 같다. 배포 뒤 purge가 빠지면 옛 빌드 RSC가 HIT로 나갈 수 있다(추정). §8.3 purge 순서가 이미 다룬다 | system-architect 확인 |

## Sources

- [S-U1-1] baseline browser run | `deploy/traffic/review/cc/runs/20261014T052554Z_baseline_19f5e31_browser/` (`summary.csv`, `raw.jsonl`, `manifest.json`) | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: summary.csv full read, raw.jsonl step and nonprefetch req lines grepped, manifest keys grepped
- [S-U1-2] after-QW browser run | `deploy/traffic/review/cc/runs/20261014T053859Z_QW1_after_qw_61d48bc_browser/` (`summary.csv`, `browser_summary.txt`, `raw.jsonl`, `manifest.json`) | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: summary files full read, raw.jsonl anon W1 rsc lines and step lines grepped
- [S-U1-3] U1 browser run | `deploy/traffic/review/cc/runs/20261014T055732Z_U1_u1_3596e4c_browser/` (`summary.csv`, `browser_summary.txt`, `raw.jsonl`, `manifest.json`) | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: summary files full read, raw.jsonl anon W1 rsc lines, step lines, error lines and auth s2 lines grepped
- [S-U1-4] browser measurement script snapshot | `deploy/traffic/review/cc/runs/20261014T055732Z_U1_u1_3596e4c_browser/cc-browser.snapshot.mjs` | published: 2026-10-14 | accessed: 2026-10-14 | type: code | note: lines 1 to 340 read
- [S-U1-5] U0b baseline summary | `deploy/traffic/review/cc/baseline.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-U1-6] QW1 curl runs | `deploy/traffic/review/cc/runs/*_QW1_qw1_{1,2,3}_61d48bc/summary.csv`, `.../20261014T054651Z_QW1_qw1_3_61d48bc/raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: W1 bytes rows grepped, cache_control field grepped
- [S-U1-10] Phase CC design rev2 §5.3, §14, §15 | `cc.design.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: lines 243 to 382 and 619 to 828 read
- [S-U1-11] measurement rule | `.claude/rules/measurement.md` | published: 2.1.1 | accessed: 2026-10-14 | type: rule | note: full file read
