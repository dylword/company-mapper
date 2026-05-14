import { NextResponse } from "next/server";
import { fetchFromCompaniesHouse } from "@/lib/api-client";
import { chErrorResponse } from "@/lib/api-response";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // 1. Fetch Company Profile
        const companyProfile = await fetchFromCompaniesHouse(`/company/${id}`);

        // 2. Fetch Officers
        const officersData = await fetchFromCompaniesHouse(`/company/${id}/officers?items_per_page=20`);

        // Extract officer ID from links
        const officers = (officersData.items || []).map((officer: any) => {
            const appointmentsLink = officer.links?.officer?.appointments;
            const officerId = appointmentsLink ? appointmentsLink.split('/')[2] : null;
            return {
                ...officer,
                officer_id: officerId,
                address: officer.address // Explicitly ensure address is passed, though ...officer likely covers it
            };
        });

        // 3. Fetch PSCs
        const pscData = await fetchFromCompaniesHouse(`/company/${id}/persons-with-significant-control?items_per_page=20`);

        // Consolidate
        return NextResponse.json({
            company: companyProfile,
            officers: officers,
            pscs: pscData.items || [],
        });
    } catch (error: any) {
        return chErrorResponse(error);
    }
}
