import { Node, Edge } from 'reactflow';

export interface PathHop {
    from: Node;
    to: Node;
    edge: Edge;
    // Plain-English sentence describing how `from` connects to `to`.
    sentence: string;
}

export interface ConnectionPath {
    root: Node;
    target: Node;
    hops: PathHop[];
    // Plain-text narrative ("X is connected to the target through …").
    narrative: string;
}

/**
 * BFS shortest undirected path from root to target through the edges array.
 * Returns null if root === target or no path exists.
 */
export function tracePath(
    rootId: string,
    targetId: string,
    nodes: Node[],
    edges: Edge[]
): ConnectionPath | null {
    if (!rootId || !targetId || rootId === targetId) return null;

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    if (!nodeById.has(rootId) || !nodeById.has(targetId)) return null;

    // Adjacency map: node id -> array of { neighbor, edge }
    const adj = new Map<string, { neighbor: string; edge: Edge }[]>();
    for (const edge of edges) {
        if (!adj.has(edge.source)) adj.set(edge.source, []);
        if (!adj.has(edge.target)) adj.set(edge.target, []);
        adj.get(edge.source)!.push({ neighbor: edge.target, edge });
        adj.get(edge.target)!.push({ neighbor: edge.source, edge });
    }

    // BFS storing the predecessor for each visited node.
    const prev = new Map<string, { from: string; edge: Edge }>();
    const visited = new Set<string>([rootId]);
    const queue: string[] = [rootId];

    while (queue.length) {
        const current = queue.shift()!;
        if (current === targetId) break;
        const neighbors = adj.get(current) || [];
        for (const { neighbor, edge } of neighbors) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            prev.set(neighbor, { from: current, edge });
            queue.push(neighbor);
        }
    }

    if (!prev.has(targetId)) return null;

    // Reconstruct path target → root, then reverse.
    const hops: PathHop[] = [];
    let cursor = targetId;
    while (cursor !== rootId) {
        const step = prev.get(cursor);
        if (!step) return null;
        const fromNode = nodeById.get(step.from)!;
        const toNode = nodeById.get(cursor)!;
        hops.unshift({
            from: fromNode,
            to: toNode,
            edge: step.edge,
            sentence: describeHop(fromNode, toNode, step.edge),
        });
        cursor = step.from;
    }

    return {
        root: nodeById.get(rootId)!,
        target: nodeById.get(targetId)!,
        hops,
        narrative: buildNarrative(nodeById.get(rootId)!, nodeById.get(targetId)!, hops),
    };
}

const cleanLabel = (label: any) => {
    if (!label || typeof label !== 'string') return 'Unknown';
    return label.trim();
};

const isProperId = (s: string) =>
    // Catch internal placeholder IDs like "officer-abc123" / "psc-0" / "address-1".
    /^(officer|psc|address|entity|note)-/i.test(s) || /^\d{8}$/.test(s);

const displayName = (node: Node): string => {
    const label = cleanLabel(node.data?.label);
    // If the label still looks like an internal ID (rare — usually means the
    // graph was hand-edited), fall back to the type.
    if (isProperId(label)) {
        const t = node.data?.type || 'entity';
        return `an unnamed ${t}`;
    }
    return label;
};

const describeHop = (from: Node, to: Node, edge: Edge): string => {
    const fromType = from.data?.type;
    const toType = to.data?.type;
    const fromName = displayName(from);
    const toName = displayName(to);
    const rawLabel = typeof edge.label === 'string' ? edge.label : '';
    const role = rawLabel || to.data?.role || '';

    // company → officer (or officer → company)
    if (fromType === 'company' && toType === 'officer') {
        const verb = role ? role.toLowerCase() : 'officer';
        return `${toName} is a ${verb} of ${fromName}.`;
    }
    if (fromType === 'officer' && toType === 'company') {
        const verb = role ? role.toLowerCase() : 'officer';
        return `${fromName} is also a ${verb} of ${toName}.`;
    }

    // company → psc / psc → company
    if (fromType === 'company' && toType === 'psc') {
        return `${toName} has significant control of ${fromName}.`;
    }
    if (fromType === 'psc' && toType === 'company') {
        return `${fromName} also has significant control of ${toName}.`;
    }

    // company ↔ address
    if (fromType === 'company' && toType === 'address') {
        return `${fromName} is registered at ${toName}.`;
    }
    if (fromType === 'address' && toType === 'company') {
        return `${toName} is also registered at ${fromName}.`;
    }

    // officer ↔ address (correspondence)
    if (fromType === 'officer' && toType === 'address') {
        return `${fromName}'s correspondence address is ${toName}.`;
    }
    if (fromType === 'address' && toType === 'officer') {
        return `${toName}'s correspondence address is ${fromName}.`;
    }

    // Fallback — generic
    return rawLabel
        ? `${fromName} → ${toName} (${rawLabel}).`
        : `${fromName} is connected to ${toName}.`;
};

const buildNarrative = (root: Node, target: Node, hops: PathHop[]): string => {
    if (hops.length === 0) return '';
    if (hops.length === 1) {
        return hops[0].sentence;
    }
    return hops.map(h => h.sentence).join(' ');
};

/**
 * Heuristic: find the originally searched company.
 * Preference order:
 *   1. A node with data.role === 'Target Company' (set in the initial fetch).
 *   2. The first company-type node in the array.
 */
export function findRootNodeId(nodes: Node[]): string | null {
    const target = nodes.find(n => n.data?.role === 'Target Company');
    if (target) return target.id;
    const firstCompany = nodes.find(n => n.data?.type === 'company');
    return firstCompany?.id || null;
}
