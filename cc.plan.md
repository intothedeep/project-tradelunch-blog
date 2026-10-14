# Phase CC plan detail: 앱 전체 `cacheComponents` + RSC prefetch 성능

> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.

- 상위 문서: `00.plan.md` Phase CC 절 (mission block, stub).
- 설계: `cc.design.md` rev2 (system-architect). 감사: `perf.audit.md`, 출처 `perf.sources.md`.
- 결정: `decisions.plan.md` #82–#88, #92–#96. 행: `00.tasks.md` Phase CC.
- 이 파일은 설계를 다시 쓰지 않는다. 절 번호로 인용한다.

## 1. 순서와 사다리

```
P1 gate PASS (Phase PJ M3)
   │
   ▼
M-CC1 MVP1 (flag off) ─────────────────────────────────────────────────────────
 U0a 계측 ─► U0b 기준선 ─► QW1 빠른 수정 ─► QW2 rail 폭 hotfix ─► U1a ─► U1b 공유 왼쪽 rail ─► U1c 공유 오른쪽 rail (#93) ─► U2 staleTimes ─► U3 잎 정리
   │                                                                                       gate (reviewer)
   ▼
M-CC2 MVP2 (flag on) ── U4 cacheComponents: true ── gate (reviewer)        S-CC = B (owner 2026-10-14, #85)
   │
   ▼
M-CC3 MVP3 ── U5 'use cache' 3개 ─► U6 무효화 ─► U7 load-more ── gate (reviewer)
   │
   ▼
Phase PJ M4 (P2) 열림 (#82)
```

- 단위 순서 = 설계 기본값, 오너 수용 2026-10-14 (#87 Update, #92). 오너 지시 #83은 "첫 단위 = 공유 rail"이었다.
- 코드 작업은 P1 gate 전에 시작했다 (owner "dispatch all", #92). 배포는 위 순서를 지킨다. QW2 배포는 U0b 기준선 뒤.
- 측정: 익명, 로그인 팔 모두 main session이 스크립트로 잰다 (#92 Q9). 오너 브라우저 HAR 실행은 없다.
- U7은 U0b 뒤 어디든 갈 수 있다. 기본 자리는 끝이다 (`cc.design.md` §7).
- 단위 하나 = 배포 하나 = purge 하나 (Q7). 측정은 main session과 오너가 한다.
- 각 milestone 끝: 단계 보고를 `cc.report.md`에 쓴다 (`.claude/CLAUDE.md` MVP 사다리 "stage report"). 그 뒤 gate.
- mock은 없다. 기다리는 backend가 없다 (`cc.design.md` §7.1).

## 2. Tactics (kill 조건은 시작 전에 적었다, `cc.design.md` §7 마지막 칸)

### M-CC1

#### Tactic: 계측과 기준선 (U0a, U0b)
- kill: 계측이 콘솔과 로그 밖의 동작을 바꾼다 → 파일 revert.
- kill: 기준선 3회 범위가 지표 중앙값의 50 %를 넘는다 → 측정 방법 재설계 (architect).

#### Tactic: 빠른 수정 (QW1, QW2)
- kill: 가드 G-a…G-l 하나라도 실패 → `git revert` + 재배포 + purge.
- kill (QW2): 정확성 판정 3개 중 하나라도 거짓 → 같은 되돌림.

#### Tactic: 공유 rail을 route group layout에서 한 번 렌더 (U1a, U1b, U1c)
- U1a, U1b = done (df11372, 왼쪽 rail은 `(shell)/layout.tsx` 한 곳). 운영 측정 = CC-U1a-2, CC-U1b-2.
- U1c = (ii′) `[handle]/(rail)` route group layout. 오른쪽 rail 렌더 자리 2곳 = `(feed)/layout.tsx`, `[handle]/(rail)/layout.tsx` (#94, `cc.design.md` §15).
- kill: 빌드 실패, 또는 smoke 15개 중 하나라도 status나 `location` 변화 → `git revert` + 재배포 + purge.

#### Tactic: client router cache 재사용 (U2)
- ~~kill: W2 `_rsc` 수 감소 0, 또는 오너가 30초 지연을 거부(Q6) → 설정 줄 삭제.~~ <!-- SUPERSEDED 2026-10-14 by #96 -->
- kill (#96, `cc.design.md` §16.4): W1 s6 익명 `_rsc` 감소 0 (s1→s6 간격 < 25 s인 run에서), 또는 오너가 30초 지연을 거부(Q6) → 설정 줄 삭제 + 재배포 + purge.

#### Tactic: flag off 상태에서 잎 정리 (U3)
- kill: 가드 실패 → `git revert`.

### M-CC2

#### Tactic: flag on, 데이터는 모두 Suspense 잎, 캐시 없음 (U4)
- kill: 주 지표 판정 실패, G-e 실패, 또는 스키마나 URL 변경 없이 빌드 통과 불가 → U4 커밋 `git revert` + 재배포 + purge, 그다음 `recover`.

### M-CC3

#### Tactic: 공개 저빈도 데이터 3개만 `'use cache'` (U5)
- kill: 판정 실패, G-i 실패, 또는 revalidate 뒤 옛 tree → 그 fetcher의 지시문 삭제.

#### Tactic: 두 층 무효화 (U6)
- kill: 정확성 판정 거짓 → 스크립트 revert. `cacheLife`가 최대 지연 상한.

#### Tactic: load-more를 엣지 안으로 (U7)
- kill: 판정 실패, 또는 로그인 draft가 2쪽부터 안 보임 → `git revert`.

## 3. 오너 질문: 모두 답함 (2026-10-14, Q1–Q13 #92, Q14–Q15 #93 Update)

| # | 질문 (한 줄) | 답 | 쓰는 행 |
| --- | --- | --- | --- |
| S-CC | 전략 A, B, C 중 무엇 | B (owner "B", #85 Update) | CC-U4 이후 |
| Q1 | 프로젝트 글 상세에서 RecentVisited 숨김(#79)을 잎 신호로 지킬까 | 지킨다, `RailContextPublisher` ("take yours") | CC-U1b |
| Q2 | `/@u/saved`에 rail을 보일까 | ~~숨긴다 ("take yours"). `/@u/me`도 같은 규칙 (pm 판단, 아래 §4)~~ <!-- SUPERSEDED 2026-10-14 by #95 --> 보인다: saved, me 모두 왼쪽 rail 있음 (오너 2026-10-14, #95, dc9aaa0) | CC-U1b |
| Q3 | 기준선 전에 계측 코드 2개(`[nav]`, `ssr_fetch`)를 배포해도 되나 | 된다 ("take yours") | CC-U0a |
| Q4 | `proxy.ts` 요청 로그에 `durationMs`를 넣을까 | 안 넣는다, MISS TTFB + `ssr_fetch` `ms` ("take yours") | 없음 |
| Q5 | `[slug]`, `[project]` sample을 무엇으로 | env 상수 `CC_SAMPLE_SLUG`, `CC_SAMPLE_PROJECT` ("take yours") | CC-U4 |
| Q6 | 뒤로 가기 때 좋아요, 댓글 수가 최대 30초 늦어도 되나 | 된다 ("ok") | CC-U2 |
| Q7 | 단위마다 배포 1회 + purge 1회 (11회) | 된다 ("ok") | 모든 행 |
| Q8 | U5 빌드가 운영 `blog-api.`를 호출해도 되나 | 된다, `x-origin-key` secret ("take yours") | CC-U5 |
| Q9 | 로그인 팔(arm)을 오너가 3회씩 재 줄 수 있나 | "ok, but you can test by yourself" → main session 스크립트 측정 | CC-U0a (스크립트), U0b, U3, U4 |
| Q10 | rail 폭 버그를 별도 hotfix로 먼저 낼까 | 예, QW2 ("take yours", #86 Update) | CC-QW2, U1b |
| Q11 | load-more (a) Next 경로 엣지 캐시, (b) 브라우저가 `blog-api.` 직접 | (b) ("take yours") | CC-U7 |
| Q12 | QW1, QW2를 P1 gate 전에 내도 되나 | 기준선 바로 뒤 ("take yours"). 코드는 지금 시작 ("dispatch all") | CC-U0a, QW1, QW2 |
| Q13 | D4(tree 링크 `<a href>`)를 CC 밖으로 미뤄도 되나 | 미룬다 ("take yours") | 없음 (행 없음) |
| 순서 | QW1, QW2를 U1 앞에 둘까 (#83과 다름) | 기본값 수용 (#87 Update) | CC-QW1…U1b 선행 칸 |
| Q14 (#93) | `/@u/me`에도 공유 오른쪽 rail(HomeRightRail)을 넣나 | 넣지 않는다 (owner "ok go with your recommendations") | CC-U1c |
| Q15 (#93) | `/@u/posts`의 프로필 카드와 인기 태그를 옮기나, 빼나 | 인기 태그는 뺀다. 프로필 카드는 `/@u/posts`에서만 공유 rail 위에 남긴다 (owner, 같은 답) | CC-U1c |
| G-CC | 판정선 숫자와 날짜 | 판정선 = 기준선 뒤 (#88). 날짜 = 없음 | 없음 (DRAFT 유지) |

## 4. 설계와 코드가 다른 곳 (2026-10-14 grep, 행 AC는 코드 기준)

| 설계 줄 | 오늘 코드 | 행 처리 |
| --- | --- | --- |
| D7 `app/me/page.tsx:6` `force-dynamic` | `app/me/` 없음. `app/[handle]/me/page.tsx:9`에 `force-dynamic` (PJ-1-32, #89) | CC-U4가 새 경로를 지운다 |
| D8 `app/me/saved/page.tsx:10` `currentUser()` | `components/me/OwnerOnly.server.tsx:17` `currentUser()`. `[handle]/me`, `[handle]/saved`가 쓴다 | CC-U3이 Suspense 잎으로 옮긴다. 404 상태 유지 문제는 CC-U4 |
| §4.2 `@/app/[handle]` import 16파일 19곳 | 15파일 18곳 | CC-U1a AC = 0곳 (개수 아님) |
| D23 `resume/page.tsx:117` | 같은 줄 + 죽은 사본 `app/ResumePage.tsx:117` (import 0) | CC-U3은 살아 있는 파일만. 죽은 사본은 보고 |
| §4.4 rail 없는 route 목록 | `/@u/me`가 새로 생겼다 (#89). U1b 뒤 `[handle]` 전체가 `(shell)` 안이다 | ~~`railVisibility`가 `/@u/me`도 숨긴다 (오늘 `/me`에 rail 없음, Q2와 같은 이유)~~ <!-- SUPERSEDED 2026-10-14 by #95 --> `/@u/me`, `/@u/saved` 모두 왼쪽 rail 보임 (#95, dc9aaa0) |
| G-e2 `/@taeklim/nope` "기록만, 200 예상" | PJ-1-35가 없는 slug를 HTTP 404로 고친다 | 기준선이 404면 G-e2는 가드(404)로 쓴다. CC-U4 AC |
| §5.4 W1–W4 HAR = 오너 손 조작 | 오너 답 Q9: main session 스크립트 | CC-U0a가 측정 스크립트를 만든다 |
