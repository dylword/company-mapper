import type { Node, Edge } from "reactflow";
import { getSicDescription, formatDate } from "@/lib/utils";
import type { ExportOptions, ExportCounts } from "@/components/canvas/ExportOptionsDialog";

const includesType = (options: ExportOptions, nodeType: string | undefined) => {
    if (!nodeType) return false;
    if (nodeType === "company") return options.includeCompanies;
    if (nodeType === "officer") return options.includeOfficers;
    if (nodeType === "officer|psc") return options.includeOfficers || options.includePscs;
    if (nodeType === "psc") return options.includePscs;
    if (nodeType === "address") return options.includeAddresses;
    if (nodeType === "note") return options.includeNotes;
    return false;
};

const isNoteNode = (n: Node) => n.type === "noteNode" || n.data?.type === "note";

const dataType = (n: Node): string => {
    if (isNoteNode(n)) return "note";
    return n.data?.type || "company";
};

export const countsByType = (nodes: Node[], edges: Edge[]): ExportCounts => ({
    includeCompanies: nodes.filter(n => dataType(n) === "company").length,
    includeOfficers: nodes.filter(n => dataType(n) === "officer" || dataType(n) === "officer|psc").length,
    includePscs: nodes.filter(n => dataType(n) === "psc" || dataType(n) === "officer|psc").length,
    includeAddresses: nodes.filter(n => dataType(n) === "address").length,
    includeNotes: nodes.filter(n => dataType(n) === "note").length,
    includeEdges: edges.length,
});

// Restrict nodes/edges to the visible set when the user picks the "filtered"
// scope. Edges are kept only when both endpoints survive — otherwise the
// Connections tab grows dangling rows.
const applyScope = (
    nodes: Node[],
    edges: Edge[],
    options: ExportOptions,
    visibleNodeIds?: Set<string>,
): { nodes: Node[]; edges: Edge[] } => {
    if (options.scope !== "filtered" || !visibleNodeIds || visibleNodeIds.size === 0) {
        return { nodes, edges };
    }
    const scopedNodes = nodes.filter(n => visibleNodeIds.has(n.id));
    const scopedIds = new Set(scopedNodes.map(n => n.id));
    const scopedEdges = edges.filter(e => scopedIds.has(e.source) && scopedIds.has(e.target));
    return { nodes: scopedNodes, edges: scopedEdges };
};

const buildCompaniesRows = (nodes: Node[]) => nodes
    .filter(n => dataType(n) === "company")
    .map(n => {
        const sics = (n.data.source?.sic_codes || []).map((c: any) => String(c));
        return {
            "Company Name": n.data.label || "",
            "Company Number": n.id,
            "Status": n.data.status || "",
            "Incorporated": n.data.source?.date_of_creation ? formatDate(n.data.source.date_of_creation) : "",
            "Type": n.data.source?.type || n.data.role || "",
            "Nature of Business": sics.map((c: string) => `${c} - ${getSicDescription(c)}`).join("; "),
            "Registered Address": n.data.address || "",
            "Notes": n.data.notes || "",
        };
    });

const buildOfficersRows = (nodes: Node[]) => nodes
    .filter(n => dataType(n) === "officer" || dataType(n) === "officer|psc")
    .map(n => ({
        "Officer Name": n.data.label || "",
        "Role": n.data.role || "",
        "Nationality": n.data.nationality || "",
        "Country of Residence": n.data.country_of_residence || "",
        "Occupation": n.data.occupation || "",
        "Appointed On": n.data.appointed_on ? formatDate(n.data.appointed_on) : "",
        "Correspondence Address": n.data.address || "",
        "Officer ID": n.data.officer_id || "",
        "Notes": n.data.notes || "",
    }));

const buildPscsRows = (nodes: Node[]) => nodes
    .filter(n => dataType(n) === "psc" || dataType(n) === "officer|psc")
    .map(n => {
        const natures: string[] = n.data.source?.natures_of_control || [];
        return {
            "PSC Name": n.data.label || "",
            "Nationality": n.data.nationality || n.data.subtext || "",
            "Natures of Control": natures.map(s => s.split("-").join(" ")).join("; ") || n.data.role || "",
            "Country of Residence": n.data.source?.country_of_residence || "",
            "Notified On": n.data.source?.notified_on ? formatDate(n.data.source.notified_on) : "",
            "Notes": n.data.notes || "",
        };
    });

const buildAddressesRows = (nodes: Node[], edges: Edge[]) => nodes
    .filter(n => dataType(n) === "address")
    .map(n => {
        const linkedEntities = edges
            .filter(e => e.source === n.id || e.target === n.id)
            .map(e => {
                const otherId = e.source === n.id ? e.target : e.source;
                const other = nodes.find(x => x.id === otherId);
                return other?.data?.label;
            })
            .filter(Boolean);
        const src = n.data.source?.address || {};
        return {
            "Address": n.data.label || "",
            "Premises": src.premises || "",
            "Address Line 1": src.address_line_1 || "",
            "Address Line 2": src.address_line_2 || "",
            "Locality": src.locality || "",
            "Region": src.region || "",
            "Postal Code": src.postal_code || "",
            "Country": src.country || "",
            "Role": n.data.role || "",
            "Linked Entities": linkedEntities.join("; "),
        };
    });

const buildNotesRows = (nodes: Node[]) => nodes
    .filter(isNoteNode)
    .map(n => ({
        "Note": n.data.label || "",
        "X": Math.round(n.position?.x ?? 0),
        "Y": Math.round(n.position?.y ?? 0),
    }));

const buildConnectionsRows = (nodes: Node[], edges: Edge[], options: ExportOptions) => edges
    .filter(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) return false;
        return includesType(options, dataType(s)) && includesType(options, dataType(t));
    })
    .map(e => {
        const s = nodes.find(n => n.id === e.source)!;
        const t = nodes.find(n => n.id === e.target)!;
        return {
            "From": s.data.label || s.id,
            "From Type": dataType(s),
            "To": t.data.label || t.id,
            "To Type": dataType(t),
            "Relationship": (typeof e.label === "string" ? e.label : "") || "",
        };
    });

const buildCombinedRows = (nodes: Node[], edges: Edge[], options: ExportOptions) => {
    const rows: any[] = [];
    const allowedNodeIds = new Set(nodes.filter(n => includesType(options, dataType(n))).map(n => n.id));
    const companies = nodes.filter(n => dataType(n) === "company" && options.includeCompanies);

    companies.forEach(company => {
        const sics = (company.data.source?.sic_codes || []).map((c: any) => String(c));
        const sicString = sics.map((c: string) => `${c} - ${getSicDescription(c)}`).join("; ");

        const connected = edges.filter(e => e.source === company.id || e.target === company.id);
        const filteredConnected = options.includeEdges
            ? connected.filter(e => {
                const otherId = e.source === company.id ? e.target : e.source;
                return allowedNodeIds.has(otherId);
            })
            : [];

        if (filteredConnected.length === 0) {
            rows.push({
                "Company Name": company.data.label,
                "Company Number": company.id,
                "Company Status": company.data.status || "",
                "Nature of Business": sicString,
                "Company Address": company.data.address || "",
                "Connected Entity Name": "",
                "Connection Type": "",
                "Entity Type": "",
                "Entity Address": "",
                "Entity Details": "",
            });
            return;
        }

        filteredConnected.forEach(edge => {
            const otherId = edge.source === company.id ? edge.target : edge.source;
            const other = nodes.find(n => n.id === otherId);
            if (!other) return;
            rows.push({
                "Company Name": company.data.label,
                "Company Number": company.id,
                "Company Status": company.data.status || "",
                "Nature of Business": sicString,
                "Company Address": company.data.address || "",
                "Connected Entity Name": other.data.label,
                "Connection Type": edge.label || other.data.role || "",
                "Entity Type": dataType(other),
                "Entity Address": other.data.address || "",
                "Entity Details": other.data.subtext || "",
            });
        });
    });

    return rows;
};

// Sheets returned in the order the user is most likely to want them.
export interface ExportSheet { name: string; rows: any[]; }

export const buildExportSheets = (
    nodes: Node[],
    edges: Edge[],
    options: ExportOptions,
    visibleNodeIds?: Set<string>,
): ExportSheet[] => {
    const scoped = applyScope(nodes, edges, options, visibleNodeIds);
    const sheets: ExportSheet[] = [];
    const enabledTypeCount = (["includeCompanies", "includeOfficers", "includePscs", "includeAddresses", "includeNotes"] as const)
        .filter(k => options[k]).length;

    // Only include the Combined sheet when more than one type is selected — a
    // single-type export already lives on its own dedicated tab.
    if (enabledTypeCount > 1) {
        const combined = buildCombinedRows(scoped.nodes, scoped.edges, options);
        if (combined.length > 0) sheets.push({ name: "Combined", rows: combined });
    }

    if (options.includeCompanies) {
        const rows = buildCompaniesRows(scoped.nodes);
        if (rows.length > 0) sheets.push({ name: "Companies", rows });
    }
    if (options.includeOfficers) {
        const rows = buildOfficersRows(scoped.nodes);
        if (rows.length > 0) sheets.push({ name: "Officers", rows });
    }
    if (options.includePscs) {
        const rows = buildPscsRows(scoped.nodes);
        if (rows.length > 0) sheets.push({ name: "PSCs", rows });
    }
    if (options.includeAddresses) {
        const rows = buildAddressesRows(scoped.nodes, scoped.edges);
        if (rows.length > 0) sheets.push({ name: "Addresses", rows });
    }
    if (options.includeNotes) {
        const rows = buildNotesRows(scoped.nodes);
        if (rows.length > 0) sheets.push({ name: "Notes", rows });
    }
    if (options.includeEdges) {
        const rows = buildConnectionsRows(scoped.nodes, scoped.edges, options);
        if (rows.length > 0) sheets.push({ name: "Connections", rows });
    }

    return sheets;
};

export const buildFlatRows = (
    nodes: Node[],
    edges: Edge[],
    options: ExportOptions,
    visibleNodeIds?: Set<string>,
): any[] => {
    // CSV is single-tab — fall back to the Combined view, or to whichever
    // single-type sheet is selected.
    const sheets = buildExportSheets(nodes, edges, options, visibleNodeIds);
    const combined = sheets.find(s => s.name === "Combined");
    if (combined) return combined.rows;
    if (sheets.length > 0) return sheets[0].rows;
    return [];
};

export const filterForJson = (
    nodes: Node[],
    edges: Edge[],
    options: ExportOptions,
    visibleNodeIds?: Set<string>,
) => {
    const scoped = applyScope(nodes, edges, options, visibleNodeIds);
    const allowedNodes = scoped.nodes.filter(n => includesType(options, dataType(n)));
    const allowedIds = new Set(allowedNodes.map(n => n.id));
    const filteredEdges = options.includeEdges
        ? scoped.edges.filter(e => allowedIds.has(e.source) && allowedIds.has(e.target))
        : [];
    return { nodes: allowedNodes, edges: filteredEdges };
};
