async function testApi() {
    console.log("Searching for company...");
    const searchRes = await fetch('http://localhost:3000/api/search?q=THE%20CAR%20SALES%20FACTORY');
    const searchData = await searchRes.json();
    const company = searchData.items[0];
    console.log("Company:", company.company_number, company.company_name);

    const compRes = await fetch(`http://localhost:3000/api/company/${company.company_number}`);
    const compData = await compRes.json();
    
    console.log(`Found ${compData.officers?.length || 0} officers.`);
    
    if (compData.officers) {
        for (const off of compData.officers) {
            console.log(`\nOfficer: ${off.name} (${off.officer_id})`);
            if (off.officer_id) {
                const appRes = await fetch(`http://localhost:3000/api/officer/${off.officer_id}/appointments`);
                const appData = await appRes.json();
                console.log(`Appointments: ${appData.items?.length || 0}`);
                if (appData.items && appData.items.length > 0) {
                     console.log(JSON.stringify(appData.items[0], null, 2));
                     break; // Just one officer
                }
            }
        }
    }
}
testApi();
