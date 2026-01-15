Google 검색에 블로그를 등록하고 SEO를 활성화하는 절차를 단계별로 정리한다. Next.js 기준 포함.

⸻

1. Google Search Console 등록 (필수) 1. https://search.google.com/search-console 접속 2. 속성 추가
   • 도메인 방식 권장
   예: example.com 3. 소유권 인증
   • DNS 레코드 추가 (TXT)
   • 또는 HTML 파일 업로드
   • 또는 메타 태그

인증 완료 후 Google이 사이트를 크롤링 가능 상태로 인식.

출처
Google Search Console 공식 문서

⸻

2. 사이트맵(sitemap.xml) 생성 및 제출 (필수)

URL

https://your-domain.com/sitemap.xml

Next.js (App Router) 예시

// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
return [
{
url: 'https://your-domain.com',
lastModified: new Date(),
},
{
url: 'https://your-domain.com/blog',
lastModified: new Date(),
},
];
}

생성 후
Search Console → Sitemaps → sitemap.xml 제출

⸻

3. robots.txt 설정

위치

public/robots.txt

예시

User-agent: \*
Allow: /

Sitemap: https://your-domain.com/sitemap.xml

Googlebot 접근 허용 필수.

⸻

4. 메타데이터(SEO 핵심)

App Router (Next.js 13+)

// app/layout.tsx
export const metadata = {
title: {
default: 'My Tech Blog',
template: '%s | My Tech Blog',
},
description: 'System, backend, and distributed systems blog',
metadataBase: new URL('https://your-domain.com'),
openGraph: {
title: 'My Tech Blog',
description: 'System, backend, and distributed systems blog',
url: 'https://your-domain.com',
siteName: 'My Tech Blog',
type: 'website',
},
};

각 포스트 페이지에서 고유 title/description 필수.

⸻

5. 구조화 데이터 (권장)

BlogPosting Schema 추가.

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Post Title",
  "datePublished": "2025-01-01",
  "author": {
    "@type": "Person",
    "name": "Your Name"
  }
}
</script>

Google 검색 결과 노출 품질 개선.

⸻

6. URL 설계 원칙 (중요)
   • /blog/nextjs-seo-guide
   • kebab-case
   • 한 포스트 = 한 URL
   • query string 지양

⸻

7. 색인 요청 (즉시 노출 원할 때)

Search Console → URL 검사 → 색인 생성 요청

신규 글 게시 직후 사용.

⸻

8. 최소 품질 기준 (검색 미반영 방지)
   • SSR 또는 SSG (CSR only 페이지 불리)
   • 콘텐츠 300자 이상
   • <h1> 1개, <h2> 구조화
   • 이미지 alt 속성
   • 중복 콘텐츠 없음

⸻

9. 확인 방법
   • site:your-domain.com (Google 검색)
   • Search Console → Pages → Indexed 확인

⸻

요약 체크리스트
• Search Console 등록
• sitemap.xml 제출
• robots.txt 허용
• page별 title / description
• SSR/SSG
• 구조화 데이터

⸻

출처
Google SEO Starter Guide
https://developers.google.com/search/docs/fundamentals/seo-starter-guide
