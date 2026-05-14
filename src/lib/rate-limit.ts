// Sliding-window tracker for the Companies House API rate limit.
//
// CH allows 600 requests per rolling 5-minute window per application. We keep
// a small safety margin so background prefetches / cache misses don't push us
// over the cliff right before the user hits "Expand Level 2".
//
// NOTE: This is in-process state. It works for a single Node server (dev,
// docker, single Vercel instance with `runtime: 'nodejs'`). In a horizontally
// scaled deployment each instance counts independently, so the budget is
// per-instance. If we ever go multi-instance with a single CH key, this
// should be moved into Redis / Upstash.

const WINDOW_MS = 5 * 60 * 1000;
const HARD_LIMIT = 600;
const SAFETY_MARGIN = 20;
export const EFFECTIVE_LIMIT = HARD_LIMIT - SAFETY_MARGIN;

const timestamps: number[] = [];

const prune = (now: number) => {
    const cutoff = now - WINDOW_MS;
    // timestamps is appended in order so we can shift from the front
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
        timestamps.shift();
    }
};

export class RateLimitError extends Error {
    retryAfterMs: number;
    used: number;
    limit: number;
    constructor(retryAfterMs: number, used: number) {
        super(`Companies House rate limit reached — retry in ${Math.ceil(retryAfterMs / 1000)}s`);
        this.name = 'RateLimitError';
        this.retryAfterMs = retryAfterMs;
        this.used = used;
        this.limit = EFFECTIVE_LIMIT;
    }
}

export const rateLimit = {
    /** Throws RateLimitError if a new request would exceed the safety budget. */
    assertCapacity() {
        const now = Date.now();
        prune(now);
        if (timestamps.length >= EFFECTIVE_LIMIT) {
            const oldest = timestamps[0];
            const retryAfterMs = Math.max(0, oldest + WINDOW_MS - now);
            throw new RateLimitError(retryAfterMs, timestamps.length);
        }
    },

    /** Record a request that was actually dispatched to Companies House. */
    record(timestamp: number = Date.now()) {
        timestamps.push(timestamp);
    },

    /** Snapshot the current window for diagnostics / the status endpoint. */
    getStatus() {
        const now = Date.now();
        prune(now);
        const used = timestamps.length;
        const remaining = Math.max(0, EFFECTIVE_LIMIT - used);
        const oldest = timestamps[0];
        const resetAt = oldest ? oldest + WINDOW_MS : now;
        return {
            used,
            remaining,
            limit: EFFECTIVE_LIMIT,
            hardLimit: HARD_LIMIT,
            windowMs: WINDOW_MS,
            resetAt,
            resetInMs: Math.max(0, resetAt - now),
        };
    },

    /** Force the window to consider the next request 429'd (used when CH itself returns 429). */
    markExternal429(retryAfterMs?: number) {
        const now = Date.now();
        const synthetic = retryAfterMs ? now - (WINDOW_MS - retryAfterMs) : now;
        for (let i = timestamps.length; i < EFFECTIVE_LIMIT; i++) {
            timestamps.push(synthetic);
        }
    },
};
