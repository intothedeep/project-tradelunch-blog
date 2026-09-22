# Log — Plan (Phase Y · Y-TD · Y M2)

> Split from `00.plan.md` (rules/docs.md §1). The 00.plan.md stub is the truth if
> the two disagree; update both in the same edit.

---

### Phase Y — Log: Threads-style 개인 마이크로피드 — M1 SHIPPED to main (2026-07-10) + UX 반복 진행 중 (2026-07-11)

> **제품의도:** 블로그 글쓰기의 격식(제목·카테고리·썸네일·마크다운) 없이 **짧은 한 줄 노트를 즉시 남기는 개인 스트림**. 각 유저가 자기 스트림을 갖고(`/log/[username]`), 누구나 남의 스트림을 읽는다. 오너가 지목한 레퍼런스 = **Meta Threads** — 단, **비주얼 문법만 채택**(단일 컬럼 텍스트 스트림 + 상단 인라인 작성창 + per-item 타임스탬프/작성자 + 답글), **소셜 머신러리는 배제**(팔로우 그래프·For-You/랭킹·리포스트/인용·미디어·DM·polls 전부 non-goal).
>
> **범위 = M1(오너 확정):** 최상위 Log 글(작성=소유자 전용) + **재귀 답글(무제한 깊이, 답글도 하나의 Log 노드 = self-ref)**, 누구나 답글 작성, 소프트삭제(작성자/글소유자/admin). 좋아요·팔로우·타임라인·수정(edit)은 M1 제외. 스펙트럼: M0(읽기전용 저널) → **M1(답글)** → M2(Threads-lite: 좋아요+팔로우+타임라인) → M3(Threads-full).
>
> **렌더링 = Threads/Twitter식 포커스-노드 뷰(오너 확정):** 데이터는 재귀 트리지만 한 화면에 전 트리를 그리지 않는다. 포커스("main log")마다 — **위: 루트→부모 조상 체인을 들여쓰기 없이 평면**으로("내가 지나온 경로"), **가운데: 포커스 노드**, **아래: 직속 답글(depth-1)만** keyset 페이징. 답글 클릭 → 그 답글이 새 포커스. 삭제된 노드 규칙: 삭제된 **조상**은 체인 유지 위해 `[deleted]` 마스킹해 **반드시 표시**; 삭제된 **직속 답글**은 살아있는 후손 있으면 마스킹 유지·없으면(죽은 리프) 숨김; 삭제된 **포커스**는 404 아님(마스킹+자식 정상).
>
> **아키텍처 결정 — 전용 self-ref `log` 테이블(Option B, 재사용 아님):** 답글은 정말 comments 성격이라 `comments`의 materialized-path 스레딩·인증·마스킹 idiom을 **복사**하되, Log **글은 블로그 post가 아니다** — `posts` 재사용 시 `slug`/`title` NOT-NULL 가짜값 + `kind<>'log'` 제외조건을 8개 `FROM posts` 쿼리 + `sitemap.ts`에 영구 삽입해야 하고 누락 시 SEO/피드 누출. 전용 테이블이면 제외조건 0개(구조적 격리), NULL 없음, 마이그레이션 1개. `comments.post_id NOT NULL REFERENCES posts(id)`(`0009:28`)가 재사용을 사실상 불가로 만드는 결정적 근거. 스키마: `log(id, user_id, parent_id self-FK, path BIGINT[], body≤500, created_at, deleted_at)` + 인덱스 3종(유저별 최상위 역순 / 직속 답글 / path GIN). `path`는 `comments 0009` 패턴 재사용 → 조상 조회 = `id = ANY(focus.path[1:-1])` 단일 PK 스캔(재귀 CTE 불필요). id는 BIGINT → **전 구간 문자열**.
>
> **M2/M3 전방호환(오너 요청 반영):** 핵심 `log` 노드는 M1 고정, 이후 확장은 전부 **주변 테이블 추가 or nullable ADD COLUMN** — M2 좋아요(`log_likes`)·팔로우(`follows`)·타임라인(쿼리만), M3 리포스트/인용(`repost_of_id`/`quote_of_id` ADD COLUMN)·미디어(`log_media`)·polls(`log_polls`)·reply_count(카운터 컬럼). `path` 컬럼과 전부 직교 → 파괴적 마이그레이션 0.
>
> **네이밍:** 앱에 이미 "feed"(Phase H 글 목록)가 있어 충돌 → 내부·UI·라우트·타입 전부 **`Log`**(테이블 `log`, 라우트 `/log/[username]`·`/log/[username]/[logId]`, API `/v1/api/log`, 타입 `TLog*`). "Threads"는 Meta 제품명이라 회피.
>
> **원자 태스크(T1–T12) = `00.tasks.md` Phase Y — 전량 구현·main 머지 완료.** 이후 UX 반복 SHIPPED
> (2026-07-10~11): 전역 `/log` 피드 + nav, canonical username 리다이렉트, depth-1+2 중첩 스레드 뷰,
> 답글 부모 @handle·자식답글 인디케이터, Threads풍 UI + 아바타 연결선, shadcn Avatar, 재귀 최신순
> 정렬 + indent cap 3 (`fdbbea2` 까지 main 머지). NB: 마이그레이션 번호 0022는 **블로그 DB 넘버링**
> (finance 0022 politician\_\*과 무관 — DB가 다름).

---

### Phase Y-TD — Log-as-todo (todo/done/overdue 개인 추적 레이어) — ENG DONE (2026-07-13, merged to main `83f401c`; PRIVATE 확정; ⚑마이그 0023 적용 게이트, T7 고의파손 검증 잔여)

> **의도:** 로그 한 줄을 **opt-in**으로 TODO로 승격해 소유자가 자기 스트림에서 todo/done/overdue를 추적.
> 별도 앱/라우트가 아닌 기존 `/log/[username]` 위의 레이어. 오너 원 요청 = "내 로그를 상태로 추적".
>
> **스키마(마이그레이션 0023, additive ADD COLUMN):** `log`에 nullable `due_at`/`done_at` 2컬럼만. **`due_at` 존재 = 이 로그가 todo**(별도 is_todo 플래그 없음). 상태는 **파생**(저장 안 함, `depth`가 `path`에서 파생되는 원칙과 동일): `done_at 있으면 done` / `due_at 없으면 none` / `due_at<now → overdue` / `else todo`. done이 overdue를 이김. 부분 인덱스 `(user_id, due_at) WHERE due_at IS NOT NULL AND done_at IS NULL AND deleted_at IS NULL` 하나로 3버킷 커버. SSOT 스냅샷 `packages/db/schema/tradelunch.schema.sql`의 log 블록에 미러.
>
> **공개 범위 = PRIVATE (architect+PM 공동 권고, ⚑오너 오버라이드 가능):** todo 필드는 **viewer==owner일 때만 서버가 직렬화**(클라 숨김이 아니라 비소유자 응답에 필드 자체 부재). 근거: 오너의 개인 추적 용도 + overdue 공개는 "실패 방송"이라 독자가치 낮고 되돌릴 수 없는 노출. private→public 전환은 projection 1줄 + TLog optional 필드로 언제든 가능(스키마 변경 0). M2 소셜 표면과 **완전 직교**(공유 `ROW_PROJECTION`이 feature-on일 때만 컬럼 포함, 클라가 소유자에게만 배지 렌더).
>
> **추적 표면:** 소유자 자기 `/log/[username]`의 필터 탭(전체|Todo|Done|Overdue + 카운트 배지) — PM안; 또는 전용 `GET /log/todos` 리스트 — architect안. body 불변 유지, **todo 메타데이터(due/done)만 가변 PATCH**(edit-없음 원칙과 무충돌). "오늘"은 클라 로컬 날짜를 필터 파라미터로 전달(자정 배치 불필요). 마감일 없는 todo는 overdue 불가.
>
> **API:** `PATCH /v1/api/log/:id/todo`(작성자 전용) + `GET /v1/api/log/todos`(소유자 스코프, status 필터, keyset). 전부 presence-guard(컬럼 존재 부팅 프로브 캐시). **페이징:** TD-1(지정+마감일+칩+done토글) → TD-2(필터 탭+카운트). 태스크 Y-TD-T1~T7 = `00.tasks.md`.

### Phase Y M2 — Log 소셜 최소셋 (좋아요 · 팔로우 · 크로노 타임라인) — ENG DONE (2026-07-13, merged to main `83f401c`; ⚑마이그 0024 적용 게이트, T9 고의파손 검증 잔여)

> **의도:** M1 전방호환 슬롯 실행 — Threads-lite 소셜 최소셋. M1 non-goal 유지(리포스트/인용·미디어·DM·polls·For-You/랭킹·**알림** 전부 제외).
>
> **스키마(마이그레이션 0024, 신규 주변 테이블 3종):** `log_likes`(PK(user_id,log_id) — post_likes 0008 미러, 라이브 COUNT, 카운터 비정규화 없음) + `follows`(방향 그래프, **소프트삭제 `deleted_at`** — 좋아요와 달리 팔로우는 감사가치 있어 tombstone; 재팔로우=`ON CONFLICT DO UPDATE SET deleted_at=NULL`; 셀프팔로우 CHECK 금지). 인덱스: like는 `(log_id)`, follow는 follower/followee 각 partial(live only).
>
> **타임라인(핵심, architect Option A=read-time fan-in 권고):** 팔로우한 유저들의 **최상위 로그만**, `id DESC` keyset(id 단조 IDENTITY라 크로노 정렬 유효), 랭킹/추천/fan-out 테이블 없음(YAGNI; 규모 커지면 Option B fan-out-on-write로 확장 여지). 좋아요 카운트+viewer 상태는 기존 stream/thread projection에 조건부 additive.
>
> **제품 결정(PM):** 좋아요=모든 live 노드(글+답글)·카운트만 공개(누가 눌렀나 리스트 제외)·셀프 허용; 팔로우=스트림 헤더 버튼+팔로워 수만(목록 페이지 제외); 타임라인=기존 `/log` 전역 피드에 `전체|팔로잉` 탭(새 라우트 없음, 팔로잉은 로그인 시만). 낙관적 토글+롤백. **페이징:** M2a(좋아요 단독 출시 가능) → M2b(팔로우+타임라인 한 묶음). 태스크 Y-M2-T1~T9 = `00.tasks.md`.
>
> **마이그레이션 순서(architect):** B(todo)=0023, A(social)=0024 — DDL 표면 분리(ADD COLUMN vs 신규 테이블)라 각각 독립 revert/배포 가능. 스키마 의존 없어 실제 출시 순서는 자유(파일명만 스왑). **오너 결정 2건:** ① todo 공개범위(공동권고=PRIVATE) ② 전체 착수 순서(PM권고=B먼저, 오너-gated).
