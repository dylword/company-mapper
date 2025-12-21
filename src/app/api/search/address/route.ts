import { NextResponse } from 'next/server';
import { fetchFromCompaniesHouse } from '@/lib/api-client';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');

    if (!location) {
        return NextResponse.json({ error: 'Location parameter is required' }, { status: 400 });
    }

    try {
        // Use advanced search to find companies at this location
        // Limit to 20 to avoid overwhelming the graph
        const data = await fetchFromCompaniesHouse(`/advanced-search/companies?location=${encodeURIComponent(location)}&size=20`);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Address search error:", error);
        return NextResponse.json({ error: error.message || "Failed to search address" }, { status: 500 });
    }
}
