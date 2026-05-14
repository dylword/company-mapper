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
} from 'reactflow';
import { ArrowDown, ArrowRight, RefreshCw, Camera, Circle, Trash, Trash2, PlusCircle, StickyNote, Download, List } from 'lucide-react';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';

import { Button } from "@/components/ui/button"
import BusinessCardNode from './nodes/BusinessCardNode';
import NoteNode from './nodes/NoteNode';
import FloatingEdge from './edges/FloatingEdge';
import { FilteredResultsPanel } from './FilteredResultsPanel';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { getLayoutedElements } from '@/lib/layout';
import { cn, formatDate, getSicDescription } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { processDuplicates, mergeNodes as mergeNodesUtil } from '@/lib/matchUtils';
import { chFetch } from '@/lib/client-fetch';
import RateLimitDialog from './RateLimitDialog';
import AIChatPanel from './AIChatPanel';

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
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [layoutDirection, setLayoutDirection] = React.useState('FORCE');

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
        (direction: string) => {
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                nodes,
                edges,
                direction
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
        [nodes, edges, setNodes, setEdges, fitView]
    );

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

    // Normalised key for address dedup — tolerates punctuation/whitespace/case
    // differences between Companies House records for the same premises.
    const normalizeAddressKey = (addr: any) => {
        if (!addr) return '';
        return [
            addr.premises,
            addr.address_line_1,
            addr.address_line_2,
            addr.locality,
            addr.region,
            addr.postal_code,
            addr.country
        ]
            .filter(Boolean)
            .map((s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, ''))
            .join('|');
    };

    useEffect(() => {
        if (!query) return;

        const fetchData = async () => {
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
                const currNode = nodes.find(n => n.id === currId);

                if (currNode?.data?.type === 'company' && currId !== activeNodeId) {
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

    const downloadImage = () => {
        const nodes = getNodes();

        // 1. Get the bounding box of all nodes
        const nodesBounds = getRectOfNodes(nodes);

        // 2. Calculate dimensions with some padding
        const padding = 50;
        const imageWidth = nodesBounds.width + (padding * 2);
        const imageHeight = nodesBounds.height + (padding * 2);

        // 3. Calculate the transform to fit the nodes into the new image dimensions
        // This effectively centers the graph and ensures scale is appropriate (close to 1)
        const transform = getTransformForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2);

        const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;

        if (viewport) {
            toPng(viewport, {
                backgroundColor: '#f8fafc', // slate-50
                width: imageWidth,
                height: imageHeight,
                style: {
                    width: String(imageWidth),
                    height: String(imageHeight),
                    // Apply the transform to shift the graph into view and scale it
                    transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
                },
            }).then((dataUrl) => {
                const link = document.createElement('a');
                link.download = 'company-map.png';
                link.href = dataUrl;
                link.click();
            });
        }
    };

    const exportToCSV = () => {
        const rows: any[] = [];
        const companies = nodes.filter(n => n.data.type === 'company');

        companies.forEach(company => {
            const sics = (company.data.source?.sic_codes || []).map((c: any) => String(c));
            const sicString = sics.map((code: string) => `${code} - ${getSicDescription(code)}`).join("; ");

            const connectedEdges = edges.filter(e => e.source === company.id || e.target === company.id);

            if (connectedEdges.length === 0) {
                rows.push({
                    "Company Name": company.data.label,
                    "Company Number": company.id,
                    "Company Status": company.data.status || "",
                    "Nature of Business": sicString,
                    "Company Address": company.data.address || "",
                    "Connected Entity Name": "",
                    "Connection Type": "",
                    "Entity Address": "",
                    "Entity Details": ""
                });
                return;
            }

            connectedEdges.forEach(edge => {
                const isSource = edge.source === company.id;
                const otherNodeId = isSource ? edge.target : edge.source;
                const otherNode = nodes.find(n => n.id === otherNodeId);
                
                if (!otherNode || otherNode.data.type === 'address') return;
                
                rows.push({
                    "Company Name": company.data.label,
                    "Company Number": company.id,
                    "Company Status": company.data.status || "",
                    "Nature of Business": sicString,
                    "Company Address": company.data.address || "",
                    "Connected Entity Name": otherNode.data.label,
                    "Connection Type": edge.label || otherNode.data.role || "",
                    "Entity Address": otherNode.data.address || "",
                    "Entity Details": otherNode.data.subtext || ""
                });
            });
        });

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
        link.setAttribute("download", `corporate_mapper_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
            {/* Main Header Container */}
            <header className="flex-none bg-white">
                <div className="px-4 py-4 flex items-start justify-between">
                    {/* Left side: Title and Tabs */}
                    <div className="flex flex-col space-y-4">
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

                    {/* Right side: Search Field */}
                    <div className="flex items-center pt-2">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const input = form.elements.namedItem('search') as HTMLInputElement;
                                if (input.value.trim()) {
                                    const newParams = new URLSearchParams(searchParams.toString());
                                    newParams.set('q', input.value.trim());
                                    window.history.pushState(null, '', `?${newParams.toString()}`);
                                    window.location.search = `?${newParams.toString()}`;
                                }
                            }}
                            className="flex items-center gap-2"
                        >
                            <input
                                name="search"
                                defaultValue={query || ''}
                                placeholder="TESCO PLC"
                                className="w-[300px] px-3 py-1.5 text-sm text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 placeholder:text-slate-400"
                            />
                            <Button type="submit" size="sm" className="bg-[#132B5C] text-white hover:bg-[#132B5C]/90 h-[34px] px-6">
                                Search
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Quick Tools Bar */}
                <div className="w-full h-[40px] bg-slate-50 border-y border-slate-200 flex items-center px-4 relative z-50">
                    <span className="text-xs font-semibold text-slate-800 mr-6 shrink-0">Quick Tools</span>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {availableStatuses.length > 0 && (
                            <>
                                <span className="text-[11px] font-medium text-slate-500 mr-1 shrink-0">Filter Status:</span>
                                <div className="flex gap-1.5 border-r border-slate-300 pr-3 mr-1">
                                    {availableStatuses.map(status => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setStatusFilters(prev => 
                                                    prev.includes(status) 
                                                        ? prev.filter(s => s !== status)
                                                        : [...prev, status]
                                                )
                                            }}
                                            className={cn(
                                                "px-2.5 py-1 rounded text-[10px] font-bold uppercase border transition-colors shrink-0",
                                                statusFilters.includes(status) 
                                                    ? "bg-[#132B5C] text-white border-[#132B5C]"
                                                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100 focus:outline-none"
                                            )}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                        
                    <div className="flex items-center flex-1">
                        {availableSics.length > 0 && (
                            <div className="relative flex items-center ml-2 border-l border-slate-300 pl-3">
                                <span className="text-[11px] font-medium text-slate-500 mr-2 shrink-0">Nature of Business:</span>
                                <div className="flex gap-1 mr-2 flex-nowrap">
                                    {sicFilters.map(sic => (
                                        <span key={sic} className="px-2 py-0.5 bg-[#132B5C] text-white text-[10px] font-bold rounded flex items-center gap-1 shrink-0">
                                            {sic}
                                            <button onClick={() => setSicFilters(prev => prev.filter(s => s !== sic))} className="hover:text-slate-200 mt-0.5">&times;</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search SIC..."
                                        value={sicSearchTerm}
                                        onChange={(e) => {
                                            setSicSearchTerm(e.target.value);
                                            setIsSicDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsSicDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsSicDropdownOpen(false), 200)}
                                        className="w-36 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400 shrink-0"
                                    />
                                    {isSicDropdownOpen && (
                                        <div className="absolute top-full mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-[0px_4px_9px_0px_rgba(23,26,31,0.11),0px_0px_2px_0px_rgba(23,26,31,0.12)] z-[60] max-h-48 overflow-y-auto right-0 md:left-0 md:right-auto">
                                            {availableSics
                                                .filter(sic => !sicFilters.includes(sic))
                                                .filter(sic => {
                                                    if (!sicSearchTerm) return true;
                                                    const term = sicSearchTerm.toLowerCase();
                                                    const desc = getSicDescription(sic).toLowerCase();
                                                    return String(sic).toLowerCase().includes(term) || desc.includes(term);
                                                })
                                                .map(sic => (
                                                    <div
                                                        key={sic}
                                                        className="px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                        onClick={() => {
                                                            setSicFilters(prev => [...prev, sic]);
                                                            setSicSearchTerm("");
                                                            setIsSicDropdownOpen(false);
                                                        }}
                                                    >
                                                        <div className="font-bold text-slate-900">{sic}</div>
                                                        <div className="text-[10px] text-slate-500 line-clamp-2">{getSicDescription(sic)}</div>
                                                    </div>
                                                ))}
                                            {availableSics.filter(sic => !sicFilters.includes(sic)).filter(sic => String(sic).toLowerCase().includes(sicSearchTerm.toLowerCase()) || getSicDescription(sic).toLowerCase().includes(sicSearchTerm.toLowerCase())).length === 0 && (
                                                <div className="px-3 py-2 text-xs text-slate-500 text-center italic">No matching businesses found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Add Node Buttons */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddNode('entity')}
                            className="h-7 text-xs bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                        >
                            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                            Entity
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddNode('note')}
                            className="h-7 text-xs bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200 mr-2"
                        >
                            <StickyNote className="h-3.5 w-3.5 mr-1.5" />
                            Note
                        </Button>

                        <div className="w-px h-4 bg-slate-300 mr-2" />

                        {/* Level Expansion Dropdown */}
                        <div className="flex items-center">
                            <span className="text-[11px] font-medium text-slate-500 mr-1.5">Expand:</span>
                            <select
                                value={expansionLevel}
                                onChange={(e) => setExpansionLevel(Number(e.target.value))}
                                className="text-xs font-medium text-slate-700 bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:outline-none cursor-pointer hover:bg-slate-100"
                            >
                                <option value={1}>Level 1</option>
                                <option value={2}>Level 2</option>
                                <option value={3}>Level 3</option>
                                <option value={4}>Level 4</option>
                                <option value={5}>Level 5</option>
                            </select>
                        </div>

                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleExpandNetwork}
                            disabled={!selectedNode || loading}
                            className="h-7 text-xs bg-[#132B5C] text-white hover:bg-[#132B5C]/90 disabled:opacity-50 ml-1 px-3"
                            title={selectedNode ? `Expand ${selectedNode.data.label}` : "Select a node to expand"}
                        >
                            {loading ? "..." : "Expand"}
                        </Button>

                        <div className="w-px h-4 bg-slate-300 mx-2" />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDeleteSelected}
                            disabled={!nodes.some(n => n.selected)}
                            className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Delete Selected"
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDeleteBranch}
                            disabled={!nodes.some(n => n.selected)}
                            className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Delete Selected & Isolated Sub-branches"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-4 bg-slate-300 mx-2" />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onLayout('TB')}
                            className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            title="Vertical Layout"
                        >
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onLayout('LR')}
                            className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            title="Horizontal Layout"
                        >
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onLayout(layoutDirection)}
                            className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            title="Auto Align"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onLayout('RADIAL')}
                            className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            title="Radial Layout"
                        >
                            <Circle className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-4 bg-slate-300 mx-2" />

                        <Button
                            variant={isFilteredPanelOpen ? "default" : "ghost"}
                            size="icon"
                            onClick={() => setIsFilteredPanelOpen(!isFilteredPanelOpen)}
                            className={cn("h-7 w-7", isFilteredPanelOpen ? "bg-[#132B5C] text-white hover:bg-[#132B5C]/90" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200")}
                            title="Toggle Filtered Results Sidebar"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={exportToCSV}
                            className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            title="Export Data to CSV"
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={downloadImage}
                            className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            title="Download Screenshot"
                        >
                            <Camera className="h-4 w-4" />
                        </Button>
                    </div>
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
                    fitView
                    className="bg-slate-50"
                >
                    <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
                    <Controls className="bg-white border-slate-200 shadow-sm text-slate-900" />

                </ReactFlow>
            </div>

            <NodeDetailsPanel
                node={selectedNode}
                isOpen={isDialogOpen}
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
