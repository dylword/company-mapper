"use client";

import React from "react";
import { Node, NodeToolbar, Position } from "reactflow";
import { Trash, Trash2, Maximize2, Palette, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SelectionActionBarProps {
    nodes: Node[];
    onDelete: () => void;
    onDeleteBranch: () => void;
    onExpand?: () => void;
    canExpand?: boolean;
    onRecolor: (color: string | null) => void;
}

interface ActionButtonProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    tone?: "default" | "danger" | "primary";
    disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, onClick, tone = "default", disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
            "group relative inline-flex items-center justify-center h-7 w-7 rounded transition-colors",
            disabled && "opacity-40 cursor-not-allowed",
            !disabled && tone === "danger" && "text-slate-700 hover:bg-red-50 hover:text-red-600",
            !disabled && tone === "primary" && "text-slate-700 hover:bg-slate-100 hover:text-[#132B5C]",
            !disabled && tone === "default" && "text-slate-700 hover:bg-slate-100"
        )}
        title={label}
    >
        <Icon className="h-3.5 w-3.5" />
        <span className="pointer-events-none absolute top-full mt-1.5 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            {label}
        </span>
    </button>
);

// Brand palette pulled from the company-mapper design system (primary navy plus
// supporting accent + status hues already used elsewhere in the app).
const PALETTE: { name: string; value: string }[] = [
    { name: "Brand navy", value: "#132B5C" },
    { name: "Officer green", value: "#10B981" },
    { name: "PSC amber", value: "#F59E0B" },
    { name: "Address slate", value: "#64748B" },
    { name: "Risk red", value: "#EF4444" },
    { name: "Investigate violet", value: "#8B5CF6" },
    { name: "Watch teal", value: "#14B8A6" },
    { name: "Highlight pink", value: "#EC4899" },
];

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
    nodes,
    onDelete,
    onDeleteBranch,
    onExpand,
    canExpand,
    onRecolor,
}) => {
    const selected = nodes.filter(n => n.selected);
    const [colorOpen, setColorOpen] = React.useState(false);
    if (selected.length === 0) return null;

    // Anchor the toolbar to the most recently selected node. react-flow's
    // NodeToolbar handles positioning relative to that node and follows pan/zoom.
    const anchor = selected[selected.length - 1];

    return (
        <NodeToolbar nodeId={anchor.id} isVisible position={Position.Top} offset={12}>
            <div className="flex items-center gap-0.5 px-1 py-1 rounded-md bg-white border border-slate-200 shadow-[0px_4px_12px_0px_rgba(15,23,42,0.10),0px_0px_2px_0px_rgba(15,23,42,0.10)]">
                {onExpand && (
                    <>
                        <ActionButton
                            icon={Maximize2}
                            label="Expand"
                            onClick={onExpand}
                            tone="primary"
                            disabled={!canExpand}
                        />
                        <div className="w-px h-4 bg-slate-200 mx-0.5" />
                    </>
                )}

                <Popover open={colorOpen} onOpenChange={setColorOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="group relative inline-flex items-center justify-center h-7 w-7 rounded text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Recolor"
                        >
                            <Palette className="h-3.5 w-3.5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="center" sideOffset={8} className="p-2 w-[180px]">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-1 pb-1.5">
                            Recolor {selected.length}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {PALETTE.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => { onRecolor(p.value); setColorOpen(false); }}
                                    className="h-7 w-7 rounded-md border border-slate-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: p.value }}
                                    title={p.name}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => { onRecolor(null); setColorOpen(false); }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 h-7 rounded-md text-[11px] font-medium text-slate-600 hover:bg-slate-100 border border-slate-200"
                        >
                            <X className="h-3 w-3" />
                            Reset to default
                        </button>
                    </PopoverContent>
                </Popover>

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                <ActionButton icon={Trash} label="Delete" onClick={onDelete} tone="danger" />
                <ActionButton icon={Trash2} label="Delete + sub-branches" onClick={onDeleteBranch} tone="danger" />
                {selected.length > 1 && (
                    <span className="ml-1 mr-0.5 text-[10px] font-medium text-slate-500">
                        {selected.length} selected
                    </span>
                )}
            </div>
        </NodeToolbar>
    );
};

export default SelectionActionBar;
