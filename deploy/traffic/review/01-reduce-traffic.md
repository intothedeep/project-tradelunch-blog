# 트래픽 줄이기 (2026-10-13)

목표: 공개 트래픽은 Cloudflare가 받고, VM은 캐시가 놓친 요청만 처리한다.
각 항목: 왜 필요했나 → 문제 → 무엇을 바꿨나 → 어떻게 → 왜 이 방법인가 → 확인.

## 1. 전체 그림: 전체 목표

**왜:** 예전 Vercel 시절에 트래픽이 폭주했다. 원인은 캐시가 없던 페이지와 OG 이미지였다.
오너 질문(2026-10-13): "과금이 터지거나 서버가 터질 걱정을 안 해도 되나?"

**목표:** 공개 트래픽은 Cloudflare가 받는다. VM은 캐시가 놓친 요청만 처리한다.

```text
방문자, 봇
   │
   ▼
Cloudflare (Free)                                        ← B, C, D
   ├─ web cache    my. GET (/_next/, /api/ 제외)   → 1일 캐시. 300–599는 캐시 안 함
   ├─ web bypass   __session 쿠키, 보호 경로, rsc 헤더(_rsc= 없음) → 캐시 안 함
   ├─ api cache    blog-api. GET                    → 서버 Cache-Control을 따름. 없으면 캐시 안 함
   ├─ api bypass   Authorization 헤더               → 캐시 안 함
   │
   │  HIT  → Cloudflare가 바로 응답. VM 부하 0, egress 0
   │  MISS, BYPASS, DYNAMIC → 아래로
   ▼
Cloudflare Tunnel → GCP e2-micro VM (1 GB)              ← E 메모리 알림
   ├─ blog-web (Next, :3000)    요청마다 JSON 로그 1줄  ← A
   └─ blog-api (Express, :4000) CORS 거절 = 403        ← G
          │
          ▼
       Supabase
                                                         ← F 매주 점검, E 예산 알림
```

## B. 웹 캐시 규칙 (`my.prettylog.com`)

**왜 필요했나:** 페이지를 Cloudflare가 대신 응답하면 VM CPU, 메모리, egress가 캐시가 놓친 몫만 남는다.

**문제:**

- Next는 HTML에 `private, no-store`를 보낸다. Cloudflare는 이 헤더를 보고 캐시하지 않았다.
- 측정(10-13, 규칙 전): HTML과 OG 이미지가 모두 DYNAMIC. 모든 방문이 VM까지 갔다.

**무엇을 바꿨나:** Cache Rules 2개.

| 규칙 | 조건 | 동작 |
| --- | --- | --- |
| web cache | my. GET, `/_next/`와 `/api/` 제외 | 캐시. 헤더를 무시하고 1일. 300–599는 캐시 안 함 |
| web bypass | `__session` 쿠키, `/write` `/me` `/settings` `/admin` `/onboarding`, rsc 헤더(`_rsc=` 없음) | 캐시 안 함 |

**어떻게:** Cloudflare → Caching → Cache Rules. bypass를 cache 아래에 둔다. 아래 규칙이 위 규칙을 덮어쓰기 때문이다.

**왜 이 방법인가:**

- **헤더를 무시하는 이유:** Next 코드를 고쳐 `public`을 보내게 하면 앱 전체를 바꿔야 한다. 규칙 한 줄로 같은 효과를 낸다.
- **`__session`으로 빼는 이유:** 로그인한 사람만 이 쿠키를 가진다. 로그인 화면이 캐시되면 다른 사람에게 보인다.
- **`__client_uat`로 빼지 않는 이유:** 모든 방문자가 이 쿠키를 받는다. 이것으로 빼면 캐시가 아예 안 된다.
- **rsc 줄이 있는 이유:** 화면 안 이동 요청(RSC)이 `_rsc=` 없이 오면 HTML과 같은 캐시 칸을 쓴다. 섞이면 HTML 대신 RSC 데이터가 보인다.
- **오류를 캐시하지 않는 이유:** 서버가 잠깐 죽은 순간의 오류 화면이 하루 동안 보이면 안 된다.
- **1일인 이유:** 오너 결정(2026-09-22). 새 글은 purge로 바로 반영한다.

**확인 (10-13):**

| 검사 | 기대 | 결과 |
| --- | --- | --- |
| `/`, `/blog`, `/robots.txt`, `/sitemap.xml` 두 번째 | HIT | HIT |
| `__session`, `__session_abc` 쿠키 | 캐시 안 됨 | DYNAMIC |
| `/me` | 캐시 안 됨 | 307, DYNAMIC |
| `?_rsc=` | `text/x-component` | `text/x-component`, HIT |
| rsc 헤더, `_rsc=` 없음 | 캐시 안 됨 | DYNAMIC |
| 캐시된 HTML의 `Set-Cookie` | 0 | 0 |
| 404 | 캐시에서 안 나감 | REVALIDATED |

**보안:** 로그인 화면과 쿠키는 캐시에 들어가지 않는다. 한 사람의 화면이 다른 사람에게 갈 수 없다.

**주의:** 보호 경로 목록은 `proxy.ts`의 `isProtectedRoute`와 같아야 한다. 한쪽만 바꾸지 않는다.

## C. 브라우저 캐시 TTL

**왜 필요했나:** 캐시는 Cloudflare에만 있어야 한다. 그래야 purge 한 번으로 모든 방문자에게 새 글이 보인다.

**문제:**

- B를 켠 뒤 캐시된 HTML이 브라우저에 `private, max-age=14400`으로 갔다(4시간).
- 원인: 도메인 전체 설정 Browser Cache TTL이 4시간이었다.
- 결과: 새 글이 최대 4시간 늦게 보일 수 있었다. 로그인 직후에도 익명 화면이 보일 수 있었다. purge는 브라우저 캐시를 지우지 못한다.

**무엇을 바꿨나:** Browser Cache TTL → **Respect Existing Headers**(기존 헤더 유지).

**어떻게:** Cloudflare → Caching → Configuration → Browser Cache TTL.

**왜 이 방법인가:** 규칙마다 브라우저 TTL을 정하는 대신 도메인 설정 하나로 끝난다. 서버가 보낸 헤더(`no-store`)를 브라우저가 그대로 따른다. `/_next/static`은 서버가 1년(`immutable`)을 보내므로 그대로 오래 캐시된다.

**확인:** 캐시된 HTML이 HIT이면서 `private, no-cache, no-store`. `/_next/static`은 `max-age=31536000, immutable`.

## D. API 캐시 규칙 (`blog-api.prettylog.com`)

**왜 필요했나:** 글 목록 같은 공개 API를 Cloudflare가 대신 응답하면 VM과 Supabase 부하가 줄어든다.

**문제:** Express는 `public, s-maxage=86400`을 보냈다. 그런데 Cloudflare는 JSON을 기본으로 캐시하지 않는다. 그래서 DYNAMIC이었다.

**무엇을 바꿨나:**

| 규칙 | 조건 | 동작 |
| --- | --- | --- |
| api cache | blog-api. GET | 캐시. 서버 Cache-Control을 따른다. 없으면 캐시 안 함 |
| api bypass | `Authorization` 헤더 | 캐시 안 함 |

**왜 이 방법인가:**

- **서버 헤더를 따르는 이유:** 어떤 API를 얼마나 캐시할지는 Express가 이미 정한다. 규칙은 그것을 켜기만 한다.
- **"없으면 캐시 안 함"인 이유:** `/ping` 같은 헤더 없는 응답이 캐시되면 안 된다(설계 위험 R8). 이 선택으로 R8이 닫혔다. 결정 D3도 필요 없어졌다.
- **`Authorization`으로 빼는 이유:** Express의 인증은 이 헤더 하나만 읽는다(`requireAuth.ts`, `optionalAuth.ts`). 이것만 빼면 개인 응답이 모두 빠진다.

**확인 (10-13):**

| 검사 | 기대 | 결과 |
| --- | --- | --- |
| `posts?limit=1` 두 번째 | HIT | MISS 뒤 HIT |
| `Authorization` 헤더 | 캐시 안 됨 | DYNAMIC |
| `/ping` | 캐시 안 됨 | BYPASS |
| `/users/me` 401, 없는 글 404 | 캐시에서 안 나감 | EXPIRED |
| OPTIONS | 캐시 안 됨 | 204, DYNAMIC |
| `Origin: my.`와 `Origin: local.` 번갈아 | 각자 자기 값 | 둘 다 HIT, `access-control-allow-origin` 각자 맞음 |

