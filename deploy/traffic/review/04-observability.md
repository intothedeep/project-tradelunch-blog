# 관찰과 알림 (2026-10-13)

목표: 캐시가 깨지거나 공격이 오면 사람이 보기 전에 숫자가 먼저 알린다.

## A. 웹 요청 로그

**왜 필요했나:** 트래픽이 터졌을 때 누가, 어디서, 무엇을 요청하는지 알아야 한다. 그래야 막을 대상을 고를 수 있다.

**문제:** blog-web은 요청을 기록하지 않았다. blog-api에만 로그가 있었다.

**무엇을 바꿨나:** `apps/dashboard_client_web/proxy.ts`가 페이지 요청마다 JSON 한 줄을 쓴다.
항목: 시각, method, host, path, query, ip(전체 `cf-connecting-ip`), country, ray, ua, referer, rsc, signedIn.

**어떻게:**

- PM2 로그 파일 → Ops Agent → Cloud Logging `log_id("blog-web")`.
- 보관 기간: Cloud Logging 30일, VM의 PM2 로그 7일(logrotate `rotate 7`).
- 로컬에서 끄기: `LOG_REQUESTS=false pnpm dev:web`.

**왜 이 방법인가:**

- 미들웨어(proxy.ts)에서 찍으면 모든 페이지 요청을 한 곳에서 잡는다.
- Ops Agent는 이미 blog-api 로그를 보내고 있다. 같은 길에 하나만 더했다.
- 전체 IP는 오너 결정이다(#58). 공격 IP를 정확히 막으려면 필요하다.

**확인:** Cloud Logging에 INFO 줄, path, country가 보인다. 상위 경로 조회가 동작한다.

**한계:** Cloudflare HIT 요청은 VM까지 오지 않으므로 이 로그에 없다. 전체 요청 수는 Cloudflare Analytics에서 본다.

## E. 예산 알림과 메모리 알림

**왜 필요했나:** 캐시가 깨지거나 공격이 와도 바로 알아야 한다. 돈과 메모리가 먼저 신호를 준다.

**문제:** 알림이 하나도 없었다. 무료 체험은 약 2027-01-10에 끝난다.

**무엇을 바꿨나:**

| 알림 | 값 | 받는 곳 |
| --- | --- | --- |
| 예산 `prettylog-monthly` | 10 USD/월, 50 %, 90 %, 100 % | 결제 계정 관리자 메일 |
| 메모리 `VM memory used > 90%` | 5분 넘게 90 % 초과 | `owner-email` 채널 |

**어떻게:** 둘 다 `gcloud` 명령으로 만들었다. 메모리 정책은 파일이다: `deploy/traffic/memory-alert.json`. 명령: `README.md` 4단계.

**왜 이 방법인가:**

- **예산을 `gcloud`로 만든 이유:** 콘솔은 서비스를 고르라고 했다. 목록에 Cloud Run만 있었다. 명령으로 만들면 서비스 조건이 없고, 모든 서비스가 대상이다.
- **메일만 보내는 이유:** 자동으로 끄면 사이트도 함께 죽는다. 판단은 오너가 한다.
- **메모리 90 %, 5분인 이유:** VM이 1 GB다. 잠깐 튀는 것은 무시하고, 계속 높을 때만 알린다.
- **정책을 파일로 둔 이유:** 다시 만들거나 바꿀 때 같은 값을 쓴다.
- **도구 문제:** `gcloud components install beta alpha`가 필요했다. gcloud는 PATH의 첫 `python3`를 쓴다. `CLOUDSDK_PYTHON`을 pyenv 3.13.12로 고정했다.

**확인:** `gcloud billing budgets list`에 `prettylog-monthly`가 보인다. `gcloud alpha monitoring policies list`에 정책이 보인다(켜짐, 채널 1개). 오늘 메모리 35–57 %.

## F. 점검 도구와 매주 자동 점검

**왜 필요했나:** 규칙은 한 번 맞춰 두어도 나중에 깨질 수 있다. 사람이 매번 확인하지 않아도 알아야 한다.

**문제:** 측정을 손으로 `curl` 여러 줄로 했다. 매주 반복하기 어렵다.

**무엇을 바꿨나:**

| 도구 | 하는 일 |
| --- | --- |
| `_scripts/cloudflare/traffic-check.sh` | B와 D의 검사 14개. 줄마다 PASS나 FAIL. FAIL이 있으면 종료 코드 1 |
| `_scripts/gcp/vm-metrics.sh [일수]` | Cloud Monitoring에서 시간별 최대 메모리, 하루 egress |
| `logging-review.yml` | 매주 월요일 14:17 UTC. 로그 점검에 캐시 검사를 더해 issue 1개 |

**어떻게:** 기존 주간 워크플로에 단계 하나를 더했다. 이 단계는 비밀 값이 필요 없다.

**왜 이 방법인가:**

- **기존 워크플로에 붙인 이유:** issue가 하나로 모인다. 새 워크플로와 권한이 필요 없다.
- **GET만 쓰는 이유:** HEAD 응답은 GET과 캐시 동작이 다르다.
- **HIT를 4번까지 시도하는 이유:** GitHub runner는 연결마다 다른 캐시 서버로 갈 수 있다. 첫 실행(issue #4)에서 MISS 2건이 잘못 FAIL이 되었다. 4번 다 MISS일 때만 진짜 실패로 본다.
- **🚨를 따로 둔 이유:** 개인 응답이 HIT인 것은 누출이다. 그냥 MISS와 다르게 바로 보이게 했다.
- **issue에 넣어도 되는 이유:** 공개 URL과 캐시 헤더뿐이다. 로그 원문(`volume.txt`)은 넣지 않는다.

**확인:**

- 일부러 틀린 주소로 돌리자 FAIL이 나왔다(고의 파손, deliberate breakage).
- issue #5: 14 PASS, 0 FAIL.

## I. 주간 issue에 egress 넣기 (보류)

**왜:** egress가 늘었는데 방문이 그대로면 캐시가 깨진 것이다. 매주 보면 빨리 안다.

**문제:** 워크플로 계정에 `roles/monitoring.viewer` 권한이 더 필요하다. IAM 변경이다.

**결정:** 오너가 보류했다(D7, 2026-10-13). 그동안은 Mac에서 `./_scripts/gcp/vm-metrics.sh 7`로 본다.

## J. Supabase Log Query 사용량 (관찰 중)

**왜 봤나:** 10-13 하루에 2.82 GB를 썼다. 오너가 많다고 봤다.

**문제인가:**

| 항목 | 값 |
| --- | --- |
| 무료 한도 | 100 GB/월 |
| 10-13 사용 | 2.82 GB (한도의 약 3 %) |
| 매일 이만큼 쓰면 | 약 85 GB/월. 한도 안이지만 여유가 적다 |
| 과금 | 2027년 초 유예 종료 뒤 |

**원인 찾기:**

- 이 지표는 로그를 **읽을 때** 스캔한 양이다. 쌓인 양과는 다르다.
- 이 저장소와 finance 저장소의 코드는 Supabase 로그를 읽지 않는다(grep 확인).
- 유력한 원인: Studio 화면(Logs Explorer, Reports, 홈 차트, 자동 새로고침 탭).

**할 일:** 탭을 닫는다. 짧은 기간으로 본다. API 로그는 Cloud Logging에서 본다. 2–3일 뒤 다시 본다.

