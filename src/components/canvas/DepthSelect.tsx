"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface DepthSelectProps {
    value: number;
    onChange: (value: number) => void;
}

const LEVELS = [
    { value: 1, label: "Direct only", hint: "Officers, PSCs, registered office" },
    { value: 2, label: "Two hops", hint: "+ their other companies" },
    { value: 3, label: "Three hops", hint: "Wide net (rate-limit risk)" },
    { value: 4, label: "Four hops", hint: "Power user — slow" },
    { value: 5, label: "Five hops", hint: "Maximum reach" },
];

export const DepthSelect: React.FC<DepthSelectProps> = ({ value, onChange }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1 h-full px-2.5 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none"
                >
                    <span className="text-slate-500">Depth</span>
                    <span className="font-semibold text-[#132B5C]">{value}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-1.5">
                {LEVELS.map(level => {
                    const active = value === level.value;
                    return (
                        <button
                            key={level.value}
                            onClick={() => {
                                onChange(level.value);
                                setOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left hover:bg-slate-50 transition-colors",
                                active && "bg-slate-100"
                            )}
                        >
                            <span className={cn(
                                "inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold shrink-0",
                                active ? "bg-[#132B5C] text-white" : "bg-slate-100 text-slate-600"
                            )}>
                                {level.value}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-slate-900">{level.label}</div>
                                <div className="text-[10px] text-slate-500 leading-tight">{level.hint}</div>
                            </div>
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
};

export default DepthSelect;
