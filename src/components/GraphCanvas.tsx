"use client"

import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    MarkerType,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Background,
    Controls,
    Node,
    BackgroundVariant,
    Panel,
    useReactFlow,
    ReactFlowProvider,
    getRectOfNodes,
    getTransformForBounds,
    ConnectionMode,
    SelectionMode,
} from 'reactflow';
import { List, Search } from 'lucide-react';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';

import { Button } from "@/components/ui/button"
import BusinessCardNode from './nodes/BusinessCardNode';
import NoteNode from './nodes/NoteNode';
import FloatingEdge from './edges/FloatingEdge';
import { FilteredResultsPanel } from './FilteredResultsPanel';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { getLayoutedElements, DEFAULT_LAYOUT_OPTIONS } from '@/lib/layout';
import { tracePath, findRootNodeId } from '@/lib/connection-path';
import { cn, formatDate } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { processDuplicates, mergeNodes as mergeNodesUtil } from '@/lib/matchUtils';
import { chFetch } from '@/lib/client-fetch';
import RateLimitDialog from './RateLimitDialog';
import AIChatPanel from './AIChatPanel';
import FiltersMenu from './canvas/FiltersMenu';
import LayoutMenu from './canvas/LayoutMenu';
import SpacingMenu from './canvas/SpacingMenu';
import ExportMenu from './canvas/ExportMenu';
import HelpDialog from './canvas/HelpDialog';
import LoadingOverlay from './canvas/LoadingOverlay';
import CanvasToolPalette from './canvas/CanvasToolPalette';
import SelectionActionBar from './canvas/SelectionActionBar';
import DepthSelect from './canvas/DepthSelect';
import { CompanySearchBar } from './canvas/CompanySearchBar';
import ExportOptionsDialog, { ExportFormat, ExportOptions } from './canvas/ExportOptionsDialog';
import { buildExportSheets, buildFlatRows, countsByType, filterForJson } from '@/lib/export';
import SummaryCards from './canvas/SummaryCards';

const nodeTypes = {
    businessCard: BusinessCardNode,
    noteNode: NoteNode,
};

const edgeTypes = {
    floating: FloatingEdge,
};

function GraphCanvasContent() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');
    const { getNodes, getViewport, screenToFlowPosition, setCenter, fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    // Only start in a loading state if a search is actually pending — on a
    // fresh load with no `q` the canvas is just empty, not loading.
    const [loading, setLoading] = React.useState(!!query);
    const [loadingLabel, setLoadingLabel] = React.useState<string>("Searching Companies House…");
    const [error, setError] = React.useState<string | null>(null);
    const [layoutDirection, setLayoutDirection] = React.useState('FORCE');
    const [linkDistance, setLinkDistance] = React.useState<number>(DEFAULT_LAYOUT_OPTIONS.linkDistance);
    const [nodeSpacing, setNodeSpacing] = React.useState<number>(DEFAULT_LAYOUT_OPTIONS.nodeSpacing);
    const [searchedCompanyName, setSearchedCompanyName] = React.useState<string | null>(null);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            type: 'floating',
            animated: true,
            style: { stroke: '#000000' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
        }, eds)),
        [setEdges]
    );

    // Layout Handler
    const onLayout = useCallback(
        (direction: string, overrideOpts?: { linkDistance?: number; nodeSpacing?: number }) => {
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                nodes,
                edges,
                direction,
                {
                    linkDistance: overrideOpts?.linkDistance ?? linkDistance,
                    nodeSpacing: overrideOpts?.nodeSpacing ?? nodeSpacing,
                }
            );

            setNodes(layoutedNodes.map(n => ({ ...n, data: { ...n.data, onMerge: handleMergeNodes } })));
            setEdges([...layoutedEdges]);
            setLayoutDirection(direction);

            // Re-frame the viewport so the user sees the re-laid-out graph
            // instead of staring at the area they had panned to.
            window.requestAnimationFrame(() => {
                fitView({ padding: 0.2, duration: 400 });
            });
        },
        [nodes, edges, setNodes, setEdges, fitView, linkDistance, nodeSpacing]
    );

    const onSpacingChange = useCallback(
        (next: { linkDistance: number; nodeSpacing: number }) => {
            setLinkDistance(next.linkDistance);
            setNodeSpacing(next.nodeSpacing);
            onLayout(layoutDirection, next);
        },
        [onLayout, layoutDirection]
    );

    const onSpacingReset = useCallback(() => {
        const next = {
            linkDistance: DEFAULT_LAYOUT_OPTIONS.linkDistance,
            nodeSpacing: DEFAULT_LAYOUT_OPTIONS.nodeSpacing,
        };
        setLinkDistance(next.linkDistance);
        setNodeSpacing(next.nodeSpacing);
        onLayout(layoutDirection, next);
    }, [onLayout, layoutDirection]);

    const handleMergeNodes = useCallback((targetId: string, sourceId: string) => {
        setNodes(nds => {
            const targetNode = nds.find(n => n.id === targetId);
            const sourceNode = nds.find(n => n.id === sourceId);
            if (!targetNode || !sourceNode) return nds;

            const merged = mergeNodesUtil(targetNode, sourceNode);
            return nds.map(n => n.id === targetId ? merged : n).filter(n => n.id !== sourceId);
        });

        setEdges(eds => eds.map(e => {
            let s = e.source === sourceId ? targetId : e.source;
            let t = e.target === sourceId ? targetId : e.target;
            return { ...e, source: s, target: t };
        }));
    }, [setNodes, setEdges]);

    // Helper to deduplicate edges
    const deduplicateEdges = (edges: Edge[]) => {
        const seen = new Set();
        return edges.filter(edge => {
            if (seen.has(edge.id)) return false;
            seen.add(edge.id);
            return true;
        });
    };

    // Helper to format address
    const formatAddress = (addr: any) => {
        if (!addr) return undefined;
        return [
            addr.premises,
            addr.address_line_1,
            addr.address_line_2,
            addr.locality,
            addr.region,
            addr.postal_code,
            addr.country
        ].filter(Boolean).join(', ');
    };

    // Normalised key for address dedup. Companies House returns the same
    // premises with different structured fields across endpoints — the
    // registered-office payload typically has `premises: "Unit 4c"` +
    // `address_line_1: "Park Road"`, while officer correspondence merges them
    // into `address_line_1: "Unit 4c, Park Road"`. Concatenate premises +
    // line1 before normalising so both forms collapse to the same token, then
    // anchor on the postcode for identity.
    const norm = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizeAddressKey = (addr: any) => {
        if (!addr) return '';
        const pc = norm(addr.postal_code);
        const place = norm(`${addr.premises || ''} ${addr.address_line_1 || ''}`);
        if (pc) return `${pc}|${place}`;
        // Fall back to a fuller key when no postcode is available (rare).
        return [addr.premises, addr.address_line_1, addr.address_line_2, addr.locality, addr.region, addr.country]
            .filter(Boolean)
            .map(norm)
            .join('|');
    };

    useEffect(() => {
        if (!query) return;

        const fetchData = async () => {
            setLoadingLabel("Searching Companies House…");
            setLoading(true);
            setError(null);
            try {
                let companyNumber = query;

                if (query.length !== 8 || isNaN(Number(query))) {
                    const searchRes = await chFetch(`/api/search?q=${encodeURIComponent(query)}`);
                    const searchData = await searchRes.json();

                    if (searchData.error) {
                        throw new Error(searchData.error);
                    }

                    if (searchData.items && searchData.items.length > 0) {
                        companyNumber = searchData.items[0].company_number;
                    } else {
                        throw new Error("No company found");
                    }
                }

                const res = await chFetch(`/api/company/${companyNumber}`);
                const data = await res.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                const { company, officers, pscs } = data;
                setSearchedCompanyName(company?.company_name || null);

                // Create Nodes
                const companyNode: Node = {
                    id: company.company_number,
                    type: 'businessCard',
                    data: {
                        label: company.company_name,
                        role: 'Target Company',
                        type: 'company',
                        subtext: `Inc: ${formatDate(company.date_of_creation)}`,
                        status: company.company_status,
                        address: formatAddress(company.registered_office_address),
                        source: company // Store full source
                    },
                    position: { x: 0, y: 0 },
                };

                // Deduplicate officers
                const uniqueOfficerIds = new Set();
                const officerNodes: Node[] = [];

                officers.forEach((officer: any, index: number) => {
                    const id = `officer-${officer.officer_id || index}`;
                    if (!uniqueOfficerIds.has(id)) {
                        uniqueOfficerIds.add(id);
                        officerNodes.push({
                            id,
                            type: 'businessCard',
                            data: {
                                label: officer.name,
                                role: officer.officer_role,
                                type: 'officer',
                                subtext: officer.nationality,
                                officer_id: officer.officer_id, // Store ID for expansion
                                appointed_on: officer.appointed_on,
                                nationality: officer.nationality,
                                occupation: officer.occupation,
                                country_of_residence: officer.country_of_residence,
                                address: formatAddress(officer.address), // Store formatted address
                                source: officer // Store full source
                            },
                            position: { x: 0, y: 0 },
                        });
                    }
                });

                // Create Address Nodes for Officers
                const officerAddressNodes: Node[] = [];
                const officerAddressEdges: Edge[] = [];

                officers.forEach((officer: any, index: number) => {
                    if (officer.address) {
                        const addressLabel = formatAddress(officer.address);
                        if (!addressLabel) return;

                        const addressKey = normalizeAddressKey(officer.address);
                        const officerId = `officer-${officer.officer_id || index}`;

                        let addressNodeId: string;
                        const foundNode = officerAddressNodes.find(n => n.data.addressKey === addressKey);
                        const companyAddressKey = normalizeAddressKey(company.registered_office_address);

                        if (foundNode) {
                            addressNodeId = foundNode.id;
                        } else if (addressKey && addressKey === companyAddressKey) {
                            // Same premises as the registered office — reuse that node.
                            addressNodeId = 'address-1';
                        } else {
                            addressNodeId = `address-${index}-${officer.officer_id || index}`;
                            officerAddressNodes.push({
                                id: addressNodeId,
                                type: 'businessCard',
                                data: {
                                    label: addressLabel,
                                    role: 'Correspondence Address',
                                    type: 'address',
                                    addressKey,
                                    source: { address: officer.address }
                                },
                                position: { x: 0, y: 0 },
                            });
                        }

                        officerAddressEdges.push({
                            id: `e-${officerId}-${addressNodeId}`,
                            source: officerId,
                            target: addressNodeId,
                            type: 'floating',
                            animated: true,
                            label: 'Correspondence',
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                            style: { stroke: '#000000', strokeDasharray: '5,5' }, // Dashed for address?
                            labelBgStyle: { fill: '#f8fafc' },
                            labelStyle: { fill: '#64748b', fontWeight: 500 },
                        });
                    }
                });

                // Deduplicate PSCs
                const uniquePscIds = new Set();
                const pscNodes: Node[] = [];

                (pscs || []).forEach((psc: any, index: number) => {
                    const id = `psc-${index}`;
                    if (!uniquePscIds.has(id)) {
                        uniquePscIds.add(id);
                        pscNodes.push({
                            id,
                            type: 'businessCard',
                            data: {
                                label: psc.name,
                                role: psc.natures_of_control?.[0]?.split('-').join(' ') || 'Significant Control',
                                type: 'psc',
                                subtext: psc.nationality,
                                source: psc // Store full source
                            },
                            position: { x: 0, y: 0 },
                        });
                    }
                });

                // Address Node (from company profile)
                const addressNode: Node = {
                    id: 'address-1',
                    type: 'businessCard',
                    data: {
                        label: formatAddress(company.registered_office_address),
                        role: 'Registered Address',
                        type: 'address',
                        addressKey: normalizeAddressKey(company.registered_office_address),
                        source: company // Store company as source for address
                    },
                    position: { x: 0, y: 0 },
                };

                const newNodes = [companyNode, ...officerNodes, ...pscNodes, addressNode, ...officerAddressNodes];

                // Create Edges
                const rawEdges: Edge[] = [
                    ...officerNodes.map((node) => ({
                        id: `e-${companyNode.id}-${node.id}`,
                        source: companyNode.id,
                        target: node.id,
                        type: 'floating',
                        animated: true,
                        label: node.data.role, // Edge Label
                        style: { stroke: '#000000' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    })),
                    ...pscNodes.map((node) => ({
                        id: `e-${companyNode.id}-${node.id}`,
                        source: companyNode.id,
                        target: node.id,
                        type: 'floating',
                        animated: true,
                        label: 'PSC', // Edge Label
                        style: { stroke: '#f59e0b' }, // Amber stroke for PSCs
                        labelBgStyle: { fill: '#fffbeb' }, // Amber-50
                        labelStyle: { fill: '#d97706', fontWeight: 700 },
                    })),
                    {
                        id: `e-${companyNode.id}-address-1`,
                        source: companyNode.id,
                        target: addressNode.id,
                        type: 'floating',
                        animated: true,
                        label: 'Registered Office', // Edge Label
                        style: { stroke: '#000000' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    },
                    ...officerAddressEdges
                ];

                // Deduplicate edges just in case
                const uniqueEdges = new Map();
                rawEdges.forEach(edge => {
                    if (!uniqueEdges.has(edge.id)) {
                        uniqueEdges.set(edge.id, edge);
                    }
                });
                const newEdges = Array.from(uniqueEdges.values());

                const consolidated = processDuplicates(newNodes, newEdges);

                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                    consolidated.nodes,
                    consolidated.edges,
                    layoutDirection
                );

                setNodes(layoutedNodes.map(n => ({ ...n, data: { ...n.data, onMerge: handleMergeNodes } })));
                setEdges(layoutedEdges);
                setSelectedNode(companyNode);
            } catch (error: any) {
                console.error("Failed to fetch graph data", error);
                setError(error.message || "Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [query, setNodes, setEdges]);

    const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [isFilteredPanelOpen, setIsFilteredPanelOpen] = React.useState(false);
    const [visibleNodeIds, setVisibleNodeIds] = React.useState<Set<string>>(new Set());

    // Customization State
    const [customColor, setCustomColor] = React.useState<string>("");
    const [notes, setNotes] = React.useState<string>("");
    const [expansionLevel, setExpansionLevel] = React.useState<number>(1);

    const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
    const [sicFilters, setSicFilters] = React.useState<string[]>([]);
    const [sicSearchTerm, setSicSearchTerm] = React.useState<string>("");
    const [isSicDropdownOpen, setIsSicDropdownOpen] = React.useState<boolean>(false);
    
    const availableStatuses = useMemo(() => {
        const statuses = new Set<string>();
        nodes.forEach(n => {
            if (n.data.type === 'company' && n.data.status) {
                statuses.add(n.data.status);
            }
        });
        return Array.from(statuses).sort();
    }, [nodes]);

    const availableSics = useMemo(() => {
        const sics = new Set<string>();
        nodes.forEach(n => {
            if (n.data.type === 'company' && n.data.source?.sic_codes) {
                if (Array.isArray(n.data.source.sic_codes)) {
                    n.data.source.sic_codes.forEach((code: any) => sics.add(String(code)));
                }
            }
        });
        return Array.from(sics).sort();
    }, [nodes]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        setCustomColor(node.data.customColor || "");
        setNotes(node.data.notes || "");
        setIsDialogOpen(true);
    }, []);

    // Interaction Handlers
    const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
        setHoveredNodeId(node.id);
    }, []);

    const onNodeMouseLeave = useCallback((event: React.MouseEvent, node: Node) => {
        setHoveredNodeId(null);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        setIsDialogOpen(false);
    }, []);

    // Highlight effect
    useEffect(() => {
        const activeNodeId = hoveredNodeId || selectedNode?.id;

        const hasStatusFilter = statusFilters.length > 0;
        const hasSicFilter = sicFilters.length > 0;
        const visibleNodeIdsLocal = new Set<string>();
        const adjacency = new Map<string, Array<{ nodeId: string, edgeId: string }>>();
        
        edges.forEach(edge => {
            if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
            if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);

            adjacency.get(edge.source)?.push({ nodeId: edge.target, edgeId: edge.id });
            adjacency.get(edge.target)?.push({ nodeId: edge.source, edgeId: edge.id });
        });

        // 1. Calculate filter visibility
        if (hasStatusFilter || hasSicFilter) {
            const queue: string[] = [];
            nodes.forEach(n => {
                if (n.data.type === 'company') {
                    const matchesStatus = !hasStatusFilter || statusFilters.includes(n.data.status);
                    const companySics = (n.data.source?.sic_codes || []).map((c: any) => String(c));
                    const matchesSic = !hasSicFilter || sicFilters.some(sic => companySics.includes(sic));
                    
                    if (matchesStatus && matchesSic) {
                        queue.push(n.id);
                        visibleNodeIdsLocal.add(n.id);
                    }
                } else if (n.data.type === 'noteNode') {
                    visibleNodeIdsLocal.add(n.id);
                }
            });

            let head = 0;
            while (head < queue.length) {
                const currId = queue[head++];
                const neighbors = adjacency.get(currId) || [];

                for (const { nodeId: nid } of neighbors) {
                    if (!visibleNodeIdsLocal.has(nid)) {
                        const neighborNode = nodes.find(n => n.id === nid);
                        if (neighborNode && neighborNode.data.type !== 'company') {
                            visibleNodeIdsLocal.add(nid);
                            queue.push(nid);
                        }
                    }
                }
            }
        }

        // 2. Calculate hover visibility
        const connectedNodeIds = new Set<string>();
        const connectedEdgeIds = new Set<string>();

        if (activeNodeId) {
            const queue: string[] = [activeNodeId];
            connectedNodeIds.add(activeNodeId);

            while (queue.length > 0) {
                const currId = queue.shift()!;

                // Only the hovered node expands. Every neighbour is terminal —
                // otherwise hovering e.g. an address would pull in the
                // attached officer and then *all* of that officer's other
                // companies, even though those companies don't relate to the
                // address. With this rule a hover highlights exactly: the
                // node + its direct neighbours + the path back to the target
                // (added separately below).
                if (currId !== activeNodeId) {
                    continue;
                }

                const neighbors = adjacency.get(currId) || [];

                for (const { nodeId, edgeId } of neighbors) {
                    connectedEdgeIds.add(edgeId);

                    if (!connectedNodeIds.has(nodeId)) {
                        connectedNodeIds.add(nodeId);
                        queue.push(nodeId);
                    }
                }
            }

            edges.forEach(edge => {
                if (connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)) {
                    connectedEdgeIds.add(edge.id);
                }
            });

            // Also keep the path back to the originally-searched company at full
            // opacity, so the user can see how the hovered node ties back to the
            // search target without having to read each card.
            const rootId = findRootNodeId(nodes);
            if (rootId && rootId !== activeNodeId) {
                const path = tracePath(rootId, activeNodeId, nodes, edges);
                if (path) {
                    connectedNodeIds.add(path.root.id);
                    for (const hop of path.hops) {
                        connectedNodeIds.add(hop.from.id);
                        connectedNodeIds.add(hop.to.id);
                        connectedEdgeIds.add(hop.edge.id);
                    }
                }
            }
        }

        setVisibleNodeIds(visibleNodeIdsLocal);

        // 3. Apply opacity and styling
        setNodes((nds) => nds.map((node) => {
            let isFilteredOut = (hasStatusFilter || hasSicFilter) && !visibleNodeIdsLocal.has(node.id);
            const isConnectedToHover = connectedNodeIds.has(node.id);

            const isDimmed = isFilteredOut || (activeNodeId && !isConnectedToHover);
            const targetOpacity = isDimmed ? 0.2 : 1;

            if (node.style?.opacity === targetOpacity) return node;

            return {
                ...node,
                style: {
                    ...node.style,
                    opacity: targetOpacity,
                    transition: 'opacity 0.2s ease-in-out'
                }
            };
        }));

        setEdges((eds) => eds.map((edge) => {
            const isSourceFilteredOut = (hasStatusFilter || hasSicFilter) && !visibleNodeIdsLocal.has(edge.source);
            const isTargetFilteredOut = (hasStatusFilter || hasSicFilter) && !visibleNodeIdsLocal.has(edge.target);
            const isEdgeFilteredOut = isSourceFilteredOut || isTargetFilteredOut;

            const isEdgeHoverConnected = connectedEdgeIds.has(edge.id);

            const isDimmed = isEdgeFilteredOut || (activeNodeId && !isEdgeHoverConnected);
            const targetOpacity = isDimmed ? 0.1 : 1;
            const targetStroke = isDimmed ? '#cbd5e1' : (edge.label === 'PSC' ? '#f59e0b' : '#000000');

            if (edge.style?.opacity === targetOpacity && edge.style?.stroke === targetStroke) return edge;

            return {
                ...edge,
                style: {
                    ...edge.style,
                    opacity: targetOpacity,
                    stroke: targetStroke,
                    transition: 'opacity 0.2s ease-in-out'
                }
            };
        }));
    }, [hoveredNodeId, selectedNode?.id, statusFilters, sicFilters]); // using closure state - careful with infinite loops. ReactFlow nodes updates don't change object identities for un-updated nodes

    const handleSaveCustomization = () => {
        if (!selectedNode) return;

        setNodes((nds) => nds.map((node) => {
            if (node.id === selectedNode.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        customColor: customColor || undefined,
                        notes: notes || undefined,
                    }
                };
            }
            return node;
        }));
    };

    // Helper to fetch and expand a single node
    const expandSingleNode = async (nodeToExpand: Node, currentNodes: Node[], currentEdges: Edge[]) => {
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const allNeighbors: Node[] = []; // To track all found neighbors for recursion

        if (nodeToExpand.data.type?.includes('officer') && nodeToExpand.data.officer_id) {
            const res = await chFetch(`/api/officer/${nodeToExpand.data.officer_id}/appointments`);
            const data = await res.json();

            if (data.items) {
                const chunkSize = 10;
                let results: any[] = [];
                
                for (let i = 0; i < data.items.length; i += chunkSize) {
                    const chunk = data.items.slice(i, i + chunkSize);
                    const chunkPromises = chunk.map(async (item: any) => {
                        const nodeId = item.appointed_to.company_number;

                        // Always return the node info, even if it exists
                        try {
                            const existingNode = currentNodes.find(n => n.id === nodeId);
                            if (existingNode) {
                                return { item, company: existingNode.data.source, existingNode };
                            }

                            const companyRes = await chFetch(`/api/company/${nodeId}`);
                            const companyData = await companyRes.json();

                            if (companyData.company) {
                                return {
                                    item,
                                    company: companyData.company
                                };
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch details for company ${nodeId}`, err);
                        }

                        return { item, company: null };
                    });

                    const chunkResults = await Promise.all(chunkPromises);
                    results = results.concat(chunkResults);
                }

                results.forEach((result: any) => {
                    if (!result) return;

                    const { item, company, existingNode } = result;
                    const nodeId = item.appointed_to.company_number;

                    if (existingNode) {
                        allNeighbors.push(existingNode);
                        // Still check for edge?
                        const edgeId = `e-${nodeToExpand.id}-${nodeId}`;
                        if (!currentEdges.some(e => e.id === edgeId) && !newEdges.some(e => e.id === edgeId)) {
                            newEdges.push({
                                id: edgeId,
                                source: nodeToExpand.id,
                                target: nodeId,
                                type: 'floating',
                                animated: true,
                                label: item.officer_role,
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                                style: { stroke: '#000000' },
                                labelBgStyle: { fill: '#f8fafc' },
                                labelStyle: { fill: '#64748b', fontWeight: 500 },
                            });
                        }
                        return;
                    }

                    // Double check duplicates in new batch
                    if (newNodes.some(n => n.id === nodeId)) return;

                    // Address Linking
                    let addressEdge: Edge | null = null;
                    const itemAddress = item.address;
                    if (itemAddress) {
                        const addressKey = normalizeAddressKey(itemAddress);
                        const existingAddressNode = currentNodes.find(n => n.data.type === 'address' && n.data.addressKey === addressKey);
                        if (existingAddressNode) {
                            addressEdge = {
                                id: `e-${nodeId}-${existingAddressNode.id}`,
                                source: nodeId,
                                target: existingAddressNode.id,
                                type: 'floating',
                                animated: true,
                                label: 'Registered Office',
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                                style: { stroke: '#000000' },
                                labelBgStyle: { fill: '#f8fafc' },
                                labelStyle: { fill: '#64748b', fontWeight: 500 },
                            };
                        }
                    }

                    const newNode: Node = {
                        id: nodeId,
                        type: 'businessCard',
                        data: {
                            label: item.appointed_to.company_name,
                            role: company?.type || "Limited Company", // Fixed: Removed item.company_status fallback
                            type: 'company',
                            subtext: company ? `Inc: ${formatDate(company.date_of_creation)}` : `Appointed: ${formatDate(item.appointed_on)}`,
                            status: company?.company_status || item.company_status,
                            address: company ? formatAddress(company.registered_office_address) : formatAddress(itemAddress),
                            source: company || item.appointed_to
                        },
                        position: { x: 0, y: 0 },
                    };

                    newNodes.push(newNode);
                    allNeighbors.push(newNode);

                    newEdges.push({
                        id: `e-${nodeToExpand.id}-${nodeId}`,
                        source: nodeToExpand.id,
                        target: nodeId,
                        type: 'floating',
                        animated: true,
                        label: item.officer_role,
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                        style: { stroke: '#000000' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    });

                    if (addressEdge) newEdges.push(addressEdge);
                });
            }
        } else if (nodeToExpand.data.type === 'company') {
            const res = await chFetch(`/api/company/${nodeToExpand.id}`);
            const data = await res.json();

            if (data.officers) {
                data.officers.forEach((officer: any, index: number) => {
                    const officerId = officer.officer_id ? `officer-${officer.officer_id}` : `officer-${nodeToExpand.id}-${index}`;

                    const existingNode = currentNodes.find(n => n.id === officerId);
                    if (existingNode) {
                        allNeighbors.push(existingNode);
                        const edgeId = `e-${nodeToExpand.id}-${officerId}`;
                        if (!currentEdges.some(e => e.id === edgeId) && !newEdges.some(e => e.id === edgeId)) {
                            newEdges.push({
                                id: edgeId,
                                source: nodeToExpand.id,
                                target: officerId,
                                type: 'floating',
                                animated: true,
                                label: officer.officer_role,
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                                style: { stroke: '#000000' },
                                labelBgStyle: { fill: '#f8fafc' },
                                labelStyle: { fill: '#64748b', fontWeight: 500 },
                            });
                        }
                        // Check for address node even if officer exists? 
                        // If officer exists, their address node might not be loaded if they were loaded from a different context (unlikely in this app flow but possible).
                        // Let's skip for now to avoid complexity.
                        return;
                    }

                    if (newNodes.some(n => n.id === officerId)) return;

                    const newNode: Node = {
                        id: officerId,
                        type: 'businessCard',
                        data: {
                            label: officer.name,
                            role: officer.officer_role,
                            type: 'officer',
                            subtext: officer.nationality,
                            officer_id: officer.officer_id,
                            appointed_on: officer.appointed_on,
                            nationality: officer.nationality,
                            occupation: officer.occupation,
                            country_of_residence: officer.country_of_residence,
                            address: formatAddress(officer.address),
                            source: officer
                        },
                        position: { x: 0, y: 0 },
                    };

                    newNodes.push(newNode);
                    allNeighbors.push(newNode);

                    newEdges.push({
                        id: `e-${nodeToExpand.id}-${officerId}`,
                        source: nodeToExpand.id,
                        target: officerId,
                        type: 'floating',
                        animated: true,
                        label: officer.officer_role,
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                        style: { stroke: '#000000' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    });

                    // Add Address Node for this new officer
                    if (officer.address) {
                        const addressLabel = formatAddress(officer.address);
                        if (addressLabel) {
                            const addressKey = normalizeAddressKey(officer.address);
                            let addressNodeId = `address-${addressKey.slice(0, 32) || index}-${index}`;

                            const existingAddress = currentNodes.find(n => n.data.type === 'address' && n.data.addressKey === addressKey);
                            if (existingAddress) {
                                addressNodeId = existingAddress.id;
                            } else {
                                const newAddress = newNodes.find(n => n.data.type === 'address' && n.data.addressKey === addressKey);
                                if (newAddress) {
                                    addressNodeId = newAddress.id;
                                } else {
                                    const newAddressNode: Node = {
                                        id: addressNodeId,
                                        type: 'businessCard',
                                        data: {
                                            label: addressLabel,
                                            role: 'Correspondence Address',
                                            type: 'address',
                                            addressKey,
                                            source: { address: officer.address }
                                        },
                                        position: { x: 0, y: 0 },
                                    };
                                    newNodes.push(newAddressNode);
                                    allNeighbors.push(newAddressNode);
                                }
                            }

                            newEdges.push({
                                id: `e-${officerId}-${addressNodeId}`,
                                source: officerId,
                                target: addressNodeId,
                                type: 'floating',
                                animated: true,
                                label: 'Correspondence',
                                markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                                style: { stroke: '#000000', strokeDasharray: '5,5' },
                                labelBgStyle: { fill: '#f8fafc' },
                                labelStyle: { fill: '#64748b', fontWeight: 500 },
                            });
                        }
                    }
                });
            }
        } else if (nodeToExpand.data.type === 'address') {
            const res = await chFetch(`/api/search/address?location=${encodeURIComponent(nodeToExpand.data.label)}`);
            const data = await res.json();

            if (data.items) {
                data.items.forEach((company: any) => {
                    const nodeId = company.company_number;

                    const existingNode = currentNodes.find(n => n.id === nodeId);
                    if (existingNode) {
                        allNeighbors.push(existingNode);
                        return;
                    }

                    if (newNodes.some(n => n.id === nodeId)) return;

                    const newNode: Node = {
                        id: nodeId,
                        type: 'businessCard',
                        data: {
                            label: company.company_name,
                            role: company.company_status || "Company",
                            type: 'company',
                            subtext: `Inc: ${formatDate(company.date_of_creation)}`,
                            status: company.company_status,
                            address: nodeToExpand.data.label,
                            source: company
                        },
                        position: { x: 0, y: 0 },
                    };

                    newNodes.push(newNode);
                    allNeighbors.push(newNode);

                    newEdges.push({
                        id: `e-${nodeToExpand.id}-${nodeId}`,
                        source: nodeToExpand.id,
                        target: nodeId,
                        type: 'floating',
                        animated: true,
                        label: 'Registered At',
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#000000', width: 15, height: 15 },
                        style: { stroke: '#000000' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    });
                });
            }
        }

        return { newNodes, newEdges, allNeighbors };
    };

    const handleExpandNetwork = async () => {
        if (!selectedNode) return;
        setLoadingLabel(`Expanding network (${expansionLevel} ${expansionLevel === 1 ? "hop" : "hops"})…`);
        setLoading(true);
        setIsDialogOpen(false);

        try {
            let currentNodes = [...nodes];
            let currentEdges = [...edges];
            let nodesToExpand = [selectedNode];

            for (let i = 0; i < expansionLevel; i++) {
                const nextLevelNodes: Node[] = [];

                const chunkSize = 5;
                const expansionResults: { newNodes: Node[]; newEdges: Edge[]; allNeighbors: Node[] }[] = [];
                for (let j = 0; j < nodesToExpand.length; j += chunkSize) {
                    const chunk = nodesToExpand.slice(j, j + chunkSize);
                    const chunkResults = await Promise.all(
                        chunk.map(node => expandSingleNode(node, currentNodes, currentEdges))
                    );
                    expansionResults.push(...chunkResults);
                }

                for (const result of expansionResults) {
                    result.newNodes.forEach(node => {
                        if (!currentNodes.some(n => n.id === node.id) && !nextLevelNodes.some(n => n.id === node.id)) {
                            nextLevelNodes.push(node);
                        }
                    });
                    currentEdges.push(...result.newEdges);
                }

                // Re-aggregating nextLevelNodes from allNeighbors
                const potentialNextNodes: Node[] = [];
                for (const result of expansionResults) {
                    potentialNextNodes.push(...result.allNeighbors);
                }

                // Filter duplicates
                const uniqueNextNodes = [];
                const seenIds = new Set();
                for (const n of potentialNextNodes) {
                    if (!seenIds.has(n.id)) {
                        seenIds.add(n.id);
                        uniqueNextNodes.push(n);
                    }
                }

                // Update currentNodes with NEW nodes only
                currentNodes = [...currentNodes, ...nextLevelNodes];
                nodesToExpand = uniqueNextNodes; // Use unique neighbors for next level

                if (nodesToExpand.length === 0) break;
            }

            // Re-layout
            const currentEdgesDeduped = deduplicateEdges(currentEdges);
            const consolidated = processDuplicates(currentNodes, currentEdgesDeduped);

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                consolidated.nodes,
                consolidated.edges,
                layoutDirection
            );

            setNodes(layoutedNodes.map(n => ({ ...n, data: { ...n.data, onMerge: handleMergeNodes } })));
            setEdges(layoutedEdges);

        } catch (error) {
            console.error("Failed to expand", error);
        } finally {
            setLoading(false);
        }
    };

    const [canvasMode, setCanvasMode] = React.useState<'pan' | 'select'>('pan');
    const [exportFormat, setExportFormat] = React.useState<ExportFormat | null>(null);

    const handleRecolorSelected = useCallback((color: string | null) => {
        const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
        if (selectedIds.size === 0) return;
        setNodes(nds => nds.map(n => selectedIds.has(n.id)
            ? { ...n, data: { ...n.data, customColor: color || undefined } }
            : n
        ));
        if (selectedNode && selectedIds.has(selectedNode.id)) {
            setCustomColor(color || "");
            setSelectedNode((prev: any) => prev ? { ...prev, data: { ...prev.data, customColor: color || undefined } } : null);
        }
    }, [nodes, setNodes, selectedNode]);

    // Align the rectangle-selected nodes along a shared edge or axis. Works on
    // their bounding box so the result feels predictable regardless of order.
    // The perpendicular axis is also distributed evenly so aligned nodes don't
    // end up stacked on top of each other.
    const handleAlignSelected = useCallback((axis: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
        const selected = nodes.filter(n => n.selected);
        if (selected.length < 2) return;

        const left = Math.min(...selected.map(n => n.position.x));
        const right = Math.max(...selected.map(n => n.position.x + (n.width ?? 0)));
        const top = Math.min(...selected.map(n => n.position.y));
        const bottom = Math.max(...selected.map(n => n.position.y + (n.height ?? 0)));
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;

        const GAP = 32; // breathing room between distributed nodes
        const vertical = axis === 'left' || axis === 'center-h' || axis === 'right';

        // Order along the perpendicular axis and assign evenly-spaced slots so
        // nodes keep their relative order but never overlap.
        const slots = new Map<string, number>();
        const ordered = [...selected].sort((a, b) =>
            vertical ? a.position.y - b.position.y : a.position.x - b.position.x
        );
        const step = vertical
            ? Math.max(...selected.map(n => n.height ?? 0)) + GAP
            : Math.max(...selected.map(n => n.width ?? 0)) + GAP;
        const startCoord = vertical ? top : left;
        ordered.forEach((n, i) => slots.set(n.id, startCoord + i * step));

        const selectedIds = new Set(selected.map(n => n.id));
        setNodes(nds => nds.map(n => {
            if (!selectedIds.has(n.id)) return n;
            const w = n.width ?? 0;
            const h = n.height ?? 0;
            let { x, y } = n.position;
            switch (axis) {
                case 'left': x = left; break;
                case 'center-h': x = centerX - w / 2; break;
                case 'right': x = right - w; break;
                case 'top': y = top; break;
                case 'center-v': y = centerY - h / 2; break;
                case 'bottom': y = bottom - h; break;
            }
            // Distribute on the perpendicular axis.
            if (vertical) y = slots.get(n.id)!;
            else x = slots.get(n.id)!;
            return { ...n, position: { x, y } };
        }));
    }, [nodes, setNodes]);

    const handleDeleteSelected = () => {
        const selectedNodesIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
        if (selectedNodesIds.size === 0) return;

        setNodes(nds => nds.filter(n => !selectedNodesIds.has(n.id)));
        setEdges(eds => eds.filter(e => !selectedNodesIds.has(e.source) && !selectedNodesIds.has(e.target)));
        // If the currently viewed details panel corresponds to a deleted node, close it
        if (selectedNode && selectedNodesIds.has(selectedNode.id)) {
            setSelectedNode(null);
            setIsDialogOpen(false);
        }
    };

    const handleDeleteBranch = () => {
        const selectedNodesIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
        if (selectedNodesIds.size === 0) return;

        const nodesToDelete = new Set(selectedNodesIds);

        // Build adjacency to quickly find degrees
        const adjacency = new Map<string, string[]>();
        nodes.forEach(n => adjacency.set(n.id, []));

        edges.forEach(e => {
            if (adjacency.has(e.source) && adjacency.has(e.target)) {
                adjacency.get(e.source)!.push(e.target);
                adjacency.get(e.target)!.push(e.source);
            }
        });

        // Breadth-first-search style pruning to find sub-nodes that ONLY connect back to the nodes being deleted
        let addedNew = true;
        while (addedNew) {
            addedNew = false;

            for (const [nodeId, neighbors] of Array.from(adjacency.entries())) {
                if (!nodesToDelete.has(nodeId)) {
                    if (neighbors.length > 0) {
                        const allNeighborsBeingDeleted = neighbors.every(neighborId => nodesToDelete.has(neighborId));
                        if (allNeighborsBeingDeleted) {
                            nodesToDelete.add(nodeId);
                            addedNew = true;
                        }
                    }
                }
            }
        }

        setNodes(nds => nds.filter(n => !nodesToDelete.has(n.id)));
        setEdges(eds => eds.filter(e => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)));
        if (selectedNode && nodesToDelete.has(selectedNode.id)) {
            setSelectedNode(null);
            setIsDialogOpen(false);
        }
    };

    const exportFilename = (extension: string) => {
        const slug = (searchedCompanyName || query || 'company-map')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'company-map';
        const date = new Date().toISOString().slice(0, 10);
        return `${slug}-network-${date}.${extension}`;
    };

    // Chrome's hard canvas limit is ~16384px per side; we stay well under that
    // to leave headroom for memory pressure on lower-spec machines.
    const MAX_SCREENSHOT_DIMENSION = 12000;

    const downloadImage = (opts: { scale?: 1 | 2 | 4; fitVisible?: boolean } = {}) => {
        const scale = opts.scale ?? 2;
        const fitVisible = opts.fitVisible ?? false;

        const triggerDownload = (dataUrl: string) => {
            const link = document.createElement('a');
            link.download = exportFilename('png');
            link.href = dataUrl;
            link.click();
        };

        if (fitVisible) {
            const flowEl = document.querySelector('.react-flow') as HTMLElement | null;
            if (!flowEl) return;
            const rect = flowEl.getBoundingClientRect();
            const maxSide = Math.max(rect.width, rect.height);
            const safePixelRatio = Math.max(1, Math.min(scale, MAX_SCREENSHOT_DIMENSION / maxSide));
            toPng(flowEl, {
                backgroundColor: '#f8fafc',
                pixelRatio: safePixelRatio,
                filter: (node) => {
                    if (!(node instanceof HTMLElement)) return true;
                    return !node.classList.contains('react-flow__panel')
                        && !node.classList.contains('react-flow__controls')
                        && !node.classList.contains('react-flow__minimap');
                },
            }).then(triggerDownload);
            return;
        }

        const allNodes = getNodes();
        const nodesBounds = getRectOfNodes(allNodes);
        const padding = 80;
        const naturalWidth = nodesBounds.width + padding * 2;
        const naturalHeight = nodesBounds.height + padding * 2;

        // If the natural bounds exceed the safe canvas limit, shrink the DOM
        // (CSS transform) so the rasterised image stays within Chrome's budget.
        const naturalMax = Math.max(naturalWidth, naturalHeight);
        const domScale = naturalMax > MAX_SCREENSHOT_DIMENSION
            ? MAX_SCREENSHOT_DIMENSION / naturalMax
            : 1;

        const imageWidth = naturalWidth * domScale;
        const imageHeight = naturalHeight * domScale;

        // Pick the highest pixelRatio that keeps the output under the limit.
        const renderedMax = Math.max(imageWidth, imageHeight);
        const safePixelRatio = Math.max(1, Math.min(scale, MAX_SCREENSHOT_DIMENSION / renderedMax));

        const transform = getTransformForBounds(nodesBounds, imageWidth, imageHeight, domScale, domScale);

        const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!viewport) return;

        toPng(viewport, {
            backgroundColor: '#f8fafc',
            width: imageWidth,
            height: imageHeight,
            pixelRatio: safePixelRatio,
            style: {
                width: String(imageWidth),
                height: String(imageHeight),
                transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
            },
        }).then(triggerDownload);
    };

    const hasActiveFilter = statusFilters.length > 0 || sicFilters.length > 0;
    const allExportCounts = useMemo(() => countsByType(nodes, edges), [nodes, edges]);
    const filteredExportCounts = useMemo(() => {
        if (!hasActiveFilter || visibleNodeIds.size === 0) return allExportCounts;
        const scopedNodes = nodes.filter(n => visibleNodeIds.has(n.id));
        const scopedIds = new Set(scopedNodes.map(n => n.id));
        const scopedEdges = edges.filter(e => scopedIds.has(e.source) && scopedIds.has(e.target));
        return countsByType(scopedNodes, scopedEdges);
    }, [hasActiveFilter, visibleNodeIds, nodes, edges, allExportCounts]);

    const runExportCSV = (options: ExportOptions) => {
        const rows = buildFlatRows(nodes, edges, options, visibleNodeIds);
        if (rows.length === 0) return;
        const headers = Object.keys(rows[0]);
        const csvContent = [
            headers.join(","),
            ...rows.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || "")).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", exportFilename('csv'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const runExportExcel = async (options: ExportOptions) => {
        const sheets = buildExportSheets(nodes, edges, options, visibleNodeIds);
        if (sheets.length === 0) return;
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();
        sheets.forEach(({ name, rows }) => {
            const worksheet = XLSX.utils.json_to_sheet(rows);
            const headers = Object.keys(rows[0] || {});
            worksheet['!cols'] = headers.map(h => {
                const maxLen = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
                return { wch: Math.min(60, Math.max(12, maxLen + 2)) };
            });
            // XLSX caps sheet names at 31 chars and disallows certain characters.
            const safe = name.replace(/[\\\/?*\[\]:]/g, '_').slice(0, 31);
            XLSX.utils.book_append_sheet(workbook, worksheet, safe);
        });
        XLSX.writeFile(workbook, exportFilename('xlsx'));
    };

    const runExportJSON = (options: ExportOptions) => {
        const { nodes: filteredNodes, edges: filteredEdges } = filterForJson(nodes, edges, options, visibleNodeIds);
        const payload = {
            metadata: {
                exportedAt: new Date().toISOString(),
                searchQuery: query || null,
                searchedCompanyName: searchedCompanyName || null,
                layoutDirection,
                linkDistance,
                nodeSpacing,
                nodeCount: filteredNodes.length,
                edgeCount: filteredEdges.length,
                exportOptions: options,
            },
            nodes: filteredNodes.map(n => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: n.data,
            })),
            edges: filteredEdges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                type: e.type,
                data: e.data,
            })),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: 'application/json;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', exportFilename('json'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportConfirm = (options: ExportOptions) => {
        if (exportFormat === 'csv') runExportCSV(options);
        else if (exportFormat === 'excel') runExportExcel(options);
        else if (exportFormat === 'json') runExportJSON(options);
    };

    const handleAddNode = useCallback((type: 'entity' | 'note') => {
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

        const position = screenToFlowPosition({
            x: windowWidth / 2,
            y: windowHeight / 2,
        });

        const newNodeId = `${type}-${Date.now()}`;
        const newNode: Node = {
            id: newNodeId,
            type: type === 'entity' ? 'businessCard' : 'noteNode',
            position,
            data: type === 'entity' ? {
                label: 'New Entity',
                role: 'Custom',
                type: 'company',
                isCustom: true,
            } : {
                label: '',
            }
        };

        setNodes((nds) => [...nds, newNode]);
    }, [screenToFlowPosition, setNodes]);

    if (error) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-sm border border-red-100">
                    <h3 className="text-lg font-bold text-red-600 mb-2">Error Loading Data</h3>
                    <p className="text-slate-600 mb-4">{error}</p>
                    <p className="text-xs text-slate-400">Please check your API Key in .env.local</p>
                </div>
            </div>
        );
    }

    const focusNode = React.useCallback((node: Node) => {
        setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 800 });
        setSelectedNode(node);
        setIsDialogOpen(true);
        setIsFilteredPanelOpen(false);
    }, [setCenter]);

    // "Home" — recentre on a node without opening the details dialog, used by
    // the target summary card so clicking the card feels like a navigation,
    // not a drill-down.
    const homeToNode = React.useCallback((node: Node) => {
        setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 600 });
    }, [setCenter]);

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
            {/* Main Header Container */}
            <header className="flex-none bg-white border-b border-slate-200">
                <div className="px-4 py-4 flex items-start justify-between gap-6">
                    {/* Left side: Title and Tabs */}
                    <div className="flex flex-col space-y-4 min-w-0">
                        {/* Title */}
                        <div className="flex items-center">
                            <h1 className="text-[20px] font-bold tracking-tight text-[#132B5C]">Company Explorer</h1>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center space-x-6">
                            <button className="text-[13px] font-bold text-[#132B5C] border-b-2 border-[#132B5C] pb-2 uppercase tracking-wide">
                                Network Analysis
                            </button>
                            <button className="text-[13px] font-bold text-slate-400 pb-2 uppercase tracking-wide hover:text-slate-600 transition-colors">
                                OSINT Search
                            </button>
                        </div>
                    </div>

                    {/* Middle: condensed summary cards (target + canvas stats) */}
                    <div className="flex-1 flex items-center justify-center min-w-0 pt-2">
                        <SummaryCards
                            nodes={nodes}
                            edges={edges}
                            onTargetClick={homeToNode}
                        />
                    </div>

                    {/* Right side: Search Field */}
                    <div className="flex items-center pt-2">
                        <CompanySearchBar />
                    </div>
                </div>

                {/* Compact toolbar — workflow ordered: Filter → Expand → Layout → View → Export */}
                <div className="w-full bg-slate-50 border-t border-slate-200 flex items-center gap-3 px-4 h-12 relative z-50">
                    <FiltersMenu
                        availableStatuses={availableStatuses}
                        availableSics={availableSics}
                        statusFilters={statusFilters}
                        sicFilters={sicFilters}
                        onToggleStatus={(s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                        onAddSic={(s) => setSicFilters(prev => [...prev, s])}
                        onRemoveSic={(s) => setSicFilters(prev => prev.filter(x => x !== s))}
                        onClearAll={() => { setStatusFilters([]); setSicFilters([]); }}
                    />

                    <div className="w-px h-5 bg-slate-200" />

                    {/* Combined Depth + Expand control — the primary action */}
                    <div className="inline-flex items-stretch h-8 rounded-md border border-[#132B5C] overflow-hidden shadow-sm">
                        <div className="border-r border-slate-200 flex">
                            <DepthSelect value={expansionLevel} onChange={setExpansionLevel} />
                        </div>
                        <button
                            onClick={handleExpandNetwork}
                            disabled={!selectedNode || loading}
                            className="inline-flex items-center gap-1 px-3 bg-[#132B5C] text-white text-xs font-semibold hover:bg-[#0d1f44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={selectedNode ? `Expand ${selectedNode.data.label}` : "Select a node to expand"}
                        >
                            <Search className="h-3.5 w-3.5" />
                            {loading ? "Expanding…" : "Expand"}
                        </button>
                    </div>

                    <div className="w-px h-5 bg-slate-200" />

                    <LayoutMenu onApply={(d) => onLayout(d)} current={layoutDirection} />

                    <SpacingMenu
                        linkDistance={linkDistance}
                        nodeSpacing={nodeSpacing}
                        onChange={onSpacingChange}
                        onReset={onSpacingReset}
                    />

                    <div className="flex-1" />

                    <button
                        onClick={() => setIsFilteredPanelOpen(!isFilteredPanelOpen)}
                        className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                            isFilteredPanelOpen
                                ? "bg-[#132B5C] text-white border-[#132B5C] hover:bg-[#0d1f44]"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                        title="Toggle filtered results sidebar"
                    >
                        <List className="h-3.5 w-3.5" />
                        Results
                    </button>

                    <ExportMenu
                        onExportCSV={() => setExportFormat('csv')}
                        onExportExcel={() => setExportFormat('excel')}
                        onExportJSON={() => setExportFormat('json')}
                        onDownloadScreenshot={downloadImage}
                    />

                    <HelpDialog />

                </div>
            </header>

            {/* Canvas Area */}
            <div className="flex-1 relative bg-slate-50 w-full">
                <ReactFlow
                    nodes={nodes}
                    edgeTypes={edgeTypes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onNodeMouseEnter={onNodeMouseEnter}
                    onNodeMouseLeave={onNodeMouseLeave}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    isValidConnection={() => true}
                    connectionMode={ConnectionMode.Loose}
                    // Select a node if the rectangle touches any part of it,
                    // not only when it fully encloses the node.
                    selectionMode={SelectionMode.Partial}
                    // In "select" mode left-drag draws a rectangle and pan is
                    // restricted to middle-mouse. Back to defaults in "pan" mode.
                    selectionOnDrag={canvasMode === 'select'}
                    panOnDrag={canvasMode === 'select' ? [1, 2] : true}
                    fitView
                    className={cn("bg-slate-50", canvasMode === 'select' && "cursor-crosshair")}
                >
                    <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
                    <Controls className="bg-white border-slate-200 shadow-sm text-slate-900" />
                    <SelectionActionBar
                        nodes={nodes}
                        onDelete={handleDeleteSelected}
                        onDeleteBranch={handleDeleteBranch}
                        onExpand={handleExpandNetwork}
                        canExpand={!!selectedNode && !loading}
                        onRecolor={handleRecolorSelected}
                        onAlign={handleAlignSelected}
                    />
                </ReactFlow>
                <CanvasToolPalette
                    onAddNode={handleAddNode}
                    mode={canvasMode}
                    onModeChange={setCanvasMode}
                />
                <LoadingOverlay active={loading} label={loadingLabel} />
            </div>

            <NodeDetailsPanel
                node={selectedNode}
                isOpen={isDialogOpen}
                nodes={nodes}
                edges={edges}
                onClose={() => setIsDialogOpen(false)}
                onExpand={handleExpandNetwork}
                onSave={(color, notes) => {
                    setCustomColor(color);
                    setNotes(notes);

                    setNodes((nds) => nds.map((node) => {
                        if (node.id === selectedNode?.id) {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    customColor: color || undefined,
                                    notes: notes || undefined,
                                }
                            };
                        }
                        return node;
                    }));
                }}
                onNodeUpdate={(updatedData) => {
                    setNodes((nds) => nds.map((node) => {
                        if (node.id === selectedNode?.id) {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    ...updatedData
                                }
                            };
                        }
                        return node;
                    }));
                    setSelectedNode((prev: any) => prev ? { ...prev, data: { ...prev.data, ...updatedData } } : null);
                }}
            />
            <FilteredResultsPanel
                isOpen={isFilteredPanelOpen}
                onClose={() => setIsFilteredPanelOpen(false)}
                nodes={nodes}
                edges={edges}
                visibleNodeIds={visibleNodeIds}
                onNodeClick={focusNode}
            />
            <AIChatPanel nodes={nodes} edges={edges} />
            <ExportOptionsDialog
                open={exportFormat !== null}
                onOpenChange={(open) => { if (!open) setExportFormat(null); }}
                format={exportFormat}
                allCounts={allExportCounts}
                filteredCounts={filteredExportCounts}
                hasActiveFilter={hasActiveFilter}
                onConfirm={handleExportConfirm}
            />
        </div>
    );
}

export function GraphCanvas() {
    return (
        <ReactFlowProvider>
            <GraphCanvasContent />
            <RateLimitDialog />
        </ReactFlowProvider>
    );
}
