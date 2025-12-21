import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { Building2, User, MapPin, Crown } from 'lucide-react';

const BusinessCardNode = ({ data, selected }: NodeProps) => {
    const type = data.type || 'company'; // default to company

    const getAccentColor = () => {
        if (data.customColor) return data.customColor;
        switch (type) {
            case 'officer': return 'bg-emerald-500';
            case 'address': return 'bg-slate-500';
            case 'psc': return 'bg-amber-500';
            default: return 'bg-slate-900'; // company
        }
    };

    const getIcon = () => {
        const iconType = data.customIcon || type;

        switch (iconType) {
            case 'officer': return <User className={cn("h-4 w-4", data.customColor ? "" : "text-emerald-600")} style={data.customColor ? { color: data.customColor } : undefined} />;
            case 'address': return <MapPin className="h-4 w-4 text-slate-600" />;
            case 'psc': return <Crown className="h-4 w-4 text-amber-600" />;
            case 'company': return <Building2 className="h-4 w-4 text-slate-900" />;
            default: return <Building2 className="h-4 w-4 text-slate-900" />;
        }
    };

    return (
        <div
            className={cn(
                "relative w-[240px] bg-white rounded-md border border-slate-200 shadow-sm transition-all duration-200",
                selected && "ring-2 ring-slate-900 ring-offset-2 shadow-md"
            )}
        >
            {/* Left Accent Bar */}
            <div
                className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-md", !data.customColor && getAccentColor())}
                style={data.customColor ? { backgroundColor: data.customColor } : undefined}
            />

            <div className="pl-5 pr-4 py-3">
                {/* Header: Entity Name */}
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">
                        {data.label}
                    </div>
                    <div className="shrink-0 mt-0.5">
                        {getIcon()}
                    </div>
                </div>

                {/* Body: Role/Type */}
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    {data.role || "Entity"}
                </div>

                {/* Optional: Extra details if needed */}
                {(data.subtext || data.status || data.country_of_residence || data.address) && (
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
                    </div>
                )}

                {/* Notes Indicator */}
                {data.notes && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 truncate">
                        📝 {data.notes}
                    </div>
                )}
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-slate-300 !w-2 !h-2 !border-0"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-slate-300 !w-2 !h-2 !border-0"
            />
        </div>
    );
};

export default memo(BusinessCardNode);
