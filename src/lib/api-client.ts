export const COMPANIES_HOUSE_API_BASE = "https://api.company-information.service.gov.uk";

// Simple in-memory cache to prevent duplicate requests during deep network expansions
const requestCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchFromCompaniesHouse(endpoint: string, retries = 3): Promise<any> {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();

    if (!apiKey) {
        console.error("COMPANIES_HOUSE_API_KEY is missing in environment variables.");
        throw new Error("API Key missing");
    }

    // Check Cache
    const cached = requestCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    let delay = 2000; // Start with a 2-second delay if we hit 429
    
    while (retries > 0) {
        const response = await fetch(`${COMPANIES_HOUSE_API_BASE}${endpoint}`, {
            headers: {
                Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
            },
            cache: "no-store", // We manage our own memory cache for the bursts
        });

        if (response.ok) {
            const data = await response.json();
            requestCache.set(endpoint, { data, timestamp: Date.now() });
            return data;
        }

        if (response.status === 429) {
            console.warn(`[CH API] 429 Too Many Requests on ${endpoint}. Retrying in ${delay}ms...`);
            await sleep(delay);
            delay *= 2; // Exponential backoff (2s, 4s, 8s)
            retries--;
            continue;
        }

        throw new Error(`Companies House API Error: ${response.status} ${response.statusText}`);
    }

    throw new Error(`Companies House API Error: 429 Too Many Requests (Exhausted retries) on ${endpoint}`);
}
