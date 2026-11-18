# 알리바바 봇과 Supabase egress 초과 (2026-11-18)

**결론: 봇 하나가 무작위 필터 URL로 캐시를 피했다. 그래서 요청마다 Supabase까지 갔다.**

- 출처: 알리바바 클라우드(Alibaba Cloud) 대역, ASN 45102, 국가 SG.
- 대상: `my.prettylog.com/@taeklim/posts?categories=…&tags=…`.
- 기간: 2026-10-22 시작. 11-09부터 하루 약 2만 회.
- 결과: Supabase 무료 egress(5 GB) 초과. GCP VM egress도 늘었다.
- 이 공격은 [`01-reduce-traffic.md`](./01-reduce-traffic.md) M "랜덤 쿼리로 캐시를 피하는 요청"이 실제로 일어난 것이다.

근거 파일: [`history/2026-11-18-alibaba-bot/`](./history/2026-11-18-alibaba-bot/).

## 핵심 흐름 (오너: "이 플로우가 핵심이다", 2026-11-18)

```text
SG 봇 (47.79.x, 47.82.x, Chrome UA를 매번 바꿈)
  │  하루 ~22,000회
  ▼
my.prettylog.com/@taeklim/posts   cf-cache-status: MISS (HTML private, no-store)
  │  Next SSR 서버 (GCP VM, UA "node")가 7번 호출
  ▼
blog-api.prettylog.com
  ├─ /profile ×2         BYPASS  ← Cache-Control 없음
  ├─ /tags               BYPASS  ← Cache-Control 없음
  ├─ /categories 38 KB   BYPASS  ← Cache-Control 없음 (가장 큼)
  ├─ /users/taeklim/tags BYPASS  ← Cache-Control 없음
  ├─ /users/taeklim 11 KB MISS   ← s-maxage는 있는데 매번 MISS
  └─ /projects           HIT     (유일하게 캐시됨)
  ▼
Supabase: 페이지 1회 ≈ SQL 5~6개, 응답 약 50 KB
```

- 피드가 매번 MISS인 이유: 봇이 `?categories=…&tags=…`를 무작위로 바꾼다. `apis/buildFeedQuery.ts:29-32`가 그 값을 피드 API 주소로 넘긴다.
- 흐름의 끝: 과부하 → SSR fetch timeout → `error_log` INSERT (§4.4).
- 조치가 끊는 곳: WAF는 맨 위 화살표를 끊는다. API 캐시는 BYPASS 네 줄을 HIT로 바꾼다 (§5, §6).
- VM IP는 적지 않는다. 공개 저장소에서 오리진 IP가 드러나면 Cloudflare를 건너뛰고 VM을 칠 수 있다.

## 수정 전후 흐름 (2026-11-18)

### 전 (11-18 22:15 UTC 이전)

```text
SG 봇 (알리바바 ASN 45102, Chrome UA를 매번 바꿈)
  │  하루 ~22,000회, robots.txt 무시
  ▼
my.prettylog.com/@taeklim/posts   MISS (HTML private, no-store)
  │  통과: 차단 규칙 없음
  │  Next SSR 서버 (GCP VM, UA "node")가 7번 호출
  ▼
blog-api.prettylog.com
  ├─ /profile ×2          BYPASS  ← Cache-Control 없음
  ├─ /tags                BYPASS  ← Cache-Control 없음
  ├─ /categories 38 KB    BYPASS  ← Cache-Control 없음
  ├─ /users/taeklim/tags  BYPASS  ← Cache-Control 없음
  ├─ /users/taeklim 11 KB MISS    ← 필터 query가 매번 달라짐
  └─ /projects            HIT
  ▼
Supabase: 페이지 1회 ≈ SQL 5~6개, 약 50 KB
  ▼
과부하 → SSR timeout → error_log INSERT (7월부터 정리 안 됨, 176 MB)
```

### 후 (11-18 22:30 UTC 이후)

```text
SG 봇
  │
  ▼
Cloudflare WAF (새로 추가, §6)
  ├─ 1. ASN 45102                → Block       ✂ 여기서 끝
  ├─ 2. 필터 URL + 알려진 크롤러   → Block       ✂ 여기서 끝
  └─ 3. 필터 URL에 태그 여러 개    → Challenge   ✂ 여기서 끝 (사람은 통과)
  │
  │  여기까지 온 요청만 (정상 독자)
  ▼
my.prettylog.com/@taeklim/posts   MISS (그대로, §9.2 4번)
  │  Next SSR 서버 (GCP VM)가 7번 호출
  ▼
blog-api.prettylog.com
  ├─ /profile ×2          HIT  ✔  s-maxage=86400 추가 (3bb35f0)
  ├─ /tags                HIT  ✔  〃
  ├─ /categories 38 KB    HIT  ✔  〃
  ├─ /users/taeklim/tags  HIT  ✔  〃
  ├─ /users/taeklim 11 KB MISS    ← 필터 조합마다 다름 (그대로, §9.2 4번)
  └─ /projects            HIT
  ▼
Supabase: 페이지 1회 ≈ SQL 1개 (피드만)
  ▼
error_log: 7일치만 남김, 22 MB (자동 정리는 아직, §9.2 2번)
```

### 숫자로 본 차이

15분 구간 (UTC). 출처: `cf-after-posts-15min.json`, `cf-after-api-15min.json`.

| 지표 | 22:15 (전) | 22:30 (후) |
| --- | --- | --- |
| 봇 페이지 200 (SSR까지 감) | 212 | 52 |
| 봇 페이지 403 (엣지에서 끝) | 0 | 107 |
| blog-api BYPASS (Supabase까지 감) | 1,032 | 0 |
| blog-api HIT | 265 | 328 |

DB 크기. 출처: 정리 전후 `pg_total_relation_size`, `pg_database_size` 조회 (§9.1).

| 지표 | 전 | 후 |
| --- | --- | --- |
| `error_log` 크기 | 176 MB | 22 MB |
| DB 전체 크기 | 190 MB | 35 MB |

- 22:30 구간은 22:40:43 UTC까지만 잰 부분 값이다. 규칙이 들어가기 전 요청이 섞여 있다.
- 하루 단위 결과는 11-20에 잰다 (`check.md` 14).

### 아직 바뀌지 않은 두 줄

| 줄 | 왜 남았나 | 남은 일 |
| --- | --- | --- |
| `/@taeklim/posts` HTML MISS | 로그인 화면 때문에 `private, no-store`가 설계 값이다 | 정상 독자만 오면 문제없는 양이다 |
| `/users/taeklim` 피드 MISS | 필터 query가 캐시 키에 그대로 들어간다 | §9.2 4번 필터 query 정규화 |

- 다음 봇이 다른 클라우드에서 태그 1개 URL로 오면 다시 Supabase까지 갈 수 있다.
- 그때도 API 4곳은 HIT다. 페이지 1회당 SQL이 5~6개에서 1개로 줄었다.

## 1. 왜 조사했나

- Supabase가 무료 플랜 egress 초과를 알렸다.
- 오너가 Query Performance 표를 내보냈다 (`x_supabase_query_performance.txt`).
- 질문: 무엇이 egress를 만드나? 어떻게 줄이나?

## 2. 쓴 데이터

| 데이터 | 범위 | 파일 |
| --- | --- | --- |
| Supabase `pg_stat_statements` 상위 20개 | 2026-10-13 01:02 UTC (DB 재시작) ~ 11-18 | `supabase-query-summary.txt` |
| Cloudflare 존 일별 요청 | 10-15 ~ 11-18 | `cf-zone-daily.json` |
| Cloudflare `/@taeklim/posts` 일별 | 11-08 ~ 11-18 | `cf-posts-page-daily.json` |
| Cloudflare 24시간 분해 (호스트, API 경로, IP 대역) | 11-17 12:00 ~ 11-18 12:00 UTC | `cf-24h-*.json` |
| `error_log` 주별 집계 | 전체 | `error-log.txt` |

- 모두 실측이다. 생성 데이터는 없다.
- 봇 IP는 원본 그대로 저장했다. robots.txt를 무시하는 수집 봇이라 방문자 개인 정보로 보지 않는다 (오너, 2026-11-18).
- `cf-24h-ip.json`: 상위 200개 IP, 합계 2,495회. 대역은 47.82 (153개), 47.79 (45개), 47.237, 8.219. 모두 알리바바다.
- Cloudflare 조회: 무료 플랜 GraphQL API. ASN, query string 필드는 읽을 수 없었다.

## 4. 결과

### 4.0 Cloudflare 보고 (존 `prettylog.com`, 일별)

출처: `cf-zone-daily.json` (`httpRequests1dGroups`), `cf-posts-page-daily.json` (`httpRequestsAdaptiveGroups`). 11-18은 조회 시각까지의 부분 값이다.

| 날짜 (UTC) | 요청 | 캐시된 요청 | 캐시 비율 | 보낸 데이터 (MiB) | `/@taeklim/posts` |
| --- | --- | --- | --- | --- | --- |
| 2026-10-15 | 26142 | 2888 | 11 % | 176 |  |
| 2026-10-16 | 12877 | 1034 | 8 % | 72 |  |
| 2026-10-17 | 27762 | 1669 | 6 % | 120 |  |
| 2026-10-18 | 11948 | 1731 | 14.4 % | 82 |  |
| 2026-10-19 | 6092 | 1331 | 21.8 % | 83 |  |
| 2026-10-20 | 5005 | 714 | 14.2 % | 49 |  |
| 2026-10-21 | 12971 | 730 | 5.6 % | 61 |  |
| 2026-10-22 | 43380 | 6037 | 13.9 % | 208 |  |
| 2026-10-23 | 100687 | 10507 | 10.4 % | 349 |  |
| 2026-10-24 | 94359 | 9312 | 9.8 % | 320 |  |
| 2026-10-25 | 73521 | 7575 | 10.3 % | 251 |  |
| 2026-10-26 | 38648 | 4543 | 11.7 % | 161 |  |
| 2026-10-27 | 164080 | 15628 | 9.5 % | 514 |  |
| 2026-10-28 | 67484 | 6792 | 10 % | 285 |  |
| 2026-10-29 | 14292 | 3408 | 23.8 % | 137 |  |
| 2026-10-30 | 344867 | 26120 | 7.5 % | 910 |  |
| 2026-10-31 | 13482 | 1517 | 11.2 % | 106 |  |
| 2026-11-01 | 9039 | 1505 | 16.6 % | 101 |  |
| 2026-11-02 | 9826 | 1427 | 14.5 % | 97 |  |
| 2026-11-03 | 105635 | 8698 | 8.2 % | 392 |  |
| 2026-11-04 | 56229 | 4880 | 8.6 % | 207 |  |
| 2026-11-05 | 21521 | 3122 | 14.5 % | 190 |  |
| 2026-11-06 | 24653 | 2202 | 8.9 % | 223 |  |
| 2026-11-07 | 23420 | 1876 | 8 % | 140 |  |
| 2026-11-08 | 22644 | 2802 | 12.3 % | 157 | 1943 |
| 2026-11-09 | 78558 | 6448 | 8.2 % | 442 | 34023 |
| 2026-11-10 | 82293 | 8107 | 9.8 % | 479 | 28150 |
| 2026-11-11 | 148007 | 17052 | 11.5 % | 824 | 20392 |
| 2026-11-12 | 151948 | 18179 | 11.9 % | 795 | 19305 |
| 2026-11-13 | 250664 | 28730 | 11.4 % | 1356 | 28561 |
| 2026-11-14 | 162484 | 20310 | 12.4 % | 1019 | 19018 |
| 2026-11-15 | 242445 | 29277 | 12 % | 1501 | 31439 |
| 2026-11-16 | 158475 | 20549 | 12.9 % | 986 | 18107 |
| 2026-11-17 | 191467 | 21651 | 11.3 % | 1249 | 20377 |
| 2026-11-18 | 178334 | 23164 | 12.9 % | 1120 | 10529 |

- 읽는 법: 10-22부터 요청이 튄다. 11-09부터는 매일 8만 ~ 25만으로 높게 머문다.
- 캐시 비율은 내내 6 ~ 24 %다. 요청 대부분이 오리진(GCP VM)까지 간다.
- `/@taeklim/posts` 열은 무료 플랜 보존 기간 때문에 11-08부터만 있다.
- 10월의 튀는 날(10-27, 10-30)은 `error_log` 10-19 ~ 10-26 주의 급증과 겹친다 (§4.4). 같은 봇으로 추정한다.

### 4.1 요청 수

| 날짜 | `/@taeklim/posts` 요청 |
| --- | --- |
| 11-08 | 1,943 |
| 11-09 | 34,023 |
| 11-13 | 28,561 |
| 11-15 | 31,439 |
| 11-17 | 20,377 |

- 11-09 ~ 11-18 합계: 약 230,000회.
- 존 전체 요청: 11-08 하루 2.3만 → 11-13 ~ 11-17 하루 15만 ~ 25만.
- 존 캐시 비율: 약 12 %.

### 4.2 24시간 분해 (11-17 12:00 ~ 11-18 12:00 UTC)

| blog-api 경로 | 요청 | 캐시 |
| --- | --- | --- |
| `/posts/users/taeklim/profile` | 43,979 | BYPASS |
| `/posts/users/taeklim/projects` | 23,082 | HIT |
| `/tags` | 22,275 | BYPASS |
| `/posts/users/taeklim/categories` | 22,261 | BYPASS |
| `/posts/users/taeklim/tags` | 21,985 | BYPASS |
| `/posts/users/taeklim` | 21,955 | MISS |

- blog-api 요청 157,153건은 모두 VM 한 곳(SSR, UA `node`)에서 왔다.
- 봇 IP는 상위 200개가 합쳐 2,495회다. 하루 2만 회를 수천 개 IP가 나눈다.
- IP당 하루 약 10 ~ 20회뿐이다. 그래서 IP당 요청 수 제한(H)에 걸리지 않는다.

### 4.3 Supabase 쿼리

| # | 쿼리 | 호출 | 평균 |
| --- | --- | --- | --- |
| 1 | 전체 인기 태그 (`/tags`) | 274,208 | 1.60 ms |
| 2 | 작가 인기 태그 | 257,356 | 1.55 ms |
| 3 | 카테고리 트리 | 266,189 | 1.04 ms |
| 4 | 작가 피드 | 249,045 | 0.78 ms |
| 5 | 프로필 카드 | 600,058 | 0.21 ms |
| 7 | `error_log` INSERT | 245,594 | 0.17 ms |

- 느린 쿼리는 없다. 문제는 호출 수다.
- 카테고리 트리(#3)는 CTE에서 `p.content`를 읽는다. 마지막 SELECT에서는 빠진다. 본문 전송은 원인이 아니다.
- egress 추정: 230,000회 × 약 50 KB ≈ 11 GB. API 응답 크기로 계산했다. DB 바이트를 잰 값이 아니다.

### 4.4 error_log

| 주 (월요일) | 행 | 그중 `/@taeklim/posts?…` |
| --- | --- | --- |
| 10-12 | 154 | 10 |
| 10-19 | 58,341 | 56,880 |
| 10-26 | 119,302 | 118,602 |
| 11-02 | 25,827 | 25,725 |
| 11-09 | 40,721 | 40,589 |

- 11-09 이후 메시지: timeout 31,555 · `fetch failed` 5,588 · 프로필 실패 4,682.
- 11-09 이후 서로 다른 path: 13,605개.
- 읽는 법: 봇이 서버를 밀어 SSR의 Express 호출이 timeout 났다. 에러는 원인이 아니라 결과다.
- 에러 기록도 DB 쓰기다. 공격 중에는 부하를 더한다.

## 5. 한 일과 할 일

| # | 항목 | 상태 |
| --- | --- | --- |
| 1 | WAF 규칙으로 봇 차단 (§6) | 규칙 2 배포 (오너, 2026-11-18 22:30 UTC쯤), 규칙 1 배포 (오너, 그 직후). 결과: §6.1. 하루 결과는 11-19에 잰다 (`check.md` 14) |
| 2 | API 4곳에 `setPostReadCache` 추가 | 배포 완료 (`3bb35f0`, 2026-11-18). 4곳 모두 2번째 GET이 HIT. `Authorization`은 DYNAMIC, 없는 사용자 404는 캐시 안 됨. `traffic-check.sh` api 0 FAIL |
| 3 | 필터 query 캐시 우회 (M) | 설계 필요. 1번이 먼저 막는다 |
| 4 | GCP egress 줄이기 (§7) | 1, 2번이 대부분을 줄인다 |

2번 대상 (익명은 `public, s-maxage=86400`, 로그인은 `private, no-store`):

- `controllers/tags/index.ts`: `GET /tags`
- `controllers/posts/posts.user-meta.ts`: `GET /users/:u/tags`, `GET /users/:u/profile` (200만)
- `controllers/posts/posts.user-categories.ts`: `GET /users/:u/categories`

규칙 D가 원본 헤더를 따르므로 배포 뒤 바로 HIT가 된다. 글을 발행하면 지금처럼 `cf-purge.sh`로 api도 비운다.

## 6. WAF 정책 (Cloudflare → Security → WAF → Custom rules)

| 순서 | 이름 | 식(expression) | 동작 |
| --- | --- | --- | --- |
| 1 | `block alibaba cloud` | `(ip.src.asnum in {45102})` | Block |
| 2 | `challenge filter combos` | 아래 | Managed Challenge |

규칙 2 식:

```text
(http.host eq "my.prettylog.com"
 and starts_with(http.request.uri.path, "/@")
 and http.request.uri.query contains "tags="
 and http.request.uri.query contains "%2C"
 and not cf.client.bot)
```

- 규칙 1: 알리바바 클라우드는 데이터센터다. 실제 독자가 거의 없다. 지금 봇을 바로 끊는다.
- 규칙 2: 다음 봇이 다른 클라우드로 옮겨도 잡는다. 태그를 여러 개(`%2C` = 쉼표) 고른 요청만 걸린다.
- 규칙 2의 사람은 Challenge를 한 번 통과하면 계속 본다. 검색 엔진(`cf.client.bot`)은 빠진다.
- `blog-api.`에는 걸지 않는다. SSR VM이 부르기 때문이다.
- Bot Fight Mode는 켜지 않는다. SSR의 `node` 요청까지 막을 수 있다.
- 확인: Security → Events에서 두 규칙의 차단 수를 본다. 다음 날 `/@taeklim/posts` 요청이 1 ~ 2천으로 돌아오면 통과.

운영 중인 순서 (오너 대시보드, 2026-11-18, Custom rules 3/5):

| 순서 | 이름 | 동작 | 대상 |
| --- | --- | --- | --- |
| 1 | `block alibaba cloud` | Block | ASN 45102 |
| 2 | `block crawlers on filter urls` (전부터 있던 규칙) | Block | 필터 URL + 알려진 봇 또는 Meta 크롤러 |
| 3 | `challenge filter combos` | Managed Challenge | 필터 URL에 태그 여러 개 + 봇 아님 |

- 규칙 2와 3은 대상이 겹치지 않는다(봇과 봇 아닌 요청). Block을 앞에 두었다.
- 규칙 2는 `or` 조건을 괄호로 묶어야 한다. 묶지 않으면 필터 URL을 연 사람도 막힐 수 있다.
- 규칙 2 식 확인 (오너, 2026-11-18). 괄호가 맞다:

```text
(http.host eq "my.prettylog.com"
 and (http.request.uri.query contains "tags="
      or http.request.uri.query contains "categories="
      or http.request.uri.query contains "category_title=")
 and (cf.client.bot
      or http.user_agent contains "meta-webindexer"
      or http.user_agent contains "meta-externalagent"))
```

### 6.1 첫 결과 (API 캐시 + 규칙 2, 2026-11-18)

출처: `cf-after-posts-15min.json`, `cf-after-api-15min.json` (15분 단위, UTC).

| 15분 구간 | `/@taeklim/posts` 200 | `/@taeklim/posts` 403 | blog-api BYPASS | blog-api MISS | blog-api HIT |
| --- | --- | --- | --- | --- | --- |
| 22:00 | 249 | 0 | 1,254 | 252 | 255 |
| 22:15 | 212 | 0 | 1,032 | 235 | 265 |
| 22:30 | 52 | 107 | 0 | 55 | 328 |

- 22:30 구간에서 봇 페이지의 약 2/3가 403(Challenge)으로 끝났다. SSR까지 가지 않는다.
- 같은 구간에서 blog-api BYPASS가 0이 되었다. 네 API가 이제 HIT다.
- 22:30 구간은 조회 시각(22:40:43 UTC)까지의 부분 값이다. 하루 단위 결과는 11-19에 다시 잰다.
- 수동 확인: 필터 없음 200, 태그 1개 200, 태그 2개(`cnn%2Cddpm`) 403.
- 토큰은 `firewallEventsAdaptiveGroups`를 읽을 수 없다. 규칙별 차단 수는 대시보드 Events에서 본다.

## 7. GCP egress 줄이기

VM에서 나가는 바이트는 Cloudflare가 캐시하지 못한 응답이다.
SSR이 `blog-api.`를 공개 주소로 부르므로 API 응답은 터널로 한 번 더 나간다.

| 순서 | 방법 | 줄어드는 것 |
| --- | --- | --- |
| 1 | WAF 규칙 (§6) | 봇 페이지와 그 API 호출 전부 |
| 2 | API 4곳 캐시 (§5 2번) | 페이지당 API 응답 약 40 KB 중 대부분 |
| 3 | 필터 query 정규화 (M 설계) | 같은 필터의 다른 순서가 같은 캐시를 쓴다 |
| 4 | 월 기록 (`check.md` 11) | 11월 청구에서 전후를 GB로 본다 |

## 8. 남은 확인

- 무료 플랜에서는 ASN과 query string을 읽을 수 없다. 봇 ASN은 `whois.cymru.com`으로 상위 IP 2개를 확인했다.
- 피드 MISS의 원인은 `error_log.path`와 `apis/buildFeedQuery.ts:29-32`로 확인했다.
- 더 볼 곳: Cloud Logging의 blog-web 요청 로그(A). 전체 URL이 30일 남는다.

## 9. 정리한 것과 남은 일 (2026-11-18)

### 9.1 error_log 정리 (오너 지시 "일주일치 놔두고 삭제")

| 항목 | 전 | 후 |
| --- | --- | --- |
| 행 수 | 245,647 | 33,845 (11-12부터) |
| `error_log` 크기 | 176 MB | 22 MB |
| DB 전체 크기 | 190 MB | 35 MB |

- 근거: `0014_error_logs.sql`의 예외. 이 표는 soft-delete 규칙의 예외이고, 7일 TTL로 실제로 지운다.
- 한 일: `DELETE ... created_at < now() - 7 days` (211,802행), 그다음 `VACUUM FULL error_log`.
- 지우기 전 집계는 `history/2026-11-18-alibaba-bot/error-log.txt`에 남아 있다.
- 원인: 0014의 pg_cron 정리 작업이 주석으로만 있고 한 번도 켜지지 않았다.

### 9.2 남은 일

| # | 일 | 왜 | 누가 |
| --- | --- | --- | --- |
| 1 | 하루 결과 재기 (`check.md` 14) | 첫 15분만 쟀다 | Claude, 11-20 |
| 2 | `error_log` 7일 정리 자동화 | 지금은 손으로 한 번 지웠다. 그대로 두면 다시 쌓인다 | 설계 필요: pg_cron 켜기(오너 대시보드) 또는 Actions |
| 3 | 에러 기록 줄이기 | 공격 중에는 실패 하나마다 DB 쓰기가 하나 생긴다 | 설계 필요: 같은 메시지 묶기 또는 표본 |
| 4 | 필터 query 정규화 (M) | 다음 봇이 다른 클라우드에서 태그 1개 URL로 오면 규칙 3에 안 걸린다 | 설계 필요 |
| 5 | GCP 11월 청구 기록 (`check.md` 11) | 공격 기간의 VM egress 비용을 GB로 본다 | 오너, 12월 초 |
| 6 | 블로그 글 08 | 설계 끝 (`prettylog-series.design.md` §9). 계획과 작성이 남았다 | product-manager, sonnet-writer |

## 용어 부록

- <a id="term-asn"></a>자율 시스템 번호(autonomous system number, ASN): 인터넷에서 한 회사의 IP 묶음에 붙은 번호.
- <a id="term-waf"></a>웹 방화벽(web application firewall, WAF): 요청 조건으로 막거나 시험하는 Cloudflare 규칙.
- <a id="term-egress"></a>egress: 서비스 밖으로 나가는 데이터 양. 무료 한도를 넘으면 과금된다.
- <a id="term-ssr"></a>서버 렌더링(server-side rendering, SSR): Next 서버가 HTML을 만드는 단계.
- <a id="term-cte"></a>공통 테이블 식(common table expression, CTE): SQL의 `WITH` 블록.
