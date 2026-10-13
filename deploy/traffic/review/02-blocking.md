# 막기: 요청 수 제한, 부하 시험, 거절 (2026-10-13)

목표: 캐시를 지나 VM까지 오는 요청이 몰려도 VM과 Supabase가 버틴다.

## H. 요청 수 제한과 부하 시험 (설계 중)

**왜 필요했나:** 캐시는 익명 GET만 막는다. 캐시를 지나는 요청은 그대로 VM까지 온다. 로그인 요청, POST, 쿼리를 매번 바꾼 요청, 오류 경로가 그렇다. 이것이 몰리면 1 GB VM이 버티지 못한다.

**문제:** 지금은 요청 수에 제한이 없다. 얼마나 버티는지도 모른다.

**설계 방향 (system-architect가 `traffic.design.md` §7.4, §10에 쓰는 중):**

- 3층 제한:
  - Cloudflare 규칙: 캐시를 지나 서버까지 오는 경로만 센다.
  - Express 메모리 기반 제한: 마지막 방어선이다.
  - 제한하지 않을 경로: 캐시 HIT 경로다.
- 기준 숫자는 며칠 치 요청 로그에서 "IP당 분당 요청 수"로 정한다. 지금은 30분 치뿐이라 정할 수 없다.
- 부하 시험은 GitHub Actions runner에서 상한을 두고 돌린다. 메모리 알림이나 PM2 재시작이 생기면 멈춘다. 오너 승인 뒤에만 돌린다.

설계를 받으면 이 절을 채운다.


## 이미 막는 것

| 무엇 | 어떻게 | 문서 |
| --- | --- | --- |
| 허용 안 된 Origin의 API 호출 | 403, DB 쓰기 없음 (배포 전) | [`03-status-codes.md`](./03-status-codes.md) G |
| 익명 GET 폭주 | Cloudflare 캐시가 받는다. VM까지 안 온다 | [`01-reduce-traffic.md`](./01-reduce-traffic.md) |
| 메모리 폭주 | PM2 `max_memory_restart` (web 320M, api 200M), 90 % 알림 | [`04-observability.md`](./04-observability.md) E |

## 제안 (아직 안 함, H 설계와 함께 결정)

| # | 무엇 | 막는 것 | 비용, 위험 | 어디서 |
| --- | --- | --- | --- | --- |
| 1 | Bot Fight Mode | 알려진 악성 봇 | 정상 크롤러(검색, 미리보기)까지 막을 수 있다. 켜고 로그를 본다 | Cloudflare → Security → Bots |
| 2 | 스캐너 경로 차단 (WAF custom rule) | `/wp-admin`, `/wp-login.php`, `.php`, `/.env`, `/.git` 같은 탐색 | 거의 없음. 우리 사이트에는 이런 경로가 없다 | Cloudflare → Security → WAF → Custom rules |
| 3 | `my.`에 이상한 method 차단 | `PUT`, `DELETE`, `PATCH` 등 | Server Actions는 POST다. POST는 막지 않는다 | WAF custom rule |
| 4 | 요청 수 제한 (rate limit) | 캐시를 지나는 요청 폭주 | 기준이 너무 낮으면 정상 사용자를 막는다. 로그로 기준을 정한다 | H 설계 |

- 2번은 요청 로그로 실제 탐색 요청을 본 뒤 켜는 것을 권한다. 지금 바로 켜도 정상 사용자에게 영향은 없다.
