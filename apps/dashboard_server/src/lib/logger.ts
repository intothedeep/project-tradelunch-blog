// Purpose: the single pino instance. One JSON line per event on stdout; PM2
//   writes stdout to a file and the GCP Ops Agent tails it (deploy/logging).
// Invariants:
//   * `severity` carries the Cloud Logging level name, so the Ops Agent sets
//     the entry severity from the JSON field.
//   * `time` is ISO-8601; ops-agent.yaml `time_format` must match it.
//   * Auth/cookie headers are redacted even though the request serializer in
//     server.ts does not emit headers (defence in depth).
import pino from 'pino';
import { LOG_LEVEL } from '../config/env.schema';

const SEVERITY: Record<string, string> = {
    trace: 'DEBUG',
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'WARNING',
    error: 'ERROR',
    fatal: 'CRITICAL',
};

export const logger = pino({
    level: LOG_LEVEL,
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ severity: SEVERITY[label] ?? 'DEFAULT' }),
    },
    redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
    ],
});
