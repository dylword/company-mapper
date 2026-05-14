import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';
import * as d3 from 'd3-force';

const nodeWidth = 240;
const nodeHeight = 80;

export interface LayoutOptions {
    // Edge / connector length between linked nodes (FORCE/RADIAL/dagre ranksep)
    linkDistance?: number;
    // Minimum spacing between unconnected nodes (FORCE collide radius / dagre nodesep)
    nodeSpacing?: number;
}

export const DEFAULT_LAYOUT_OPTIONS: Required<LayoutOptions> = {
    linkDistance: 350,
    nodeSpacing: 200,
};

export const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[],
    direction = 'FORCE',
    options: LayoutOptions = {}
) => {
    const linkDistance = options.linkDistance ?? DEFAULT_LAYOUT_OPTIONS.linkDistance;
    const nodeSpacing = options.nodeSpacing ?? DEFAULT_LAYOUT_OPTIONS.nodeSpacing;

    if (direction === 'FORCE') {
        // Clone nodes and edges for simulation
        const simNodes = nodes.map((node) => ({
            ...node,
            x: node.position.x || Math.random() * 800,
            y: node.position.y || Math.random() * 600,
        }));

        // Ensure links reference indices or string IDs that match node IDs
        const simLinks = edges.map((edge) => ({
            ...edge,
            source: simNodes.find((n) => n.id === edge.source),
            target: simNodes.find((n) => n.id === edge.target),
        })).filter(link => link.source && link.target); // Safety filter

        // Run simulation synchronously
        // Initialize nodes farther apart so they don't get tangled
        simNodes.forEach(node => {
            node.x = node.x || (Math.random() - 0.5) * 2000;
            node.y = node.y || (Math.random() - 0.5) * 2000;
        });

        // Repulsion scales with spacing so larger gaps don't collapse back from charge pull.
        const chargeStrength = -Math.max(1000, nodeSpacing * 20);
        const simulation = d3.forceSimulation(simNodes as any)
            .force('link', d3.forceLink(simLinks as any).id((d: any) => d.id).distance(linkDistance).strength(0.5))
            .force('charge', d3.forceManyBody().strength(chargeStrength).distanceMax(1500))
            .force('center', d3.forceCenter(0, 0))
            .force('collide', d3.forceCollide().radius(nodeSpacing).iterations(3));

        simulation.stop();
        for (let i = 0; i < 400; i++) {
            simulation.tick();
        }

        // Map positions back to React Flow nodes
        const layoutedNodes = simNodes.map((simNode: any) => {
            const node = nodes.find(n => n.id === simNode.id)!;
            return {
                ...node,
                position: {
                    x: simNode.x - nodeWidth / 2,
                    y: simNode.y - nodeHeight / 2,
                },
                // Add handles all around for floating edges to attach nicely
                targetPosition: Position.Top,
                sourcePosition: Position.Bottom,
            };
        });

        return { nodes: layoutedNodes, edges };
    }

    if (direction === 'RADIAL') {
        const centerNode = nodes.find(n => n.data.type === 'company') || nodes[0];
        if (!centerNode) return { nodes, edges };

        // Reset positions for calculation
        const layoutedNodes = nodes.map(node => ({ ...node }));

        // BFS to determine levels
        const levels = new Map<string, number>();
        const queue = [{ id: centerNode.id, level: 0 }];
        levels.set(centerNode.id, 0);
        const visited = new Set<string>([centerNode.id]);

        while (queue.length > 0) {
            const { id, level } = queue.shift()!;

            // Find neighbors
            const neighbors = edges
                .filter(e => e.source === id || e.target === id)
                .map(e => e.source === id ? e.target : e.source);

            for (const neighborId of neighbors) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    levels.set(neighborId, level + 1);
                    queue.push({ id: neighborId, level: level + 1 });
                }
            }
        }

        // Group nodes by level
        const nodesByLevel = new Map<number, Node[]>();
        layoutedNodes.forEach(node => {
            const level = levels.get(node.id) ?? 1; // Default to 1 if disconnected
            if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
            nodesByLevel.get(level)!.push(node);
        });

        // Position nodes — radial ring distance tracks the connector-length control.
        const baseRadius = Math.max(200, linkDistance + 150);

        nodesByLevel.forEach((levelNodes, level) => {
            if (level === 0) {
                levelNodes[0].position = { x: 0, y: 0 };
                return;
            }

            const radius = baseRadius * level;
            const angleStep = (2 * Math.PI) / levelNodes.length;

            levelNodes.forEach((node, index) => {
                const angle = index * angleStep;
                node.position = {
                    x: radius * Math.cos(angle) - nodeWidth / 2,
                    y: radius * Math.sin(angle) - nodeHeight / 2
                };
            });
        });

        return { nodes: layoutedNodes, edges };
    }

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: nodeSpacing,
        ranksep: Math.max(60, linkDistance / 3)
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        const isAddressEdge = edge.label === 'Correspondence' || edge.data?.type === 'address';
        dagreGraph.setEdge(edge.source, edge.target, {
            minlen: isAddressEdge ? 1 : 3
        });
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = Position.Top;
        node.sourcePosition = Position.Bottom;

        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes: layoutedNodes, edges };
};
