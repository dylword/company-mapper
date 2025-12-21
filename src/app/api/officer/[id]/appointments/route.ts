import { NextResponse } from "next/server";
import { fetchFromCompaniesHouse } from "@/lib/api-client";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // Fetch appointments
        // Note: The officer ID in the graph might need to be the actual officer ID from Companies House.
        // The previous implementation used `officer-${index}` which is NOT the real ID.
        // We need to ensure we are passing the real officer ID (links.officer.appointments usually contains it).
        // For now, let's assume the ID passed here is the real one.

        const data = await fetchFromCompaniesHouse(`/officers/${id}/appointments?items_per_page=50`);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Officer Appointments API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
