import {
    DB_PG_DATABASE,
    DB_PG_HOST,
    DB_PG_PASSWORD,
    DB_PG_PORT,
    DB_PG_USER,
    EC2_HOST,
    EC2_USERNAME,
    IS_DEVELOPMENT,
    IS_LOCAL,
    NODE_ENV,
    SERVER_PORT,
} from '@/src/config/env.schema';

// Local SSH tunnel config shape (legacy dev convenience; tunnel manager retired).
interface SSHTunnelConfig {
    host: string;
    port: number;
    username: string;
    keyPath?: string;
    privateKey?: string;
    useAgent: boolean;
    dstHost: string;
    dstPort: number;
    localPort: number;
}

// src/config/env.ts
interface DatabaseConfig {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    endpoint?: string;
}

interface SSHConfig {
    host: string;
    port: number;
    username: string;
    keyPath?: string;
}

interface EnvironmentConfig {
    nodeEnv: 'development' | 'production' | 'test' | 'local';
    port: number;
    database: DatabaseConfig;
    ssh?: SSHConfig;
}

export const sshConfig: SSHTunnelConfig | undefined = (() => {
    if (IS_DEVELOPMENT) {
        return {
            host: EC2_HOST!,
            //   host: 'aws_20250627',
            port: 22,
            username: EC2_USERNAME || 'ec2-user',
            useAgent: true,

            //   keyPath: path.resolve(process.cwd(), 'src', AWS_RDS_CA!),

            dstHost: DB_PG_HOST!,
            dstPort: 5432,
            localPort: 5432,
        };
    }

    return undefined;
})();

export const databaseEnv: EnvironmentConfig = {
    nodeEnv: NODE_ENV || 'development',
    port: parseInt(String(SERVER_PORT) || '3000', 10),
    database: {
        host: IS_DEVELOPMENT ? 'localhost' : DB_PG_HOST!,
        port: parseInt(String(DB_PG_PORT) || '5432', 10),
        name: DB_PG_DATABASE!,
        user: DB_PG_USER!,
        password: DB_PG_PASSWORD!,
    },
    ssh: sshConfig,
};

export default databaseEnv;
