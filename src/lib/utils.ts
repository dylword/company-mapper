import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatCompanyType(type: string | undefined) {
  if (!type) return 'N/A';
  const map: Record<string, string> = {
    'ltd': 'Private Limited Company',
    'plc': 'Public Limited Company',
    'llp': 'Limited Liability Partnership',
    'limited-partnership': 'Limited Partnership',
    'private-limited-guarant-nsc': 'Private Limited by Guarantee',
    'private-limited-guarant-nsc-limited-exemption': 'Private Limited by Guarantee',
    'oversea-company': 'Overseas Company',
  };
  return map[type] || type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function formatJurisdiction(jurisdiction: string | undefined) {
  if (!jurisdiction) return 'N/A';
  const map: Record<string, string> = {
    'england-wales': 'England & Wales',
    'scotland': 'Scotland',
    'northern-ireland': 'Northern Ireland',
    'united-kingdom': 'United Kingdom',
    'great-britain': 'Great Britain',
  };
  return map[jurisdiction] || jurisdiction.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const sicCodes: Record<string, string> = {
  "62020": "Information technology consultancy activities",
  "62012": "Business and domestic software development",
  "62090": "Other information technology service activities",
  "62011": "Ready-made interactive leisure and entertainment software development",
  "70229": "Management consultancy activities other than financial management",
  "74909": "Other professional, scientific and technical activities n.e.c.",
  "82990": "Other business support service activities n.e.c.",
  "68209": "Other letting and operating of own or leased real estate",
  "68100": "Buying and selling of own real estate",
  "41100": "Development of building projects",
  "64209": "Activities of other holding companies n.e.c.",
  "64999": "Financial intermediation not elsewhere classified",
  "66190": "Activities auxiliary to financial services n.e.c.",
  "69102": "Solicitors",
  "69201": "Accounting and auditing activities",
  "69202": "Bookkeeping activities",
  "69203": "Tax consultancy",
  "86210": "General medical practice activities",
  "86220": "Specialist medical practice activities",
  "86230": "Dental practice activities",
  "47910": "Retail sale via mail order houses or via Internet",
  "47190": "Other retail sale in non-specialised stores",
  "47710": "Retail sale of clothing in specialised stores",
  "56101": "Licenced restaurants",
  "56102": "Unlicenced restaurants and cafes",
  "56302": "Public houses and bars",
  "55100": "Hotels and similar accommodation",
  "49410": "Freight transport by road",
  "52290": "Other transportation support activities",
  "43210": "Electrical installation",
  "43220": "Plumbing, heat and air-conditioning installation",
  "43390": "Other building completion and finishing",
  "43999": "Other specialised construction activities n.e.c.",
  "96020": "Hairdressing and other beauty treatment",
  "96090": "Other personal service activities n.e.c.",
  "93199": "Other sports activities",
  "93290": "Other amusement and recreation activities n.e.c.",
  "85590": "Other education n.e.c.",
  "85600": "Educational support activities",
  "88100": "Social work activities without accommodation for the elderly and disabled",
  "88990": "Other social work activities without accommodation n.e.c.",
  "90010": "Performing arts",
  "90020": "Support activities to performing arts",
  "90030": "Artistic creation",
  "32990": "Other manufacturing n.e.c.",
  "33120": "Repair of machinery",
  "33140": "Repair of electrical equipment",
  "45200": "Maintenance and repair of motor vehicles",
  "45111": "Sale of new cars and light motor vehicles",
  "45112": "Sale of used cars and light motor vehicles",
  "71111": "Architectural activities",
  "71121": "Engineering design activities for industrial process and production",
  "71122": "Engineering related scientific and technical consulting activities",
  "71129": "Other engineering activities",
  "73110": "Advertising agencies",
  "73120": "Media representation",
  "74100": "Specialised design activities",
  "74201": "Portrait photographic activities",
  "74202": "Other specialist photography",
  "74209": "Photographic activities not elsewhere classified",
  "74300": "Translation and interpretation activities",
  "78109": "Other activities of employment placement agencies",
  "78200": "Temporary employment agency activities",
  "78300": "Other human resources provision",
  "81100": "Combined facilities support activities",
  "81210": "General cleaning of buildings",
  "81221": "Window cleaning services",
  "81222": "Specialised cleaning services",
  "81223": "Furnace and chimney cleaning services",
  "81229": "Other building and industrial cleaning activities",
  "81299": "Other cleaning services",
  "81300": "Landscape service activities",
  "82110": "Combined office administrative service activities",
  "82190": "Photocopying, document preparation and other specialised office support activities",
  "82200": "Activities of call centres",
  "82301": "Activities of exhibition and fair organisers",
  "82302": "Activities of conference organisers",
  "82911": "Activities of collection agencies",
  "82912": "Activities of credit bureaus",
  "82920": "Packaging activities",
  "99999": "Dormant Company",
};

export function getSicDescription(code: string) {
  return sicCodes[code] || "Activity description not available";
}
