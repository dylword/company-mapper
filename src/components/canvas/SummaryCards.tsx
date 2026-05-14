"use client";

import React from "react";
import type { Node, Edge } from "reactflow";
import { Building2, Users, MapPin, Crown, User, Link2, CircleDot, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { findRootNodeId } from "@/lib/connection-path";

interface SummaryCardsProps {
    nodes: Node[];
    edges: Edge[];
    onTargetClick?: (node: Node) => void;
}

const Stat: React.FC<{
    icon: React.ComponentType<{ className?: string }>;
    value: React.ReactNode;
    tooltip: string;
    iconColor?: string;
}> = ({ icon: Icon, value, tooltip, iconColor }) => (
    <div
        className="group relative inline-flex items-center gap-1 tabular-nums"
        title={tooltip}
    >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor || "text-slate-500")} />
        <span className="text-[12px] font-semibold text-slate-800">{value}</span>
    </div>
);

const dataType = (n: Node): string => {
    if (n.type === "noteNode" || n.data?.type === "note") return "note";
    return n.data?.type || "company";
};

export const SummaryCards: React.FC<SummaryCardsProps> = ({ nodes, edges, onTargetClick }) => {
    const targetId = findRootNodeId(nodes);
    const target = targetId ? nodes.find(n => n.id === targetId) : null;

    const stats = React.useMemo(() => {
        const companies = nodes.filter(n => dataType(n) === "company").length;
        const officers = nodes.filter(n => dataType(n) === "officer" || dataType(n) === "officer|psc").length;
        const pscs = nodes.filter(n => dataType(n) === "psc" || dataType(n) === "officer|psc").length;
        const addresses = nodes.filter(n => dataType(n) === "address").length;
        const connections = edges.length;
        return { companies, officers, pscs, addresses, connections };
    }, [nodes, edges]);

    // Director count for the target = officer-typed neighbours in the edge list.
    const targetDirectors = React.useMemo(() => {
        if (!target) return 0;
        const neighbourIds = new Set<string>();
        edges.forEach(e => {
            if (e.source === target.id) neighbourIds.add(e.target);
            else if (e.target === target.id) neighbourIds.add(e.source);
        });
        let count = 0;
        neighbourIds.forEach(id => {
            const n = nodes.find(x => x.id === id);
            if (!n) return;
            const t = dataType(n);
            if (t === "officer" || t === "officer|psc") count += 1;
        });
        return count;
    }, [target, nodes, edges]);

    if (!target && stats.companies === 0) return null;

    const status = (target?.data?.status as string | undefined)?.toLowerCase();
    const statusActive = status === "active";

    return (
        <div className="flex items-stretch gap-2 min-w-0">
            {target && (
                <button
                    type="button"
                    onClick={() => onTargetClick?.(target)}
                    className={cn(
                        "group min-w-0 max-w-[420px] flex items-center gap-2.5 h-[44px] px-3 rounded-md bg-white border border-slate-200 text-left transition-colors hover:border-[#132B5C]/40 hover:shadow-sm",
                    )}
                    title={`Recentre canvas on ${target.data.label}`}
                >
                    <div className="h-7 w-7 shrink-0 rounded-md bg-[#132B5C]/8 flex items-center justify-center relative">
                        <Building2 className="h-3.5 w-3.5 text-[#132B5C] group-hover:opacity-0 transition-opacity" />
                        <Crosshair className="h-3.5 w-3.5 text-[#132B5C] absolute opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="min-w-0 flex flex-col leading-tight">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[13px] font-bold text-slate-900 truncate">
                                {target.data.label || "Unnamed"}
                            </span>
                            {status && (
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1 px-1.5 rounded text-[9px] font-semibold uppercase tracking-wide shrink-0",
                                        statusActive
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-red-50 text-red-700"
                                    )}
                                    title={`Status: ${status}`}
                                >
                                    <CircleDot className="h-2.5 w-2.5" />
                                    {status}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 min-w-0">
                            <Stat
                                icon={Users}
                                value={targetDirectors}
                                tooltip={`${targetDirectors} director${targetDirectors === 1 ? "" : "s"} on canvas`}
                                iconColor="text-emerald-600"
                            />
                            {target.data.address && (
                                <div
                                    className="inline-flex items-center gap-1 min-w-0"
                                    title={target.data.address}
                                >
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                    <span className="text-[11px] text-slate-600 truncate">
                                        {target.data.address}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </button>
            )}

            <div className="flex items-center gap-3 h-[44px] px-3 rounded-md bg-white border border-slate-200">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 hidden xl:block">
                    Network
                </div>
                <Stat
                    icon={Building2}
                    value={stats.companies}
                    tooltip={`${stats.companies} companies on canvas`}
                    iconColor="text-[#132B5C]"
                />
                <Stat
                    icon={User}
                    value={stats.officers}
                    tooltip={`${stats.officers} officers / directors`}
                    iconColor="text-emerald-600"
                />
                <Stat
                    icon={Crown}
                    value={stats.pscs}
                    tooltip={`${stats.pscs} PSCs`}
                    iconColor="text-amber-600"
                />
                <Stat
                    icon={MapPin}
                    value={stats.addresses}
                    tooltip={`${stats.addresses} addresses`}
                    iconColor="text-slate-500"
                />
                <div className="w-px h-4 bg-slate-200" />
                <Stat
                    icon={Link2}
                    value={stats.connections}
                    tooltip={`${stats.connections} connections`}
                    iconColor="text-slate-500"
                />
            </div>
        </div>
    );
};

export default SummaryCards;
