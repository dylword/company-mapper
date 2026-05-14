import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn, getSicDescription } from '@/lib/utils';
import { Building2, User, MapPin, Crown, ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";

const CH_BASE = 'https://find-and-update.company-information.service.gov.uk';

const getCompaniesHouseUrl = (id: string, data: any): string | null => {
    const type = data?.type || 'company';
    // PSC and officer links sometimes come directly from the Companies House API
    const apiSelf: string | undefined = data?.source?.links?.self;
    if (apiSelf && typeof apiSelf === 'string' && apiSelf.startsWith('/')) {
        return `${CH_BASE}${apiSelf}`;
    }

    switch (type) {
        case 'company': {
            // Custom nodes don't have a real company_number — bail out.
            if (data?.isCustom) return null;
            const num = data?.source?.company_number || id;
            if (!num) return null;
            return `${CH_BASE}/company/${num}`;
        }
        case 'officer': {
            const officerId = data?.officer_id || data?.source?.officer_id;
            if (!officerId) return null;
            return `${CH_BASE}/officers/${officerId}/appointments`;
        }
        default:
            return null;
    }
};

const BusinessCardNode = ({ id, data, selected }: NodeProps) => {
    const type = data.type || 'company'; // default to company

    const getAccentColor = () => {
        if (data.customColor) return data.customColor;
        switch (type) {
            case 'officer': return 'bg-emerald-500';
            case 'address': return 'bg-slate-500';
            case 'psc': return 'bg-amber-500';
            default: return 'bg-[#132B5C]'; // company
        }
    };

    const getIcon = () => {
        const isCustom = data.isCustom;
        const isDualRole = !!data.isDualRole;
        const iconType = data.customIcon || type;

        // Helper to format date
        switch (iconType) {
            case 'officer': return <User className={cn("h-4 w-4", data.customColor ? "" : "text-emerald-600")} style={data.customColor ? { color: data.customColor } : undefined} />;
            case 'address': return <MapPin className="h-4 w-4 text-slate-600" />;
            case 'psc': return <Crown className="h-4 w-4 text-amber-600" />;
            case 'company': return <Building2 className="h-4 w-4 text-slate-900" />;
            case 'officer|psc': return (
                <div className="flex gap-1">
                    <User className="h-4 w-4 text-emerald-600" />
                    <Crown className="h-4 w-4 text-amber-600" />
                </div>
            );
            default: return <Building2 className="h-4 w-4 text-slate-900" />;
        }
    };

    const isOfficer = type === 'officer';
    const isPsc = type === 'psc';
    const isCompany = type === 'company';
    const isDualRole = !!data.isDualRole;

    const chUrl = getCompaniesHouseUrl(id, data);

    const formatDate = (dateString: string) => {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            console.error("Invalid date string:", dateString);
            return dateString; // Return original if invalid
        }
    };

    return (
        <div
            className={cn(
                "group w-[240px] bg-white rounded-md border border-slate-200 transition-all duration-200 relative",
                "shadow-[0px_4px_9px_0px_rgba(23,26,31,0.11),0px_0px_2px_0px_rgba(23,26,31,0.12)]", // Finspye shadow
                selected && "ring-2 ring-[#132B5C] ring-offset-2 shadow-md"
            )}
        >
            {/* Top Accent Bar (Replaces left accent to look more like a premium card) */}
            <div
                className={cn(
                    "h-1.5 w-full rounded-t-md",
                    !data.customColor && !data.isDualRole && getAccentColor(),
                    !data.customColor && data.isDualRole && "bg-gradient-to-r from-emerald-500 to-amber-500"
                )}
                style={data.customColor ? { backgroundColor: data.customColor } : undefined}
            />

            <div className="px-4 py-3">
                {/* Header: Entity Name */}
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">
                        {data.label}
                    </div>
                    <div className="shrink-0 mt-0.5 flex items-center gap-1.5">
                        {chUrl && (
                            <a
                                href={chUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                title="Open on Companies House"
                                className="nodrag inline-flex items-center justify-center h-4 w-4 rounded text-slate-400 hover:text-[#132B5C] hover:bg-slate-100 transition-colors"
                            >
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                        {getIcon()}
                    </div>
                </div>

                {/* Body: Role/Type */}
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    {data.role || "Entity"}
                </div>

                {/* Optional: Extra details if needed */}
                {(data.subtext || data.status || data.country_of_residence || data.address || (type !== 'address' && data.source?.sic_codes)) && (
                    <div className="mt-2 text-xs text-slate-400 border-t border-slate-100 pt-1 flex flex-col gap-0.5">
                        {data.subtext && <span>{data.subtext}</span>}
                        {data.status && (
                            <span className={cn(
                                "font-medium",
                                data.status === 'active' ? "text-emerald-600" : "text-red-500"
                            )}>
                                {data.status.toUpperCase()}
                            </span>
                        )}
                        {data.country_of_residence && <span>{data.country_of_residence}</span>}
                        {data.address && <span className="truncate">{data.address}</span>}
                        {type !== 'address' && data.source?.sic_codes && data.source.sic_codes.length > 0 && (
                            <span className="truncate border border-slate-200 bg-slate-50 text-slate-500 rounded px-1.5 py-0.5 mt-1 font-medium text-[10px]" title={getSicDescription(data.source.sic_codes[0])}>
                                {data.source.sic_codes[0]}: {getSicDescription(data.source.sic_codes[0])}
                                {data.source.sic_codes.length > 1 && ` (+${data.source.sic_codes.length - 1})`}
                            </span>
                        )}
                    </div>
                )}

                {/* Notes Indicator */}
                {data.notes && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 truncate">
                        📝 {data.notes}
                    </div>
                )}

                {/* Probable merge prompt */}
                {data.probableDuplicateOf && (
                    <div className="mt-2 text-xs pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium">Possible duplicate</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-5 text-[10px] px-2 py-0 bg-slate-100 hover:bg-slate-200 text-slate-700"
                            onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                data.onMerge?.(data.probableDuplicateOf, id);
                            }}
                        >
                            Merge?
                        </Button>
                    </div>
                )}
            </div>

            {/* Interactive Handles for manual connections */}
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                className="w-3 h-3 bg-slate-300 border-2 border-white opacity-70 hover:opacity-100 hover:bg-slate-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="w-3 h-3 bg-slate-300 border-2 border-white opacity-70 hover:opacity-100 hover:bg-slate-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                className="w-3 h-3 bg-slate-300 border-2 border-white opacity-70 hover:opacity-100 hover:bg-slate-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="w-3 h-3 bg-slate-300 border-2 border-white opacity-70 hover:opacity-100 hover:bg-slate-500 hover:scale-150 transition-all cursor-crosshair"
                isConnectable={true}
            />
        </div>
    );
};

export default memo(BusinessCardNode);
