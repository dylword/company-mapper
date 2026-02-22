import { Node, Edge, Position } from 'reactflow';

// Returns the coordinates of the center of a node
function getNodeCenter(node: Node) {
    return {
        x: (node.positionAbsolute?.x || node.position.x) + (node.width || 0) / 2,
        y: (node.positionAbsolute?.y || node.position.y) + (node.height || 0) / 2,
    };
}

// Calculates the intersection point between a line from source center to target center and the bounding box of a node.
function getNodeIntersection(intersectionNode: Node, targetNode: Node) {
    const {
        width: intersectionNodeWidth,
        height: intersectionNodeHeight,
        positionAbsolute: intersectionNodePosition,
    } = intersectionNode;

    const targetPosition = getNodeCenter(targetNode);
    
    // Fallback if measurement hasn't happened yet
    const w = intersectionNodeWidth || 240;
    const h = intersectionNodeHeight || 80;
    const x = intersectionNodePosition?.x || intersectionNode.position.x;
    const y = intersectionNodePosition?.y || intersectionNode.position.y;

    const intersectionNodeCenter = {
        x: x + w / 2,
        y: y + h / 2,
    };

    const dx = targetPosition.x - intersectionNodeCenter.x;
    const dy = targetPosition.y - intersectionNodeCenter.y;

    if (dx === 0 && dy === 0) return intersectionNodeCenter;

    // Use ratio to find intersection with rectangle boundary
    const wRatio = w / 2 / Math.abs(dx);
    const hRatio = h / 2 / Math.abs(dy);

    const ratio = Math.min(wRatio, hRatio);

    return {
        x: intersectionNodeCenter.x + dx * ratio,
        y: intersectionNodeCenter.y + dy * ratio,
    };
}

export function getEdgeParams(source: Node, target: Node) {
    const sourceIntersectionPoint = getNodeIntersection(source, target);
    const targetIntersectionPoint = getNodeIntersection(target, source);

    return {
        sx: sourceIntersectionPoint.x,
        sy: sourceIntersectionPoint.y,
        tx: targetIntersectionPoint.x,
        ty: targetIntersectionPoint.y,
    };
}
