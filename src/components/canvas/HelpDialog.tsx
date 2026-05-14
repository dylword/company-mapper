"use client";

import React from "react";
import { HelpCircle, Building2, User, Crown, MapPin } from "lucide-react";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

const NODE_LEGEND = [
    {
        type: "Company",
        color: "#132B5C",
        icon: Building2,
        description: "A UK-registered company. The initially searched entity is the root of every map.",
    },
    {
        type: "Officer",
        color: "#10b981",
        icon: User,
        description: "A director, secretary or other appointed officer of a company.",
    },
    {
        type: "PSC",
        color: "#f59e0b",
        icon: Crown,
        description: "A Person with Significant Control — owns or controls more than 25% of the company.",
    },
    {
        type: "Address",
        color: "#64748b",
        icon: MapPin,
        description: "A registered office or correspondence address. Useful for spotting shared premises.",
    },
];

const DEPTH_LEVELS = [
    {
        level: 1,
        label: "Direct only",
        description:
            "Pulls the immediate officers, persons with significant control and the registered office for the selected company.",
    },
    {
        level: 2,
        label: "Two hops",
        description:
            "Also expands each officer and PSC to reveal the other companies they are appointed to or control.",
    },
    {
        level: 3,
        label: "Three hops",
        description:
            "Continues outward from those second-degree companies — useful for surfacing shared directorships and ownership chains. Higher rate-limit cost.",
    },
    {
        level: 4,
        label: "Four hops",
        description:
            "Deeper network sweep. Slower to load and more likely to brush the Companies House rate limit.",
    },
    {
        level: 5,
        label: "Five hops",
        description:
            "Maximum reach. Use sparingly — large networks become difficult to read and can exhaust the per-window API budget.",
    },
];

export const HelpDialog: React.FC = () => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Help"
                >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Help
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-[#132B5C]">Company Explorer guide</DialogTitle>
                    <DialogDescription>
                        Reference for what the colours mean and how each expansion depth widens the network.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-2">
                    <section>
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Node colour key
                        </h3>
                        <div className="space-y-2">
                            {NODE_LEGEND.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.type}
                                        className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50"
                                    >
                                        <div className="flex items-center gap-2 shrink-0 w-[110px]">
                                            <span
                                                className="inline-block w-3 h-3 rounded-sm"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <Icon
                                                className="h-3.5 w-3.5"
                                                style={{ color: item.color }}
                                            />
                                            <span className="text-xs font-semibold text-slate-900">
                                                {item.type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed flex-1">
                                            {item.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Expansion depth
                        </h3>
                        <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                            Depth controls how many hops away from the selected node the
                            expansion reaches. Each hop traverses an existing relationship
                            (appointment, control, or shared address).
                        </p>
                        <div className="space-y-2">
                            {DEPTH_LEVELS.map((d) => (
                                <div
                                    key={d.level}
                                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-100"
                                >
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#132B5C] text-white text-xs font-bold shrink-0">
                                        {d.level}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-slate-900 mb-0.5">
                                            {d.label}
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            {d.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Tips
                        </h3>
                        <ul className="text-xs text-slate-600 leading-relaxed space-y-1.5 list-disc pl-4">
                            <li>Click any node to open its detail panel and see its connection path back to the search target.</li>
                            <li>Use the Spacing menu to give a dense network room to breathe before exporting.</li>
                            <li>Companies House enforces a strict request budget — keep depth ≤ 3 unless you really need a wider sweep.</li>
                        </ul>
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default HelpDialog;
