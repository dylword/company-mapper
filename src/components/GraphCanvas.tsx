"use client"

import React, { useCallback, useEffect } from 'react';
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
} from 'reactflow';
import { ArrowDown, ArrowRight, RefreshCw } from 'lucide-react';
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

export function GraphCanvas() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');

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
                                source: officer // Store full source
                            },
                            position: { x: 0, y: 0 },
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

                const newNodes = [companyNode, ...officerNodes, ...pscNodes, addressNode];

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
                    })),
                    ...pscNodes.map((node) => ({
                        id: `e-${companyNode.id}-${node.id}`,
                        source: companyNode.id,
                        target: node.id,
                        type: 'smoothstep',
                        animated: true,
                        label: 'PSC', // Edge Label
                        style: { stroke: '#f59e0b' }, // Amber stroke for PSCs
                    })),
                    {
                        id: `e-${companyNode.id}-address-1`,
                        source: companyNode.id,
                        target: addressNode.id,
                        type: 'smoothstep',
                        animated: true,
                        label: 'Registered Office', // Edge Label
                        style: { stroke: '#94a3b8' },
                    }
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
                            });
                        }
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
                    });
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
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-50"
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
                <Controls className="bg-white border-slate-200 shadow-sm text-slate-900" />

                {/* Title Panel */}
                <Panel position="top-left" className="bg-white p-2 rounded-lg shadow-md border border-slate-200">
                    <h1 className="text-lg font-bold text-slate-900 leading-tight px-2">Company Mapper</h1>
                </Panel>

                {/* Search Panel */}
                <Panel position="top-center" className="bg-white p-2 rounded-lg shadow-md border border-slate-200 flex gap-2 w-[400px]">
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
                        <Button type="submit" size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                            Search
                        </Button>
                    </form>
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
                            <option value={3}>Level 3</option>
                        </select>
                    </div>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleExpandNetwork}
                        disabled={!selectedNode || loading}
                        className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 shadow-sm"
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
