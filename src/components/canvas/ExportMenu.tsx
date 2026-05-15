"use client";

import React from "react";
import { Download, FileSpreadsheet, FileText, Camera, ChevronDown, FileJson } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ScreenshotScale = 1 | 2 | 4;

interface ScreenshotOptions {
    scale: ScreenshotScale;
    fitVisible: boolean;
}

interface ExportMenuProps {
    onExportCSV: () => void;
    onExportExcel: () => void;
    onExportJSON: () => void;
    onDownloadScreenshot: (options?: ScreenshotOptions) => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ onExportCSV, onExportExcel, onExportJSON, onDownloadScreenshot }) => {
    const [open, setOpen] = React.useState(false);
    const [scale, setScale] = React.useState<ScreenshotScale>(2);
    const [fitVisible, setFitVisible] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[260px] p-1.5">
                <button
                    onClick={() => {
                        onExportExcel();
                        setOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left hover:bg-slate-50"
                >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900">Export to Excel</div>
                        <div className="text-[10px] text-slate-500">.xlsx workbook</div>
                    </div>
                </button>
                <button
                    onClick={() => {
                        onExportCSV();
                        setOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left hover:bg-slate-50"
                >
                    <FileText className="h-4 w-4 text-slate-500" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900">Export to CSV</div>
                        <div className="text-[10px] text-slate-500">Plain text rows</div>
                    </div>
                </button>
                <button
                    onClick={() => {
                        onExportJSON();
                        setOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left hover:bg-slate-50"
                >
                    <FileJson className="h-4 w-4 text-indigo-500" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900">Export to JSON</div>
                        <div className="text-[10px] text-slate-500">Nodes, edges & metadata</div>
                    </div>
                </button>

                <div className="mt-1 pt-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-2.5 px-2.5 pb-1.5">
                        <Camera className="h-4 w-4 text-slate-500" />
                        <div className="text-xs font-medium text-slate-900">Screenshot (PNG)</div>
                    </div>
                    <div className="px-2.5">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Quality</div>
                        <div className="flex gap-1 mb-2">
                            {([1, 2, 4] as ScreenshotScale[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setScale(s)}
                                    className={cn(
                                        "flex-1 h-7 text-[11px] font-medium rounded-md border transition-colors",
                                        scale === s
                                            ? "border-[#132B5C] bg-[#132B5C] text-white hover:bg-[#132B5C]/90"
                                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    {s}×{s === 2 ? " (default)" : s === 4 ? " (print)" : ""}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer mb-1.5">
                            <input
                                type="checkbox"
                                checked={fitVisible}
                                onChange={(e) => setFitVisible(e.target.checked)}
                                className="h-3.5 w-3.5 accent-[#132B5C]"
                            />
                            Capture visible area only
                        </label>
                        <div className="text-[10px] text-slate-500 leading-snug mb-2">
                            {fitVisible
                                ? "Saves what you can see right now. Best for big graphs."
                                : "Saves the entire graph. Output auto-caps to prevent crashes."}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            onDownloadScreenshot({ scale, fitVisible });
                            setOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium bg-[#132B5C] text-white hover:bg-[#132B5C]/90 transition-colors"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Download PNG
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default ExportMenu;
