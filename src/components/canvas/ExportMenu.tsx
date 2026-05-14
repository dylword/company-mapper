"use client";

import React from "react";
import { Download, FileSpreadsheet, FileText, Camera, ChevronDown, FileJson } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface ExportMenuProps {
    onExportCSV: () => void;
    onExportExcel: () => void;
    onExportJSON: () => void;
    onDownloadScreenshot: () => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ onExportCSV, onExportExcel, onExportJSON, onDownloadScreenshot }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[220px] p-1.5">
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
                <button
                    onClick={() => {
                        onDownloadScreenshot();
                        setOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left hover:bg-slate-50"
                >
                    <Camera className="h-4 w-4 text-slate-500" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900">Download screenshot</div>
                        <div className="text-[10px] text-slate-500">PNG of current view</div>
                    </div>
                </button>
            </PopoverContent>
        </Popover>
    );
};

export default ExportMenu;
