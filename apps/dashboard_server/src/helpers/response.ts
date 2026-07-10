// helpers/response.ts
// Purpose: single place that shapes the { success, data } / { success, message }
// envelope so every route is consistent. Keep responses declarative in controllers.
import type { Response } from 'express';

export function sendOk<T>(res: Response, data: T, status = 200): void {
    res.status(status).json({ success: true, data });
}

export function sendError(
    res: Response,
    status: number,
    message: string,
    code?: string
): void {
    res.status(status).json({
        success: false,
        message,
        ...(code ? { code } : {}),
    });
}
