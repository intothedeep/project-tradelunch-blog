# 부하 시험(load test) k6 스크립트

설계: `traffic.design.md` §10. 결정: #65 (L1), #66 (L2).
workflow: `.github/workflows/load-test.yml`. GitHub runner에서만 돈다. Mac에서 돌리지 않는다.

## 1. 무엇을 알려고 쓰나

| 세트 | 답하는 질문 | 대상 | 속도 × 시간 | 총 요청 |
| --- | --- | --- | --- | --- |
| L1 (`l1.js`) | 엣지(edge)가 burst를 흡수하는가 | `my.prettylog.com/@taeklim/rust-config`, `blog-api.prettylog.com/v1/api/posts?limit=1` (둘 다 HIT) | 각 8 rps × 40 s | 320 + 320 = 640 |
| L2 (`l2.js`) | 오리진(origin)은 MISS를 몇 rps까지 버티는가 | `my.prettylog.com/?lt=<run>-<n>`, `blog-api.prettylog.com/v1/api/posts?limit=1&lt=<run>-<n>` (매번 MISS) | web 0.5 → 1 → 2 → 4 rps (단계당 60 s), 이어서 api 1 → 2 → 4 → 8 rps (단계당 30 s) | 450 + 450 = 900 |

- L2는 web을 먼저, api를 그 뒤에 돌린다. 두 오리진에 동시에 부하를 주지 않는다.
- `lt=` 값이 매번 달라서 캐시 키(cache key)가 MISS가 된다.
- 모든 요청의 User-Agent는 `prettylog-load-test/L1` 또는 `prettylog-load-test/L2`다. Cloud Logging에서 걸러 낼 수 있다.

## 2. 중단 조건 (k6 `thresholds`, `abortOnFail`, 10 s 뒤부터 평가)

| 세트 | 중단 조건 |
| --- | --- |
| L1 | 200이 아닌 응답이 1 %를 넘는다 |
| L2 | 5xx가 1건 이상, 실패율이 2 %를 넘는다, p95가 3 s를 넘는다. 하나라도 걸리면 중단 |

- 마지막으로 통과한 단계의 rps가 C 값이다 (§10.3).

## 3. 시작 전 점검

1. L-b(Express 제한)가 `off` 또는 `log`인지 본다. L2-api 8 rps는 `enforce`면 막힌다.
2. `pm2 ls`의 ↺ 값을 적어 둔다.
3. 가장 한가한 시간대를 고른다 (§7.4.4 마지막 명령).
4. workflow가 스스로 점검한다. `traffic-check.sh`가 0 FAIL이어야 한다. L1은 두 URL의 2번째 GET이 HIT이어야 한다. 아니면 시작하지 않는다.

## 4. 실행, 관찰, 중단

```sh
gh workflow run load-test.yml -f set=L1    # 또는 set=L2
gh run list --workflow load-test.yml --limit 1
gh run watch <id>
gh run cancel <id>                         # 이상하면 바로 끊는다
```

- run이 끝나면 Job summary에 표가 뜬다. 요청 수, rps, p95, 실패율, `cf-cache-status` 개수가 들어 있다.
- 원본 숫자는 artifact `load-test-<세트>-<id>`의 `summary.json`이다. 인용하는 숫자는 이 파일에서 읽는다.

## 5. 끝난 뒤 점검

1. `pm2 ls`의 ↺ 값이 시작 전과 같은지 본다.
2. 메모리 최댓값이 80 % 아래인지 본다: `./_scripts/gcp/vm-metrics.sh 1`
3. blog-web 로그에서 run 시간대의 대상 path 줄 수를 센다. L1 통과 기준은 10줄 이하다.
4. blog-api 로그에서 run 시간대의 5xx 수를 센다. L2-api 통과 기준은 0이다.
5. 재시작 뒤 `online`이 아니면 `pm2 restart blog-web` 또는 `blog-api`를 한다.

## 6. 읽는 법

| 결과 | 뜻 |
| --- | --- |
| L1 200 ≥ 99 %, HIT ≥ 99 %, 오리진 줄 ≤ 10, ↺ 불변 | 통과. 엣지가 burst를 흡수한다 |
| L1 오리진 줄 > 10 | C1/C2 룰 또는 colo 분산(C3)을 본다 |
| L2 첫 단계부터 중단 | 오리진이 0.5 rps도 못 버틴다. 오너 결정이다 |
| L2 통과 중 ↺ 증가 | PM2 cap에 닿았다. 그 단계의 rps를 C 값으로 쓰지 않는다 |

- L2의 첫 run은 판정하지 않는다. C_web, C_api의 첫 값만 기록한다.
- `lt=` 캐시 항목은 하루 뒤 만료된다. purge하지 않는다.
