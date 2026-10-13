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

**오너 결정 (권고):**

| ID | 질문 | 권고 |
| --- | --- | --- |
| D5 | 층과 한도 | 위 표대로. L-a는 가안으로 켜고 14일 뒤 확정 |
| D9 | L1 시험 | 진행 |
| D11 | blog-api 로그에 전체 IP와 `ssr` 표시 | 예. 웹 로그(#58)와 같은 정책 |
| D12 | SSR 제외 방법 | A: `x-origin-key` (#60으로 이미 만듦) |
| D13 | L2 오리진 시험 | 방문자가 적은 시각에 1회 |
| D14 | Express 시작 모드 | `log` 14일 뒤 `enforce` |

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
