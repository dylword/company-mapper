"use client";

import React from "react";
import { Building2, User, Crown, MapPin, StickyNote, Link2, FileSpreadsheet, FileText, FileJson, Filter, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ExportFormat = "excel" | "csv" | "json";

export type ExportScope = "all" | "filtered";

export interface ExportOptions {
    scope: ExportScope;
    includeCompanies: boolean;
    includeOfficers: boolean;
    includePscs: boolean;
    includeAddresses: boolean;
    includeNotes: boolean;
    includeEdges: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
    scope: "all",
    includeCompanies: true,
    includeOfficers: true,
    includePscs: true,
    includeAddresses: true,
    includeNotes: true,
    includeEdges: true,
};

export type ExportCounts = Record<Exclude<keyof ExportOptions, "scope">, number>;

interface ExportOptionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    format: ExportFormat | null;
    allCounts: ExportCounts;
    filteredCounts: ExportCounts;
    hasActiveFilter: boolean;
    onConfirm: (options: ExportOptions) => void;
}

const TYPE_ROWS: {
    key: keyof ExportCounts;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
}[] = [
    { key: "includeCompanies", label: "Companies", description: "Company entities, status, SIC codes", icon: Building2, iconColor: "text-[#132B5C]" },
    { key: "includeOfficers", label: "Officers / Directors", description: "People appointed to companies", icon: User, iconColor: "text-emerald-600" },
    { key: "includePscs", label: "PSCs", description: "Persons with significant control", icon: Crown, iconColor: "text-amber-600" },
    { key: "includeAddresses", label: "Addresses", description: "Registered + correspondence locations", icon: MapPin, iconColor: "text-slate-600" },
    { key: "includeNotes", label: "Notes", description: "Sticky-note annotations on the canvas", icon: StickyNote, iconColor: "text-yellow-600" },
];

const FORMAT_META: Record<ExportFormat, { label: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; tabHint: string }> = {
    excel: { label: "Excel", icon: FileSpreadsheet, iconColor: "text-emerald-600", tabHint: "Combined sheet plus one tab per type" },
    csv: { label: "CSV", icon: FileText, iconColor: "text-slate-500", tabHint: "Single combined sheet (CSV has no tabs)" },
    json: { label: "JSON", icon: FileJson, iconColor: "text-indigo-500", tabHint: "Filtered nodes and edges with metadata" },
};

const Checkbox: React.FC<{ checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
            "h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
            disabled && "opacity-40 cursor-not-allowed",
            checked
                ? "bg-[#132B5C] border-[#132B5C] text-white"
                : "bg-white border-slate-300 hover:border-slate-400"
        )}
    >
        {checked && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )}
    </button>
);

export const ExportOptionsDialog: React.FC<ExportOptionsDialogProps> = ({
    open,
    onOpenChange,
    format,
    allCounts,
    filteredCounts,
    hasActiveFilter,
    onConfirm,
}) => {
    const [options, setOptions] = React.useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);

    React.useEffect(() => {
        if (open) {
            // Default to the filtered scope when canvas filters are active —
            // matches the user's mental model ("export what I'm looking at").
            setOptions({ ...DEFAULT_EXPORT_OPTIONS, scope: hasActiveFilter ? "filtered" : "all" });
        }
    }, [open, hasActiveFilter]);

    if (!format) return null;

    const fmt = FORMAT_META[format];
    const FmtIcon = fmt.icon;

    const counts: ExportCounts = options.scope === "filtered" ? filteredCounts : allCounts;
    const totalSelected = TYPE_ROWS.reduce((sum, r) => sum + (options[r.key] ? counts[r.key] : 0), 0);
    const canConfirm = totalSelected > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-[#132B5C]">
                        <FmtIcon className={cn("h-5 w-5", fmt.iconColor)} />
                        Export to {fmt.label}
                    </DialogTitle>
                    <DialogDescription>{fmt.tabHint}</DialogDescription>
                </DialogHeader>

                {hasActiveFilter && (
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-slate-100">
                        {([
                            { value: "all", label: "All on canvas", icon: Globe, count: allCounts.includeCompanies + allCounts.includeOfficers + allCounts.includePscs + allCounts.includeAddresses + allCounts.includeNotes },
                            { value: "filtered", label: "Only filtered", icon: Filter, count: filteredCounts.includeCompanies + filteredCounts.includeOfficers + filteredCounts.includePscs + filteredCounts.includeAddresses + filteredCounts.includeNotes },
                        ] as const).map(({ value, label, icon: Icon, count }) => {
                            const active = options.scope === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setOptions(prev => ({ ...prev, scope: value }))}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 h-8 rounded text-[11px] font-semibold transition-colors",
                                        active
                                            ? "bg-white text-[#132B5C] shadow-sm border border-slate-200"
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                    <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="space-y-1">
                    {TYPE_ROWS.map(row => {
                        const Icon = row.icon;
                        const count = counts[row.key];
                        const disabled = count === 0;
                        const checked = options[row.key] && !disabled;
                        return (
                            <label
                                key={row.key}
                                className={cn(
                                    "flex items-center gap-3 px-2 py-2 rounded-md transition-colors",
                                    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 cursor-pointer"
                                )}
                            >
                                <Checkbox
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={(next) => setOptions(prev => ({ ...prev, [row.key]: next }))}
                                />
                                <Icon className={cn("h-4 w-4 shrink-0", row.iconColor)} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-900">{row.label}</div>
                                    <div className="text-[10px] text-slate-500 truncate">{row.description}</div>
                                </div>
                                <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                                    {count}
                                </span>
                            </label>
                        );
                    })}
                </div>

                <div className="border-t border-slate-200 pt-3">
                    <label className={cn(
                        "flex items-center gap-3 px-2 py-2 rounded-md transition-colors",
                        counts.includeEdges === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 cursor-pointer"
                    )}>
                        <Checkbox
                            checked={options.includeEdges && counts.includeEdges > 0}
                            disabled={counts.includeEdges === 0}
                            onChange={(next) => setOptions(prev => ({ ...prev, includeEdges: next }))}
                        />
                        <Link2 className="h-4 w-4 text-slate-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-900">Connections</div>
                            <div className="text-[10px] text-slate-500 truncate">
                                {format === "excel" ? "Separate \"Connections\" tab" : "Source → target → relationship"}
                            </div>
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                            {counts.includeEdges}
                        </span>
                    </label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">
                        {totalSelected.toLocaleString()} {totalSelected === 1 ? "row" : "rows"} will be exported
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="text-slate-600 h-8"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={!canConfirm}
                            onClick={() => { onConfirm(options); onOpenChange(false); }}
                            className="bg-[#132B5C] hover:bg-[#0d1f44] text-white h-8"
                        >
                            Export
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ExportOptionsDialog;
