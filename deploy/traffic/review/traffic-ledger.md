# Traffic ledger (트래픽 대장)

`check.md` 10, 11번의 값을 한 줄씩 쌓는다. 실측만 적는다. 고치지 않고 아래에 덧붙인다.
목적: 다음 변경 때 GB와 금액으로 전후를 비교한다 (`books/debugging/15-traffic-overrun.md` §6).

## Cloudflare 주간 (check 10)

| 기록일 | 기간 (7일) | Requests total | Requests cached | Percent cached | Data served total | Data served cached | 그 주의 변경 (커밋) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-02 | 2026-10-26 ~ 11-01 (UTC, GraphQL `httpRequests1dGroups`) | 651,892 | 59,513 | 9.13 % | 2.324 GB | 0.176 GB | `65c1c28`, `df73101`, `469a8c7` |

## GCP 월간 (check 11)

| 기록일 | 달 | Internet egress GB | egress 금액 | External IP 금액 | 합계 | 메모 |
| --- | --- | --- | --- | --- | --- | --- |
