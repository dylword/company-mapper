// Client-side fetch wrapper that catches structured 429 responses from our
// Next.js API routes and broadcasts them to any subscribed UI (the rate-limit
// dialog). Components keep using `await chFetch('/api/...')` exactly like
// they used `fetch(...)` and just `.json()` on the result.

export type RateLimitNotice = {
    retryAt: number; // epoch ms
    used: number;
    limit: number;
};

type Listener = (notice: RateLimitNotice) => void;
const listeners = new Set<Listener>();

export const rateLimitEvents = {
    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },
    emit(notice: RateLimitNotice) {
        listeners.forEach(l => l(notice));
    },
};

export class ClientRateLimitError extends Error {
    notice: RateLimitNotice;
    constructor(notice: RateLimitNotice) {
        super('Companies House rate limit reached');
        this.name = 'ClientRateLimitError';
        this.notice = notice;
    }
}

export async function chFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init);
    if (response.status === 429) {
        const body = await response.clone().json().catch(() => null);
        if (body?.rateLimited) {
            const notice: RateLimitNotice = {
                retryAt: body.retryAt ?? Date.now() + (body.retryAfterMs ?? 60_000),
                used: body.used ?? 0,
                limit: body.limit ?? 600,
            };
            rateLimitEvents.emit(notice);
            throw new ClientRateLimitError(notice);
        }
    }
    return response;
}
