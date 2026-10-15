# 트래픽 디버깅 증거 표 (traffic debug evidence)

> 작성: data-analyst, 2026-10-14. 저장된 파일만 읽었다. 실행, 네트워크, git은 쓰지 않았다.
> 숫자는 모두 파일에서 읽었다. 칸마다 `[S-TDE-n]`으로 출처를 단다. 출처 표는 맨 아래 §5다.
> 태그 `TDE`는 이 파일이 정했다 (dispatch에 태그가 없었다).
> 상태: 초안 완성. 모든 절을 채웠다.

## 0. 결론

- 2026-09-22 Vercel 402의 원인은 앱 쪽 캐시 누수 5건이다 [S-TDE-1] [S-TDE-3].
- 그 5건 중 전후를 같은 단위로 잰 것은 OG 렌더 시간 하나뿐이다. 528 → 12 ms [S-TDE-2].
- 사용량(GB, 호출 수, CPU 시간)은 402 전에도 뒤에도 저장된 값이 없다. "얼마나 줄였나"를 바이트나 돈으로 말할 수 없다 (§4).
- 같은 단위로 전후를 잰 감소는 Phase CC 측정 셋이다 (서버 fetch 19 → 12, `my.` load-more 12 → 0, s6 `_rsc` 1 → 0) [S-TDE-13] [S-TDE-14].
- 스크롤 폭주(79 요청)는 전 값만 있다. 고친 뒤 개수는 세지 않았다 [S-TDE-9] [S-TDE-12].
- U4 운영 배포는 요청을 **늘렸다**. 메뉴 링크당 prefetch 2 → 6, 로그인 10초 최대 35 → 50–53 [S-TDE-16] [S-TDE-17].

## 1. 사건 시간표 (timeline)

**무엇을 알려고 쓰나:** 언제 어떤 증상이 났고, 그때 무엇을 바꿨나.

```text
2026-09-22  Vercel 402 (my., blogapi. 둘 다) ─► 누수 5건 수정 d094859, e4c6f48, c21e53c
2026-10-12  Vercel 떠남, GCP e2-micro + Cloudflare Tunnel (#47, #51, #53, #54)
2026-10-13  Cache Rules ON (DYNAMIC → HIT) ─► L1 / L2 / L-a 시험 ─► 한도 100 → 50 (#68)
2026-10-13  17:52 스크롤 79 요청, 429 ─► #70 a–d (34e2080) ─► 옛 HTML로 잘못 셈 ─► f
2026-10-14  35b3630 "줄었다" (개수 없음) ─► Phase CC QW1 … U7
2026-10-14  U4 운영 (prefetch ×3) ─► 한도 50 → 70 (#106) ─► U5 오류 43회, 되돌림
```

| 날짜 (UTC 또는 문서 날짜) | 증상 또는 사건 | 측정값 | 출처 |
| --- | --- | --- | --- |
| 2026-09-22 | `my.`, `blogapi.` 둘 다 HTTP 402 `x-vercel-error: DEPLOYMENT_DISABLED` (Vercel Hobby 쿼터 소진) | 어느 계량기가 넘쳤는지 저장 파일 없음 | [S-TDE-1] |
| 2026-09-22 | 로컬 `next start` probe: HTML에 `Set-Cookie: locale=en` + Clerk `private, no-cache, no-store`. OG 응답에도 `Set-Cookie` | 이진 (있음) | [S-TDE-2] 330–331행 |
| 2026-09-22 | Cloudflare는 네임서버였지만 `my.`, `blogapi.`는 DNS-only. 앱 요청 경로에 한 번도 없었다 | 이진 | [S-TDE-1] [S-TDE-2] 333행 |
| 2026-09-22 | 누수 5건 수정 (`d094859`, `e4c6f48`), `locale` 쿠키 삭제 (`c21e53c`) | OG 528 → 12 ms | [S-TDE-2] 337–345행 |
| 2026-09-22 ~ 10-12 | 운영은 계속 402. 로컬 probe만 가능. 엣지 규칙은 "402 해소 뒤에만" | 없음 | [S-TDE-2] 346, 357행 |
| 2026-10-12 | 두 hostname을 터널에 연결. 방문자는 402 대신 Cloudflare 502를 봄 (오리진 미기동) | 없음 | [S-TDE-30] 418행 |
| 2026-10-12 | 호스팅 Vercel → GCP (#47). Vercel은 402로 살아 있는 fallback 없음 | 없음 | [S-TDE-4] |
| 2026-10-13 | 규칙 전 측정: HTML과 OG 이미지 모두 `DYNAMIC`. 모든 방문이 VM까지 감 | 이진 | [S-TDE-5] 41–42행 |
| 2026-10-13 | Cache Rules 켬. `/`, `/blog`, `/robots.txt`, `/sitemap.xml` 두 번째 GET = `HIT` | 이진 | [S-TDE-5] 62–72행, [S-TDE-6] 116행 |
| 2026-10-13 | Browser Cache TTL 4시간(`private, max-age=14400`) → Respect Existing Headers | 이진 | [S-TDE-6] 118행 |
| 2026-10-13 | L1 HIT 경로: 640 요청, VM까지 온 시험 요청 0 | 640 / 0 | [S-TDE-7] 209–221행 |
| 2026-10-13 20:53–20:57 | L2 웹 MISS 경로: 4 rps에서 시간 초과. 웹 오리진 용량 약 2 rps | 실패 10건 (3.1 %) | [S-TDE-7] 223–247행 |
| 2026-10-13 21:00 | L-a 한도 100 / 10 s: `/` 250번 중 429 18 | 232 / 18 | [S-TDE-7] 249–261행 |
| 2026-10-13 | 오너 정상 사용: 10 s에 50을 넘은 구간 6개. 최댓값 89 | 6, 89 | [S-TDE-7] 308–322행 |
| 2026-10-13 | 한도 100 → 50 (#68) | 없음 | [S-TDE-8] |
| 2026-10-13 21:21 | 한도 50 확인: `/` 150번 중 200 53, 429 97 | 53 / 97 | [S-TDE-7] 388–396행 |
| 2026-10-13 17:52 (로컬) | 익명 메인 스크롤: `79 requests`, `264 kB transferred`. 보이는 28줄 중 27줄 실패(429) | 79, 264 kB | [S-TDE-9] 12–31행 |
| 2026-10-13 | #70 a–d 배포 `34e2080` 뒤 첫 셈 `_rsc` 108 / 전체 177. 그러나 HTML이 `age: 13671` HIT (배포 전 코드) | 108 / 177 (무효) | [S-TDE-9] 113–119행, [S-TDE-11] |
| 2026-10-13 | f: 사이드바 태그 `NavTagLink` prefetch 끔. 홈 HTML에 `/tags/...` 고유 약 30개 | 약 30 | [S-TDE-9] 102–104행 |
| 2026-10-13 | Supabase Log Query 하루 2.82 GB (로그 스캔양, 사이트 트래픽 아님) | 2.82 GB/일 | [S-TDE-23] 94–102행 |
| 2026-10-14 | `35b3630` 배포 뒤 오너 확인: 스크롤 요청이 줄었다. 개수는 세지 않았다 | 없음 | [S-TDE-12] 47행 |
| 2026-10-14 05:03–09:54 | Phase CC 기준선, QW1, U2, U3, U4 시도 2, U7 run | §2 표 | [S-TDE-14] |
| 2026-10-14 | U4 시도 1 `535b931`: 모르는 최상위 경로가 운영에서 500. 되돌림 `7b4a138` | 이진 | [S-TDE-22] 99행 |
| 2026-10-14 | U4 운영 `f76c1d9`. 한도 50 → 70, G-a 가드 ≤ 60 (#106) | G-a 로그인 50 / 53 / 50 | [S-TDE-18] [S-TDE-17] |
| 2026-10-14 18:37–18:39 | U5 T 동안 `Connection closed.` 43회. 오류 로그 855 → 1134줄. 되돌림 | 43 | [S-TDE-20] 14–18행 |

## 2. 원인 표 (root causes)

**무엇을 알려고 쓰나:** 원인마다 무엇을 고쳤고, 같은 단위로 얼마나 줄었나.

**어떻게 읽나:**

1. "감소" 칸은 전과 뒤가 같은 단위, 같은 측정 방법일 때만 계산한다.
2. 한쪽이 없거나 단위가 다르면 "비교 불가"라 적는다.
3. "미측정"은 그 칸의 값이 어느 저장 파일에도 없다는 뜻이다.

### 2.1 Vercel 402 시기 (2026-09-22)

| # | 원인 | 작동 방식 | 전 (단위, 출처) | 수정 (커밋, 결정) | 뒤 (단위, 출처) | 감소 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | 캐시 없는 `next/og` OG 이미지 route | 캐시 설정이 없었다. 수정이 fetch `revalidate`를 opt-in으로 "관통"시켰다. 곧 Phase CF(`4e5c085`)의 서버 fetch no-store가 OG 캐시를 껐다 [S-TDE-2] 337행, [S-TDE-30] 7행. `Set-Cookie: locale`도 OG 응답에 붙었다 [S-TDE-2] 331행 | 528 ms (OG route 렌더 시간, 환경은 그 줄에 없음) [S-TDE-2] 337행. 요청 수, CPU 시간: 미측정 | 24h `revalidate` (`d094859`, CF2-S1). `locale` 쿠키 삭제 (`c21e53c`, CF2-0a). #46 | 12 ms [S-TDE-2] 337행 | −516 ms (−97.7 %). **렌더 시간이다. 트래픽 감소가 아니다** |
| A2 | 목록 SELECT의 `content` (전체 마크다운) | feed, user-feed, by-tag 목록 3곳이 전체 마크다운을 실었다 [S-TDE-2] 338행. "카드는 읽지 않음"은 메모리에만 있다 [UNVERIFIED] | 미측정 (바이트 없음) | `content` 제거 (`d094859`, CF2-S2). #46 | 미측정 | 비교 불가 |
| A3 | Vercel 이미지 최적화기 (Image Transformations) | `next/image`가 Vercel `/_next/image`를 지났다. OCI + Cloudflare CDN을 건너뜀 | 미측정 (변환 수 없음) | `images: { unoptimized: true }` (`d094859`, CF2-S3). #46 | 미측정 | 비교 불가 |
| A4 | 무제한 `?limit=` | feed, user-feed, load-more가 상한 없이 행을 돌려줄 수 있었다 | 상한 없음 (코드 사실) | 상한 1000 / 50 / 50 (`d094859`, CF2-S4) | 상한 값만 있음. 요청 크기 미측정 | 비교 불가 |
| A5 | 죽은 sitemap 캐시 | `revalidate=3600`이 OG와 "같은 no-store 이유로" 꺼져 있었다 [S-TDE-2] 341행 | `revalidate=3600`이 "죽어 있었음" [S-TDE-2] 341행. 빌드 표기 `ƒ`는 메모리에만 있음 [S-TDE-28] | `e4c6f48` (CF2-S5) | 빌드 출력 `○ /sitemap.xml 1d` [S-TDE-2] 341행 | 비교 불가 (상태 변화) |
| A6 | 모든 HTML의 `Set-Cookie: locale` + DNS-only | 쿠키가 붙은 응답은 CDN이 캐시하지 않는다. Cloudflare는 경로에 없었다 | `Set-Cookie` 있음 (로컬 probe) [S-TDE-2] 330–331행 | `c21e53c` 삭제. 엣지 규칙은 GCP 뒤 (§2.2 B1) | CF2-0a DONE, "검증됨 2026-09-22". AC1, AC2 `Set-Cookie` "출력 없음" (로컬 probe, 운영 미확인) [S-TDE-2] 345–347행 | 비교 불가 (이진) |

- A1–A5 다섯 건이 #46의 "앱측 캐시 누수" 목록과 같다 [S-TDE-3].
- 이 시기에는 Cloudflare가 경로에 없었다. 그래서 엣지 HIT 비율은 0이 아니라 "해당 없음"이다 [S-TDE-1].

### 2.2 GCP + Cloudflare 시기 (2026-10-12 ~ 10-14)

| # | 원인 | 작동 방식 | 전 (단위, 출처) | 수정 (커밋, 결정) | 뒤 (단위, 출처) | 감소 |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | 엣지 캐시 없음 (Phase CF2, TC) | Next가 HTML에 `private, no-store`를 보낸다. Cloudflare는 JSON을 기본으로 캐시하지 않는다 | HTML, OG `DYNAMIC`. API `DYNAMIC` [S-TDE-5] 41–42, 100행 | web cache, web bypass, api cache, api bypass 규칙 (2026-10-13). #54 | 두 번째 GET `HIT` (URL별) [S-TDE-5] 62–72, 115–124행. L1 640 요청 중 VM 도달 0 [S-TDE-7] 209–221행 | 비교 불가 (URL별 이진 상태. HIT 비율은 미측정, §4) |
| B2 | 브라우저 캐시 TTL 4시간 | 캐시된 HTML이 `private, max-age=14400`으로 갔다. purge가 브라우저를 지우지 못함 | 14400 s [S-TDE-6] 118행 | Respect Existing Headers (2026-10-13) | `private, no-cache, no-store` [S-TDE-6] 118행 | 비교 불가 (신선도 문제, 트래픽 양 아님) |
| B3 | Next `<Link>` viewport prefetch 폭주 (스크롤) | 새 카드 10장이 화면에 들어오면 카드 링크, 태그 칩, 댓글 링크가 prefetch. Cloudflare 한도는 HIT도 센다 | 79 요청, 264 kB (스크롤 세션 전체의 DevTools 합계. 스크롤 횟수 미기록) [S-TDE-9] 14–15행, [S-TDE-10] 9행 | #70 a 태그 칩, b 댓글, c hover 전용, d load-more 실패 처리 (`34e2080`). `35b3630` 배포 [S-TDE-11] [S-TDE-12] | 개수 미측정. "줄었다"만 있음 [S-TDE-12] 21, 47행. 108 / 177은 옛 HTML을 잰 값이라 무효 [S-TDE-9] 115–117행 | 비교 불가 |
| B4 | 사이드바 태그 목록 prefetch (페이지 열 때) | `NavTagLink`가 태그 약 30개를 한꺼번에 미리 받음 | 홈 HTML의 `/tags/...` 고유 약 30개, 각 2–7번 (href 수, 요청 수 아님) [S-TDE-9] 104행 | #70 f, `prefetch={false}` [S-TDE-11] | 미측정 | 비교 불가 |
| B5 | 정상 사용의 10 s 요청 폭 (prefetch) | 한 번 누를 때 요청이 수십 개 나간다. 표는 VM까지 온 요청만 센다 | 50 초과 10 s 구간 6개, 최댓값 89 (blog-web 로그, 10-13) [S-TDE-7] 308–322행 | #68 한도 50, #70 | 같은 로그 분석을 다시 하지 않음 | 비교 불가 |
| B6 | 서버 fetch 중복 (QW1) | 서버 fetch마다 `AbortSignal`이 붙어 Next fetch 중복 제거가 꺼졌다 [S-TDE-26] | 19 (서버 fetch 수, MISS 렌더 3페이지 합, run 19 / 19 / 19) [S-TDE-13] 39행 | QW1 `61d48bc` | 13 (13 / 13 / 13) → U2 뒤 12 (12 / 12 / 12) [S-TDE-13] 39, 71행 | 19 → 13: −6 (−31.6 %). 13 → 12: −1, **원인 기록 없음** [S-TDE-14] 117–118행. 합 19 → 12: −7 (−36.8 %) |
| B7 | load-more가 `my.` 경유 (Next route handler) | 스크롤마다 `my.` `/api/posts/load-more`가 VM의 Next를 지났다. curl 응답 run마다 18/18 `DYNAMIC`, `cache-control` 없음 [S-TDE-29] 191, 395행 | 12 (브라우저 run 3개의 `my.` load-more 줄 합, U3, U4 기준 폴더 각각) [S-TDE-14] 89행 | U7 `964c9f8` (Q11 b안, 브라우저가 `blog-api.`를 직접 부름) | `my.` 0. 대신 `blog-api.` 피드 12, 모두 200 [S-TDE-14] 66, 89행 | `my.` 12 → 0 (−100 %). **없앤 것이 아니라 옮겼다.** 전체 요청 수 12 → 12. `blog-api.` 익명 run 2, 3은 HIT, 로그인은 모두 `DYNAMIC` [S-TDE-14] 144행 |
| B8 | 홈 복귀 이동 `_rsc` (U2 staleTimes) | 라우터 캐시가 짧아 s6 홈 이동이 `_rsc`를 다시 받았다 | 1 / 1 / 1 (익명 expanded s6 비prefetch `_rsc`, 브라우저) [S-TDE-13] 42행 | U2 `c26c69d` | 0 / 0 / 0 [S-TDE-13] 42행 | −1 요청 / walk (−100 %) |
| B9 | U4 운영의 prefetch 증가 (`cacheComponents` 빌드) | 메뉴 링크 하나가 segment prefetch 여러 개로 나뉨 (`/_tree`, `/_head`, `__PAGE__`) [S-TDE-16] 96–104행 | v2 기준 `0ac938c`: 링크당 최대 2 / 2 (익명 / 로그인), 메뉴 prefetch 합 7 / 13, G-a 22 / 35 [S-TDE-16] 112–114행 | U4 `f76c1d9` 운영 (#106). 한도 50 → 70 | 링크당 최대 익명 6, 로그인 6 / 6 / 5. 합 20 / 32. G-a 36 / 50, 53, 50. W1 `_rsc` 29 / 41, 44, 41 [S-TDE-17] 14–26, 50–62행 | **증가.** 링크당 최대 2 → 6 (×3). 합 익명 7 → 20 (×2.9), 로그인 13 → 32 (×2.5). G-a 로그인 35 → 50–53 (+15 ~ +18) |
| B10 | U5 `'use cache'` 시도 | MISS 렌더 TTFB를 줄이려 했다 | C 302 ms (MISS TTFB) [S-TDE-20] 8행 | U5 `b30d03a`, 되돌림 (#111) | T 316 ms [S-TDE-20] 9행 | +14 ms (줄지 않음). 시도 중 `Connection closed.` 43회 |

- B6의 기준선과 QW1 run은 하네스 `code_sha`가 다르다 (`7c45cff7baf1` → `5b54f3f63fa1`, 둘 다 v1). 재현 검사가 없다 [S-TDE-14] 189행.
- B6 U4 시도 2의 12는 curl 하네스 v2 값이다. v1 12와 같은 표에서 판정하지 않는다 [S-TDE-14] 197행.
- B7 기준 12는 U3, U4 기준 폴더의 값이다. U0b 브라우저의 `w3_load_more_requests`는 run마다 2다 [S-TDE-15] 22, 51행.
- B9 G-a는 `f76c1d9`에서 쟀다. 지금 운영 `181e6ed`의 브라우저 가드 run은 없다 [S-TDE-27] 549행.
- B9는 #70 c(hover 전용)와 같은 처방을 A-B-A T 빌드에서 쟀다. s1 prefetch 13 → 0, G-b 0 [S-TDE-19]. 운영에는 들어가지 않았다 (#106 "원래 prefetch") [S-TDE-18].
- Phase CC 기준선(10-14)은 #70(10-13) 뒤다. 기준선 `g_b_card_prefetch_total`은 이미 0이다 [S-TDE-15] 27, 56행. 그래서 CC run은 #70의 효과를 잴 수 없다.

### 2.3 용량과 한도 (감소가 아님, 맥락)

| 항목 | 값 | 출처 |
| --- | --- | --- |
| 웹 오리진 MISS 용량 C_web | 약 2 rps (4 rps에서 시간 초과) | [S-TDE-7] 244행 |
| API 오리진 MISS 용량 C_api | 8 rps 이상 (시험 상한) | [S-TDE-7] 304행 |
| Cloudflare 한도 | 100 (#62) → 50 (#68) → 70 (#106) / 10 s | [S-TDE-8] [S-TDE-18] |
| 한도 100 실측 | 약 230번째부터 차단 | [S-TDE-7] 260행 |
| 한도 50 실측 | 53번째부터 차단 | [S-TDE-7] 395행 |
| GCP 무료 egress | 1 GB/월 | [S-TDE-24] |

## 3. "그대로 두었다면" 추정 [추정]

**무엇을 알려고 쓰나:** 출처가 식이나 입력을 준 경우만 계산한다. 모두 측정값이 아니다.

| # | 대상 | 식 | 입력 (출처) | 결과 [추정] |
| --- | --- | --- | --- | --- |
| E1 | 스크롤 1회 (카드 10장), 수정 전 | load-more + 글 링크 + 태그 링크 | 1, 10, 20–30 (태그 2–3개 × 카드 10장) [S-TDE-9] 51행 | 31–41 요청 (출처가 같은 값을 적음) |
| E2 | 빠른 스크롤 2회, 10 s | E1 × 2 | 31–41 [S-TDE-9] 52행 | 약 60–80 요청 / 10 s (출처가 같은 값을 적음). 한도 50, 70 모두 넘음 |
| E3 | 스크롤 1회, 수정 뒤 기대 | load-more + 마우스를 올린 글 | 1, 0–1 [S-TDE-10] 106–113행 | 1–2 요청. 출처도 "기대값, 측정 아님"이라 적음 |
| E4 | 한 IP가 캐시를 피할 때 오리진 부하 | 한도 ÷ 10 s, C_web과 비교 | 한도 100, 50, 70. C_web 약 2 rps [S-TDE-5] 129–132행, [S-TDE-7] 244행 | 10, 5, 7 rps. C_web의 약 5, 2.5, 3.5배. 한도 100의 10 rps만 출처가 직접 적음 |
| E5 | Supabase Log Query 한 달 | 2.82 GB × 30 | 2.82 GB/일 [S-TDE-23] 101–102행 | 약 85 GB/월 (출처가 같은 값을 적음). **로그 스캔양이다. 사이트 트래픽이 아니다** |

- 402 시기의 "그대로 두었다면" 값(GB, 호출 수, CPU 시간)은 계산할 입력이 없다. 만들지 않았다.
- E4의 5, 7 rps는 이 파일의 나눗셈이다. 공격 시나리오의 상한일 뿐 관측값이 아니다.

## 4. 빈칸 (gap): 글에서 주장하면 안 되는 것

| # | 측정하지 않은 것 | 사실 | 출처 |
| --- | --- | --- | --- |
| G1 | 402 때 넘친 Vercel 계량기와 사용량 | Fast Data Transfer, 호출 수, Active CPU, Image Transformations 값이 repo에 없다. Hobby 한도 숫자도 메모리 파일에만 있다 [UNVERIFIED] | [S-TDE-1] [S-TDE-28] |
| G2 | 월 bandwidth, egress 전후 | 저장된 측정이 없다. README의 `314 MiB`는 예시 출력 블록 안이라 측정으로 쓰지 않는다. 주간 issue egress는 보류 (#61) | [S-TDE-6] 327–333행, [S-TDE-23] 84–90행 |
| G3 | Cloudflare HIT 비율 (Percent cached) | TC-M3-2가 열려 있다. 값이 없다 | [S-TDE-25] |
| G4 | `content` 제거로 줄어든 바이트 | 전후 바이트 없음 | [S-TDE-2] 338행 |
| G5 | 이미지 변환 수 전후 | 없음 | [S-TDE-2] 339행 |
| G6 | OG 요청 수, 크롤러 양 | 528 → 12 ms는 렌더 시간이다. 요청 수가 아니다. 측정 환경도 그 줄에 없다 | [S-TDE-2] 337행 |
| G7 | 글 상세의 Express 호출 수 (8–9회, `getPostBySlug` 4 → 1) | 메모리 파일에만 있다. repo 파일에 측정이 없다 [UNVERIFIED] | [S-TDE-28] |
| G8 | #70 뒤 스크롤 요청 수 | 세지 않았다. check.md 7번이 열려 있다 | [S-TDE-12] 21, 47행 |
| G9 | #70 뒤 정상 사용 10 s 폭 | 10-13 로그 분석을 다시 하지 않았다 | [S-TDE-7] 308–322행 |
| G10 | U7 뒤 오리진 도달 수 | 요청이 `blog-api.`로 옮겼다. 로그인 피드는 `DYNAMIC`이라 VM에 그대로 간다. `proxy.ts` 로그 수는 저장 파일에 없다 | [S-TDE-14] 89, 144행, [S-TDE-13] 88행 |
| G11 | RSC 바이트 감소 (U1) | 판정 불가. 브라우저 바이트가 null을 0으로 센다 | [S-TDE-14] 83, 188행 |
| G12 | 서버 fetch 13 → 12의 원인 | 기록 없음 | [S-TDE-14] 117–118행 |
| G13 | 운영 `181e6ed`의 prefetch, G-a | 브라우저 가드 run이 없다. B9 값은 `f76c1d9`다 | [S-TDE-27] 549행 |
| G14 | 한도 70 뒤 Cloudflare 429 이벤트 수 | 저장 파일 없음 | 없음 |
| G15 | U7 가드 Express `rate_limit` 0줄 | dispatch 기록뿐이다. 저장 파일 없음 | [S-TDE-14] 139행 |
| G16 | `decisions.plan.md` #20 | 그 파일에서 찾지 못했다 (보관본은 읽지 않음) | 없음 |
| G17 | `books/debugging/*.md`의 트래픽 숫자 | 트래픽 양을 다루는 숫자가 없다 | 없음 |

## 5. Sources

- [S-TDE-1] Phase CF2 incident block | `00.plan.md` lines 182–204 | published: 2026-09-22 | accessed: 2026-10-14 | type: plan | note: block read
- [S-TDE-2] Phase CF2 tasks and local probe facts | `00.tasks.md` lines 323–347 | published: 2026-09-22 | accessed: 2026-10-14 | type: plan | note: rows read; 528 ms to 12 ms at line 337
- [S-TDE-3] Decision 46: 402 root cause | `decisions.plan.md` line 111 | published: 2026-09-22 | accessed: 2026-10-14 | type: decision | note: row read
- [S-TDE-4] Decisions 47, 51, 53, 54: GCP move | `decisions.plan.md` lines 116, 120, 122, 123 | published: 2026-10-12 | accessed: 2026-10-14 | type: decision | note: rows read
- [S-TDE-5] Reduce traffic review | `deploy/traffic/review/01-reduce-traffic.md` | published: 2026-10-13 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-TDE-6] Traffic controls README | `deploy/traffic/README.md` | published: 2026-10-13 | accessed: 2026-10-14 | type: runbook | note: full file read; line 332 is inside an example output block
- [S-TDE-7] Blocking and load tests | `deploy/traffic/review/02-blocking.md` lines 205–396 | published: 2026-10-13 | accessed: 2026-10-14 | type: analysis | note: test result sections read
- [S-TDE-8] Decision 68: limit 50 | `decisions.plan.md` line 137 | published: 2026-10-13 | accessed: 2026-10-14 | type: decision | note: row read
- [S-TDE-9] Prefetch source note | `deploy/traffic/review/prefetch-source.md` | published: 2026-10-13 | accessed: 2026-10-14 | type: analysis | note: full file read; owner DevTools screenshot transcribed by main session
- [S-TDE-10] Prefetch review | `deploy/traffic/review/06-prefetch.md` | published: 2026-10-13 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-TDE-11] Decision 70: prefetch fixes | `decisions.plan.md` line 139 | published: 2026-10-13 | accessed: 2026-10-14 | type: decision | note: row read
- [S-TDE-12] Pending checks | `check.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: plan | note: full file read
- [S-TDE-13] Phase CC criteria | `deploy/traffic/review/cc/criteria.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-TDE-14] Phase CC run ledger | `deploy/traffic/review/cc/00.runs.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-ledger | note: full file read
- [S-TDE-15] U0b browser baseline | `deploy/traffic/review/cc/runs/20261014T052554Z_baseline_19f5e31_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: g_a, g_b, w3 rows grepped
- [S-TDE-16] U4 attempt 2 verdict | `deploy/traffic/review/cc/u4-verdict.md` lines 55–126 | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: §2.2 to §3 read
- [S-TDE-17] U4 production guard run | `deploy/traffic/review/cc/runs/20261014T181839Z_U4_u4o_f76c1d9_browser/summary.csv` | published: 2026-10-14 | accessed: 2026-10-14 | type: run-output | note: g_a, g_b, w1_rsc, w3 rows grepped
- [S-TDE-18] Decision 106: U4 kept, limit 70 | `decisions.plan.md` line 179 | published: 2026-10-14 | accessed: 2026-10-14 | type: decision | note: row read
- [S-TDE-19] U4 A-B-A verdict | `deploy/traffic/review/cc/u4-aba-verdict.md` line 135; `cc.report.md` lines 478–487 | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: line grepped; report table read
- [S-TDE-20] U5 A-B record | `deploy/traffic/review/cc/u5-ab.md` | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-TDE-22] Status log, CC-U4 lines | `01.status.md` lines 99–105 | published: 2026-10-14 | accessed: 2026-10-14 | type: status | note: lines read
- [S-TDE-23] Observability review | `deploy/traffic/review/04-observability.md` | published: 2026-10-13 | accessed: 2026-10-14 | type: analysis | note: full file read
- [S-TDE-24] GCP design, egress | `gcp.design.md` lines 98, 148, 152 | published: 2026-10-12 | accessed: 2026-10-14 | type: design | note: lines grepped
- [S-TDE-25] TC-M3-2 Percent cached task | `00.tasks.md` lines 595–596 | published: 2026-10-13 | accessed: 2026-10-14 | type: plan | note: rows grepped, still open
- [S-TDE-26] Phase CC design, fetch dedupe | `cc.design.md` line 66 | published: 2026-10-14 | accessed: 2026-10-14 | type: design | note: line grepped
- [S-TDE-27] Phase CC report | `cc.report.md` lines 405–666 | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: MVP2 and MVP3 sections read
- [S-TDE-29] U0b curl baseline summary | `deploy/traffic/review/cc/baseline.md` lines 172–195, 384–398 | published: 2026-10-14 | accessed: 2026-10-14 | type: analysis | note: full file read; load-more state at lines 191 and 395
- [S-TDE-30] Task file: active line and GCP-U8 | `00.tasks.md` lines 7, 418 | published: 2026-10-12 | accessed: 2026-10-14 | type: plan | note: lines read; Phase CF sha 4e5c085 at line 7
- [S-TDE-28] Owner memory: traffic overrun | `~/.claude-school/projects/-Users-tio-Documents-00-projects-project-tradelunch/memory/traffic-overrun-root-cause.md` | published: 2026-09-23 | accessed: 2026-10-14 | type: anecdotal | note: auto-memory outside the repo, used as a map only; no number in this file rests on it alone

`[S-TDE-21]`은 쓰지 않았다. 번호는 다시 매기지 않는다.

open_questions:
- G1, G7: [UNVERIFIED] 메모리에만 있는 숫자. repo 근거가 생기기 전에는 글에 쓰지 않는다.
- A5 전 값 `ƒ /sitemap.xml`은 메모리 기록이다. repo 줄은 "죽어 있었음"만 적는다.
- A2 "카드는 `content`를 읽지 않음": [UNVERIFIED], 메모리에만 있다.
