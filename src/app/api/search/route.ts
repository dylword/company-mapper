import { NextResponse } from "next/server";
import { fetchFromCompaniesHouse } from "@/lib/api-client";
import { chErrorResponse } from "@/lib/api-response";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q) {
        return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    try {
        const data = await fetchFromCompaniesHouse(`/search/companies?q=${encodeURIComponent(q)}&items_per_page=5`);
        return NextResponse.json(data);
    } catch (error: any) {
        return chErrorResponse(error);
    }
}
