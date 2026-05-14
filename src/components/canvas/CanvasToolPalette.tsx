"use client";

import React from "react";
import { PlusCircle, StickyNote, MousePointer2, BoxSelect } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasToolPaletteProps {
    onAddNode: (type: "entity" | "note") => void;
    mode: "pan" | "select";
    onModeChange: (mode: "pan" | "select") => void;
}

interface ToolButtonProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    tone?: "default" | "accent";
    active?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon: Icon, label, onClick, tone = "default", active }) => (
    <button
        onClick={onClick}
        className={cn(
            "group relative inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors",
            active && "bg-[#132B5C] text-white hover:bg-[#0d1f44]",
            !active && tone === "accent" && "text-yellow-700 hover:bg-yellow-50",
            !active && tone === "default" && "text-slate-700 hover:bg-slate-100"
        )}
        title={label}
    >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
    </button>
);

export const CanvasToolPalette: React.FC<CanvasToolPaletteProps> = ({ onAddNode, mode, onModeChange }) => {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-1 rounded-lg bg-white border border-slate-200 shadow-[0px_4px_12px_0px_rgba(15,23,42,0.08),0px_0px_2px_0px_rgba(15,23,42,0.10)]">
            <ToolButton
                icon={MousePointer2}
                label="Pan"
                onClick={() => onModeChange("pan")}
                active={mode === "pan"}
            />
            <ToolButton
                icon={BoxSelect}
                label="Box select"
                onClick={() => onModeChange("select")}
                active={mode === "select"}
            />
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <ToolButton icon={PlusCircle} label="Add entity" onClick={() => onAddNode("entity")} />
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <ToolButton icon={StickyNote} label="Add note" onClick={() => onAddNode("note")} tone="accent" />
        </div>
    );
};

export default CanvasToolPalette;
