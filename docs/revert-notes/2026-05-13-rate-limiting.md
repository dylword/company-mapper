# Companies House rate-limit handling — 2026-05-13

Companies House allows 600 requests per rolling 5-minute window per
application. Hitting it returns 429 and (per the docs) can get the app
banned if abused. This change adds:

1. A backend sliding-window tracker.
2. A pre-flight check in `fetchFromCompaniesHouse` that throws before
   blowing the budget.
3. A 429 JSON contract on every CH-backed API route.
4. A client `chFetch` wrapper that catches those 429s.
5. A `<RateLimitDialog>` with a live countdown to retry.

## Files added (delete to revert)

- `src/lib/rate-limit.ts`
- `src/lib/api-response.ts`
- `src/lib/client-fetch.ts`
- `src/app/api/rate-limit/status/route.ts`
- `src/components/RateLimitDialog.tsx`

## Files modified

### `src/lib/api-client.ts`

#### Now

```ts
import { rateLimit, RateLimitError } from './rate-limit';

export const COMPANIES_HOUSE_API_BASE = "https://api.company-information.service.gov.uk";

const requestCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 15;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export { RateLimitError };

export async function fetchFromCompaniesHouse(endpoint: string, retries = 3): Promise<any> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
    if (!apiKey) { /* ... */ }

    const cached = requestCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    rateLimit.assertCapacity();

    let delay = 2000;
    while (retries > 0) {
        rateLimit.record();
        const response = await fetch(/* ... */);
        if (response.ok) { /* cache + return */ }
        if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
            rateLimit.markExternal429(retryAfterMs);
            await sleep(delay);
            delay *= 2;
            retries--;
            continue;
        }
        throw new Error(/* ... */);
    }

    const status = rateLimit.getStatus();
    throw new RateLimitError(status.resetInMs, status.used);
}
```

#### Before

No `rateLimit.*` calls. Final fallthrough threw a plain
`Error("...429 Too Many Requests (Exhausted retries)...")`. The full original
file is preserved in git at `6b1a716:src/lib/api-client.ts`.

### `src/app/api/search/route.ts`, `.../search/address/route.ts`, `.../company/[id]/route.ts`, `.../officer/[id]/appointments/route.ts`

#### Now

Each `catch` block now calls `chErrorResponse(error)` from
`@/lib/api-response`, which returns 429 + structured JSON if the error
is a `RateLimitError`, else 500.

#### Before

```ts
} catch (error: any) {
    console.error(/* ... */);
    return NextResponse.json({ error: error.message || "..." }, { status: 500 });
}
```

To revert: replace each `return chErrorResponse(error);` with the
original `console.error` + `NextResponse.json({ error: ... }, { status: 500 })`
and remove the `import { chErrorResponse }` line.

### `src/components/GraphCanvas.tsx`, `NodeDetailsDialog.tsx`, `NodeDetailsPanel.tsx`

All `fetch(\`/api/...\`)` calls swapped for `chFetch(\`/api/...\`)`. Plus
`import { chFetch } from '@/lib/client-fetch';` at the top of each file.
`GraphCanvas` also renders `<RateLimitDialog />` alongside `<GraphCanvasContent />`
inside the `ReactFlowProvider`.

To revert these: `sed -i '' 's|await chFetch(|await fetch(|g'` on the three
files and delete the two added imports + the dialog mount.

## Tuning knobs (in `src/lib/rate-limit.ts`)

- `WINDOW_MS` — currently 5 minutes (CH's quoted window).
- `HARD_LIMIT` — 600 (CH's documented per-app cap).
- `SAFETY_MARGIN` — 20. We throw the dialog when the user is within 20 of
  the cap. Raise this to be more conservative; drop to 0 to use the full
  documented allowance.

## Caveats

- The tracker is **in-process**. Single Node server / single Vercel
  instance only. If the app is ever deployed multi-instance with one
  shared CH key, this needs to move into a shared store (Redis/Upstash).
- Cache hits are not counted against the budget (correct — they don't
  reach CH).
- If CH itself returns 429 despite our tracker showing capacity, we call
  `markExternal429` to backfill timestamps so the UI dialog reflects CH's
  view of the world, not ours.

## How to revert

1. Delete the 5 added files listed above.
2. Restore `src/lib/api-client.ts` to its pre-change form (`git show 6b1a716:src/lib/api-client.ts`).
3. Restore the four route `catch` blocks (above) and drop the
   `chErrorResponse` imports.
4. Swap `chFetch` → `fetch` in `GraphCanvas.tsx`, `NodeDetailsDialog.tsx`,
   `NodeDetailsPanel.tsx`, and remove the added imports + `<RateLimitDialog />` mount.
