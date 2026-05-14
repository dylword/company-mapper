import { NextResponse } from 'next/server';
import { RateLimitError, rateLimit } from './rate-limit';

/**
 * Standard error mapper for Companies House route handlers. Returns a 429
 * with `{ rateLimited: true, retryAfterMs, retryAt, used, limit }` if we hit
 * the budget, otherwise a 500.
 */
export function chErrorResponse(error: any) {
    if (error instanceof RateLimitError) {
        const status = rateLimit.getStatus();
        return NextResponse.json(
            {
                error: 'rate_limited',
                rateLimited: true,
                retryAfterMs: error.retryAfterMs,
                retryAt: Date.now() + error.retryAfterMs,
                used: status.used,
                limit: status.limit,
            },
            {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil(error.retryAfterMs / 1000)) },
            }
        );
    }
    console.error('CH route error:', error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
}
