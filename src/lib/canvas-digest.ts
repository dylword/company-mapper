import { Node, Edge } from 'reactflow';

// Compact representation of the canvas for the AI investigator. Pre-computes
// the deterministic signals (shared addresses, cross-officer overlap, dual
// roles, etc.) locally so the model can spend its tokens on interpretation,
// not rediscovery. This is what lets Sonnet 4.6 do this job well — without it
// we'd be burning the reasoning budget on graph traversal.

export type DigestNode = {
    id: string;
    type: string;
    name: string;
    role?: string;
    status?: string;
    jurisdiction?: string;
    incorporated?: string;
    nationality?: string;
    sicCodes?: string[];
    addressKey?: string;
    address?: string;
};

export type DigestEdge = {
    from: string;
    to: string;
    label?: string;
};

export type DigestSignals = {
    sharedAddressClusters: { addressKey: string; address: string; nodeIds: string[] }[];
    dualRolePeople: { nodeId: string; name: string }[];
    dissolvedCompanies: { nodeId: string; name: string }[];
    recentlyIncorporated: { nodeId: string; name: string; date: string }[];
    overseasJurisdictions: { nodeId: string; name: string; jurisdiction: string }[];
};

export type CanvasDigest = {
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
    focus?: { id: string; name: string };
    nodes: DigestNode[];
    edges: DigestEdge[];
    signals: DigestSignals;
};

const TWO_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 2;

export function buildCanvasDigest(nodes: Node[], edges: Edge[]): CanvasDigest {
    const digestNodes: DigestNode[] = nodes
        .filter(n => n.type === 'businessCard')
        .map(n => {
            const d = n.data || {};
            const src = d.source || {};
            const inc = src.date_of_creation || src.incorporated_on;
            return {
                id: n.id,
                type: d.type || 'company',
                name: d.label || '(unknown)',
                role: d.role,
                status: d.status || src.company_status,
                jurisdiction: src.jurisdiction || src.country_of_residence,
                incorporated: inc,
                nationality: src.nationality,
                sicCodes: src.sic_codes,
                addressKey: d.addressKey,
                address: d.type === 'address' ? d.label : d.address,
            };
        });

    const digestEdges: DigestEdge[] = edges.map(e => ({
        from: e.source,
        to: e.target,
        label: typeof e.label === 'string' ? e.label : undefined,
    }));

    // Signals — computed deterministically so the model doesn't have to.
    const addressBuckets = new Map<string, { address: string; nodeIds: string[] }>();
    for (const n of digestNodes) {
        if (!n.addressKey) continue;
        const bucket = addressBuckets.get(n.addressKey);
        if (bucket) bucket.nodeIds.push(n.id);
        else addressBuckets.set(n.addressKey, { address: n.address || '', nodeIds: [n.id] });
    }
    const sharedAddressClusters = [...addressBuckets.entries()]
        .filter(([, v]) => v.nodeIds.length >= 2)
        .map(([addressKey, v]) => ({ addressKey, address: v.address, nodeIds: v.nodeIds }));

    const dualRolePeople = nodes
        .filter(n => n.data?.isDualRole)
        .map(n => ({ nodeId: n.id, name: n.data.label }));

    const dissolvedCompanies = digestNodes
        .filter(n => n.type === 'company' && (n.status || '').toLowerCase().includes('dissolved'))
        .map(n => ({ nodeId: n.id, name: n.name }));

    const now = Date.now();
    const recentlyIncorporated = digestNodes
        .filter(n => {
            if (n.type !== 'company' || !n.incorporated) return false;
            const t = Date.parse(n.incorporated);
            return !isNaN(t) && now - t < TWO_YEARS_MS;
        })
        .map(n => ({ nodeId: n.id, name: n.name, date: n.incorporated! }));

    const overseasJurisdictions = digestNodes
        .filter(n => {
            const j = (n.jurisdiction || '').toLowerCase();
            return j && !j.includes('united kingdom') && !j.includes('england') && !j.includes('scotland')
                && !j.includes('wales') && !j.includes('northern ireland') && j !== 'gb' && j !== 'uk';
        })
        .map(n => ({ nodeId: n.id, name: n.name, jurisdiction: n.jurisdiction! }));

    const focusNode = digestNodes.find(n => n.role === 'Target Company');

    return {
        generatedAt: new Date().toISOString(),
        nodeCount: digestNodes.length,
        edgeCount: digestEdges.length,
        focus: focusNode ? { id: focusNode.id, name: focusNode.name } : undefined,
        nodes: digestNodes,
        edges: digestEdges,
        signals: {
            sharedAddressClusters,
            dualRolePeople,
            dissolvedCompanies,
            recentlyIncorporated,
            overseasJurisdictions,
        },
    };
}

// Stable hash for change detection. djb2 over the JSON form. The exact
// algorithm doesn't matter — only that identical canvases produce identical
// hashes and small changes produce different ones.
export function hashDigest(digest: CanvasDigest): string {
    const json = JSON.stringify({
        nodes: digest.nodes,
        edges: digest.edges,
    });
    let h = 5381;
    for (let i = 0; i < json.length; i++) {
        h = ((h << 5) + h + json.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
}
