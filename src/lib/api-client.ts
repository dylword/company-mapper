export const COMPANIES_HOUSE_API_BASE = "https://api.company-information.service.gov.uk";

export async function fetchFromCompaniesHouse(endpoint: string) {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();

    if (!apiKey) {
        console.error("COMPANIES_HOUSE_API_KEY is missing in environment variables.");
        throw new Error("API Key missing");
    }

    // Log masked key for debugging
    console.log(`Using API Key: ${apiKey.substring(0, 4)}...`);

    const response = await fetch(`${COMPANIES_HOUSE_API_BASE}${endpoint}`, {
        headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
        },
        cache: "no-store", // Ensure fresh data
    });

    if (!response.ok) {
        throw new Error(`Companies House API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
