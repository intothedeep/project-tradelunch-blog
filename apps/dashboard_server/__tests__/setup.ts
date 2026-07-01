// __tests__/setup.ts
// import { sequalizeP } from '@/src/db';

// // 전역 설정
// beforeAll(async () => {
//     // DB 연결 테스트
//     try {
//         await sequelizeP.authenticate();
//         console.log('✓ Database connected');
//     } catch (error) {
//         console.error('✗ Database connection failed:', error);
//         throw error;
//     }
// });

// afterAll(async () => {
//     // DB 연결 종료
//     await sequalizeP.close();
//     console.log('✓ Database disconnected');
// });

// // 전역 타임아웃 설정
// jest.setTimeout(10000);

// // 콘솔 에러 무시 (선택사항)
// global.console = {
//     ...console,
//     error: jest.fn(), // console.error 무시
//     warn: jest.fn(), // console.warn 무시
// };
