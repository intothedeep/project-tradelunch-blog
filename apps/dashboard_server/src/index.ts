import { app } from './server';
import { SERVER_PORT, HOST_NAME } from './config/env.schema';
import { pool } from './database';

async function shutdown(signal: string): Promise<void> {
    console.log(`${signal} received`);
    try {
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Shutdown error:', error);
        process.exit(1);
    }
}

(async () => {
    try {
        app.listen(SERVER_PORT, () => {
            console.log(
                `Backend listening on port http://${HOST_NAME}:${SERVER_PORT}/ping`
            );
        });

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
})();
