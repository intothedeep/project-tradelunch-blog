import { app } from './server';
import { SERVER_PORT, HOST_NAME } from './config/env.schema';
import { pool } from './database';
import { logger } from './lib/logger';

async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received`);
    try {
        await pool.end();
        process.exit(0);
    } catch (error) {
        logger.error({ err: error }, 'Shutdown error');
        process.exit(1);
    }
}

(async () => {
    try {
        app.listen(SERVER_PORT, () => {
            logger.info(
                `Backend listening on port http://${HOST_NAME}:${SERVER_PORT}/ping`
            );
        });

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.fatal({ err: error }, 'Server startup failed');
        process.exit(1);
    }
})();
