# Phase CC 판정 기준 (criteria)

## 머리 메모: 늦게 쓴 사본

> 작성: data-analyst, 2026-10-14. 저장된 파일만 읽었다. 코드, git, 네트워크는 쓰지 않았다.

- 이 파일은 늦게 쓴 사본이다.
- 쓴 시각은 QW1, QW2 배포(`61d48bc`), U1 배포(`3596e4c`), U2 배포(`c26c69d`) 뒤다.
- 그래서 CC-U0b AC3("criteria.md 커밋이 QW1 배포보다 앞")은 지킬 수 없다. 사실 그대로 적는다.
- 이 파일은 새 기준을 만들지 않는다. 이미 고정된 줄만 옮긴다.
- 갱신: data-analyst, 2026-10-14, gate review `cc.m1-gate.review.md` M2, M3. U2, U3 판정과 U4 기준 재설정, 가드 G-g, G-h, G-j, G-l 상태를 적었다. 옛 값은 지우지 않고 줄을 그었다.
- 갱신: data-analyst, 2026-10-14. U4 attempt 2 판정(FAIL), U7 판정(통과)을 적었다.
- 같은 갱신: G-g, G-l, smoke를 `smoke-0ac938c.txt`로 채웠다 (CC-N15, #101).

| 옮긴 원본 | 고정 시점 | 이 파일의 칸 |
| --- | --- | --- |
| `decisions.plan.md` #88 (write-first) = `cc.design.md` §5.3 표, §7 kill 칸 | QW1 배포 전 | 주 지표, 공식, 실패 조건, kill, 가드 |
| #88 Update = `cc.design.md` §14 (rev2.1) | 변경 후 측정 전 | p50 읽기 A, U3/U4는 브라우저 `[nav]`만, QW1 집계, U5 판정선 140 ms |
| #94 = `cc.design.md` §15.2 | U1c 코드 전 | U1c 조각 = 오른쪽 rail, 브라우저 HAR로만 |
| #96 = `cc.design.md` §16.4 | U2 실행 전 | U2 주 지표 `w1_s6_home_rsc_nonprefetch`, 25 s 유효 조건 |

- 사전 등록의 증거는 이 파일이 아니라 위 원본들이다.
- "기준선 값"과 "판정선 계산" 칸은 저장된 파일 위의 산술이다. 출처는 칸마다 적었다.
- 산술에 가정이 들어간 칸은 "가정"이라고 적었다. 그 칸은 §3 열린 항목에도 있다.
- 주 대비는 모든 단위가 같다: 직전 단위 뒤 3회 중앙값 vs 이 단위 뒤 3회 중앙값 (§5.3).
- 그래서 U0b 기준선 값은 QW1의 비교 기준이다. 뒤 단위의 비교 기준은 직전 단위 run이다.
- 범위 = run 값 3개의 최댓값 − 최솟값 (`baseline.md` §1.2, §14.1).

## 1. 단위 표

**무엇을 알려고 쓰나:** 단위마다 무엇으로 판정하는지, 지금 판정선 숫자가 있는지, 판정이 났는지.

- 행 하나 = 단위 하나. U1 행은 U1b와 U1c를 함께 담는다(§3 1번).
- "기준선 값"은 그 단위의 비교 기준이다. 아직 없으면 U0b 값을 참고로 적는다.
- 판정이 없는 칸은 "없음"이다. 대체 판정을 만들지 않는다.

| 단위 | 주 지표 | 사전 등록 공식과 실패 조건 | 기준선 값 (출처) | 판정선 계산과 판정 | kill (되돌림) | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| QW1 | 서버 fetch 수 / MISS 렌더 1회. 페이지 3개 합: `/`, `/@taeklim/posts`, `/@taeklim/<S>`. `ssr_fetch` 줄을 MISS 창마다 센다 (집계 = §14.2, `ssr-fetch-count.mjs`) | 통과: 줄어든 수 ≥ max(범위 × 2, 2). 실패: 미달이면 "중복 제거 효과 없음"으로 적는다. 가드가 통과하면 코드는 남긴다 | U0b run 3개: 19 / 19 / 19. 중앙값 19, 범위 0. 각 run valid 3/3 [S-CRIT-1] | 판정선 = max(0 × 2, 2) = 2. QW1 뒤 run 3개: 13 / 13 / 13 (valid 2/3, 3/3, 3/3). 중앙값 13, 범위 0 [S-CRIT-2]. 줄어든 수 6 ≥ 2. **통과** | G-a…G-l 하나라도 실패 → `git revert` + 재배포 + purge | 판정 통과. 배포 `61d48bc`. 가드 칸 전부와 smoke 15개는 기록 없음 (CC-QW1-2). 기록: `/@taeklim/<S>` 렌더 1회의 `/posts/slug/` 줄 = 1 (감사 §5-7) [S-CRIT-2] |
| QW2 | 정확성 판정 3개 (이진). (1) 익명 MISS `/?cb=X` HTML의 rail 폭 class가 `Cookie: railCollapsed=1` 유무와 무관. (2) 쿠키 1인 브라우저의 첫 paint 폭 = 접힘. (3) hydration 오류 0. (1)의 비교 = `<aside>` class 문자열 (§14.3) | 통과: 셋 모두 참. 실패: 하나라도 거짓 | (1) 거짓 ×3, D1 재현 (`baseline.md` §4) [S-CRIT-3]. (2) 미측정. (3) U0b 브라우저 0, 네 그룹 [S-CRIT-4] | (1) 참 3/3: `rail_width_same: true` [S-CRIT-5]. (3) 참: hydration 0, 네 그룹, 브라우저 run 1회 [S-CRIT-6]. (2) 미측정. 셋 모두 참이 확인되지 않았다. **판정 미완** | 판정 하나라도 거짓 → `git revert` + 재배포 + purge | 미완. (2) 스크린샷 없음 → CC-QW2-2. QW1과 같은 배포 `61d48bc`. 판정 칸은 서로 다르다 |
| U1 | U1b + U1c, 한 배포 `3596e4c` (`u1-verdict.md`). W1 익명 `text/x-component` 응답 본문 바이트 합. 브라우저 HAR로만 (#94). U1c 조각 = 오른쪽 rail 조각 (§15.2) | 통과: 줄어든 양 ≥ max(범위 × 2, 기준선 HAR rail 조각 크기 × 0.5). 실패: 미달이면 "바이트 효과 없음"으로 적는다. 가드가 통과하면 U1은 남긴다 | 직전 단위 = after-QW 브라우저 run 1회: `rsc_bytes_w1` 251151 B, null 1개 포함 [S-CRIT-6]. U0b 브라우저 run에는 바이트 열이 없다. curl 386407 B는 판정에 쓰지 않는다 [S-CRIT-3] | 계산 불가. 범위 없음 (기준 run 1개). rail 조각 크기 R 미측정. 바이트 지표가 null을 0으로 센다. **판정 불가** [S-CRIT-7] | 가드 실패 또는 smoke 하나라도 status나 `location` 변화 → `git revert` + 재배포 + purge (U1c는 커밋 2만, §15.4) | 판정 불가. 측정된 가드 G-a, G-b, G-f 통과. 나머지 가드와 smoke는 미측정. 다시 측정 선택지 A/B는 오너 대기 (`u1-verdict.md` §5). `00.tasks.md`는 CC-U1b = `df11372`, CC-U1c = `[ ]`로 적는다. 두 사실을 고치지 않고 둔다 |
| U2 | `w1_s6_home_rsc_nonprefetch`, 익명(anon) expanded (§16.4, #96). §5.3 U2 행 "W2 뒤로 3회 `_rsc` 수"는 대체됨 | 통과: 줄어든 수 ≥ max(범위 × 2, 1). 유효 조건: run마다 `at(s6 _rsc) − at(s1 document)` < 25 s. 넘으면 그 run은 판정 불가. 실패: 유효 run에서 감소 0. 기록만: 로그인 팔 같은 칸, `w1_rsc_nonprefetch`, `w1_s6_home_nav_ms`, `w2_back3_rsc` (0 유지. 0이 아니면 가드처럼 보고) | 직전 단위 = U1 브라우저 run 3개: 1 / 1 / 1, 범위 0 [S-CRIT-8]. U0b 브라우저도 1 / 1 / 1 [S-CRIT-4] | 판정선 = max(0 × 2, 1) = 1. U2 뒤 0 / 0 / 0, 중앙값 0. 감소 1 ≥ 1. 유효 조건: s1 → s6 간격 8.27 / 8.30 / 8.25 s < 25 s, run 3개 모두 유효 (s6 `_rsc`가 없어 s6 첫 요청 `at`로 잼). **통과** [S-CRIT-13] | 유효 run에서 감소 0 → 설정 줄 삭제 + 재배포 + purge | 판정 통과. 배포 `c26c69d`. 판정 run `runs/20261014T070608Z_U2_u2_c26c69d_browser/`. 가드 run `*_U2_u2_{1,2,3}_c26c69d/` (u2_1은 이제 manifest 있음, `00.runs.md` 11번 정정). 기록만: 로그인 expanded 1 → 0, `w2_back3_rsc` 0 유지. 같은 배포에 header tone 15 %, filter chips가 함께 들어갔다 (`00.tasks.md` CC-U2) |
| ~~U3~~ | ~~W1 로그인, 5단계(글 상세) 이동 시간 p50 … 읽기 (§14.1)~~ | | | | | ~~가정 두 개는 §3 2, 3번~~ <!-- SUPERSEDED 2026-10-14: cc.design.md §17 (rev2.2), U3 비교 run 전 정정 --> |
| ~~U4~~ | ~~G-CC. W1 로그인, 이동 시간 p50 (s2–s6), 읽기 A~~ | | | | | ~~판정선 3.5 ms (가정)~~ <!-- SUPERSEDED 2026-10-14: cc.design.md §17 (rev2.2), U3 비교 run 전 정정 --> |
| U3 (rev2.2) | **정정, U3 비교 run 전 (2026-10-14, system-architect, `cc.design.md` §17).** `w1_s5_post_nav_ms`, 로그인(auth) expanded, 브라우저 `[nav]`. run 값 = run마다 1개. 단위 값 = run 3개 중앙값. curl proxy는 판정에 쓰지 않는다 | 통과: 줄어든 양 ≥ max(범위 × 2, 기준값의 10 %). 실패: 미달이면 "효과 없음"으로 적는다. 가드가 통과하면 남긴다 (U4의 필수 준비). 기록만: collapsed, 익명 같은 칸 | 비교 기준 = U2 배포 `c26c69d` 뒤 브라우저 3회: 317 / 403 / 307, 중앙값 317, 범위 96 [S-CRIT-13]. ~~가안 = U1 브라우저 run: 401 / 338 / 341, 중앙값 341, 범위 63~~ (U2 run으로 대체) [S-CRIT-8] 41행. 참고 U0b: 473 / 347 / 379 → 379, 범위 126 [S-CRIT-4] 38행 | 판정선 = max(96 × 2, 317 × 0.1) = max(192, 31.7) = **192 ms** (U3 뒤 중앙값 ≤ 125 ms면 통과). ~~가안 126 ms~~. U3 뒤 176 / 174 / 169 → 174, 범위 7. 감소 143 < 192. **미달, 효과 없음. 가드 통과로 유지** [S-CRIT-14] | 가드 실패 → `git revert` | 판정 미달 (사전 등록 실패 조건 그대로). 코드 유지 (가드 통과, `00.runs.md` §2.1). 배포 `0ac938c`. 판정 run `runs/20261014T073207Z_U3_u3_0ac938c_browser/`. 기록만: s2–s6 합 527 → 343, 익명 s5 73 → 45. 판정선이 큰 까닭은 기준 run 2의 403 ms다 |
| U4 (rev2.3) | **보정, 다음 U4 run 전 (2026-10-14, system-architect, `cc.design.md` §19).** 지표 그대로: `w1_nav_ms_s2_s6`, 로그인 expanded, 브라우저 `[nav]`. 비교만 바뀐다: 한 시간 안의 A-B-A 묶음. C1(현재 build) 5 run → U4 배포 + purge → T 5 run → 대조 되돌림 + purge → C2 5 run. 블록마다 warmup 1회 버림. 조용한 시각(기본 UTC 05–07시) | 유효: `d = \|m(C1) − m(C2)\|` ≤ 0.10 × c̃ (c̃ = 대조 10 run 중앙값). 판정선 `L = max(2d, 0.10 c̃)`. 통과: c̃ − m(T) ≥ L, m(T) < min(m(C1), m(C2)), T 5 run 중 4개 이상 < c̃. 회귀: m(T) − c̃ ≥ L이고 4개 이상 > c̃. 그 밖: 미달 | 07:44 기준 329 ms는 U4에 대체됨: 같은 W1 경로 대조 run이 476 (`runs/20261014T101744Z_U4_env_recheck_964c9f8_browser` 49행), 500 (`runs/20261014T095432Z_U7_u7_964c9f8_browser` 49행). 기준값은 묶음 안의 c̃다 | 판정: 없음 (묶음 run 전). 가드 G-a, G-b는 T 블록 run마다 그대로 (U0b + 20 %, 링크당 prefetch ≤ 기준) | 미달 또는 회귀 → U4 되돌림 + `recover`. 가드 FAIL → 주 지표와 무관하게 되돌림. 묶음 > 60 min 또는 무효 → 판정 불가, 다시 | 시작 전. 로그인 팔은 오너 secret이 있는 `cc-browser-measure.yml`에서만 돈다 (쿠키 도메인 때문에 단독 Actions 점검은 익명만) |
| ~~U4 (rev2.2)~~ <!-- SUPERSEDED 2026-10-14: 비교 방법은 cc.design.md §19 (rev2.3)로 대체. 다음 U4 run 전 보정. 아래 attempt 2 판정 기록은 고치지 않는다. 주석: 주 지표의 원인은 흔들림과 섞였다. kill은 G-a, G-b FAIL로 유지 --> | **정정, U3 비교 run 전 (2026-10-14, system-architect, `cc.design.md` §17).** G-CC. `w1_nav_ms_s2_s6` (s2–s6 `[nav]` 합), 로그인(auth) expanded, 브라우저. run 값 = run마다 1개. 단위 값 = run 3개 중앙값. p50이 아니라 합이다 | 통과: 줄어든 양 ≥ max(범위 × 2, 기준값의 10 %). 실패: 미달이면 U4 되돌림과 `recover`. 기록만: 단계별 run 값, collapsed, 익명 | **기준 재설정, U4 비교 run 전 (2026-10-14, 하네스 v1 → v2).** 비교 기준 = `0ac938c` 위 v2 브라우저 3회: 295 / 329 / 329, 중앙값 329, 범위 34 [S-CRIT-15]. 이 값이 아래 둘을 대체한다. ~~U3 뒤 v1 브라우저 3회: 348 / 343 / 338 → 343, 범위 10~~ [S-CRIT-14]. ~~가안 = U1 브라우저 run: 607 / 533 / 541, 중앙값 541, 범위 74~~ [S-CRIT-8] 45행. 참고 U0b: 679 / 561 / 585 → 585, 범위 118 [S-CRIT-4] 42행 | 판정선 = max(34 × 2, 329 × 0.1) = max(68, 32.9) = **68 ms** (U4 뒤 중앙값 ≤ 261 ms면 통과). ~~343 기준 판정선 max(20, 34.3) = 34.3 ms~~. ~~가안 148 ms~~. ~~판정: 없음~~. **판정 (attempt 2, `f122265`): FAIL, 회귀(regression).** U4 뒤 482 / 421 / 434 → 434, 범위 61. 감소 −105 < 68 [S-CRIT-19]. 조건: U4 비교 run도 하네스 v2 (`code_sha` `2d5f4acc0be4` 또는 CHANGELOG에 적힌 v2), 같은 실행 기기(`linux 6.17.0-1022-azure`, chromium 156)로 돈다. v2도 바이트는 null이 남는다 (로그인 expanded 37–39개/run). 바이트 지표는 판정에 쓰지 않는다 | 판정 실패, G-e 실패, 또는 스키마나 URL 변경 없이 빌드 통과 불가 → U4 커밋 `git revert` + 재배포 + purge, 그다음 `recover` | ~~시작 전 (M-CC2)~~. **FAIL, kill 발동.** 판정 run `runs/20261014T092201Z_U4_u4_f122265_browser/`. 가드 G-a, G-b도 FAIL (`u4-verdict.md` §3). 되돌림 `7b1d1c9` (dispatch 기록). `recover` K3 정지, 오너 답 대기 (#102). Attempt 1 `535b931`은 측정 없이 되돌림 `7b4a138` (운영 500, dispatch 기록). 조건 충족: 하네스 v2 `2d5f4acc0be4`, 같은 플랫폼 [S-CRIT-19] |
| U5 | MISS TTFB p50. `/`, `/@taeklim/projects`, `/@taeklim/<S>`, `?cb=`. curl `ttfb_ms` (§14.1) | 통과: 줄어든 양 ≥ max(범위 × 2, 50 ms). 읽기 A: run마다 세 페이지 원값 9개의 p50 → run 3개 중앙값. 실패: 미달이면 그 fetcher의 지시문 되돌림 | U0b run 3개: 280 / 263 / 210 ms. 중앙값 263, 범위 70 [S-CRIT-3] | 판정선 = max(70 × 2, 50) = **140 ms**. §14.1이 이 값을 고정했다. 판정: 없음 | 판정 실패, G-i 실패, revalidate 뒤 옛 tree → 그 fetcher 지시문 삭제 | 시작 전 (M-CC3) |
| U6 | 정확성 판정 (이진). 글 1개 제목 수정 → 스크립트 1회 → 60초 안에 익명 창과 로그인 창 모두 새 제목 | 통과: 참. 실패: 거짓이면 되돌림 | 해당 없음 (이진) | 해당 없음. 판정: 없음 | 판정 거짓 → 스크립트 revert. `cacheLife`가 최대 지연 상한 | 시작 전 (M-CC3) |
| U7 | W3 동안 `my.`에 온 `/api/posts/load-more` 요청 수 (`proxy.ts` 요청 로그). (b)안 (#92 Q11) | 통과: (b)안 0. (a)안이면 두 번째 같은 스크롤에서 `cf-cache-status: HIT` 비율 ≥ 90 %. 실패: 미달이면 되돌림. 가드 추가: Express `rate_limit` 경고 수 | 참고, U0b 브라우저 `w3_load_more_requests`: 익명 expanded 2 / 2 / 2, 로그인 expanded 2 / 2 / 2. collapsed 팔은 W3를 돌지 않는다 (값 없음) [S-CRIT-4]. curl load-more 18/18 `DYNAMIC`, (a)안 HIT 0 % [S-CRIT-3] | 판정선 = 0 (절대값). ~~판정: 없음~~. **판정 (`964c9f8`): 통과.** `my.` `/api/posts/load-more` 요청 12 → 0. 셈 = `raw.jsonl`의 `"path":"/api/posts/load-more` 접두 줄. 기준 = U3 브라우저 12, U4 기준 브라우저 12 [S-CRIT-20] | 판정 실패 또는 로그인 draft가 2쪽부터 안 보임 → `git revert` | ~~시작 전 (M-CC3)~~. **통과.** 판정 run `runs/20261014T095432Z_U7_u7_964c9f8_browser/`. `blog-api.` 피드 12개 모두 200. hydration 0. G-a 익명 22, 로그인 35. 가드 추가: Express `rate_limit` 로그 0줄, 09:54–10:15 UTC (dispatch 기록, 저장 파일 없음). G-c 0 FAIL도 dispatch 기록이다. 셈 출처는 등록된 `proxy.ts` 로그가 아니다 (§3 7번). draft 확인(CC-U7 AC4)은 이 run에 없다 |

## 2. 가드 표

**무엇을 알려고 쓰나:** 모든 단위에서 깨지면 안 되는 선과 그 기준선 값. 하나라도 깨지면 그 단위를 되돌린다 (§5.3).

- 행 하나 = 가드 하나. G-a…G-l 12개와 G-e2 1개, 모두 13개다.
- 기준선 값은 U0b의 curl run 3개 또는 브라우저 run 1폴더(run 3개)에서 읽었다.

| ID | 가드 (§5.3) | 통과 기준 | U0b 기준선 값 | 출처 |
| --- | --- | --- | --- | --- |
| G-a | W1+W3+W4 동안 10초 창 최대 요청 수 (`/_next/` 제외) | 기준선 + 20 % 이하. 30 초과는 오너 경보 (되돌림 조건 아님) | 익명 expanded 23 (한도 27.6). 로그인 expanded 38 (한도 45.6). 익명 collapsed 23 (한도 27.6). 로그인 collapsed 39 (한도 46.8). 로그인 팔은 기준선부터 30 초과 | [S-CRIT-4] 18, 47, 77, 101행 |
| G-b | W4 링크 1개당 prefetch 요청 수 | 기준선보다 늘지 않음 | 최댓값: 익명 2, 로그인 5. 평균: 익명 1.75, 로그인 2.29 | [S-CRIT-4] 24, 25, 53, 54행 |
| G-c | `./_scripts/cloudflare/traffic-check.sh` | 0 FAIL | 0 FAIL ×3 | [S-CRIT-9] |
| G-d | 공개 표본 응답 `set-cookie` | 0줄 | 0줄 ×3 (`public_set_cookie_lines`) | [S-CRIT-10] |
| G-e | `/nope`, `/@nope/x` status | 404 | 404, 404 ×3 (`status_nope`, `status_nope_handle`) | [S-CRIT-10] |
| G-e2 | `/@taeklim/nope` status (slug 단계) | §5.3 원문: 기록만. `00.tasks.md` 839행과 `baseline.md` §4: 기준선이 404라 404를 가드로 쓴다 | 404 ×3 (`status_nope_slug`) | [S-CRIT-10] |
| G-f | W1 콘솔 hydration 오류 | 0, rail 펼침과 접힘 두 상태 모두 | 0, 네 그룹 (익명, 로그인 × expanded, collapsed) | [S-CRIT-4] 28, 57, 82, 106행 |
| G-g | 비공개 글 고의 파손: 익명 창에서 오너의 비공개 글 URL | 404 화면, 본문 없음 | 미측정 | 없음. ~~**상태 (2026-10-14): 모든 단위 미측정.** 실측 필요: `cc-browser.mjs --private-path <경로>`, 경로는 오너가 준다. U4 기준 run manifest에도 미측정 경고가 있다 [S-CRIT-15]~~. **상태 갱신 (2026-10-14): U3 배포 `0ac938c` 통과.** 익명 비공개 글 → 404, 본문 제목 0 (`smoke-0ac938c.txt` 19행) [S-CRIT-21]. U4 attempt 2, U7 브라우저 run은 미측정 (manifest 경고) |
| G-h | 같은 URL의 prefetch와 이동이 서로 다른 `_rsc` 값 | 다름 | 미측정 (curl은 구성상 다름) | 없음. **상태 (2026-10-14): 통과, 기준선부터 U4 기준까지 브라우저 폴더 6개.** 이동 `_rsc` 359건의 값 12개가 prefetch 요청에 0건 나온다. 근거: `00.runs.md` §2.1 "G-h 계산" [S-CRIT-16] |
| G-i | VM 메모리 (`./_scripts/gcp/vm-metrics.sh 1`) | 최대 < 80 % | 실행 시각 52.1, 52.9, 52.9 %. 24시간 최대 64.2 % | [S-CRIT-11] |
| G-j | 서버 fetch 수 / MISS 렌더 (QW1 지표) | QW1 뒤 단위에서 늘지 않음 | U0b 19. QW1 뒤 13. 그래서 뒤 단위의 한도는 13 | [S-CRIT-1], [S-CRIT-2]. **상태 (2026-10-14): U2, U3 통과.** run 값 12 / 12 / 12 (두 단위 모두, 범위 0, valid 3/3, home 3 + posts 5 + post 4). U1은 curl run이 없어 미측정. 근거: `runs/*_U{2,3}_u{2,3}_*/ssr_fetch_summary.txt` [S-CRIT-17]. **갱신: U4 attempt 2 통과.** 12 / 12 / 12, valid 3/3. curl 하네스 v2 값이다 (§3 8번) [S-CRIT-19] |
| G-k | 익명 HTML이 `railCollapsed` 쿠키와 무관 (QW2 판정 (1)) | QW2 뒤 모든 단위에서 참 | U0b 거짓 ×3 (D1 재현, 설계상 정상). QW1/QW2 배포 뒤 참 3/3 | [S-CRIT-3], [S-CRIT-5] |
| G-l | 감사 PASS 항목 회귀 없음: B1, B3, C5, C6, D2, D3 | 모두 유지 | D3만 데이터: `?_rsc=` `text/x-component` PASS ×3. B1, B3, C5, C6, D2는 코드 grep이라 run 밖. 기록 없음 | [S-CRIT-9] 8행. ~~**상태 (2026-10-14): 일부.** D3 통과 (QW1, U2, U3 curl 9개). B1, B3, C6 통과 (작업 트리 `787daed` grep). D2 = 13줄, 기준 `19f5e31` 비교는 git이 필요하다. C5 미확인 (운영 HTML 필요). 근거와 명령: `00.runs.md` §2.1 "G-l 계산", §3.1 [S-CRIT-18]~~. **상태 갱신 (2026-10-14): U3 `0ac938c` 통과.** D2 13줄, 배포 6개 같음. `Promise.all` 0. `git diff 0ac938c..787daed apps/` 비어 있음. 그래서 B1, B3, C6 grep은 `0ac938c`에 적용된다. C5 통과 (`smoke-0ac938c.txt` 21–24행) [S-CRIT-21]. U4 curl D3 통과 ×3 |

## 3. 열린 항목

이 파일은 아래를 정하지 않는다. 정하는 사람을 적었다.

| # | 항목 | 사실 | 누가 |
| --- | --- | --- | --- |
| 1 | U1 행을 하나로 묶음 | dispatch는 U1b, U1c 행을 따로 요구했다. CC-U0a AC5는 단위 행 9개를 센다. 그 정규식은 `U1` 뒤 공백을 찾는다. 그래서 `U1b`, `U1c` 행은 세지 않는다. §5.3도 U1 행 하나다. U1b와 U1c는 한 배포 `3596e4c`, 한 공식으로 판정됐다 (`u1-verdict.md`). 그래서 한 행으로 썼다 | main session (나눌지 결정) |
| 2, 3 닫힘 | **2026-10-14 system-architect가 정했다 (`cc.design.md` §17, U3 비교 run 전).** 팔 = 로그인 expanded. U3 = s5 단계 값, U4 = s2–s6 합. 아래 두 행은 기록으로 남긴다 | 정함 | 없음 |
| 2 | U3, U4의 rail 팔 | §14.1과 #88 Update는 로그인 팔의 rail 상태(expanded, collapsed)를 정하지 않았다. 이 파일은 expanded로 계산하고 "가정"이라 적었다. 참고: collapsed로 하면 U4 run 값 34 / 35 / 33, U3 s5 값 348 / 453 / 367 | system-architect (#88 Update) |
| 3 | U3, U4 읽기를 브라우저 데이터에 맞추기 | §14.1은 "run마다 원값 15개 (5단계 × 반복 3)"다. 이것은 curl run 모양이다. 브라우저 run은 run마다 W1 1회라 원값 5개다 (`nav.log` 60줄 = 4 그룹 × 3 run × 5). 이 읽기로 U4 run p50은 34–35 ms다. 이 값은 s2 단계 값이다. 그래서 s5(글 상세, 347–473 ms)가 바뀌어도 U4 지표는 거의 움직이지 않는다 (data-analyst 관찰). U3 run 전이라 아직 고칠 수 있다. 이 파일은 다른 읽기를 고르지 않는다 | system-architect (#88 Update, U3 run 전) |
| 4 | U1 판정 | 판정 불가. 다시 측정 선택지 A (두 배포 재측정) / B (판정 없음으로 닫음) | 오너 (`u1-verdict.md` §5) |
| 5 | QW2 판정 (2) | 첫 paint 스크린샷 없음 | main session (CC-QW2-2) |
| 6 | 단위마다 빠진 가드 | ~~G-g, G-h, G-l(코드 grep)과 smoke 15개(§7.3)는 어느 단위에도 기록이 없다~~. ~~갱신 2026-10-14: G-h 통과, G-j U2/U3 통과, G-l 일부 (§2). 남음: G-g, smoke 15개, G-l C5와 D2 기준 비교, U1의 curl 가드. 기준선 `smoke.txt`는 없다~~. 갱신 2026-10-14 (2): G-g, G-l은 U3에서 통과. smoke 기준선 = `smoke-0ac938c.txt` (#101). 남음: U1의 curl 가드, U4와 U7 열의 G-g, G-h, smoke | main session (측정). ~~smoke 기준선 선택은 pm과 architect~~ (#101로 정함) |
| 7 | U7 지표 출처 | §5.3은 `proxy.ts` 요청 로그다. 브라우저 `w3_load_more_requests`는 참고값이다. 판정 전에 어느 출처로 셀지 확인한다. **갱신 (2026-10-14):** U7 판정은 브라우저 `raw.jsonl`의 `my.` 경로 줄 수로 냈다 (dispatch). `proxy.ts` 로그 수는 저장 파일에 없다. `w3_load_more_requests`는 2 / 2 / 2로 그대로다. 호스트를 가르지 않는 것으로 읽는다 (추정). 출처를 바꾼 확인은 아직 없다 | system-architect (출처 확인) |
| 8 | 하네스 버전 | curl `code_sha` `7c45cff7baf1` (U0b) → `5b54f3f63fa1` (QW1). 브라우저 `df24dbc8d070` (U0b) → `224ea49e90b9` (after-QW, U1). `CODE_VERSION`은 모두 `v1`이다. 재현 검사가 없다 (`rules/measurement.md` §2.4). **갱신 (2026-10-14):** 브라우저 v2 `2d5f4acc0be4` (U4 기준부터), curl v2 `a8e8c318e25c` (U4 curl부터). G-j U3 12 → U4 12는 curl v1 → v2를 건넌다 | developer |
| 9 | U7 run의 로그인 W1 시간 | 로그인 expanded `w1_nav_ms_s2_s6` 454 / 500 / 609 → 500. `0ac938c` v2 값은 329다. U7은 W1을 바꾸지 않는다 (dispatch). U4 attempt 2 값 434보다 크다. 원인 미확인. 표: `00.runs.md` §3 14번 | system-architect (`recover`의 U4 판별과 함께) |

## Sources

- [S-CRIT-1] U0b QW1 counts | `deploy/traffic/review/cc/runs/20261014T050303Z_baseline1_b13f4ee/ssr_fetch_summary.txt`, `.../20261014T050727Z_baseline2_b13f4ee/ssr_fetch_summary.txt`, `.../20261014T051216Z_baseline3_b1fcedc/ssr_fetch_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-CRIT-2] QW1 counts | `deploy/traffic/review/cc/runs/20261014T053805Z_QW1_qw1_1_61d48bc/ssr_fetch_summary.txt`, `.../20261014T054229Z_QW1_qw1_2_61d48bc/ssr_fetch_summary.txt`, `.../20261014T054651Z_QW1_qw1_3_61d48bc/ssr_fetch_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-CRIT-3] U0b baseline summary | `deploy/traffic/review/cc/baseline.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-CRIT-4] U0b browser baseline | `deploy/traffic/review/cc/runs/20261014T052554Z_baseline_19f5e31_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read, values column read as run order
- [S-CRIT-5] QW1 curl manifests | `deploy/traffic/review/cc/runs/*_QW1_qw1_{1,2,3}_61d48bc/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: top keys and guards keys grepped
- [S-CRIT-6] after-QW browser run | `deploy/traffic/review/cc/runs/20261014T053859Z_QW1_after_qw_61d48bc_browser/summary.csv`, `browser_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: browser_summary.txt full read, summary.csv rows grepped
- [S-CRIT-7] U1 verdict memo | `deploy/traffic/review/cc/u1-verdict.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-CRIT-8] U1 browser run | `deploy/traffic/review/cc/runs/20261014T055732Z_U1_u1_3596e4c_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: rows grepped
- [S-CRIT-9] traffic checks | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/traffic-check.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: PASS and FAIL lines grepped
- [S-CRIT-10] U0b curl manifests | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: guards keys grepped
- [S-CRIT-11] VM metrics | `deploy/traffic/review/cc/runs/*_baseline{1,2,3}_*/vm.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: per-hour lines grepped
- [S-CRIT-13] U2 browser run | `deploy/traffic/review/cc/runs/20261014T070608Z_U2_u2_c26c69d_browser/summary.csv`, `raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: summary.csv full read; raw.jsonl grepped for s1 document and s6 first request `at`
- [S-CRIT-14] U3 browser run | `deploy/traffic/review/cc/runs/20261014T073207Z_U3_u3_0ac938c_browser/summary.csv`, `browser_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full files read
- [S-CRIT-15] U4 v2 baseline run | `deploy/traffic/review/cc/runs/20261014T074439Z_U4_u4base_v2_0ac938c_browser/manifest.json` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read, including env and warnings
- [S-CRIT-16] G-h key comparison | `deploy/traffic/review/cc/runs/*_browser/raw.jsonl` (6 folders) | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: navigation and prefetch `_rsc` values grepped and counted
- [S-CRIT-17] U2, U3 QW1-metric counts | `deploy/traffic/review/cc/runs/*_U2_u2_{1,2,3}_c26c69d/ssr_fetch_summary.txt`, `.../*_U3_u3_{1,2,3}_0ac938c/ssr_fetch_summary.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: rep lines and run value lines read; files made by main session after the runs
- [S-CRIT-18] G-l code grep | `apps/dashboard_client_web` working tree at main HEAD `787daed`; `deploy/traffic/review/cc/runs/*/traffic-check.txt` line 8 | published: 2026-10-14 | accessed: 2026-10-14 | type: code | note: grep only; tree equality with deployed sha not verified
- [S-CRIT-19] U4 attempt 2 runs and verdict | `deploy/traffic/review/cc/u4-verdict.md`; `deploy/traffic/review/cc/runs/20261014T092201Z_U4_u4_f122265_browser/summary.csv`, `manifest.json`; `.../*_U4_u4_{1,2,3}_f122265/` (`manifest.json`, `ssr_fetch_summary.txt`, `traffic-check.txt`, `vm.txt`) | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: verdict memo full read; summary rows and manifest keys grepped; revert shas from dispatch, not from a file
- [S-CRIT-20] U7 browser run and load-more counts | `deploy/traffic/review/cc/runs/20261014T095432Z_U7_u7_964c9f8_browser/` (`manifest.json`, `summary.csv`, `browser_summary.txt`, `raw.jsonl`); U3 and U4 base browser `raw.jsonl` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: summaries full read; prefix `"path":"/api/posts/load-more` lines counted per file; rate_limit and traffic-check values from dispatch, no saved file
- [S-CRIT-21] smoke, G-g, C5, D2 on 0ac938c | `deploy/traffic/review/cc/smoke-0ac938c.txt` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: full file read; written by main session, git lines are its results
- [S-CRIT-12] design and pre-registration | `cc.design.md` §5.3, §7, §14, §15.2, §16; `decisions.plan.md` #88, #88 Update, #94, #96; `00.tasks.md` Phase CC rows | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: sections read
