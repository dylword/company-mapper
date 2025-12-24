import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';

const nodeWidth = 240;
const nodeHeight = 80;

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 200,
        ranksep: 120  // Increased slightly from 80 for better balance
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        // "Correspondence" edges should be short (minlen: 1)
        // All other edges should be longer to maintain spacing (minlen: 3)
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

        // We are shifting the dagre node position (anchor=center center) to the top left
        // so it matches the React Flow node anchor point (top left).
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes: layoutedNodes, edges };
};
