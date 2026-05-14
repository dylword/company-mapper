"use client";

import React from "react";
import { ArrowDown, ArrowRight, Circle, RefreshCw, ChevronDown, LayoutPanelTop } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface LayoutMenuProps {
    onApply: (direction: string) => void;
    current: string;
}

const OPTIONS: { key: string; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "TB", label: "Vertical", description: "Top-down hierarchy", icon: ArrowDown },
    { key: "LR", label: "Horizontal", description: "Left-to-right hierarchy", icon: ArrowRight },
    { key: "RADIAL", label: "Radial", description: "Concentric rings", icon: Circle },
    { key: "FORCE", label: "Auto-tidy", description: "Spread evenly", icon: RefreshCw },
];

export const LayoutMenu: React.FC<LayoutMenuProps> = ({ onApply, current }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                    <LayoutPanelTop className="h-3.5 w-3.5" />
                    Layout
                    <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-1.5">
                {OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const active = current === opt.key;
                    return (
                        <button
                            key={opt.key}
                            onClick={() => {
                                onApply(opt.key);
                                setOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left hover:bg-slate-50 transition-colors",
                                active && "bg-slate-100"
                            )}
                        >
                            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#132B5C]" : "text-slate-500")} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-slate-900">{opt.label}</div>
                                <div className="text-[10px] text-slate-500">{opt.description}</div>
                            </div>
                            {active && <div className="w-1.5 h-1.5 rounded-full bg-[#132B5C]" />}
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
};

export default LayoutMenu;
