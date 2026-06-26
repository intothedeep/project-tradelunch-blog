가능함. Cloudflare는 AWS S3 버킷을 원본(origin) 으로 지정해 프록시 역할을 수행할 수 있음.
방법은 크게 3가지로 나뉨.

⸻

1. Cloudflare R2로 마이그레이션 (권장)

S3 API 100% 호환이므로 코드 변경 거의 없음.
S3 대신 Cloudflare R2에 업로드/호출하면 네트워크 비용(egress) 무료.
S3 URI는 s3:// 대신 r2:// 형태로 대체 가능.

장점
• AWS egress 비용 없음
• Cloudflare 글로벌 CDN 캐싱
• API 동일 (PutObjectCommand, GetObjectCommand 그대로 사용 가능)

대응 코드 예

const r2 = new S3Client({
region: "auto",
endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
credentials: {
accessKeyId: process.env.CF_R2_ACCESS_KEY!,
secretAccessKey: process.env.CF_R2_SECRET_KEY!,
},
});

⸻

2. Cloudflare CDN이 AWS S3 Public Bucket을 프록시 (정적 리소스 제공용) 1. AWS S3 버킷을 Public Read로 설정 2. Cloudflare DNS에서 CNAME → S3 정적 웹사이트 엔드포인트 설정
   예:

assets.example.com CNAME my-bucket.s3.amazonaws.com

    3.	Cloudflare Proxy (orange cloud) 활성화

이렇게 하면 https://assets.example.com/... 요청이 S3로 전달되고 Cloudflare가 캐싱함.

제한
• 서명된 URL(Signed URL) 사용 불가
• Private S3 object 불가능

⸻

3. Cloudflare Worker로 S3 Private Bucket 프록시 (서명 요청 지원)

S3 버킷이 Private일 경우 Cloudflare Worker가 서명 요청을 생성하거나 S3 Signed URL로 redirect할 수 있음.

예시

export default {
async fetch(request, env) {
const url = new URL(request.url);
const key = url.pathname.substring(1);
const s3Url = `https://prettylog.posts.s3.amazonaws.com/${key}`;

    // Cloudflare Worker가 AWS S3로 요청 proxy
    const resp = await fetch(s3Url, {
      headers: { Authorization: `Bearer ${env.AWS_SIGNED_TOKEN}` },
    });

    return new Response(resp.body, resp);

},
};

→ Cloudflare는 Edge에서 요청을 서명 처리하거나 캐싱 가능.

장점
• AWS private bucket 그대로 유지
• Cloudflare global edge에서 캐싱
• 세밀한 접근 제어 가능

⸻

4. 요약 비교

방식 접근 제어 비용 캐싱 구현 난이도
R2 사용 완전 제어 ✅ 무료 egress ✅ 중
Cloudflare CDN + S3 Public ❌ Public만 ❌ S3 egress ✅ 쉬움
Cloudflare Worker Proxy ✅ Private 지원 ❌ S3 egress ✅ 높음

⸻

결론
• 단순 정적 파일 호스팅 → Cloudflare CDN + S3 Public
• 보안/비용 최적화 목적 → Cloudflare R2로 이전
• Private S3 유지하며 캐싱/서명 제어 → Cloudflare Worker 프록시

⸻

현재 URI:

s3://prettylog.posts/1/java/spring/jdbc/java-spring-jdbc/637897400245030912.png

→ Cloudflare를 통해 접근하려면 아래 중 하나로 변환해야 함:

환경 예시 URI
Cloudflare CDN (public) https://cdn.prettylog.com/1/java/spring/jdbc/java-spring-jdbc/637897400245030912.png
Cloudflare R2 https://<account>.r2.cloudflarestorage.com/prettylog.posts/...
Worker Proxy https://media.prettylog.com/api/s3/1/java/spring/jdbc/...
