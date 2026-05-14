"use client";

import React, { useState } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import { cn, getSicDescription } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface FiltersMenuProps {
    availableStatuses: string[];
    availableSics: string[];
    statusFilters: string[];
    sicFilters: string[];
    onToggleStatus: (status: string) => void;
    onAddSic: (sic: string) => void;
    onRemoveSic: (sic: string) => void;
    onClearAll: () => void;
}

export const FiltersMenu: React.FC<FiltersMenuProps> = ({
    availableStatuses,
    availableSics,
    statusFilters,
    sicFilters,
    onToggleStatus,
    onAddSic,
    onRemoveSic,
    onClearAll,
}) => {
    const [sicSearch, setSicSearch] = useState("");
    const total = statusFilters.length + sicFilters.length;
    const disabled = availableStatuses.length === 0 && availableSics.length === 0;

    const filteredSics = availableSics
        .filter(s => !sicFilters.includes(s))
        .filter(s => {
            if (!sicSearch) return true;
            const t = sicSearch.toLowerCase();
            return String(s).toLowerCase().includes(t) || getSicDescription(s).toLowerCase().includes(t);
        });

    return (
        <div className="flex items-center gap-1.5">
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        disabled={disabled}
                        className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors",
                            total > 0
                                ? "bg-[#132B5C] text-white border-[#132B5C] hover:bg-[#0d1f44]"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                            disabled && "opacity-40 cursor-not-allowed"
                        )}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        Filters
                        {total > 0 && (
                            <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#132B5C] text-[10px] font-bold">
                                {total}
                            </span>
                        )}
                        <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>
                </PopoverTrigger>

                <PopoverContent className="w-[340px] p-0">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Filters</div>
                        {total > 0 && (
                            <button
                                onClick={onClearAll}
                                className="text-[11px] text-slate-500 hover:text-[#132B5C] underline"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {availableStatuses.length > 0 && (
                        <div className="px-4 py-3 border-b border-slate-100">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                Status
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {availableStatuses.map(status => {
                                    const active = statusFilters.includes(status);
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => onToggleStatus(status)}
                                            className={cn(
                                                "px-2.5 py-1 rounded text-[10px] font-bold uppercase border transition-colors",
                                                active
                                                    ? "bg-[#132B5C] text-white border-[#132B5C]"
                                                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            {status}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {availableSics.length > 0 && (
                        <div className="px-4 py-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                Nature of business
                            </div>

                            {sicFilters.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {sicFilters.map(sic => (
                                        <span
                                            key={sic}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#132B5C] text-white text-[10px] font-bold rounded"
                                        >
                                            {sic}
                                            <button onClick={() => onRemoveSic(sic)} className="hover:text-slate-200">
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <input
                                type="text"
                                value={sicSearch}
                                onChange={e => setSicSearch(e.target.value)}
                                placeholder="Search SIC code or description…"
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
                                autoFocus={false}
                            />

                            <div className="mt-2 max-h-48 overflow-y-auto border border-slate-100 rounded">
                                {filteredSics.length === 0 && (
                                    <div className="px-3 py-3 text-xs text-slate-500 text-center italic">
                                        No matching SIC codes
                                    </div>
                                )}
                                {filteredSics.map(sic => (
                                    <button
                                        key={sic}
                                        onClick={() => {
                                            onAddSic(sic);
                                            setSicSearch("");
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                                    >
                                        <div className="font-bold text-slate-900">{sic}</div>
                                        <div className="text-[10px] text-slate-500 line-clamp-2">{getSicDescription(sic)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {disabled && (
                        <div className="px-4 py-6 text-xs text-slate-500 text-center">
                            Load a company to enable filters.
                        </div>
                    )}
                </PopoverContent>
            </Popover>

            {/* At-a-glance active filter chips, Linear-style */}
            {sicFilters.slice(0, 2).map(sic => (
                <span
                    key={sic}
                    className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-medium rounded"
                    title={getSicDescription(sic)}
                >
                    SIC {sic}
                    <button onClick={() => onRemoveSic(sic)} className="hover:text-slate-900">
                        <X className="h-2.5 w-2.5" />
                    </button>
                </span>
            ))}
            {sicFilters.length > 2 && (
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-medium rounded">
                    +{sicFilters.length - 2}
                </span>
            )}
        </div>
    );
};

export default FiltersMenu;
