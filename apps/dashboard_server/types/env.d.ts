// apps/dashboard_server/types/env.d.ts
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production' | 'test' | 'local';
            PORT?: string;
            POSTGRES_URL?: string;
            POSTGRES_URL_NON_POOLING?: string;
            POSTGRES_PRISMA_URL?: string;
            // add other keys you expect
        }
    }
}
export {};
