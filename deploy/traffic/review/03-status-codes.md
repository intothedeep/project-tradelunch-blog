# 상태 코드와 보안 (2026-10-13)

목표: 응답 코드가 실제 의미를 말하게 한다. 거절은 4xx, 서버 고장만 5xx. 오류 응답은 캐시하지 않는다.

## G. CORS 거절을 403으로 (커밋과 배포 전)

**왜 필요했나:** 주간 issue #5에 "blog-api ERROR 48" ⚠️가 떴다. 원인을 찾다가 보안 문제를 발견했다.

**문제:**

```text
요청 (Origin: 아무거나)
  └─► CORS 거절 ─► errorHandler
                    ├─ ERROR 로그 2줄
                    ├─ Supabase error_log INSERT 1건   ← 누구나 DB 쓰기를 만들 수 있음
                    └─ 500 응답
```

- 이것은 증폭 경로(amplification vector)다. 아무 Origin 헤더로 요청을 많이 보내면 DB 쓰기가 같은 수만큼 생긴다.
- 거절은 서버 고장이 아닌데 500과 ERROR로 남았다. 그래서 주간 issue에 거짓 경고가 뜬다.
- 지난 7일 24건(ERROR 48줄). 모두 오늘 우리가 만든 것이다(로컬 설정 23건, 고의 파손 시험 1건).

**무엇을 바꿨나:**

| 파일 | 변경 |
| --- | --- |
| `apps/dashboard_server/src/middlewares/corsRejection.ts` (새 파일) | `CorsRejectedError`. 이 오류만 잡아 403으로 답하는 처리기 |
| `apps/dashboard_server/src/server.ts` | 거절할 때 `CorsRejectedError`를 던진다. `cors()` 바로 뒤에 처리기를 붙인다 |

| 요청 | 전 | 후 |
| --- | --- | --- |
| 허용 안 된 Origin, GET | 500, ERROR 2줄, INSERT 1건 | **403**, WARN 1줄, DB 쓰기 없음 |
| 허용 안 된 Origin, OPTIONS | 500 | **403** |
| 허용 Origin, Origin 없음 | 200 | 200 (그대로) |
| 다른 오류 | errorHandler | errorHandler (그대로) |

**왜 이 방법인가:**

- **이름 있는 오류를 쓰는 이유:** 처리기가 CORS 거절만 정확히 골라낸다. 다른 진짜 오류는 그대로 errorHandler로 가서 기록된다.
- **`cors()` 바로 뒤에 두는 이유:** errorHandler보다 먼저 잡아야 DB 쓰기를 건너뛴다. 사전 요청(OPTIONS)도 여기서 잡힌다.
- **403인 이유:** 요청한 쪽이 허락받지 않은 것이다. 서버 고장(5xx)이 아니다.
- **버린 대안:** `callback(null, false)`로 조용히 넘기는 방법. 이러면 요청이 라우트까지 가서 DB를 읽는다. 브라우저만 막히고 서버 부하는 그대로다.

**확인:** 타입 검사와 빌드 통과. 운영 확인은 배포 뒤에 한다.

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS -H 'Origin: https://evil.example' \
  -H 'Access-Control-Request-Method: GET' 'https://blog-api.prettylog.com/v1/api/posts?limit=1'   # 403
```

- GET은 Cloudflare 캐시가 먼저 200 HIT로 답할 수 있다. 서버가 요청을 받지 않으니 문제가 아니다.
- Cloud Logging에 `Unhandled Express error`가 새로 생기지 않는지 본다.


## 이미 있는 상태 코드 정리

| 경우 | 코드 | 캐시 | 왜 |
| --- | --- | --- | --- |
| 없는 글 (`getPost.api.ts`, `42ba55c`) | 404 페이지 | 안 함 (300–599 규칙) | 예전에는 오류 화면(500 경계)이 떴다. 없는 것은 404가 맞다 |
| 피드 API가 죽었을 때 (`77315eb`) | 200 + "잠시 뒤 다시" 안내 | 1일 캐시 가능 ⚠️ | 화면 전체가 오류로 바뀌지 않게 했다. 아래 주의 참고 |
| 보호 경로, 로그인 안 함 (`/me`) | 307 → `/sign-in` | 안 함 (bypass) | Clerk `auth.protect` |
| API 로그인 필요, 토큰 없음 | 401 | 안 함 (EXPIRED) | |
| Cloudflare 오류 응답 | 300–599 | 안 함 | 서버가 잠깐 죽은 순간의 화면이 하루 동안 남지 않게 |

**주의 (피드 안내 화면):** 피드를 못 받은 홈은 200으로 나간다. 그래서 "web cache" 규칙이 하루 동안 캐시할 수 있다. 이때는 purge 한 번으로 고친다. 근본 해결은 아래 제안 4.

## 제안 (아직 안 함, 오늘 측정으로 찾음)

| # | 무엇 | 지금 (측정 10-13) | 바꾸면 | 왜 | 어디서 |
| --- | --- | --- | --- | --- | --- |
| 1 | 서버 종류 숨기기 | `x-powered-by: Next.js`, `x-powered-by: Express` | 헤더 없음 | 공격자에게 프레임워크를 알려 줄 이유가 없다 | `next.config.ts` `poweredByHeader: false`, Express `app.disable('x-powered-by')` |
| 2 | 없는 API 경로 | 404 + Express 기본 HTML (`Cannot GET /v1/api/nope`) | 404 + JSON `{success:false}` | 응답 형식을 하나로. 내부 경로 모양을 덜 드러낸다 | Express 마지막 404 처리기 |
| 3 | 보안 헤더 | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` 없음 (API 404에만 일부) | 모든 응답에 붙음 | 다운그레이드, MIME 추측, 클릭재킹(clickjacking) 방지 | Cloudflare Transform Rules 또는 앱. HSTS는 Cloudflare SSL/TLS 설정 (preload는 되돌리기 어려우니 빼고 시작) |
| 4 | 피드 실패 화면이 캐시되지 않게 | 200, 캐시 가능 | 그 응답만 짧게 또는 캐시 안 함 | 일시 장애가 하루 동안 남지 않게 | 설계 필요 (Next에서 응답 헤더를 바꾸기 어렵다) |

- 1, 2는 코드 몇 줄이다. 원하면 G와 같이 배포한다.
- 3, 4는 설계가 먼저다.
