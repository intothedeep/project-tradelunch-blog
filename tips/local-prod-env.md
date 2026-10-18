# 로컬 웹을 운영 데이터에 붙이기

결과: 로컬 웹은 운영 DB(prod DB)에 직접 붙지 않는다. 운영 API(`https://blog-api.prettylog.com`)를 부르고, 그 API가 운영 Supabase DB를 읽는다. 그래서 "운영 DB 로컬 환경" = 로컬 Next 서버 + 운영 API다.

```text
브라우저
  │  https://local.prettylog.com   (/etc/hosts가 127.0.0.1로 보낸다)
  ▼
내 Mac: Next 개발 서버 (:443, HTTPS)      ← 로컬에서 도는 것은 이것뿐
  │  SSR 호출, 브라우저 호출 (Clerk 운영 토큰)
  ▼
https://blog-api.prettylog.com            ← GCP VM의 Express API
  ▼
Supabase (운영 DB)
```

주의: 로그인한 상태의 쓰기(댓글, 좋아요, 저장, 글쓰기)는 운영 데이터를 바꾼다. 시험 댓글은 공개된다. 끝나면 지운다(soft delete).

## 어떤 모드를 쓰나

| 모드 | 시험할 것 | Clerk 키 | 쓰기 |
| --- | --- | --- | --- |
| A. 읽기 전용 | 페이지, 피드, 글 상세, SSR | 개발 키(`.env.local`) | 없음 |
| B. API 중단 | "글을 불러올 수 없음" 안내 | 개발 키 | 없음 |
| C. 로그인 | 댓글, 좋아요, 저장, 글쓰기 | 운영 키(`pk_live` / `sk_live`) | 운영 DB에 실제로 기록 |

로그인이 필요 없으면 A로 충분하다. C는 아래 설정이 필요하다.

## 한 번만 / 매번

| 단계 | 어디서 | 언제 |
| --- | --- | --- |
| 1. `/etc/hosts`에 이름 추가 | Mac | 한 번 |
| 2. 운영 API에 origin 허용(`ALLOWED_ORIGINS`) | GCP VM | 한 번 |
| 3. 인증서(certificate) 만들기 | Mac | 한 번 (약 2년마다 다시) |
| 4. 개발 서버 실행 | Mac | 매번 |
| 5. 확인 | 브라우저 | 매번 |

## 모드 A: 읽기 전용 (설정 없음)

```sh
# 저장소 루트에서
LOG_REQUESTS=false NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com pnpm dev:web
# 열기: http://localhost:3000
```

- `LOG_REQUESTS=false`는 요청 로그 한 줄씩을 끈다.
- 브라우저가 직접 부르는 호출(더 보기, 좋아요)은 CORS로 실패할 수 있다. 첫 화면(SSR)은 괜찮다.

## 모드 C: 운영 Clerk로 로그인

이유: Clerk 운영 키는 `prettylog.com`과 그 하위 도메인에서만 동작한다. `localhost`는 안 된다.

1. 한 번. Mac에서 이름을 내 Mac으로 보낸다.

   ```sh
   echo '127.0.0.1 local.prettylog.com' | sudo tee -a /etc/hosts
   ```

2. 한 번. VM에서 `ALLOWED_ORIGINS`에 `https://local.prettylog.com`을 넣고 재시작한다. 포트, 따옴표, 끝의 `/`는 쓰지 않는다. 명령 전체: [`LOCAL_PROD_API.md`](../apps/dashboard_client_web/LOCAL_PROD_API.md) 2단계.
3. 한 번. mkcert로 `local.prettylog.com`이 들어간 인증서를 `~/.config/prettylog/certs/`에 만든다. 명령 전체: [`LOCAL_PROD_API.md`](../apps/dashboard_client_web/LOCAL_PROD_API.md) 3단계.
4. 매번. 운영 키를 입력하고 개발 서버를 켠다.

   ```sh
   cd ~/Documents/00_projects/project_tradelunch
   read -s 'PK?pk_live: ' && echo && read -s 'SK?sk_live: ' && echo

   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$PK CLERK_SECRET_KEY=$SK \
   NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com \
   pnpm --filter dashboard_client_web exec next dev --turbopack -p 443 -H 0.0.0.0 --experimental-https \
     --experimental-https-key "$HOME/.config/prettylog/certs/local-key.pem" \
     --experimental-https-cert "$HOME/.config/prettylog/certs/local.pem"
   ```

   - `read -s`는 키를 화면과 셸 기록에 남기지 않는다.
   - 두 키가 모두 있어야 한다. 없으면 개발 키가 로드되어 401이 난다.
   - `0.0.0.0`은 같은 네트워크의 다른 기기도 받는다. 시험이 끝나면 `Ctrl+C`로 끈다.
5. 매번. `https://local.prettylog.com`(포트 없음)을 열고 로그인한다.

## 막히면

| 증상 | 한 줄 원인 | 기록 |
| --- | --- | --- |
| 401 `unauthorized` | 개발 키가 로드됨 | [04](../books/debugging/04-clerk-dev-keys-401.md) |
| Clerk "Production Keys are only allowed for domain" | URL에 포트가 있음 | [05](../books/debugging/05-clerk-origin-port.md) |
| `listen EACCES ... 443` | `-H`에 호스트 이름을 줌 | [06](../books/debugging/06-bind-eacces-443.md) |
| 인증서 경고, HMR 차단 | Next 기본 인증서, `allowedDevOrigins` 누락 | [07](../books/debugging/07-certificate-and-hmr.md) |
| CORS preflight `500`, PM2 `ecosystem not found` | origin이 실행 중인 값에 없음 | [08](../books/debugging/08-cors-preflight-500.md) |

## 프로젝트 그룹 mock 화면 보기 (Phase PG M1)

환경 변수 `PROJECTS_DATA_SOURCE=mock`을 주면 Projects 카드가 mock 데이터로 바뀐다. 이 변수는 작업 PG-1-03(`pg.plan.md`)에서 추가하는 중이다. 아직 코드에 없을 수 있다.

```sh
PROJECTS_DATA_SOURCE=mock LOG_REQUESTS=false pnpm dev:web
# 열기: http://localhost:3000/@taeklim/projects
```

- 값이 정확히 `mock`일 때만 mock이다.
- 변수를 빼면 실제 데이터가 나온다.
- 서버 전용 변수다. `NEXT_PUBLIC_` 접두가 없다.

## 되돌리기

- VM의 `ALLOWED_ORIGINS`에서 `https://local.prettylog.com`을 빼고 `blog-api`를 재시작한다.
- `/etc/hosts`에서 그 줄을 지운다.
- Cloudflare에 이 이름의 공개 DNS 레코드를 만들지 않는다.

전체 설명: [`LOCAL_PROD_API.md`](../apps/dashboard_client_web/LOCAL_PROD_API.md)
