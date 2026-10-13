# 트래픽과 보안 검토 (2026-10-13)

오늘 바뀐 트래픽 통제와 보안 변경을 목적별로 나눈 검토 문서다.
각 항목은 같은 순서로 쓴다: 왜 필요했나 → 문제 → 무엇을 바꿨나 → 어떻게 → 왜 이 방법인가 → 확인.

| 문서 | 목적 | 항목 |
| --- | --- | --- |
| [`01-reduce-traffic.md`](./01-reduce-traffic.md) | 트래픽 줄이기 | 전체 그림, B 웹 캐시, C 브라우저 TTL, D API 캐시, M 랜덤 쿼리 우회(설계 전) |
| [`02-blocking.md`](./02-blocking.md) | 막기 | H 요청 수 제한과 부하 시험(설계 중), 이미 막는 것, 제안 |
| [`03-status-codes.md`](./03-status-codes.md) | 상태 코드와 보안 | G CORS 403, 상태 코드 정리, 제안(헤더, 404 JSON) |
| [`04-observability.md`](./04-observability.md) | 관찰과 알림 | A 요청 로그, E 알림, F 점검 도구, I egress 보류, J Supabase Log Query |
| [`05-secrets.md`](./05-secrets.md) | 비밀 값과 개인 정보 | IP, 계정 ID, 토큰 |

실행 방법: [`../README.md`](../README.md). 설계: [`traffic.design.md`](../../../traffic.design.md).

## 한눈에

| # | 항목 | 상태 |
| --- | --- | --- |
| A | 웹 요청 로그(request log) | 완료, 운영 중 |
| B | 웹 캐시 규칙(Cache Rules) | 완료, 측정 통과 |
| C | 브라우저 캐시 TTL | 완료, 측정 통과 |
| D | API 캐시 규칙 | 완료, 측정 통과 |
| E | 예산 알림(budget), 메모리 알림(alert) | 완료 |
| F | 점검 도구와 매주 자동 점검 | 완료, issue #5: 14 PASS |
| G | CORS 거절을 403으로 | 완료, 운영 확인 (`4d137f2`) |
| H | 요청 수 제한(rate limit), 부하 시험(load test) | Cloudflare 규칙 운영 중, Express `log` 모드 운영 중, L1 통과, L2-web 약 2 rps에서 한계 (`02-blocking.md`) |
| I | 주간 issue에 egress 넣기 | **보류** (오너, 2026-10-13) |
| K | GCP 방화벽 22, 3389 끄기 | 오너 승인 대기 (`02-blocking.md`) |
| M | 랜덤 쿼리로 캐시를 피하는 요청 막기 | 설계 전 (`01-reduce-traffic.md` M) |
| L | 공개 error-logs 쓰기 막기 | 완료, 운영 확인 (`38b4c12`) |
| J | Supabase Log Query 사용량 | 관찰 중 |

검토할 것: G의 커밋과 배포, H의 설계(받으면 이 문서에 붙인다).

## 남은 결정

| 결정 | 권고 | 이유 |
| --- | --- | --- |
| H 요청 수 제한 (D5, D9, D11–D14) | `02-blocking.md` H의 권고대로 | 숫자는 가안. 14일 로그와 시험 뒤 확정 |
| K 방화벽 22, 3389 끄기 | 지금 | 공개 SSH는 첫 공격 대상. IAP로만 접속하니 잃는 것이 없다 |
| L error-logs 키 설정과 배포 | 지금 | 누구나 DB에 쓰는 경로를 닫는다 |
| I 주간 egress | 보류 (오너 결정) | IAM 변경 |

## 오늘 커밋

| 커밋 | 내용 |
| --- | --- |
| `3a6463a` | blog-web self-proxy 수정 (`HOSTNAME=localhost`) |
| `f33a917` | A: blog-web 요청 로그 |
| `3c365fd` | A 운영 시작, 트래픽 통제 검증 설계 |
| `48ae20e` | 5단계 실행표, `traffic-check.sh`, `vm-metrics.sh`, 스크립트 폴더 정리 |
| `10dab4c` | 웹 로그 조회 명령, Phase TC 계획 |
| `c3c49ff` | F: 주간 issue에 캐시 검사 |
| `2912bca` | F: HIT 재시도, 🚨는 개인 응답 HIT일 때만 |
| (커밋 전) | G: CORS 403 수정, 이 문서 |

## 새로 나온 제안 (아직 안 함)

| 제안 | 문서 |
| --- | --- |
| `x-powered-by` 숨기기, 없는 API 경로를 JSON 404로 | `03-status-codes.md` 제안 1, 2 (코드 몇 줄, G와 같이 배포 가능) |
| 보안 헤더 (HSTS 등), 피드 실패 화면 캐시 | `03-status-codes.md` 제안 3, 4 (설계 먼저) |
| Bot Fight Mode, 스캐너 경로 차단, method 차단 | `02-blocking.md` 제안 1–3 |
