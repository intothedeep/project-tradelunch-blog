# 상태 코드와 보안 (2026-10-13)

목표: 응답 코드가 실제 의미를 말하게 한다. 거절은 4xx, 서버 고장만 5xx. 오류 응답은 캐시하지 않는다.

## G. CORS 거절을 403으로 (배포 완료 2026-10-13, `4d137f2`)

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

**확인 (운영, 2026-10-13 20:07 UTC, `4d137f2`):**

| 요청 | 결과 |
| --- | --- |
| 허용 안 된 Origin, OPTIONS | 403, DYNAMIC |
| 허용 안 된 Origin, GET `/users/me` | 403, `{"success":false,"message":"origin not allowed"}` |
| 허용 안 된 Origin, GET `posts` | 403, EXPIRED (캐시에서 그대로 나가지 않음) |
| `Origin: my.`, OPTIONS / GET | 204 / 200 HIT |
| Origin 없음 | 200 HIT |
| Cloud Logging | 403은 WARNING `request completed` 한 줄씩. 배포 뒤 ERROR 0건 |

배포 전 확인: 타입 검사와 빌드 통과.

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

## 제안 (오늘 측정으로 찾음. 1, 2는 코드 완료)

| # | 무엇 | 지금 (측정 10-13) | 바꾸면 | 왜 | 어디서 |
| --- | --- | --- | --- | --- | --- |
| 1 | 서버 종류 숨기기 (코드 완료 `42e1bf3`, 배포 대기) | `x-powered-by: Next.js`, `x-powered-by: Express` | 헤더 없음 | 공격자에게 프레임워크를 알려 줄 이유가 없다 | `next.config.ts` `poweredByHeader: false`, Express `app.disable('x-powered-by')` |
| 2 | 없는 API 경로 (코드 완료 `42e1bf3`, 배포 대기) | 404 + Express 기본 HTML (`Cannot GET /v1/api/nope`) | 404 + JSON `{success:false}` | 응답 형식을 하나로. 내부 경로 모양을 덜 드러낸다 | Express 마지막 404 처리기 |
| 3 | 보안 헤더 | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` 없음 (API 404에만 일부) | 모든 응답에 붙음 | 다운그레이드, MIME 추측, 클릭재킹(clickjacking) 방지 | Cloudflare Transform Rules 또는 앱. HSTS는 Cloudflare SSL/TLS 설정 (preload는 되돌리기 어려우니 빼고 시작) |
| 4 | 피드 실패 화면이 캐시되지 않게 | 200, 캐시 가능 | 그 응답만 짧게 또는 캐시 안 함 | 일시 장애가 하루 동안 남지 않게 | 설계 필요 (Next에서 응답 헤더를 바꾸기 어렵다) |

- 1, 2는 코드 몇 줄이다. 원하면 G와 같이 배포한다.
- 3, 4는 설계가 먼저다.

## L. 공개 error-logs 쓰기 막기 (코드 완료 `42e1bf3`, 배포 대기, 결정 #60)

**왜 필요했나:** 설계 검토 중 architect가 "인증 여부 확인 필요"로 남긴 경로를 확인했다.

**문제:** `POST /v1/api/error-logs`는 인증이 없다. 인터넷 누구나 부를 수 있고, 요청 1건마다 Supabase에 1행을 쓴다. CORS 문제(G)보다 직접적인 DB 쓰기 경로다. CORS는 브라우저만 막고, `curl`은 막지 못한다.

**무엇을 바꿨나:**

```text
브라우저 오류 ─► Next /api/log-error ─► Express /error-logs  (x-origin-key: 비밀)  ─► INSERT
누구나 curl  ─────────────────────────► Express /error-logs  (헤더 없음)          ─► 403, INSERT 없음
```

| 파일 | 변경 |
| --- | --- |
| `apps/dashboard_server/src/middlewares/requireOriginKey.ts` (새 파일) | `x-origin-key`가 env `ORIGIN_KEY`와 같을 때만 통과. 아니면 403 |
| `apps/dashboard_server/src/controllers/index.ts` | `/api/error-logs` 앞에 붙임 |
| `apps/dashboard_client_web/apis/http.server.ts` | `originKeyHeaders()`. 키가 있을 때만 헤더를 만든다 |
| `instrumentation.ts`, `app/api/log-error/route.ts`, `apis/reportSsrError.server.ts` | `/error-logs`를 부르는 세 곳만 헤더를 보낸다 |

**어떻게:** VM의 `shared/api.env`와 `shared/web.env`에 같은 `ORIGIN_KEY`(64자, `openssl rand -hex 32`)를 넣는다. 웹을 먼저, API를 나중에 올린다. 둘 다 ecosystem 파일로 restart한다.

**왜 이 방법인가:**

- **공유 비밀인 이유:** 이 경로는 Next 서버만 부른다. 사용자 로그인과 상관없다. 서버끼리의 증명에는 비밀 헤더 하나면 된다.
- **비교에 `timingSafeEqual`을 쓰는 이유:** 응답 시간 차이로 키를 한 글자씩 알아내는 공격을 막는다.
- **키가 없으면 예전처럼 여는 이유:** 배포 순서가 틀려도 사이트와 오류 기록이 멈추지 않는다. 시작할 때 `ORIGIN_KEY unset` 경고를 남겨 빠뜨린 것을 알 수 있다.
- **요청 수 제한만으로 막지 않는 이유:** 한도 안의 스팸은 그대로 쌓인다.
- **같은 헤더를 SSR 제외(D12)에 다시 쓰는 이유:** 비밀을 하나만 관리한다.

**주의:** `ORIGIN_KEY=`처럼 빈 값을 두면 Express가 시작하지 못한다(최소 32자 검사). 쓰지 않을 때는 줄을 지운다.

**확인 (배포 뒤):** 키 없이 POST → 403. 사이트 정상. Cloud Logging에 `ORIGIN_KEY unset` 경고 없음.
