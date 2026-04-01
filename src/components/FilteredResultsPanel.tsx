import React from 'react';
import { Node, Edge } from 'reactflow';
import { X, Building2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getSicDescription } from '@/lib/utils';

interface FilteredResultsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    nodes: Node[];
    edges: Edge[];
    visibleNodeIds: Set<string>;
    onNodeClick: (node: Node) => void;
}

export function FilteredResultsPanel({ isOpen, onClose, nodes, edges, visibleNodeIds, onNodeClick }: FilteredResultsPanelProps) {
    const activeCompanies = nodes.filter(n => n.data.type === 'company' && visibleNodeIds.has(n.id));

    const exportSidebarCSV = () => {
        const rows: any[] = [];

        activeCompanies.forEach(company => {
            const sics = (company.data.source?.sic_codes || []).map((c: any) => String(c));
            const sicString = sics.map((code: string) => `${code} - ${getSicDescription(code)}`).join("; ");

            const connectedEdges = edges.filter(e => e.source === company.id || e.target === company.id);

            if (connectedEdges.length === 0) {
                rows.push({
                    "Company Name": company.data.label,
                    "Company Number": company.id,
                    "Company Status": company.data.status || "",
                    "Nature of Business": sicString,
                    "Company Address": company.data.address || "",
                    "Connected Entity Name": "",
                    "Connection Type": "",
                    "Entity Address": "",
                    "Entity Details": ""
                });
                return;
            }

            connectedEdges.forEach(edge => {
                const isSource = edge.source === company.id;
                const otherNodeId = isSource ? edge.target : edge.source;
                const otherNode = nodes.find(n => n.id === otherNodeId);
                
                if (!otherNode || otherNode.data.type === 'address') return;
                
                rows.push({
                    "Company Name": company.data.label,
                    "Company Number": company.id,
                    "Company Status": company.data.status || "",
                    "Nature of Business": sicString,
                    "Company Address": company.data.address || "",
                    "Connected Entity Name": otherNode.data.label,
                    "Connection Type": edge.label || otherNode.data.role || "",
                    "Entity Address": otherNode.data.address || "",
                    "Entity Details": otherNode.data.subtext || ""
                });
            });
        });

        if (rows.length === 0) return;
        
        const headers = Object.keys(rows[0]);
        const csvContent = [
            headers.join(","),
            ...rows.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || "")).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `filtered_network_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div
            className={cn(
                "absolute top-16 left-4 bottom-4 w-[350px] bg-white/95 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200/60 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] z-[60] flex flex-col overflow-hidden",
                isOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
            )}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50 bg-white/50">
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">Filtered Results</h2>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{activeCompanies.length} businesses matching filter</p>
                </div>
                <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" onClick={exportSidebarCSV} className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full" title="Export this list to CSV">
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {activeCompanies.map(company => {
                    const sics = company.data.source?.sic_codes || [];
                    const primarySic = sics.length > 0 ? String(sics[0]) : null;

                    return (
                        <div 
                            key={company.id}
                            onClick={() => onNodeClick(company)}
                            className="p-3 bg-white border border-slate-100 rounded-lg hover:border-[#132B5C]/30 hover:shadow-sm cursor-pointer transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 p-1.5 bg-slate-50 rounded-md text-slate-400 group-hover:text-[#132B5C] group-hover:bg-[#132B5C]/5 transition-colors">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[13px] font-semibold text-slate-900 leading-snug break-words pr-2">{company.data.label}</h3>
                                    <div className="flex flex-col gap-0.5 mt-1.5">
                                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{company.data.status || 'Unknown Status'}</p>
                                        <span className="text-[10.5px] text-slate-400 font-mono tracking-tight">{company.id}</span>
                                    </div>
                                    
                                    {primarySic && (
                                        <div className="mt-2.5 flex flex-wrap gap-1">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 border border-slate-200/60 text-slate-600 line-clamp-2" title={getSicDescription(primarySic)}>
                                                {primarySic} - {getSicDescription(primarySic)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {activeCompanies.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-full">
                        <div className="bg-slate-50 p-3 rounded-full mb-3">
                            <Building2 className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="font-medium text-slate-600">No active businesses</p>
                        <p className="text-slate-400 mt-1">Adjust your filters to see results here.</p>
                    </div>
                )}
            </div>
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #94a3b8;
                }
            `}</style>
        </div>
    );
}
