# 막기: 요청 수 제한, 부하 시험, 거절 (2026-10-13)

목표: 캐시를 지나 VM까지 오는 요청이 몰려도 VM과 Supabase가 버틴다.

## H. 요청 수 제한과 부하 시험 (설계 완료 rev2 `aad898b`, 실행 전)

**왜 필요했나:** 캐시는 익명 GET만 막는다. 캐시를 지나는 요청은 그대로 VM까지 온다. 로그인 요청, POST, 쿼리를 매번 바꾼 요청, 오류 경로가 그렇다. 이것이 몰리면 1 GB VM이 버티지 못한다.

**문제:** 지금은 요청 수에 제한이 없다. VM이 몇 rps까지 버티는지도 모른다.

**무엇을 바꾸나 (설계, 숫자는 모두 가안):**

```text
요청 ─► L-a Cloudflare "web rate limit"  my.만, IP당 100 / 10 s → Block 10 s
          │                               (/_next/, 검증된 봇 제외)
          ▼
        VM ─► L-b Express backstop        cf-connecting-ip 기준 (IPv6는 /64), 메모리만
                                          읽기 120 / 60 s, 쓰기 30 / 60 s → 429 + Retry-After
                                          SSR 요청(x-origin-key 일치)은 세지 않음
        L-c 제한 안 함: /_next/static, 엣지 HIT, Next SSR, traffic-check.sh
```

| 층 | 대상 | 가안 한도 | 동작 | 끄는 법 |
| --- | --- | --- | --- | --- |
| L-a Cloudflare | `my.` | IP당 100 / 10 s | Block 10 s | 대시보드 토글 |
| L-b Express | blog-api | 읽기 120 / 60 s, 쓰기 30 / 60 s | 429. 처음 14일은 `log` 모드(세기만 함) | `RATE_LIMIT_MODE=off` + ecosystem restart |
| L-c | HIT 경로, SSR | 없음 | 없음 | |

**왜 이 방법인가:**

- **`blog-api.`를 엣지에서 세지 않는 이유:** Next SSR이 API를 부르면 모두 VM IP 하나로 보인다. 엣지에서 IP로 세면 사이트가 자기 SSR을 막는다.
- **SSR을 `x-origin-key`로 빼는 이유:** 같은 비밀 헤더를 이미 error-logs 보호에 쓴다(#60). 새 비밀을 만들지 않는다.
- **Challenge 대신 Block인 이유:** RSC 요청과 `fetch`는 challenge를 풀 수 없다. 앱 안 이동이 깨진다.
- **메모리만 쓰는 이유:** VM이 한 대다. Redis는 메모리와 관리 비용만 늘린다. 키 하나 약 400 B, 상한 5만 키면 약 20 MB(추정, 미측정).
- **`log` 모드로 시작하는 이유:** 한도가 틀리면 정상 사용자를 막는다. 14일 동안 세기만 하고 숫자를 본다.

**한도를 정하는 규칙 (§7.4.4):**

1. 아래 한계 = max(로그의 IP별 최댓값 × 3, 브라우저로 센 페이지당 요청 수 × 3). 정상 사용자를 막지 않는 값이다.
2. 위 한계 = 오리진 용량(L2 시험)의 절반.
3. 아래 한계가 위 한계보다 크면 오너가 정한다.

**부하 시험 (§10):** GitHub Actions `load-test.yml`에서 k6로 돈다. 8분 제한, 동시 실행 1개.

| 세트 | 무엇을 알려고 쓰나 | 속도 × 시간 | 총 요청 |
| --- | --- | --- | --- |
| L1 | 엣지가 몰리는 요청을 흡수하나 (HIT 경로) | 8 rps × 40 s, web과 api 각각 | 640 |
| L2 | 오리진이 MISS를 몇 rps까지 버티나 | web 0.5 → 4 rps, api 1 → 8 rps 단계 | 최대 900 (Supabase 조회 최대 450) |
| L3 | 제한이 실제로 발동하나 | 창 길이의 2배 | cf 60, api 300 |

- 멈추는 조건: 5xx 1건, 실패율 2 % 초과, p95 3 s 초과 중 하나.
- 통과: PM2 재시작 횟수 그대로, 메모리 최댓값 80 % 미만.
- L3를 창 길이의 2배로 보내는 이유: 고정 창은 시계 경계에서 끊긴다. 한 창 길이만 보내면 두 창으로 나뉘어 한도를 안 넘을 수 있다.

**순서 (§11.1, 작업 ID는 `00.tasks.md` Phase TC):**

| 단계 | 작업 | 막는 것 |
| --- | --- | --- |
| MVP1 | RL-0 Free 플랜 화면 값 기록 (TC-M4-1), LT-1 L1 시험 (TC-M4-2), RL-1 로그 필드 (TC-M4-3) | 아무것도 막지 않음 |
| MVP2 | RL-2 L-a 켜기 (TC-M5-1), RL-3 L-b `log` 모드 (TC-M5-2), LT-2 (TC-M5-3), LT-3a (TC-M5-4) | 엣지만 실제로 막음 |
| MVP3 | RL-4 14일 로그로 한도 확정, `enforce` (TC-M6-1), LT-3b (TC-M6-2), RL-5 주간 issue (TC-M6-3) | 둘 다 막음 |

**오너 결정 (2026-10-13, `decisions.plan.md` #62–#67):**

| ID | 질문 | 결정 |
| --- | --- | --- |
| D5 | 층과 한도 | 위 표대로. 숫자는 가안 (#62) |
| D9 | L1 시험 | 진행 (#65) |
| D11 | blog-api 로그에 전체 IP와 `ssr` | 예. 남용자를 찾아야 한다 (#63) |
| D12 | SSR 제외 방법 | A `x-origin-key` (#64) |
| D13 | L2 오리진 시험 | 지금 1회. 막 열어서 방문자가 적다 (#66) |
| D14 | Express 시작 모드 | `log` (#67) |

**확인 못 한 것:** Cloudflare Free 플랜의 rate limit 기능 9개(규칙 수, 세는 기준, 기간 등). TC-M4-1에서 대시보드 화면으로 확인한다.

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

## K. GCP 방화벽 (오너 승인 대기, TC-M1-10)

**왜 필요했나:** 설계의 Express backstop은 헤더가 없으면 제한하지 않는다(fail-open). 이것은 3000, 4000번 포트가 인터넷에 열려 있지 않을 때만 안전하다.

**확인 (2026-10-13, `gcloud compute firewall-rules list`):**

| 규칙 | 열린 것 | 판정 |
| --- | --- | --- |
| 3000, 4000번 | 규칙 없음. 앱도 `127.0.0.1`에서만 받음 | 안전. fail-open 전제가 맞다 |
| `allow-ssh-from-iap` | 22번, IAP 대역 `35.235.240.0/20`만 | 필요. 우리 접속 경로다 |
| `default-allow-ssh` | 22번, **인터넷 전체** | 필요 없음 |
| `default-allow-rdp` | 3389번(Windows 원격), **인터넷 전체** | 필요 없음. VM은 Linux다 |

**무엇을 바꾸나:** 두 기본 규칙을 끈다. 지우지 않고 끄기만 해서 되돌릴 수 있다.

```sh
gcloud compute firewall-rules update default-allow-ssh --disabled
gcloud compute firewall-rules update default-allow-rdp --disabled
gcloud compute ssh tio_taek_lim@instance-servers --zone=us-central1-a --tunnel-through-iap --command 'echo ok'   # ok
# 되돌리기: --no-disabled
```

**왜 이 방법인가:** 공개 22번은 비밀번호 대입과 취약점 탐색의 첫 대상이다. 우리는 IAP로만 들어가므로 잃는 것이 없다.

## 오너 질문과 답 (2026-10-13)

### Q1. `ALLOWED_ORIGINS`가 있는데 왜 키가 또 필요한가? `curl` 같은 요청 때문인가?

**답: 그렇다.** CORS(`ALLOWED_ORIGINS`)는 브라우저만 지키는 규칙이다. 서버를 지키는 자물쇠가 아니다.

```text
브라우저 (다른 사이트의 JS)  Origin: https://evil.example  ─► Express: 403 (G)        CORS가 막는다
curl, 스크립트, 봇           Origin 헤더 없음              ─► Express: 통과 (!origin) ─► INSERT
                             Origin: https://my.prettylog.com (위조) ─► 통과          ─► INSERT
```

| 요청한 쪽 | CORS가 막나 | 왜 |
| --- | --- | --- |
| 다른 사이트에서 도는 브라우저 JS | 막는다 | 브라우저가 `Origin`을 붙이고, 응답 헤더를 보고 스스로 막는다 |
| `curl`, 서버, 봇 | **못 막는다** | `Origin`을 안 붙이거나 마음대로 바꾼다. CORS를 지킬 의무가 없다 |

- **왜 `Origin` 없는 요청을 통과시키나:** Next SSR, 헬스 체크, 같은 사이트 요청은 `Origin`을 보내지 않는다. 막으면 사이트가 깨진다.
- **그래서 L이 필요하다:** DB에 쓰는 서버 전용 경로는 "누가 보냈는지"를 증명하는 비밀 값으로 지킨다. 브라우저 규칙(CORS)에 맡기지 않는다.

### Q2. Express는 IP를 어디에 저장하나? DB인가 메모리인가? 메모리가 작은데 괜찮나?

**답: 메모리에 저장한다. 1 GB VM에서도 괜찮다.**

| 저장 위치 | 요청마다 드는 비용 | VM 한 대에서 | 결정 |
| --- | --- | --- | --- |
| **프로세스 메모리 (Map)** | 메모리 읽기·쓰기 1번 | 충분하다 | **선택** |
| DB (Supabase) | 요청마다 DB 쓰기 1번 | 공격이 오면 DB까지 같이 무너진다. 막으려던 것을 스스로 만든다 | 버림 |
| Redis | 프로세스 하나 더 (수십 MB) | 서버가 여러 대일 때만 이득 | 버림 |

**메모리 계산 (추정):**

```text
키 하나 = IP 문자열 + 카운터 + 창 시작 시각 ≈ 약 400 B (Map 오버헤드 포함, 넉넉히)
상한 50,000 키 × 400 B ≈ 20 MB   ← 최악. 이보다 커지지 않게 상한을 둔다
오늘 실제: 하루 IP 약 21개 → 약 8 KB
blog-api 한도 200 MB (PM2 max_memory_restart). 지금 사용량은 VM에서 `pm2 ls`로 잰다
```

- **창(window)이 60초라서:** 60초가 지나면 카운터가 초기화된다. 그래서 메모리에는 "최근 1분 안의 IP"만 남는다.
- **상한을 넘으면:** 오래된 키를 버린다. 메모리가 끝없이 늘지 않는다.
- **잃는 것:** 서버를 재시작하면 카운터가 0이 된다. 1분 창이라 문제가 거의 없다.
- 정확한 값은 developer가 구현 뒤 보고하고, 배포 전후 `pm2 ls` 메모리로 잰다.

### Q3. D12 A안을 더 자세히

**문제:** 방문자 한 명이 페이지를 열면 Next 서버가 Express를 여러 번 부른다. 이 요청들은 모두 VM 자신(127.0.0.1 또는 VM IP)에서 온다.

```text
방문자 1명 ─► my.prettylog.com/blog/@taeklim
                 │ Next SSR이 화면을 그리면서
                 ├─► GET /posts/users/taeklim/profile     ┐
                 ├─► GET /posts/users/taeklim/categories  │ 오늘 로그: profile 294, tags 164,
                 ├─► GET /posts/users/taeklim/tags        │ categories 155 ...
                 └─► GET /tags                            ┘ 모두 "같은 IP"로 보인다
```

- 이것을 IP로 세면 방문자 30명만 와도 "한 IP가 분당 120번"이 되어 사이트가 스스로 막힌다.

**A안:** Next 서버가 모든 Express 호출에 `x-origin-key: <비밀>`을 붙인다. Express는 이 값이 `ORIGIN_KEY`와 같으면 "우리 SSR"로 보고 세지 않는다.

| 질문 | 답 |
| --- | --- |
| 비밀은 어디에 있나 | VM의 `shared/api.env`, `shared/web.env`. 저장소, 브라우저, 로그에는 없다 |
| 브라우저가 볼 수 있나 | 없다. Next 서버 안에서만 붙인다(`NEXT_PUBLIC_` 아님). 브라우저가 직접 부르는 API 요청에는 붙지 않는다 |
| 위조하면 | 키를 모르면 일치하지 않는다. 비교는 `timingSafeEqual`이라 응답 시간으로 알아낼 수 없다 |
| 키가 새면 | VM에서 새 키를 만들어 두 파일을 바꾸고 두 앱을 restart한다 |
| 왜 B(VM IP로 판별)가 아닌가 | SSR 호출은 `blog-api.prettylog.com`(Cloudflare)을 거쳐 온다. 그때 IP가 무엇으로 보이는지 확인이 더 필요하다. 키는 그런 가정이 없다 |
| 덤 | 같은 비밀로 error-logs 쓰기도 막는다(L, #60). 비밀은 하나만 관리한다 |

### Q4. D13 L2를 지금 하는 이유

- 오너: "good time to try cuz I just launched".
- 10-13 외부 IP는 약 20개다. 지금 서버에 부하를 주어도 영향을 받는 방문자가 거의 없다.
- 방문자가 늘면 같은 시험이 더 위험해진다. 그래서 지금 기준 숫자(오리진 용량)를 잡아 둔다.

## 지금 하는 일 (2026-10-13)

| 작업 | 누가 | 상태 |
| --- | --- | --- |
| RL-1 로그에 `ip`, `ssr`. 모든 SSR 호출에 `x-origin-key` | developer | 작업 중 |
| RL-3 Express 제한, `log` 모드 | developer | 작업 중 |
| LT-1, LT-2 `load-test.yml` (k6) | developer | 작업 중 |
| L 키 설정과 배포 | 오너 | 대기 |
| K 방화벽 | 오너 | 대기 |
| RL-0 Cloudflare Free rate limit 화면 값 확인 | 오너 | 대기 |
| RL-2 Cloudflare 규칙 "web rate limit" 켜기 | 오너 | RL-0 뒤 |

## 시험 결과 (2026-10-13)

### L1: 캐시 HIT 경로 (run `38465971720`, 통과)

| 항목 | 결과 |
| --- | --- |
| 요청 | 640 (web 320, api 320), 8 rps × 40 s 씩 |
| cf-cache-status | web HIT 320, api HIT 320 |
| 실패 | 0 |
| p95 | 전체 82 ms (web 88, api 73) |
| VM까지 온 시험 요청 | 0 (blog-web 로그에 `prettylog-load-test` 없음) |
| PM2 재시작 | 전후 같음 (api 5, web 3) |
| 메모리 | api 76 → 77 MB, web 129 → 130 MB |

**읽는 법:** 익명 GET 폭주는 Cloudflare가 모두 받는다. VM은 아무것도 하지 않았다.

### L2: 오리진 MISS 경로 (run `38466353765`, 중단)

| 단계 (web) | 시각 (UTC) | blog-web 로그의 시험 요청 |
| --- | --- | --- |
| 0.5 rps | 20:53 | 13 |
| 1 rps | 20:54 | 44 |
| 2 rps | 20:55 | 87 |
| 4 rps | 20:56 | 172 |
| 중단 | 20:57 | 24 |

| 항목 | 결과 |
| --- | --- |
| 요청 | web 320 (api 단계는 시작 전에 중단) |
| 실패 | web 10건 (3.1 %), 모두 10 s 시간 초과. 5xx 0 |
| p95 / 중앙값 | 874 ms / 589 ms |
| 중단 이유 | `http_req_failed{target:web}` > 2 % (사전 등록 기준) |
| PM2 재시작 | 없음 (api 5, web 3) |
| 메모리 | web 130 → 220 MB (cap 320M), VM available 425 → 287 MiB, swap 190 MiB |

**읽는 법:**

- 웹 오리진은 캐시를 놓친 요청을 **초당 2번까지는 버티고, 4번에서 시간 초과가 생긴다.** 첫 C_web 값은 약 2 rps다.
- 재시작이나 5xx는 없었다. 서버는 죽지 않고 느려졌다.
- API 단계(L2-api)는 돌지 않았다. C_api는 아직 모른다.
- **새 위험:** L-a 한도(IP당 100 / 10 s = 10 rps)는 웹 오리진 용량(약 2 rps)보다 크다. 매번 다른 쿼리(`/?x=랜덤`)로 MISS를 만들면, IP 하나로도 웹 오리진을 밀 수 있다. 대응 설계가 필요하다(아래 L-a 시험 뒤 "다음 할 일").

### L-a: Cloudflare "web rate limit" 발동 (2026-10-13 21:00 UTC, Mac에서)

| 시험 | 결과 |
| --- | --- |
| `/robots.txt?rl=<n>` 120번, 동시 20 | 120 모두 200. 발동 안 함 |
| `/` (HIT) 250번, 6초, 동시 25 | 200 232, **429 18** |
| 직후와 12초 뒤 `/` | 200 |

**읽는 법:**

- 규칙은 동작한다. HIT 요청도 센다.
- 세기는 정확하지 않고 늦게 반영된다. 100번째가 아니라 약 230번째부터 막혔다.
- 차단은 짧게 풀렸다(10 s).

### 다음 할 일

| 일 | 이유 |
| --- | --- |
| 랜덤 쿼리로 MISS를 만드는 우회를 막는 설계 (architect) | 오리진 용량 약 2 rps가 L-a 한도 10 rps보다 낮다. 후보: HTML 캐시 키에서 모르는 쿼리를 빼기, L-a 한도 낮추기 |
| L2-api만 다시 (오너 승인) | C_api가 없으면 Express 한도의 위쪽 한계를 정할 수 없다 |

### 배포 확인: L-b `log` 모드, `ip`, `ssr` (2026-10-13, `38b4c12`)

| 확인 | 결과 |
| --- | --- |
| blog-api 로그 `jsonPayload.req.ip` | 모든 요청에 있음 |
| `ssr=true` | `profile`, `tags`, `posts/users/.../tags` 같은 SSR 호출 |
| `ssr=false` | 브라우저와 `curl` 요청, **그리고 SSR의 `categories` 호출** (아래) |
| `rate_limit` WARN | 아직 없음 |
| 메모리 (배포 뒤 몇 분) | api 103 MB, web 171 MB, VM available 359 MiB |

**찾은 것: 키를 안 보내는 SSR 호출**

- `apis/getCategories.api.ts`는 서버와 브라우저 양쪽에서 쓰는 함수다(isomorphic). `clientRequest`를 쓰므로 서버에서 불려도 `x-origin-key`가 붙지 않는다.
- 같은 패턴 후보: `getComments.api.ts`, `get-log-thread.api.ts`, `get-log-global.api.ts`, `get-log-stream.api.ts`.
- 지금은 `log` 모드라 막히지 않는다. 이 호출들은 VM IP 하나로 세어진다.
- **`enforce`로 바꾸기 전(RL-4)에 반드시 고친다.** 그대로 두면 방문자가 늘 때 사이트가 자기 SSR을 막는다.
