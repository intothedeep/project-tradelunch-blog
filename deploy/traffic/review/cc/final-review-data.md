# Phase CC 최종 검토: data-analyst 몫 (숫자, 표, 분석 방법)

- 작성: data-analyst, 2026-10-14. 저장된 파일만 읽었다. run, git, 네트워크는 쓰지 않았다.
- 범위: `.claude/CLAUDE.md` Workflow 4단계, 프로젝트 끝 검토의 data-analyst 몫.
- 대상 보고: `cc.report.md` (이하 "보고"). 줄 번호는 이 파일을 읽은 시점 값이다.
- 새 계산은 없다. U5 run p50 6개만 `summary.csv` 원값을 다시 읽어 확인했다.
- 출처 ID는 끝의 Sources 절에 있다.

## 0. 결론

| 묶음 | 결과 |
| --- | --- |
| 옮겨 적은 숫자 | 단위 8개 모두 저장 파일 값과 같다. 숫자 오기(typo)는 없다 |
| 판정 문구 | 사전 등록 규칙 없이 낸 판정 문구가 3곳이다 (U3 "이득", U4 "한도 안", U7 "가드 모두 통과") |
| 낡은 문구 | 3곳이다 (U1 오너 확인 대기, `00.runs.md` 19행, U1 G-a 한도 50) |
| 방법 문제 | 11개 중 보고가 적은 것 5개, 일부만 적은 것 3개, 적지 않은 것 3개 (§2) |
| U5 140 ms | `u5-ab.md`와 보고 모두 140 ms 선을 보이지 않는다. #110 문구와 다르다 (§3) |
| 대장 빈칸 | `00.runs.md`에 drift 대조 run 1개와 U5 폴더 6개가 없다. `criteria.md` U5 행은 "시작 전" 그대로다 |

```
저장 파일 ──► 판정 메모 ──► 보고
  숫자:  같다 ───────────────► 같다
  조건:  메모에 있다 ──────────► 일부 빠짐 (drift, 가드 변경, 출처 종류)
```

## 1. 단위별: 보고의 주장 대 저장 값

**무엇을 알려고 쓰나:** 보고의 숫자와 판정이 저장 파일과 사전 등록 규칙에 맞는지.

- 행 하나 = 단위 하나. U4는 시도마다 한 행이다.
- "판정 근거" 칸: 사전 등록 규칙이 있으면 그 행, 없으면 "규칙 없음".

| 단위 | 보고의 주장 (줄) | 저장 값 (출처) | 숫자 | 판정 근거 | 지적 |
| --- | --- | --- | --- | --- | --- |
| QW1 | 19 → 13, 통과 (119, 648) | run 값 19 / 19 / 19 → 13 / 13 / 13, qw1_1 valid 2/3 [S-FRD-1] | 같다 | `criteria.md` QW1 행 | 없음 |
| QW2 | (1) 참 3/3, (3) 참, (2) 미측정, 미완 (144) | `criteria.md` QW2 행, `00.runs.md` 6–9행 [S-FRD-2] | 같다 | QW2 행 | 없음 |
| U1 | 판정 불가. G-a "최대 36 (한도 50)" (255–258) | U1 G-a 최대 36. 바이트 270469 / 270469 / 10641 [S-FRD-3] | 같다 | U1 행, `u1-verdict.md` | 한도 50은 Cloudflare 한도다. 가드 선은 U0b + 20 % (27.6 / 45.6)다. 오너 확인 대기(45, 250행)는 낡았다. #107 (1)이 B로 닫았다 |
| U2 | `_rsc` 1 1 1 → 0 0 0, 통과 (278) | 익명 expanded 1 1 1 → 0 0 0. 로그인 s5 317 / 403 / 307 [S-FRD-4] | 같다 | U2 행 (#96) | 없음 |
| U3 | 317 → 174, 실패 (코드 유지) (312). 최종 상태 "남은 이득: … U3" (639) | s5 317 / 403 / 307 → 176 / 174 / 169 [S-FRD-4] | 같다 | U3 (rev2.2) 행: 미달, 효과 없음 | 639행의 "이득"은 규칙 없는 판정이다. 사전 등록 판정은 효과 없음이다 |
| U4 시도 1 | 운영 500, 되돌림 (354) | 폴더 없음. `00.runs.md` 20행, sha는 dispatch 기록 [S-FRD-5] | 해당 없음 | 측정 없음 | 보고는 dispatch 기록임을 적지 않는다 |
| U4 시도 2 | 329 → 434, 실패 (회귀). 우세 가설 H-S (411, 443, 654) | 295 / 329 / 329 → 482 / 421 / 434 [S-FRD-6] | 같다 | U4 (rev2.2) 행 | #102 Update는 이 비교가 drift와 섞였다고 적는다. H-S는 약해졌다. 보고의 이 절과 최종 표는 이 단서를 적지 않는다 |
| U4 A-B-A | d = 534 > 89.75, 무효. G-a, G-b 통과 (465, 472–480) | C1 643, C2 1177, T 1351 [S-FRD-7] | 같다 | U4 (rev2.3) 행, §19.4 | 없음 (방법 문제는 §2) |
| U4 운영 | G-a 50 / 53 / 50, 통과 (≤ 60). "요청 한도 안"을 이득으로 적음 (545, 639) | 로그인 G-a 50 / 53 / 50, 익명 36, G-b 로그인 6 / 6 / 5, 익명 6, hydration 0 [S-FRD-8] | 같다 | #106 선 (≤ 60)만 | 사전 등록 G-a (45.6, 27.6)와 G-b (로그인 5, 익명 2)로는 모두 FAIL이다. #106은 G-b를 배포 뒤 확인 목록에서 뺐다. 보고는 이것을 적지 않는다. 가드 run은 `f76c1d9`에서만 돌았다. 운영 `181e6ed`의 브라우저 가드 run은 없다 |
| U5 | 302 → 316, 참고선 50 ms 미달, 뺌 (598) | run p50 472 / 302 / 263 → 283 / 343 / 316 [S-FRD-9] | 같다 (원값 9개에서 다시 읽음) | #110 참고선 | 140 ms 선이 없다 (§3). 오류 줄 수 855, 1134, 43은 main session 메모 값이다. 로그 파일은 저장소에 없다 |
| U7 | 12 → 0, 통과. "가드가 모두 통과" (568–578) | `my.` load-more 0, 기준 12 [S-FRD-10] | 같다 | U7 행: 판정선 0 | G-d, G-e, G-g, G-i, G-j는 미측정이다. traffic-check 0 FAIL과 `rate_limit` 0줄은 dispatch 기록이다. 셈 출처는 `raw.jsonl`이다. 등록 출처(`proxy.ts` 로그)가 아니다 (`criteria.md` §3 7번) |

### 1.1 숫자 확인 방법

1. 보고의 숫자마다 그 run 폴더의 `summary.csv` 또는 `ssr_fetch_summary.txt`를 읽었다.
2. U5는 run마다 `miss.home`, `miss.projects`, `miss.post` 원값 9개를 정렬해 다섯째 값을 읽었다.
3. 예: C run 1 = 220, 232, 252, 386, 472, 573, 576, 634, 854. 다섯째 = 472. `u5-ab.md`와 같다.

### 1.2 읽는 법

| 경우 | 뜻 |
| --- | --- |
| 숫자 같음, 지적 없음 | 보고를 그대로 인용해도 된다 |
| 숫자 같음, 판정 근거가 "규칙 없음" | 숫자는 맞다. 문구가 사전 등록 판정보다 강하다 |
| 숫자 같음, 출처가 dispatch 기록 | 저장 파일로 다시 확인할 수 없다 |

### 1.3 낡은 문구

| 줄 | 보고 문구 | 지금 사실 |
| --- | --- | --- |
| 39 | `cc/00.runs.md`는 19행까지 있다 | 29행까지 있다 [S-FRD-11] |
| 45, 250 | U1 오너 확인이 남았다 (#99) | #107 (1)이 B로 확정했다 ("checked close it") [S-FRD-12] |
| 255 | G-a 최대 36 (한도 50) | 가드 선은 27.6 / 45.6이다. 50은 #68 Cloudflare 한도다 [S-FRD-3] |

## 2. 방법 문제와 보고의 기재

**무엇을 알려고 쓰나:** 판정의 뜻을 바꾸는 방법 문제를 보고가 적었는지.

| # | 방법 문제 | 근거 | 보고 기재 |
| --- | --- | --- | --- |
| 1 | criteria.md를 QW1 배포 뒤에 썼다 | `criteria.md` 머리 메모 | 적음 (83행) |
| 2 | U2 배포에 header tone, filter chips가 함께 들어갔다 | `00.runs.md` §3 8번 | 적음 (279행) |
| 3 | A-B-A가 조용한 시각을 벗어났다 | `u4-aba-verdict.md` §5.4, #104 | 적음 (467행) |
| 4 | A-B-A 묶음 무효 (d > 0.10 × c̃) | `u4-aba-verdict.md` §1 | 적음 (465행) |
| 5 | U5는 C2 없는 A-B다 (#110) | `u5-ab.md`, #110 | 적음 (596행) |
| 6 | C2가 로그인 팔만 돌았다 (팔 변경, arm change) | `u4-aba-verdict.md` §5.5 | 사실만 적음. §5.5는 d를 drift 하나로 단정하지 않는다. 보고는 시각 문제로만 읽힌다 |
| 7 | **drift**: 같은 코드 경로 `964c9f8`가 10:17에 476 ms였다. 07:44 기준은 329 ms다 | `20261014T101744Z_U4_env_recheck_964c9f8_browser`, #102 Update [S-FRD-13] | 적지 않음. 연달아 잰 시간 지표 판정(U3, U4 시도 2)은 모두 대조 없는 비교다. 그 run 폴더는 `00.runs.md`에도 없다 |
| 8 | 하네스 버전 교차: 같은 `0ac938c`에서 s5가 v1 174, v2 142다. G-j 12 → 12는 curl v1 → v2를 건넌다 | U3, U4 기준 `summary.csv` [S-FRD-4], `00.runs.md` §3 12, 13번 | 일부. 보고는 합 343 → 329만 적는다 (409행) |
| 9 | 가드 선을 실패 뒤 바꿨다: G-a 45.6 → 60, G-b는 확인 목록에서 빠짐 | #106 | G-a만 적음 (505–506행). G-b 제외는 적지 않음 |
| 10 | purge 뒤 대기: A-B-A 60초 대기는 확인 불가. U5 T는 배포 + purge 18:37:42 뒤 16초에 시작했다 (폴더 `183758Z`) | `u4-aba-verdict.md` §5.4, `u5-ab.md` 4행 | 적지 않음 |
| 11 | 판정 파일(`verdicts.json`)이 없다. dispatch 기록 사실이 저장 파일과 섞였다 | `00.runs.md` 머리 메모, `rules/measurement.md` §4.1 | 적지 않음 |

- 환경 사실: curl run은 모두 `darwin 27.0.0`이다 (QW1, U2, U3, U4, U5). 브라우저 run은 모두 `linux 6.17.0-1022-azure`다 [S-FRD-14].
- U5 비교는 같은 curl 하네스 v2 (`a8e8c318e25c`) 안이다. 하네스 교차는 없다 [S-FRD-9].

### 2.1 대장과 기준표의 빈칸

| 파일 | 빠진 것 |
| --- | --- |
| `00.runs.md` | drift 대조 run `20261014T101744Z_U4_env_recheck_964c9f8_browser` 1행 |
| `00.runs.md` | U5 폴더 6개 (`183605Z`, `183636Z`, `183654Z` C, `183758Z`, `183817Z`, `183835Z` T) |
| `00.runs.md` 26–29행 | 하네스 칸이 `v2`뿐이다. `code_sha`가 없다 |
| `criteria.md` U5 행 | "판정: 없음, 시작 전 (M-CC3)" 그대로다. #107, #110 비교 변경과 결과가 없다 |
| `criteria.md` U4 (rev2.3) 행 | "시작 전" 그대로다. A-B-A 무효 결과가 없다 |

## 3. U5: 140 ms 선

**무엇을 알려고 쓰나:** #110이 약속한 두 선이 U5 기록에 모두 보이는지.

| 선 | 출처 | `u5-ab.md` | 보고 |
| --- | --- | --- | --- |
| 참고선 max(0.10 × m(C), 50) = 50 ms | #110 | 있음 (11행) | 있음 (598행) |
| `criteria.md` U5 판정선 140 ms | `criteria.md` U5 행, #88 Update (1) | **없음** | **없음** |

- #110은 "`criteria.md` 140 ms도 함께 보인다"고 적는다. 두 파일 모두 이 선을 보이지 않는다. 비교가 빠졌다.
- 결론은 바뀌지 않는다. T가 C보다 14 ms 느리다. 감소가 아니므로 어느 선에도 못 미친다.
- 읽기만 한 사실: C 블록 run 값 472 / 302 / 263의 퍼짐은 C와 T의 차 14 ms보다 크다.
- 140 ms는 U0b 범위에서 나온 선이다. #107이 U0b 비교를 대체했다. 그래서 140 ms 행을 보일 때 이 사정을 함께 적는다.

## 4. 독자가 잘못 읽을 수 있는 것과 고칠 문구

**무엇을 알려고 쓰나:** 보고만 읽은 독자가 틀린 결론을 내릴 곳과 그 대신 쓸 문구.

| # | 잘못 읽기 | 보고 줄 | 고칠 문구 |
| --- | --- | --- | --- |
| 1 | U3가 글 이동을 45 % 빠르게 했다 | 312, 639, 652 | "U3: 사전 등록 판정 미달, 효과 없음. 가드 통과로 코드 유지. 317 → 174 ms는 대조 없는 연속 비교 값이다" |
| 2 | cacheComponents가 로그인 이동을 105 ms 늦춘다 | 411, 443, 654 | "시도 2의 329 → 434 ms는 drift와 섞였다 (#102 Update, 같은 코드 476 ms). 회귀의 근거가 아니다. 되돌림 근거는 G-a, G-b FAIL이다" |
| 3 | U4는 요청 한도 안에 있다 | 545, 636, 639 | "U4는 #106 선 (≤ 60)만 통과한다. 사전 등록 G-a (45.6)와 G-b (로그인 5, 익명 2)로는 FAIL이다 (50 / 53 / 50, prefetch 6)" |
| 4 | 운영 `181e6ed`가 가드 검사를 받았다 | 636, 656 | "가드 run은 `f76c1d9`에서 돌았다. `181e6ed`는 오류 줄 수와 `/` GET 4회만 확인했다 (main session 메모)" |
| 5 | `'use cache'`는 MISS TTFB를 줄이지 못한다 | 4, 598, 657 | "U5 A-B는 C2가 없는 참고 값이다. C 블록 퍼짐이 차 14 ms보다 크다. 효과 유무는 판정되지 않았다. T build는 오류 상태였다 (`Connection closed.`)" |
| 6 | U7의 가드가 모두 통과했다 | 569 | "U7: 잰 가드 G-a, G-b, G-f는 통과다. G-d, G-e, G-g, G-i, G-j는 미측정이다. traffic-check와 `rate_limit`은 dispatch 기록이다" |
| 7 | U7의 0은 등록된 지표로 셌다 | 568 | "셈 출처는 브라우저 `raw.jsonl`이다. 등록 출처 `proxy.ts` 로그가 아니다 (`criteria.md` §3 7번)" |
| 8 | 대장(ledger)이 모든 run을 담는다 | 9, 39 | "`00.runs.md`는 29행이다. drift 대조 run 1개와 U5 폴더 6개는 대장에 없다" |
| 9 | U1은 오너 확인을 기다린다 | 45, 250 | "U1은 #107 (1)로 B 확정, 바이트 판정 없이 닫았다" |
| 10 | U7 run의 로그인 500 ms는 원인 불명이다 | 587 | "같은 코드 경로가 10:17에 476 ms였다 (#102 Update). drift로 읽는다 (추정)" |

## Sources

- [S-FRD-1] QW1 and U0b counts | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/ssr_fetch_summary.txt`, `.../*_QW1_qw1_{1,2,3}_61d48bc/ssr_fetch_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: line 6 "run value" grepped in all 15 files
- [S-FRD-2] criteria and ledger | `deploy/traffic/review/cc/criteria.md`, `deploy/traffic/review/cc/00.runs.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full files read
- [S-FRD-3] U1 verdict | `deploy/traffic/review/cc/u1-verdict.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-FRD-4] browser step values | `deploy/traffic/review/cc/runs/*_browser/summary.csv` (14 folders) | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: rows `w1_s5_post_nav_ms`, `w1_s6_home_rsc_nonprefetch`, `w1_nav_ms_s2_s6` grepped
- [S-FRD-5] U4 attempt 1 | `deploy/traffic/review/cc/00.runs.md` row 20 | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: no run folder exists; shas are dispatch records
- [S-FRD-6] U4 attempt 2 verdict | `deploy/traffic/review/cc/u4-verdict.md`; `.../runs/20261014T092201Z_U4_u4_f122265_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: memo full read; summary row 49 grepped
- [S-FRD-7] A-B-A verdict | `deploy/traffic/review/cc/u4-aba-verdict.md`; C1, T, C2 `summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: memo full read; sum rows grepped
- [S-FRD-8] U4 production guard run and errors | `deploy/traffic/review/cc/runs/20261014T181839Z_U4_u4o_f76c1d9_browser/summary.csv`; `deploy/traffic/review/cc/u4o-prerender-errors.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: G-a, G-b, hydration, nav rows grepped; memo full read; log line counts are main-session notes, log file not saved
- [S-FRD-9] U5 runs | `deploy/traffic/review/cc/runs/20261014T1836{05,36,54}Z_U5_u5C*_181e6ed/`, `.../20261014T18{3758,3817,3835}Z_U5_u5T_*_b30d03a/` (`summary.csv`, first manifest); `deploy/traffic/review/cc/u5-ab.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: six summary.csv full read; one manifest lines 1 to 90 read; memo full read
- [S-FRD-10] U7 run | `deploy/traffic/review/cc/criteria.md` U7 row; `00.runs.md` row 25, §2.1.1 | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: rows read; raw.jsonl not re-counted
- [S-FRD-11] phase report | `cc.report.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read; line numbers as read
- [S-FRD-12] decisions | `decisions.plan.md` #88, #96, #99, #102 to #111 (lines 157 to 189) | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: rows read in full
- [S-FRD-13] drift control run | `deploy/traffic/review/cc/runs/20261014T101744Z_U4_env_recheck_964c9f8_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: auth expanded sum row 49 grepped (459 623 476)
- [S-FRD-14] run platforms | `deploy/traffic/review/cc/runs/*/manifest.json` (35 folders) | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: `platform` key grepped
