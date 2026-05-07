# Next.js 데이터 패칭 계층 가이드 (API vs Server Actions)

본 문서는 `dashboard_client_web` 프로젝트의 데이터 패칭 구조와 Next.js 14 환경에서의 최적화된 사용 방식을 정리한 가이드입니다.

## 1. 프로젝트의 데이터 패칭 3계층 구조

현재 프로젝트의 데이터 패칭 폴더는 크게 세 가지 계층으로 나뉘어 각자의 역할을 수행하고 있습니다.

### 1) `apis/` (핵심 비즈니스 로직)
- **역할:** 외부 백엔드 서버와 통신(예: `axios`)하기 위한 핵심 API 호출 공통 라이브러리.
- **특징:** 중복 코드를 방지하며 서버 컴포넌트, 서버 액션, 라우트 핸들러 어디서든 불러와(import) 사용할 수 있습니다.
- **예시:** `getPost.api.ts`, `getPosts.api.ts`

### 2) `app/actions/` (Next.js 서버 액션)
- **역할:** 클라이언트와 서버를 쉽게 연결해주는 RPC(Remote Procedure Call) 계층.
- **특징:** 최상단에 `'use server';` 지시어가 있으며, 별도의 REST API 엔드포인트 생성 없이 클라이언트 화면 요소(버튼, 폼 등)에서 일반 함수처럼 서버 측 코드를 직접 안전하게 호출할 수 있게 해줍니다.
- **예시:** `post.action.ts`

### 3) `app/api/` (Next.js 라우트 핸들러)
- **역할:** 전통적인 REST API 엔드포인트 생성 계층.
- **특징:** 외부 서비스 연동, 클라이언트 측 순수 `fetch` 호출 등을 위해 만들어지며 `route.ts` 파일을 사용해 HTTP 메서드(GET, POST 등)에 응답합니다.
- **예시:** `app/api/posts/load-more/route.ts`

---

## 2. 현재 프로젝트의 사용 사례 (우수 사례 활용)

현재 블로그 게시글 목록 페이지(`RecentPostsList`) 구현에서 **위 패턴들이 목적에 맞게 아주 훌륭하게 분배되어 사용**되고 있습니다.

1. **최초 로딩 속도 최적화 (서버 액션 활용):**
   - **위치:** `RecentPostsList.server.tsx` (서버 컴포넌트)
   - **설명:** 서버 렌더링 시점에 **서버 액션(`app/actions/post.action.ts`)**인 `loadMorePosts`를 미리 실행하여 첫 데이터 10개를 서버에서 즉시 그려냅니다. 덕분에 초기 로딩이 매우 빠르고 SEO에 유리합니다.
2. **무한 스크롤 동적 로딩 (API 라우트 활용):**
   - **위치:** `RecentPostsList.client.tsx` (클라이언트 컴포넌트)
   - **설명:** 사용자가 스크롤을 끝까지 내렸을 때 그다음 데이터를 가져오기 위해 **라우트 핸들러(`app/api/posts/load-more`)**로 HTTP `fetch` 요청을 보냅니다.
3. **공통 코어 사용:**
   - **위치:** `apis/getPosts.api.ts`
   - **설명:** 서버 액션과 API 라우트 모두 내부적으로 일관되게 `getBlogPostsByUsername` 함수를 재사용합니다.

---

## 3. Server Actions vs Route Handlers (어떤 것을 써야 할까?)

클라이언트 측(예: 무한 스크롤)에서 데이터를 추가 요청할 때, 기존의 API 라우트 방식(`fetch('/api/..')`)을 그대로 쓸지, 아니면 서버 액션(`post.action.ts`)으로 통일할지에 대한 비교입니다.

### Route Handler 유지 (`app/api/`)
* **장점:** 
  - 모바일 앱 등 Next.js가 아닌 외부 환경에서도 동일한 공용 API 주소로 호출 가능합니다.
  - 범용적인 HTTP 상태 코드 관리가 명확하며, GET 요청의 경우 CDN/Edge 레벨에서의 캐싱이 직관적입니다.
  - 무한 스크롤과 같은 "데이터 조회(Fetch)" 목적에 부합하는 전통적인 RESTful 방식입니다.

### Server Action 도입 (`app/actions/`)
* **장점:** 
  - `route.ts` 보일러 플레이트 코드를 완전히 삭제할 수 있어 **코드가 극적으로 간결해집니다.**
  - `fetch`나 `res.json()` 변환 없이, 클라이언트에서 바로 `import { loadMorePosts }`해서 쓸 수 있습니다.
  - 넘겨주는 인자와 리턴 받는 데이터의 타입(TypeScript)이 처음부터 끝까지 물 흐르듯 완벽히 추론됩니다.(End-to-End Type Safety)

**[💡 추천 가이드]**
이 대시보드가 **외부 연동이 필요 없는 순수 Next.js 웹 서비스**라면, 코드가 간결해지고 타입 안정성이 높은 **서버 액션(`app/actions/`) 방식 하나로 통일하는 것을 적극 추천** 문서화합니다. 즉, 굳이 `app/api/.../route.ts`를 만들지 않고 클라이언트 컴포넌트에서도 바로 서버 액션을 호출하는 방식이 최신 Next.js 생산성 향상 트렌드입니다.
