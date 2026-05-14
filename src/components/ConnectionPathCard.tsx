"use client";

import React from "react";
import { Node, Edge } from "reactflow";
import { Building2, User, Crown, MapPin, GitBranch, ArrowDown } from "lucide-react";
import { tracePath, findRootNodeId } from "@/lib/connection-path";
import { cn } from "@/lib/utils";

interface ConnectionPathCardProps {
    node: Node;
    nodes: Node[];
    edges: Edge[];
}

const typeMeta: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }> = {
    company: { icon: Building2, color: "text-[#132B5C]", bg: "bg-[#132B5C]/5", border: "border-[#132B5C]/20" },
    officer: { icon: User, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    psc: { icon: Crown, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    address: { icon: MapPin, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
};

export const ConnectionPathCard: React.FC<ConnectionPathCardProps> = ({ node, nodes, edges }) => {
    const rootId = React.useMemo(() => findRootNodeId(nodes), [nodes]);
    const path = React.useMemo(() => {
        if (!rootId) return null;
        return tracePath(rootId, node.id, nodes, edges);
    }, [rootId, node.id, nodes, edges]);

    // If this IS the root, or no path could be found, hide the card.
    if (!path || !rootId || rootId === node.id) return null;

    const stops: Node[] = [path.root, ...path.hops.map(h => h.to)];

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-slate-400" />
                    Connection path
                </h3>
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {path.hops.length} {path.hops.length === 1 ? "hop" : "hops"} from target
                </span>
            </div>

            {/* Plain-English narrative */}
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-3">
                {path.narrative}
            </p>

            {/* Visual chain */}
            <div className="space-y-1">
                {stops.map((stop, idx) => {
                    const meta = typeMeta[stop.data?.type as string] || typeMeta.company;
                    const Icon = meta.icon;
                    const isRoot = idx === 0;
                    const isTarget = idx === stops.length - 1;
                    const hop = idx > 0 ? path.hops[idx - 1] : null;

                    return (
                        <React.Fragment key={stop.id + idx}>
                            {hop && (
                                <div className="flex items-center gap-2 pl-3">
                                    <ArrowDown className="h-3 w-3 text-slate-300" />
                                    <span className="text-[10px] text-slate-500 italic">
                                        {typeof hop.edge.label === "string" && hop.edge.label
                                            ? hop.edge.label
                                            : "connected"}
                                    </span>
                                </div>
                            )}
                            <div
                                className={cn(
                                    "flex items-start gap-2.5 rounded-lg border p-2.5",
                                    meta.bg,
                                    meta.border,
                                    isTarget && "ring-2 ring-[#132B5C]/30"
                                )}
                            >
                                <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", meta.color)} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                        {stop.data?.label || "Unnamed"}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                        {isRoot ? "Initial search" : stop.data?.role || stop.data?.type}
                                        {isTarget && !isRoot && " · this node"}
                                    </div>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default ConnectionPathCard;
