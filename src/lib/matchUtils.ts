import { Node } from 'reactflow';

// Helper to normalize strings for comparison
const normalize = (str?: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const extractSurname = (node: Node) => {
    const source = node.data.source;
    if (!source) return '';

    // PSCs usually have name_elements
    if (source.name_elements?.surname) {
        return normalize(source.name_elements.surname);
    }

    // Officers usually have a "SURNAME, Firstname" format
    if (source.name && source.name.includes(',')) {
        return normalize(source.name.split(',')[0]);
    }

    // Fallback just use the whole name if format is unknown
    return normalize(source.name);
};

const extractForename = (node: Node) => {
    const source = node.data.source;
    if (!source) return '';

    if (source.name_elements?.forename) {
        return normalize(source.name_elements.forename);
    }

    // Officers: "SURNAME, Firstname Middlename" — first token after the comma.
    if (source.name && source.name.includes(',')) {
        const after = source.name.split(',')[1] || '';
        const first = after.trim().split(/\s+/)[0] || '';
        return normalize(first);
    }

    // Fallback: first whitespace-separated token of the full name.
    if (source.name) {
        return normalize(source.name.trim().split(/\s+/)[0] || '');
    }
    return '';
};

const compareDates = (source1: any, source2: any) => {
    const d1 = source1?.date_of_birth || source1?.source?.date_of_birth;
    const d2 = source2?.date_of_birth || source2?.source?.date_of_birth;
    if (!d1 || !d2) return false;
    return d1.year === d2.year && d1.month === d2.month;
};

const compareNationalities = (source1: any, source2: any) => {
    const n1 = source1?.nationality || source1?.source?.nationality;
    const n2 = source2?.nationality || source2?.source?.nationality;
    if (!n1 || !n2) return false;
    return normalize(n1) === normalize(n2);
};

const comparePostcodes = (source1: any, source2: any) => {
    const getPC = (src: any) => src?.address?.postal_code || src?.source?.address?.postal_code;
    const pc1 = getPC(source1);
    const pc2 = getPC(source2);
    if (!pc1 || !pc2) return false;
    return normalize(pc1) === normalize(pc2);
};

export const processDuplicates = (nodes: Node[], edges: any[]) => {
    const people = nodes.filter(n => n.data.type === 'officer' || n.data.type === 'psc');
    const toMerge = new Map<string, string>(); // sourceId -> targetId (keep targetId)
    const probableMatches = new Map<string, string>();

    for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
            const nodeA = people[i];
            const nodeB = people[j];

            if (toMerge.has(nodeB.id) || toMerge.has(nodeA.id)) continue;
            if (nodeA.id === nodeB.id) continue;

            const surnameA = extractSurname(nodeA);
            const surnameB = extractSurname(nodeB);
            const sameSurname = surnameA === surnameB && surnameA !== '';

            const forenameA = extractForename(nodeA);
            const forenameB = extractForename(nodeB);
            const sameForename = forenameA === forenameB && forenameA !== '';

            const sameDob = compareDates(nodeA.data, nodeB.data);
            const sameNationality = compareNationalities(nodeA.data, nodeB.data);
            const samePostcode = comparePostcodes(nodeA.data, nodeB.data);

            let isDefinite = false;
            let isProbable = false;

            if (sameDob && sameSurname) {
                isDefinite = true;
            } else if (sameDob && sameNationality && samePostcode) {
                isDefinite = true;
            } else if (sameSurname && sameForename && samePostcode) {
                // Same full name at same postcode is treated as the same
                // person and auto-merged. Forename guard already excludes
                // family members sharing surname + home postcode.
                isDefinite = true;
            }

            if (isDefinite) {
                // Determine which id to keep, let's keep the officer if it exists
                if (nodeA.data.type === 'officer') {
                    toMerge.set(nodeB.id, nodeA.id);
                } else if (nodeB.data.type === 'officer') {
                    toMerge.set(nodeA.id, nodeB.id);
                } else {
                    toMerge.set(nodeB.id, nodeA.id);
                }
            } else if (isProbable) {
                probableMatches.set(nodeA.id, nodeB.id);
                probableMatches.set(nodeB.id, nodeA.id);
            }
        }
    }

    // Now merge nodes
    let consolidatedNodes = [...nodes];
    const nodesToRemove = new Set(toMerge.keys());

    // Merge data into target nodes
    toMerge.forEach((targetId, sourceId) => {
        const targetNode = consolidatedNodes.find(n => n.id === targetId);
        const sourceNode = consolidatedNodes.find(n => n.id === sourceId);

        if (targetNode && sourceNode) {
            // Found a definite match -> merge them.
            const merged = mergeNodes(targetNode, sourceNode);
            consolidatedNodes = consolidatedNodes.map(n => n.id === targetId ? merged : n);
        }
    });

    // Tag probable matches
    probableMatches.forEach((targetId, sourceId) => {
        if (!nodesToRemove.has(sourceId) && !nodesToRemove.has(targetId)) {
            consolidatedNodes = consolidatedNodes.map(n => {
                if (n.id === sourceId) {
                    return { ...n, data: { ...n.data, probableDuplicateOf: targetId } };
                }
                return n;
            });
        }
    });

    consolidatedNodes = consolidatedNodes.filter(n => !nodesToRemove.has(n.id));

    // Consolidate edges
    const remappedEdges = edges.map(edge => {
        let newSource = edge.source;
        let newTarget = edge.target;

        if (toMerge.has(newSource)) newSource = toMerge.get(newSource)!;
        if (toMerge.has(newTarget)) newTarget = toMerge.get(newTarget)!;

        return { ...edge, source: newSource, target: newTarget };
    });

    // Collapse duplicate edges (same source+target) that arise when an officer
    // and PSC referring to the same person were merged. Replace the two stacked
    // labels with a single combined "PSC & UBO" edge.
    const edgesByPair = new Map<string, any[]>();
    remappedEdges.forEach(edge => {
        const key = `${edge.source}->${edge.target}`;
        if (!edgesByPair.has(key)) edgesByPair.set(key, []);
        edgesByPair.get(key)!.push(edge);
    });

    const consolidatedEdges: any[] = [];
    edgesByPair.forEach((group) => {
        if (group.length === 1) {
            consolidatedEdges.push(group[0]);
            return;
        }

        const targetNode = consolidatedNodes.find(n => n.id === group[0].target);
        if (targetNode?.data?.isDualRole) {
            const pscEdge = group.find(e => e.label === 'PSC');
            const base = pscEdge || group[0];
            consolidatedEdges.push({
                ...base,
                label: 'PSC & UBO',
            });
        } else {
            consolidatedEdges.push(...group);
        }
    });

    return { nodes: consolidatedNodes, edges: consolidatedEdges };
};

export const mergeNodes = (primaryNode: Node, secondaryNode: Node): Node => {
    const isPrimaryOfficer = primaryNode.data.type === 'officer';
    const isSecondaryOfficer = secondaryNode.data.type === 'officer';
    const isPrimaryPsc = primaryNode.data.type === 'psc';
    const isSecondaryPsc = secondaryNode.data.type === 'psc';

    const officerSource = isPrimaryOfficer ? primaryNode.data.source : (isSecondaryOfficer ? secondaryNode.data.source : undefined);
    const pscSource = isPrimaryPsc ? primaryNode.data.source : (isSecondaryPsc ? secondaryNode.data.source : undefined);

    const mergedSource = {
        officer: officerSource,
        psc: pscSource,
    };

    // Sometimes primaryNode is already merged (e.g. multiple duplicates)
    // We should safely preserve previous sources if any
    if (primaryNode.data.isDualRole) {
        mergedSource.officer = primaryNode.data.source.officer || officerSource;
        mergedSource.psc = primaryNode.data.source.psc || pscSource;
    }

    const rolesSet = new Set(primaryNode.data.role?.split(' & '));
    if (secondaryNode.data.role) {
        secondaryNode.data.role.split(' & ').forEach((r: string) => rolesSet.add(r));
    }
    const combinedRoles = Array.from(rolesSet).join(' & ');

    return {
        ...primaryNode,
        data: {
            ...primaryNode.data,
            isDualRole: true,
            type: 'officer|psc',
            role: combinedRoles,
            source: mergedSource,
            probableDuplicateOf: undefined
        }
    };
};
