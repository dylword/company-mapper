import { useCallback } from 'react';
import { useStore, EdgeProps, BaseEdge, EdgeLabelRenderer } from 'reactflow';
import { getEdgeParams } from '@/lib/floating';

function FloatingEdge({ id, source, target, markerEnd, style, label, labelBgStyle, labelStyle }: EdgeProps) {
    const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
    const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

    if (!sourceNode || !targetNode) {
        return null;
    }

    const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

    // Use a simple straight line path. It's mathematically the fastest and clearest for investigator tools.
    // getBezierPath is trying to dynamically calculate curves on every frame which causes lag.
    const edgePath = `M ${sx},${sy} L ${tx},${ty}`;

    // Label should be placed in the center of the line
    const labelX = sx + (tx - sx) / 2;
    const labelY = sy + (ty - sy) / 2;

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            background: (labelBgStyle?.fill as string) || '#f8fafc',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: (labelStyle?.fontWeight as number) || 500,
                            color: (labelStyle?.fill as string) || '#64748b',
                            border: '1px solid #e2e8f0',
                            // Everything inside EdgeLabelRenderer has no pointer events by default
                            // If you need mouse events, change below to 'all'
                            pointerEvents: 'none',
                        }}
                        className="nodrag nopan"
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export default FloatingEdge;
