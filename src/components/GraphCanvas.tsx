"use client"

import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
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
} from 'reactflow';
import { ArrowDown, ArrowRight, RefreshCw, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';

import { Button } from "@/components/ui/button"
import BusinessCardNode from './nodes/BusinessCardNode';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import { getLayoutedElements } from '@/lib/layout';
import { cn, formatDate } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

const nodeTypes = {
    businessCard: BusinessCardNode,
};

function GraphCanvasContent() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');
    const { getNodes } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [layoutDirection, setLayoutDirection] = React.useState('TB');

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
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

            setNodes([...layoutedNodes]);
            setEdges([...layoutedEdges]);
            setLayoutDirection(direction);
        },
        [nodes, edges, setNodes, setEdges]
    );

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
            addr.address_line_1,
            addr.address_line_2,
            addr.locality,
            addr.region,
            addr.postal_code,
            addr.country
        ].filter(Boolean).join(', ');
    };

    useEffect(() => {
        if (!query) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                let companyNumber = query;

                if (query.length !== 8 || isNaN(Number(query))) {
                    const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
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

                const res = await fetch(`/api/company/${companyNumber}`);
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

                        const officerId = `officer-${officer.officer_id || index}`;
                        const addressId = `addr-${officerId}`; // Unique ID for this specific officer's address node instance? 
                        // Or should we deduplicate addresses? 
                        // "sit tightly and just under the director node" suggests a dedicated node per director might be better for layout 
                        // unless we want to show shared addresses. 
                        // Let's deduplicate by address string to show connections, but for layout "tightly under" might be tricky if shared.
                        // Let's try deduplicating first as that's more "graph-like".

                        // Actually, to ensure it sits "tightly under", maybe we treat it as a child? 
                        // But we are using a flat graph. 
                        // Let's stick to standard nodes for now.

                        const existingAddressNode = officerAddressNodes.find(n => n.data.label === addressLabel) ||
                            (addressLabel === formatAddress(company.registered_office_address) ? companyNode : null); // Check if matches company address? No, companyNode is a company.

                        // Let's just make a new address node if it doesn't exist in our list
                        let addressNodeId = `address-${addressLabel.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}-${index}`; // simple ID generation

                        // Better ID strategy: hash or just use the label if unique enough?
                        // Let's use a prefix and simple check.
                        const foundNode = officerAddressNodes.find(n => n.data.label === addressLabel);

                        if (foundNode) {
                            addressNodeId = foundNode.id;
                        } else {
                            // Check if it matches the main company address?
                            const companyAddressLabel = formatAddress(company.registered_office_address);
                            if (addressLabel === companyAddressLabel) {
                                // If it matches company address, do we link to the existing company address node?
                                // The existing code creates 'address-1' for company address.
                                addressNodeId = 'address-1';
                            } else {
                                addressNodeId = `address-${index}-${officer.officer_id || index}`; // Unique per officer for now to ensure "tightly under"? 
                                // No, user said "same sidebar/ expand connection functionality like normal company addresses"
                                // So it should be a proper address node.

                                // Let's try to deduplicate globally if possible, but for now let's just add it.
                                officerAddressNodes.push({
                                    id: addressNodeId,
                                    type: 'businessCard',
                                    data: {
                                        label: addressLabel,
                                        role: 'Correspondence Address',
                                        type: 'address',
                                        source: { address: officer.address } // Mock source
                                    },
                                    position: { x: 0, y: 0 },
                                });
                            }
                        }

                        officerAddressEdges.push({
                            id: `e-${officerId}-${addressNodeId}`,
                            source: officerId,
                            target: addressNodeId,
                            type: 'smoothstep',
                            animated: true,
                            label: 'Correspondence',
                            style: { stroke: '#94a3b8', strokeDasharray: '5,5' }, // Dashed for address?
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
                        label: [company.registered_office_address.address_line_1, company.registered_office_address.locality].filter(Boolean).join(', '),
                        role: 'Registered Address',
                        type: 'address',
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
                        type: 'smoothstep',
                        animated: true,
                        label: node.data.role, // Edge Label
                        style: { stroke: '#94a3b8' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    })),
                    ...pscNodes.map((node) => ({
                        id: `e-${companyNode.id}-${node.id}`,
                        source: companyNode.id,
                        target: node.id,
                        type: 'smoothstep',
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
                        type: 'smoothstep',
                        animated: true,
                        label: 'Registered Office', // Edge Label
                        style: { stroke: '#94a3b8' },
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

                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                    newNodes,
                    newEdges,
                    layoutDirection
                );

                setNodes(layoutedNodes);
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
    }, [query, setNodes, setEdges, layoutDirection]);

    const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // Customization State
    const [customColor, setCustomColor] = React.useState<string>("");
    const [notes, setNotes] = React.useState<string>("");
    const [expansionLevel, setExpansionLevel] = React.useState<number>(1);

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

    // Derived state for highlighting
    const { styledNodes, styledEdges } = useMemo(() => {
        const activeNodeId = hoveredNodeId || selectedNode?.id;

        if (!activeNodeId) {
            return { styledNodes: nodes, styledEdges: edges };
        }

        // Context-Aware BFS
        // Rule: Do not traverse THROUGH a company node to find other nodes, unless the company node is the start node.
        // This allows finding "Shared Address" connections (Director -> Address -> Director)
        // but prevents finding "Shared Company" connections (Director -> Company -> All Other Directors)

        const connectedNodeIds = new Set<string>();
        const connectedEdgeIds = new Set<string>();
        const queue: string[] = [activeNodeId];
        connectedNodeIds.add(activeNodeId);

        // Build adjacency list
        const adjacency = new Map<string, Array<{ nodeId: string, edgeId: string }>>();
        edges.forEach(edge => {
            if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
            if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);

            adjacency.get(edge.source)?.push({ nodeId: edge.target, edgeId: edge.id });
            adjacency.get(edge.target)?.push({ nodeId: edge.source, edgeId: edge.id });
        });

        while (queue.length > 0) {
            const currId = queue.shift()!;
            const currNode = nodes.find(n => n.id === currId);

            // Stop traversal if we are at a company node, UNLESS it is the start node
            // We still want to highlight the company node itself (which is why we added it to connectedNodeIds before queueing)
            // but we don't want to push its neighbors.
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

        // Ensure edges between any two highlighted nodes are visible (e.g. Director -> Company)
        // This covers the case where we stopped at Company, but we still want the edge pointing to it.
        // (Actually the loop above adds edges as it traverses, so edges TO the company are added. 
        // Edges FROM the company to unvisited nodes are skipped.)
        // But if we have Director A -> Company and Director B -> Company, and both Directors are highlighted (via address),
        // we want both edges to be highlighted.
        edges.forEach(edge => {
            if (connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)) {
                connectedEdgeIds.add(edge.id);
            }
        });

        const newStyledNodes = nodes.map((node) => {
            const isConnected = connectedNodeIds.has(node.id);
            return {
                ...node,
                style: {
                    ...node.style,
                    opacity: isConnected ? 1 : 0.2,
                    transition: 'opacity 0.2s ease-in-out'
                }
            };
        });

        const newStyledEdges = edges.map((edge) => {
            const isConnected = connectedEdgeIds.has(edge.id);
            return {
                ...edge,
                style: {
                    ...edge.style,
                    opacity: isConnected ? 1 : 0.1,
                    stroke: isConnected ? '#94a3b8' : '#cbd5e1',
                    transition: 'opacity 0.2s ease-in-out'
                }
            };
        });

        return { styledNodes: newStyledNodes, styledEdges: newStyledEdges };
    }, [nodes, edges, hoveredNodeId, selectedNode]);

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

        if (nodeToExpand.data.type === 'officer' && nodeToExpand.data.officer_id) {
            const res = await fetch(`/api/officer/${nodeToExpand.data.officer_id}/appointments`);
            const data = await res.json();

            if (data.items) {
                // Fetch full company details for each appointment in parallel
                const appointmentPromises = data.items.map(async (item: any) => {
                    const nodeId = item.appointed_to.company_number;

                    // Always return the node info, even if it exists
                    try {
                        // Optimisation: If node exists, we might not need to fetch details again if we trust existing data
                        // But for simplicity and ensuring we have the node object for recursion, we'll proceed.
                        // Actually, if it exists, we can just find it in currentNodes.
                        const existingNode = currentNodes.find(n => n.id === nodeId);
                        if (existingNode) {
                            return { item, company: existingNode.data.source, existingNode };
                        }

                        const companyRes = await fetch(`/api/company/${nodeId}`);
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

                const results = await Promise.all(appointmentPromises);

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
                                type: 'smoothstep',
                                animated: true,
                                label: item.officer_role,
                                style: { stroke: '#94a3b8' },
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
                        const addressLabel = [itemAddress.address_line_1, itemAddress.locality].filter(Boolean).join(', ');
                        const existingAddressNode = currentNodes.find(n => n.data.type === 'address' && n.data.label === addressLabel);
                        if (existingAddressNode) {
                            addressEdge = {
                                id: `e-${nodeId}-${existingAddressNode.id}`,
                                source: nodeId,
                                target: existingAddressNode.id,
                                type: 'smoothstep',
                                animated: true,
                                label: 'Registered Office',
                                style: { stroke: '#94a3b8' },
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
                            address: company ? formatAddress(company.registered_office_address) : (itemAddress ? [itemAddress.address_line_1, itemAddress.locality].filter(Boolean).join(', ') : undefined),
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
                        type: 'smoothstep',
                        animated: true,
                        label: item.officer_role,
                        style: { stroke: '#94a3b8' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    });

                    if (addressEdge) newEdges.push(addressEdge);
                });
            }
        } else if (nodeToExpand.data.type === 'company') {
            const res = await fetch(`/api/company/${nodeToExpand.id}`);
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
                                type: 'smoothstep',
                                animated: true,
                                label: officer.officer_role,
                                style: { stroke: '#94a3b8' },
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
                        type: 'smoothstep',
                        animated: true,
                        label: officer.officer_role,
                        style: { stroke: '#94a3b8' },
                        labelBgStyle: { fill: '#f8fafc' },
                        labelStyle: { fill: '#64748b', fontWeight: 500 },
                    });

                    // Add Address Node for this new officer
                    if (officer.address) {
                        const addressLabel = formatAddress(officer.address);
                        if (addressLabel) {
                            // Check if address node already exists in currentNodes or newNodes
                            let addressNodeId = `address-${addressLabel.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}-${index}`;

                            // Simple dedupe check against current graph
                            const existingAddress = currentNodes.find(n => n.data.type === 'address' && n.data.label === addressLabel);
                            if (existingAddress) {
                                addressNodeId = existingAddress.id;
                            } else {
                                // Check newNodes
                                const newAddress = newNodes.find(n => n.data.type === 'address' && n.data.label === addressLabel);
                                if (newAddress) {
                                    addressNodeId = newAddress.id;
                                } else {
                                    // Create new address node
                                    const newAddressNode: Node = {
                                        id: addressNodeId,
                                        type: 'businessCard',
                                        data: {
                                            label: addressLabel,
                                            role: 'Correspondence Address',
                                            type: 'address',
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
                                type: 'smoothstep',
                                animated: true,
                                label: 'Correspondence',
                                style: { stroke: '#94a3b8', strokeDasharray: '5,5' },
                                labelBgStyle: { fill: '#f8fafc' },
                                labelStyle: { fill: '#64748b', fontWeight: 500 },
                            });
                        }
                    }
                });
            }
        } else if (nodeToExpand.data.type === 'address') {
            const res = await fetch(`/api/search/address?location=${encodeURIComponent(nodeToExpand.data.label)}`);
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
                        type: 'smoothstep',
                        animated: true,
                        label: 'Registered At',
                        style: { stroke: '#94a3b8' },
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

                const expansionResults = await Promise.all(
                    nodesToExpand.map(node => expandSingleNode(node, currentNodes, currentEdges))
                );

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
                // (Already done in the loop above for newNodes)
                // Wait, I need to add newNodes to currentNodes for the next iteration's check.
                // The loop above adds to nextLevelNodes (which was just new nodes).
                // I should separate "nodes added to graph" and "nodes to expand next".

                // Let's fix the loop above:
                // 1. Add result.newNodes to currentNodes.
                // 2. Collect result.allNeighbors into nodesToExpand for next loop.
                currentNodes = [...currentNodes, ...nextLevelNodes];
                nodesToExpand = uniqueNextNodes; // Use unique neighbors for next level

                if (nodesToExpand.length === 0) break;
            }

            // Re-layout
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                currentNodes,
                deduplicateEdges(currentEdges),
                layoutDirection
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);

        } catch (error) {
            console.error("Failed to expand", error);
        } finally {
            setLoading(false);
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

    return (
        <div className="h-full w-full bg-slate-50 relative overflow-hidden">
            <ReactFlow
                nodes={styledNodes}
                edges={styledEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-50"
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
                <Controls className="bg-white border-slate-200 shadow-sm text-slate-900" />

                {/* Title Panel */}
                <Panel position="top-left" className="bg-white p-2 rounded-lg shadow-md border border-slate-200">
                    <h1 className="text-lg font-bold leading-tight px-2" style={{ color: '#132B5C' }}>Company Map</h1>
                    <p className="text-[10px] text-slate-400 px-2 font-medium">Dylan Wordley - ComMap V.1</p>
                </Panel>

                {/* Search Panel */}
                <Panel position="top-center" className="bg-white p-2 rounded-lg shadow-md border border-slate-200 flex flex-col gap-2 w-[400px]">
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
                        className="flex w-full gap-2"
                    >
                        <input
                            name="search"
                            defaultValue={query || ''}
                            placeholder="Search Company..."
                            className="flex-1 px-3 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                        <Button type="submit" size="sm" className="bg-[#132B5C] text-white hover:bg-[#132B5C]/90">
                            Search
                        </Button>
                    </form>
                    <p className="text-[10px] text-slate-400 text-center px-1">
                        Please only enter a company name/number, do not input any internal data or customer PII.
                    </p>
                </Panel>
                <Panel position="top-right" className="flex gap-2">
                    {/* Level Expansion Dropdown */}
                    <div className="bg-white border border-slate-200 rounded-md flex items-center px-2 shadow-sm">
                        <span className="text-xs font-medium text-slate-500 mr-2">Expand:</span>
                        <select
                            value={expansionLevel}
                            onChange={(e) => setExpansionLevel(Number(e.target.value))}
                            className="text-sm font-medium text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                        >
                            <option value={1}>Level 1</option>
                            <option value={2}>Level 2</option>
                        </select>
                    </div>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleExpandNetwork}
                        disabled={!selectedNode || loading}
                        className="bg-[#132B5C] text-white hover:bg-[#132B5C]/90 disabled:opacity-50 shadow-sm"
                        title={selectedNode ? `Expand ${selectedNode.data.label}` : "Select a node to expand"}
                    >
                        {loading ? "Loading..." : (!selectedNode ? "Select Node" : "Expand")}
                    </Button>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onLayout('TB')}
                        className="bg-white border-slate-200 hover:bg-slate-50"
                        title="Vertical Layout"
                    >
                        <ArrowDown className="h-4 w-4 text-slate-700" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onLayout('LR')}
                        className="bg-white border-slate-200 hover:bg-slate-50"
                        title="Horizontal Layout"
                    >
                        <ArrowRight className="h-4 w-4 text-slate-700" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onLayout(layoutDirection)}
                        className="bg-white border-slate-200 hover:bg-slate-50"
                        title="Auto Align"
                    >
                        <RefreshCw className="h-4 w-4 text-slate-700" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={downloadImage}
                        className="bg-white border-slate-200 hover:bg-slate-50"
                        title="Download Screenshot"
                    >
                        <Camera className="h-4 w-4 text-slate-700" />
                    </Button>
                </Panel>
            </ReactFlow>

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
                    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...updatedData } } : null);
                }}
            />
        </div>
    );
}

export function GraphCanvas() {
    return (
        <ReactFlowProvider>
            <GraphCanvasContent />
        </ReactFlowProvider>
    );
}
