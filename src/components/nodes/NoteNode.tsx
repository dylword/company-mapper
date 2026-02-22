import React, { memo } from 'react';
import { NodeProps, useReactFlow, Handle, Position } from 'reactflow';
import { cn } from '@/lib/utils';
import { StickyNote } from 'lucide-react';

const NoteNode = ({ id, data, selected }: NodeProps) => {
    const { setNodes } = useReactFlow();

    // Update the node's data when the text changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            label: newText,
                        },
                    };
                }
                return node;
            })
        );
    };

    return (
        <div
            className={cn(
                "group w-[200px] min-h-[150px] bg-yellow-100 rounded shadow-md border border-yellow-200 transition-all duration-200 flex flex-col relative",
                selected && "ring-2 ring-yellow-400 shadow-lg"
            )}
        >
            {/* Top Drag Handle Bar (styled like a tape/header) */}
            <div className="w-full h-4 bg-yellow-200/50 rounded-t flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <div className="w-8 h-1 bg-yellow-400/30 rounded-full" />
            </div>

            <div className="absolute top-2 right-2 text-yellow-500/30 pointer-events-none">
                <StickyNote className="w-4 h-4" />
            </div>

            {/* Editable Content */}
            <textarea
                className="flex-1 w-full bg-transparent border-none resize-none px-3 py-2 text-sm text-slate-800 focus:outline-none placeholder:text-yellow-600/50 min-h-[110px]"
                placeholder="Type note here..."
                value={data.label || ''}
                onChange={handleChange}
                onKeyDown={(e) => {
                    // Prevent ReactFlow from deleting the node if we are typing and press backspace
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        e.stopPropagation();
                    }
                }}
            />

            {/* Interactive Handles for manual connections */}
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                className="w-3 h-3 bg-yellow-400 border-2 border-white opacity-70 hover:opacity-100 hover:bg-yellow-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="w-3 h-3 bg-yellow-400 border-2 border-white opacity-70 hover:opacity-100 hover:bg-yellow-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                className="w-3 h-3 bg-yellow-400 border-2 border-white opacity-70 hover:opacity-100 hover:bg-yellow-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="w-3 h-3 bg-yellow-400 border-2 border-white opacity-70 hover:opacity-100 hover:bg-yellow-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
        </div>
    );
};

export default memo(NoteNode);
