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
            default: return 'bg-[#132B5C]'; // company
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
                "group w-[240px] bg-white rounded-md border border-slate-200 transition-all duration-200 relative",
                "shadow-[0px_4px_9px_0px_rgba(23,26,31,0.11),0px_0px_2px_0px_rgba(23,26,31,0.12)]", // Finspye shadow
                selected && "ring-2 ring-[#132B5C] ring-offset-2 shadow-md"
            )}
        >
            {/* Top Accent Bar (Replaces left accent to look more like a premium card) */}
            <div
                className={cn("h-1.5 w-full rounded-t-md", !data.customColor && getAccentColor())}
                style={data.customColor ? { backgroundColor: data.customColor } : undefined}
            />

            <div className="px-4 py-3">
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
