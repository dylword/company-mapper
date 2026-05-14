"use client";

import React from "react";
import { ChevronDown, Move, RotateCcw } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface SpacingMenuProps {
    linkDistance: number;
    nodeSpacing: number;
    onChange: (next: { linkDistance: number; nodeSpacing: number }) => void;
    onReset: () => void;
}

export const SpacingMenu: React.FC<SpacingMenuProps> = ({
    linkDistance,
    nodeSpacing,
    onChange,
    onReset,
}) => {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                    <Move className="h-3.5 w-3.5" />
                    Spacing
                    <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[260px] p-3">
                <div className="space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                                Connector length
                            </label>
                            <span className="text-[11px] text-slate-500 tabular-nums">{linkDistance}</span>
                        </div>
                        <input
                            type="range"
                            min={120}
                            max={800}
                            step={10}
                            value={linkDistance}
                            onChange={(e) =>
                                onChange({ linkDistance: Number(e.target.value), nodeSpacing })
                            }
                            className="w-full accent-[#132B5C]"
                        />
                        <div className="text-[10px] text-slate-500 mt-0.5">
                            Distance between linked nodes
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                                Node spacing
                            </label>
                            <span className="text-[11px] text-slate-500 tabular-nums">{nodeSpacing}</span>
                        </div>
                        <input
                            type="range"
                            min={80}
                            max={500}
                            step={10}
                            value={nodeSpacing}
                            onChange={(e) =>
                                onChange({ linkDistance, nodeSpacing: Number(e.target.value) })
                            }
                            className="w-full accent-[#132B5C]"
                        />
                        <div className="text-[10px] text-slate-500 mt-0.5">
                            How close nodes can sit to each other
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            onReset();
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset to defaults
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default SpacingMenu;
