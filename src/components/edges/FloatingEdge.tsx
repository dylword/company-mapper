import { useCallback, useState } from 'react';
import { useStore, EdgeProps, BaseEdge, EdgeLabelRenderer, useReactFlow } from 'reactflow';
import { getEdgeParams } from '@/lib/floating';

function FloatingEdge({ id, source, target, markerEnd, style, label, labelBgStyle, labelStyle, selected }: EdgeProps) {
    const { setEdges } = useReactFlow();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState((label as string) || '');

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

    const saveLabel = () => {
        setIsEditing(false);
        setEdges((eds) =>
            eds.map((e) => {
                if (e.id === id) {
                    return { ...e, label: editValue || undefined };
                }
                return e;
            })
        );
    };

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {(label || selected) && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all', // enable interactions
                            zIndex: isEditing ? 100 : 1, // ensure it's above other things when editing
                        }}
                        className="nodrag nopan"
                    >
                        {isEditing ? (
                            <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveLabel}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveLabel();
                                    if (e.key === 'Escape') {
                                        setEditValue((label as string) || '');
                                        setIsEditing(false);
                                    }
                                }}
                                className="px-2 py-0.5 text-[10px] font-medium text-slate-700 bg-white border border-[#132B5C] rounded-md shadow outline-none w-24 text-center ring-2 ring-[#132B5C]/20"
                                placeholder="Edge Label"
                            />
                        ) : label ? (
                            <div
                                onClick={() => setIsEditing(true)}
                                style={{
                                    background: (labelBgStyle?.fill as string) || '#f8fafc',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: (labelStyle?.fontWeight as number) || 500,
                                    color: (labelStyle?.fill as string) || '#64748b',
                                    border: '1px solid #e2e8f0',
                                    cursor: 'pointer',
                                }}
                                className="hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-sm"
                            >
                                {label}
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase text-slate-500 bg-white border border-slate-200 rounded shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors"
                            >
                                + Add Label
                            </button>
                        )}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export default FloatingEdge;
