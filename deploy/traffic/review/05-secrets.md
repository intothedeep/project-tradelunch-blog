# 비밀 값과 개인 정보 (2026-10-13)

저장소가 공개라서 지키는 규칙이다.

## 비밀 값과 개인 정보 다루기

| 항목 | 어떻게 다루나 | 왜 |
| --- | --- | --- |
| 방문자 IP | Cloud Logging에만 저장. 30일 뒤 지워짐 | 공격 대응에 필요. 저장소는 공개다 |
| 결제 계정 ID, 메일 주소, 토큰 | 저장소와 issue에 넣지 않음. 문서에는 `<ACCOUNT_ID>` | 공개 저장소 |
| 메일 주소 입력 | `read`로 입력. 터미널 변수에만 있음 | 셸 기록과 파일에 남지 않게 |
| Cloudflare purge 토큰 | 환경 변수 또는 `_scripts/cloudflare/.env` (`*.env`는 gitignore) | 커밋되지 않게 |
| 주간 issue | 캐시 검사 줄만 넣음 | 공개 URL과 헤더뿐 |


## 함께 볼 것

- 서버 종류 헤더(`x-powered-by`) 숨기기 제안: [`03-status-codes.md`](./03-status-codes.md) 제안 1.
