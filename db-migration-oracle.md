# DB 마이그레이션 런북 — Supabase → Oracle Cloud (self-hosted PostgreSQL)

> ⚠️ **범위 변경(2026-07-08):** 이 문서는 "Supabase 전체 → Oracle" 초안입니다. 확정 범위는
> **blog DB→새 Supabase / finance DB→Oracle PG17(1GB+swap) / 모든 storage→Oracle**로 바뀌었습니다.
> **실제 실행은 [`scripts/migration/RUNBOOK.md`](./scripts/migration/RUNBOOK.md)를 따르세요.**
> 이 문서는 SSL·PgBouncer·env 상세 등 **참고 레퍼런스**로만 사용(스텝 순서는 RUNBOOK이 최신).
>
> 이 문서는 일회성 운영 런북입니다. 완료 후에는 `_docs/archive/`로 이동하세요.
> (living docs 3종 규칙과 별개인 operational runbook)

작성일: 2026-07-05

---

## 0. 한눈에 보기

전 레포는 Vercel↔Supabase 통합 변수명으로 DB를 연결합니다:

| 변수                       | 의미                                  | 포트          | 사용처                                                        |
| -------------------------- | ------------------------------------- | ------------- | ------------------------------------------------------------- |
| `POSTGRES_URL`             | pooled (PgBouncer transaction pooler) | 6543          | `dashboard_server` 런타임 `pg.Pool`                           |
| `POSTGRES_URL_NON_POOLING` | direct / session                      | 5432          | migrations, `blog_agent`(asyncpg), `stock_collector` fallback |
| `DATABASE_URL`             | 평문                                  | 5432(session) | `stock_collector`(psycopg3), GitHub Actions                   |

- **`DATABASE_URL_DIRECT`는 환경변수가 아님** — `env.schema.ts` 내부 export 심볼일 뿐(값은 `POSTGRES_URL_NON_POOLING`).
- SSL은 현재 **모든 곳에서 non-verifying**(Supabase 자체서명 체인 허용). `sslmode`/`pgbouncer`/`connect_timeout` 쿼리 파라미터는 코드가 벗겨냄.
- **Supabase Storage는 Postgres와 완전히 별개.** Postgres만 옮기면 Storage(블로그 이미지 `blog.prettylog`, Parquet 아카이브 `market-archive`/`sec-archive`)는 Supabase에 그대로 남습니다.

**범위 결정 (확정):**

1. **Storage도 Oracle로 이관** — 단, DB 이전 안정화 후 **별도 페이즈**로 (§7). 최종 목표 = Supabase 완전 탈출.
2. **Oracle 인스턴스에 PgBouncer(pooler)를 둘 것인가?** (없으면 pooled/direct 둘 다 5432 동일 호스트로) — 미정, §2에서 결정.

> 이 문서는 **페이즈 1 = DB(§1~§6, §8~§11)**, **페이즈 2 = Storage(§7)** 로 구성. 두 페이즈는 독립 cutover.

---

## 1. 영향 범위 (앱별)

| 앱                                | DB 접근                                               | 읽는 변수                                   | SSL 코드 위치                                   | 조치                                   |
| --------------------------------- | ----------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| `dashboard_server` (Express)      | `pg.Pool`                                             | `POSTGRES_URL` (pooled)                     | `src/database.ts:34` `rejectUnauthorized:false` | 변수 repoint + SSL 재검토              |
| `dashboard_client_web` (Next)     | **직접 접근 없음** — 전부 `dashboard_server` API 경유 | 없음                                        | 없음                                            | **변경 없음** (CDN URL만 Storage 유지) |
| `stock_collector` (psycopg3)      | `sink/db_sink.py:connect()`                           | `DATABASE_URL` → `POSTGRES_URL_NON_POOLING` | DSN 파라미터에 의존 (명시 SSL 없음)             | 변수 repoint (GitHub secret)           |
| `blog_agent` (asyncpg/SQLAlchemy) | `db/connection.py:get_engine()`                       | `POSTGRES_URL_NON_POOLING` → `POSTGRES_URL` | `db/connection.py:43-45` `CERT_NONE`            | 변수 repoint + SSL 재검토              |

> `stock_collector`의 `connect()`는 세션에 `-c timezone=UTC`를 설정하므로 **transaction pooler(6543)를 쓰면 안 됨** — 반드시 session/direct 연결이어야 합니다.

---

## 2. 사전 준비 — Oracle Cloud PostgreSQL 인스턴스

1. **Postgres 버전**: Supabase는 PG 15/17 계열. 동일하거나 상위 마이너로 프로비저닝(스키마 replay 호환).
2. **네트워크**:
    - Vercel(2개 프로젝트: client_web, dashboard_server)에서 인스턴스로 아웃바운드 접속 허용 — 고정 IP가 없으므로 **TLS 필수 + 강한 패스워드**, 가능하면 IP allowlist 대신 TLS 클라이언트 인증 고려.
    - GitHub Actions 러너(동적 IP)에서도 접속 필요 → public 엔드포인트 + TLS. Supabase가 IPv6-only direct 호스트 문제로 pooler를 썼던 것처럼, **IPv4 도달성**을 반드시 확인.
    - Oracle Cloud VCN Security List / NSG에서 5432 인바운드 오픈.
3. **TLS**: 서버에 `ssl=on` + 인증서 배치. 자체서명이어도 무방하나, 가능하면 CA 발급 인증서로 두면 이후 검증 강화가 쉬움.
4. **(선택) PgBouncer**: `dashboard_server`는 Vercel Fluid Compute에서 다중 동시요청을 받으므로 pooler가 이상적. 없으면 `pg.Pool max:5`로 direct(5432) 접속해도 동작하나 커넥션 수를 모니터링.
5. **DB/롤**: `postgres` superuser 외에 앱용 롤 생성 권장(최소권한). 스키마 소유자 정리.

### 2.1 커넥션 풀링 — HikariCP? PgBouncer?

- **URL 변수·포맷은 그대로.** `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` 이름과 `postgresql://user:pw@host:port/db` 포맷 유지, host/port/creds만 교체.
- **HikariCP는 해당 없음** — JVM 전용. 이 스택은 Node `pg.Pool`(`database.ts` `max:5`) + Python SQLAlchemy(`connection.py` `pool_size=5, max_overflow=10`) + `stock_collector`는 풀 없이 단발 `psycopg.connect()`. **클라이언트 풀은 이미 있음 → 추가 라이브러리 불필요.**
- **바뀌는 것 = `pooler.supabase.com:6543`.** 이건 Supabase가 운영하던 서버사이드 풀러(Supavisor/PgBouncer). Oracle엔 없으므로 직접 둘지 결정:

    |                            | 옵션 A — PgBouncer 직접 운영 (Vercel 트래픽 있으면 권장) | 옵션 B — 풀러 없이 직결 (저트래픽)                       |
    | -------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
    | `POSTGRES_URL`             | Oracle PgBouncer **transaction 모드** (`:6432`)          | Postgres 직결 `:5432`                                    |
    | `POSTGRES_URL_NON_POOLING` | Postgres 직결 `:5432`                                    | 동일 `:5432`                                             |
    | 부가작업                   | 인스턴스에 PgBouncer/pgcat 설치·운영                     | `max_connections` 넉넉히 + `pg.Pool max` 낮게 + 모니터링 |

- **왜 필요할 수 있나:** `dashboard_server`는 Vercel 서버리스 → 인스턴스마다 `pg.Pool(max:5)` → 인스턴스 20개면 100 커넥션으로 Postgres 기본 `max_connections` 소진. 풀러가 이를 다중화.
- **collector는 항상 direct/session(5432).** `-c timezone=UTC` + prepare 워크어라운드 탓에 transaction 풀러 통과 금지. 이미 `POSTGRES_URL_NON_POOLING` 사용 → 변경 없음.
- 코드 gotcha(이미 처리됨): `database.ts:stripSslmode()`가 `pgbouncer` 파라미터 제거 → PgBouncer 앞단 안전. `psycopg` `prepare_threshold=None`은 direct 연결엔 무해.

---

## 3. 스키마 이관

스키마 원본: `apps/dashboard_server/supabase/migrations/` (`0001_*.sql` … `0034_*.sql`, `0026` 결번, 나머지 연속).

두 가지 방법 중 택1:

**(A) 마이그레이션 파일 순차 replay** (권장 — 깨끗한 스키마):

```sh
for f in apps/dashboard_server/supabase/migrations/*.sql; do
  psql "postgresql://<user>:<pw>@<oracle-host>:5432/<db>?sslmode=require" -v ON_ERROR_STOP=1 -f "$f"
done
```

> Supabase 확장/롤(`auth`, `storage`, `supabase_*` 스키마)에 의존하는 구문이 있으면 self-hosted에서 실패할 수 있으니 로그 확인. 순수 앱 테이블만 필요.

**(B) 스키마 덤프**:

```sh
pg_dump --schema-only --no-owner --no-privileges \
  "$POSTGRES_URL_NON_POOLING" > schema.sql
psql "<oracle-dsn>" -v ON_ERROR_STOP=1 -f schema.sql
```

`supabase/config.toml`의 로컬 개발 흐름(`supabase start`)은 마이그레이션 작성용으로만 유지하거나 폐기.

---

## 4. 데이터 이관

```sh
# 1) 덤프 (direct/non-pooling에서)
pg_dump --data-only --no-owner --no-privileges \
  --disable-triggers \
  "$POSTGRES_URL_NON_POOLING" > data.sql

# 2) 복원
psql "<oracle-dsn>" -v ON_ERROR_STOP=1 -f data.sql
```

- 대용량 테이블(`market_history`, `politician_trades`, `signal_backtest`, `mv_sec_new_positions` 등)은 `--table`로 분할하거나 `pg_dump -Fc` custom format + `pg_restore -j`로 병렬 복원.
- **MV(materialized view)** 는 복원 후 `REFRESH MATERIALIZED VIEW` 필요.
- soft-delete 정책(`deleted_at`)상 대부분 하드삭제 없음 → 덤프 그대로 이관. 단 `market_history`는 하드삭제 테이블임(무결성만 확인).
- 이관 후 행 수 대조: 주요 테이블별 `SELECT count(*)` before/after 비교.

---

## 5. 환경변수 업데이트 (Before → After)

새 DSN 형식 예 (pooler 없을 때 pooled/direct 동일):

```
postgresql://<app-user>:<pw>@<oracle-host>:5432/<db>?sslmode=require
```

### 5.1 `apps/dashboard_server` — `.env.production` (그리고 Vercel 프로젝트 환경변수)

| 변수                                                                                                                    | Before (Supabase)                      | After (Oracle)                                              |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `POSTGRES_URL`                                                                                                          | `...pooler.supabase.com:6543/postgres` | `...@<oracle-host>:6543/<db>` (pooler 있을 때) 또는 `:5432` |
| `POSTGRES_URL_NON_POOLING`                                                                                              | `...pooler.supabase.com:5432/postgres` | `...@<oracle-host>:5432/<db>`                               |
| `POSTGRES_PRISMA_URL`                                                                                                   | (무시됨)                               | **삭제 가능**                                               |
| `POSTGRES_USER/HOST/PASSWORD/DATABASE/PORT`                                                                             | (미사용)                               | **삭제 가능**                                               |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` / `SUPABASE_STORAGE_BUCKET` / `SUPABASE_PROJECT_ID` / `SUPABASE_PUBLISHABLE_KEY` | Supabase 값                            | **Storage 유지 시 그대로 둠** (아래 §7)                     |
| `CDN_ASSETS`                                                                                                            | `https://assets.prettylog.com/`        | Storage 유지 시 그대로                                      |

> Vercel에서 Supabase 통합을 제거하면 `POSTGRES_*`가 자동주입되지 않으므로, Vercel 대시보드에서 **수동으로** 넣어야 합니다.

### 5.2 `apps/blog_agent` — `.env`

| 변수                                     | After                                        |
| ---------------------------------------- | -------------------------------------------- |
| `POSTGRES_URL_NON_POOLING`               | Oracle direct DSN (asyncpg는 이걸 우선 사용) |
| `POSTGRES_URL`                           | Oracle DSN (fallback)                        |
| `SUPABASE_*` / `SUPABASE_STORAGE_BUCKET` | Storage 유지 시 그대로                       |

### 5.3 `apps/stock_collector` — 로컬 `.env` + **GitHub secrets**

| 변수                                   | After                                                       |
| -------------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                         | Oracle **session/direct** DSN (`:5432`) — pooler(6543) 금지 |
| (fallback) `POSTGRES_URL_NON_POOLING`  | 동일                                                        |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Parquet 아카이브 Storage 유지 시 그대로                     |

### 5.4 `apps/dashboard_client_web`

**DB 변수 없음.** `CDN_ASSETS` / `NEXT_PUBLIC_CDN_ASSETS`만 존재 → Storage 유지 시 변경 없음.

### 5.5 루트 `.env` (⚠️ 라이브 시크릿)

루트 `.env`에 실제 Supabase 프로젝트 ref(`rdtvemrbbsmiagbyvgzz`)와 `sb_secret_...` 키가 평문으로 있습니다.

- 마이그레이션과 무관하게 **키 회전/스크럽** 권장.
- Storage를 옮기면 이 값들도 교체.

---

## 6. SSL 처리 (코드 변경 포인트)

현재는 전부 **비검증 SSL**. self-hosted에서 동작 방식이 드라이버마다 다릅니다:

| 드라이버                     | 현재 동작                                       | self-hosted 주의                                             |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| node-pg (`dashboard_server`) | `ssl:{rejectUnauthorized:false}` → **SSL 강제** | 서버 TLS 꺼져 있으면 **접속 실패**. TLS 켜거나 `ssl` 키 제거 |
| asyncpg (`blog_agent`)       | `CERT_NONE` context → **SSL 강제**              | 동일. TLS 켜거나 `ssl=None` 전달                             |
| psycopg3 (`stock_collector`) | DSN 파라미터 의존(기본 `prefer`)                | TLS 유무 무관하게 대체로 동작                                |

**권장: Oracle 인스턴스에 TLS를 켜고 non-verifying 그대로 두면 코드 변경 0.**
보안 강화를 원하면(선택):

- `apps/dashboard_server/src/database.ts:34`
    ```ts
    // Before: ssl: { rejectUnauthorized: false }
    // After (CA 검증):
    ssl: { ca: fs.readFileSync(process.env.DB_SSL_CA_PATH!), rejectUnauthorized: true }
    ```
    단, `stripSslmode()`가 `sslmode`를 벗기므로 검증은 `ssl` 객체가 단독 관장.
- `apps/blog_agent/db/connection.py:33-45` `get_ssl_context()`를 `check_hostname=True` + `load_verify_locations(ca)`로.
- `stock_collector`는 DSN에 `?sslmode=verify-full&sslrootcert=<ca>` 추가.

> `blog_agent/.env.example`에 이미 `DB_SSL_CA_PATH`(구 RDS용, Phase B5 폐기) 흔적이 있음 — 되살릴 수 있음.

---

## 7. Storage 이관 (Oracle Object Storage — 별도 페이즈)

Postgres 마이그레이션은 object storage를 옮기지 않습니다. **결정: Storage도 Oracle로 이관하되, DB 이전이 안정화된 뒤 별도 페이즈로 진행** (둘을 묶으면 cutover 리스크가 배가되므로 분리).

### 7.0 왜 옮기는가 / 왜 분리하는가

- **동기 = Supabase egress/비용** (최근 `b3e9dac`/`01e050c`/`4bf7f92` 커밋이 전부 egress 절감). Oracle Object Storage는 **아웃바운드 10TB/월 always-free** + 20GB 스토리지 무료 → egress 통증의 정반대.
- **S3 호환 API** 제공(`https://<namespace>.compat.objectstorage.<region>.oraclecloud.com`) → 지금 제각각인 접근을 **단일 S3 SDK로 통일**.
- DB와 Storage는 독립 시스템 → **분리 cutover**로 blast radius 축소.

### 7.1 현재 Storage 접근 지점 (교체 대상)

| 앱                     | 현재 방식                                                       | 파일                                 | 교체 후                                          |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `blog_agent`           | supabase-py `create_client`                                     | `db/storage.py`                      | `boto3` S3 client (upload/list/delete/presigned) |
| `dashboard_server`     | Storage REST `POST /storage/v1/object/...` (Bearer, `x-upsert`) | `src/helpers/uploadImage.ts`         | `@aws-sdk/client-s3` `PutObjectCommand`          |
| `stock_collector`      | Storage REST (apikey+Bearer, head-check)                        | `src/collector/sink/storage_sink.py` | `boto3` (Parquet/SEC 아카이브, private 버킷)     |
| `dashboard_client_web` | 공개 읽기 URL만 (`CDN_ASSETS`)                                  | 여러 서버 컴포넌트                   | **코드 변경 없음** — CDN origin만 바뀜           |

### 7.2 버킷 & public-access 모델

- 버킷: `blog.prettylog`(블로그 이미지, public read), `market-archive`·`sec-archive`(Parquet, private).
- Supabase public bucket → **Oracle public bucket** 또는 **PAR(Pre-Authenticated Request)**. private 아카이브는 그대로 private + S3 presigned/PAR.
- **CDN 재구성**: 현재 `assets.prettylog.com`(Cloudflare CNAME)이 `/{bucket}/{path}` → Supabase origin `/storage/v1/object/public/{bucket}/{path}`로 rewrite. 이관 시 rewrite 타깃을 **Oracle S3-compat / PAR 경로**로 변경. `CDN_ASSETS` 값 자체는 유지 가능(origin만 교체) → **client_web 코드 무변경**.

### 7.3 데이터 복사

`rclone`가 Supabase S3(Supabase도 S3-compat 엔드포인트 제공)와 Oracle S3-compat을 모두 지원하므로 remote 2개 설정 후:

```sh
rclone sync supabase:blog.prettylog   oci:blog.prettylog   --progress
rclone sync supabase:market-archive   oci:market-archive   --progress
rclone sync supabase:sec-archive      oci:sec-archive      --progress
```

> Oracle S3 compat은 **Customer Secret Key**(access key/secret) 발급 필요 (콘솔 → User → Customer Secret Keys).

### 7.4 env 변수 (Storage 페이즈)

| 폐기 (Supabase)                                    | 신규 (Oracle S3-compat)                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                     | `OCI_S3_ENDPOINT` (`https://<namespace>.compat.objectstorage.<region>.oraclecloud.com`) |
| `SUPABASE_SECRET_KEY`                              | `OCI_S3_ACCESS_KEY_ID` / `OCI_S3_SECRET_ACCESS_KEY`                                     |
| `SUPABASE_PROJECT_ID` / `SUPABASE_PUBLISHABLE_KEY` | (불필요)                                                                                |
| `SUPABASE_STORAGE_BUCKET`                          | `STORAGE_BUCKET` (버킷명 유지 가능)                                                     |
| (collector) `COLLECTOR_*_BUCKET`                   | 동일 이름 유지                                                                          |

`CDN_ASSETS` / `NEXT_PUBLIC_CDN_ASSETS`는 값 유지, CDN origin만 교체.

### 7.5 Storage 페이즈 순서

1. Oracle 버킷 3개 생성 + Customer Secret Key 발급
2. `rclone sync`로 데이터 복사 (읽기 트래픽 유지한 채 사전 복사 → cutover 직전 재sync)
3. 3곳 코드 S3 SDK로 교체 (`uploadImage.ts`, `storage.py`, `storage_sink.py`)
4. Cloudflare rewrite 타깃을 Oracle으로 변경 + 캐시 purge
5. env 교체 + Vercel 재배포 + collector dispatch 검증
6. Supabase Storage 1주 병행 유지 후 해제

> ⚠️ 이 페이즈는 DB 이전(§1~§6)과 **독립 실행**. DB 안정화 확인 후 착수.

---

## 8. GitHub Actions / workflow `DATABASE_URL`

`.github/workflows/` 아래 collector cron 워크플로가 DB를 사용합니다. YAML은 각 스텝 `env:`에서 `${{ secrets.* }}`를 주입하므로 **워크플로 파일은 대부분 수정 불필요 — GitHub repo Secrets 값만 교체**하면 됩니다.

### 8.1 교체할 GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret                                 | 조치                                                              |
| -------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                         | Oracle **session/direct** DSN(`:5432`, `?sslmode=require`)로 교체 |
| `POSTGRES_URL_NON_POOLING`             | 동일하게 교체                                                     |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Storage 유지 시 그대로                                            |
| `SEC_USER_AGENT` / `OPENFIGI_API_KEY`  | DB 무관, 유지                                                     |

### 8.2 DB env를 주입하는 워크플로 (참고 — 값만 바뀜)

`collector-backfill / daily / monthly / weekly / options-daily / security-map / committees-enrich / bioguide-enrich / politician-trades / politician-backfill / politician-promote / prune-logs / prune / seed-archive` — 모두 `DATABASE_URL` (+ 일부 `POSTGRES_URL_NON_POOLING`)을 secret에서 주입.

### 8.3 폐기 대상 워크플로

| 파일                      | 이유                                                                       | 조치                                                               |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `supabase-keepalive.yml`  | Supabase 무료티어 자동 일시정지 방지(`psql SELECT 1`, `PGSSLMODE:require`) | self-hosted엔 불필요 → **삭제**(soft-delete: `x_` 프리픽스 rename) |
| `collector-keepalive.yml` | 주석에 Supabase 7일 auto-pause 언급 (DB env 없음, HTTP dispatch만)         | 로직상 유지 가능하나 주석 정리                                     |

> 소프트삭제 규칙(§rm -rf): 파일 직접 삭제 대신 `x_supabase-keepalive.yml`로 rename 후 사용자가 확인·삭제.

---

## 9. 검증 (cutover 전 smoke test)

1. **연결**: 각 DSN으로 `psql "<dsn>" -c 'select 1'` (Vercel 리전/GitHub 러너에서 도달성 확인).
2. **dashboard_server**: 로컬에서 `POSTGRES_URL`만 Oracle로 바꿔 `pnpm --filter dashboard_server dev` → API 스모크 + jest(`pnpm --filter dashboard_server test`).
3. **blog_agent**: `uv run` 스크립트로 read 1건.
4. **stock_collector**: `DATABASE_URL`을 Oracle로 두고 `uv run` 드라이런(예: `read_tracked_symbols`).
5. **행 수 대조**: §4 참고.
6. **SSL**: node-pg/asyncpg가 SSL 강제이므로, TLS 미설정 시 여기서 실패가 드러남 → §6로 해결.

---

## 10. Cutover & Rollback

- **Cutover 순서**: 스키마 → 데이터(읽기 트래픽 잠깐 정지 또는 최종 delta 재덤프) → Vercel/GitHub 변수 교체 → 재배포(Vercel 2개 프로젝트) → collector 다음 cron 대기 또는 수동 dispatch.
- **Rollback**: Supabase 인스턴스를 즉시 지우지 말 것. Vercel/GitHub 변수를 되돌리면 원복 가능. 최소 1주 병행 유지 권장.
- **Vercel Supabase 통합 제거**는 변수 수동입력 확인 후 마지막에.

---

## 11. 최종 체크리스트

- [ ] Oracle PG 프로비저닝 (버전/네트워크/TLS/방화벽 5432)
- [ ] (선택) PgBouncer 또는 pooled=direct 결정
- [ ] 스키마 replay (`0001`~`0034`, 0026 결번)
- [ ] 데이터 덤프/복원 + MV refresh + 행 수 대조
- [ ] `dashboard_server` `.env.production` + Vercel 변수 (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`)
- [ ] `blog_agent` `.env` (`POSTGRES_URL_NON_POOLING`, `POSTGRES_URL`)
- [ ] `stock_collector` 로컬 `.env` (`DATABASE_URL`)
- [ ] GitHub Secrets: `DATABASE_URL`, `POSTGRES_URL_NON_POOLING` 교체
- [ ] SSL 방식 결정 (TLS on + non-verify 유지 / CA 검증 강화)
- [ ] `supabase-keepalive.yml` soft-delete
- [ ] `POSTGRES_PRISMA_URL` / 개별 `POSTGRES_*` 정리 (선택)
- [ ] 루트 `.env` 라이브 시크릿 회전
- [ ] Vercel 2개 프로젝트 재배포 + collector 수동 dispatch 검증
- [ ] Supabase Postgres 1주 병행 유지 후 해제

### 페이즈 2 — Storage (§7, DB 안정화 후)

- [ ] Oracle 버킷 3개(`blog.prettylog`/`market-archive`/`sec-archive`) + Customer Secret Key
- [ ] `rclone sync` 데이터 복사 (사전 + cutover 직전 재sync)
- [ ] 코드 3곳 S3 SDK 교체 (`uploadImage.ts` / `storage.py` / `storage_sink.py`)
- [ ] Cloudflare rewrite origin 교체 + 캐시 purge (`CDN_ASSETS` 값 유지)
- [ ] env 교체 (`SUPABASE_*` → `OCI_S3_*`) + 재배포
- [ ] Supabase Storage 1주 병행 유지 후 해제
      </content>
      </invoke>
