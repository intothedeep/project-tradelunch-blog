pm2는 ESM 기반 또는 CommonJS 기반 Node.js 서버 모두 실행 가능하다. 실행 방식은 사용하는 모듈 시스템에 따라 다르다.

⸻

1. CommonJS일 경우 ("module": "CommonJS")

빌드 후 dist 실행:

pnpm --filter dashboard_server build
pm2 start dist/index.js --name server

개발 모드(ts-node 직접 실행, 비권장):

pm2 start "pnpm --filter dashboard_server dev" --name server

⸻

2. ESM일 경우 ("type": "module", "module": "ESNext")

TS는 반드시 빌드 후 실행해야 안정적이다.

pnpm --filter dashboard_server build
pm2 start dist/index.js --name server

만약 개발 중이라면 ts-node로 직접 실행할 수 있으나, ESM에선 pm2에서 직접 ts-node를 쓰는 것보다 ecosystem.config.js를 쓰는 게 안정적이다.

⸻

3. pm2 설정 파일 (권장 방식)

루트 또는 apps/server에 ecosystem.config.js 생성:

module.exports = {
apps: [
{
name: 'server',
script: 'dist/index.js', // 빌드 결과물 실행
cwd: './apps/server',
instances: 1,
autorestart: true,
watch: false,
max_memory_restart: '500M',
env: {
NODE_ENV: 'production'
}
}
]
}

실행:

pnpm --filter dashboard_server build
pm2 start ecosystem.config.js

로그 확인:

pm2 logs server

⸻

4. TypeScript를 직접 실행하고 싶을 때 (개발용)

개발 환경이라면 ts-node로 직접 실행 가능:

pm2 start "ts-node --esm src/index.ts" --name server

단, 프로덕션에서는 빌드 후 node dist/index.js 실행이 표준이다.

⸻

5. pm2 기본 명령어 요약

명령어 설명
pm2 start dist/index.js 프로세스 시작
pm2 list 실행 중인 프로세스 목록
pm2 logs server 로그 확인
pm2 restart server 재시작
pm2 stop server 정지
pm2 delete server 삭제
pm2 save 현재 상태 저장 (재부팅 후 자동 실행 가능)
pm2 startup OS 부팅 시 자동 시작 설정

⸻

결론
• CommonJS, ESM 모두 pm2 실행 가능.
• 프로덕션에서는 ts-node가 아닌 빌드된 dist/index.js 실행이 표준.
• 장기 실행 및 유지보수는 ecosystem.config.js 방식이 가장 안정적.
