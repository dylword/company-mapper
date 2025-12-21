import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { Building2, User, MapPin, FileText, Calendar, Globe, Briefcase, PoundSterling, X, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn, formatCompanyType, formatJurisdiction, getSicDescription } from "@/lib/utils";

interface NodeDetailsPanelProps {
    node: Node | null;
    isOpen: boolean;
    onClose: () => void;
    onExpand: () => void;
    onSave: (customColor: string, notes: string) => void;
    onNodeUpdate: (data: any) => void;
}

export function NodeDetailsPanel({ node, isOpen, onClose, onExpand, onSave, onNodeUpdate }: NodeDetailsPanelProps) {
    const [customColor, setCustomColor] = useState("");
    const [notes, setNotes] = useState("");
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Sync state with node when it changes
    useEffect(() => {
        if (node) {
            setCustomColor(node.data.customColor || "");
            setNotes(node.data.notes || "");
        }
    }, [node]);

    const [companyOfficers, setCompanyOfficers] = useState<any[]>([]);
    const [companyPscs, setCompanyPscs] = useState<any[]>([]);

    // Fetch full details if missing (and officers/PSCs)
    useEffect(() => {
        if (!node || !isOpen) return;
        const { data } = node;

        // Reset lists when node changes
        setCompanyOfficers([]);
        setCompanyPscs([]);

        // Check if it's a company
        if (data.type === 'company') {
            const fetchFullDetails = async () => {
                setIsLoadingDetails(true);
                try {
                    const res = await fetch(`/api/company/${node.id}`);
                    const json = await res.json();

                    if (json.company) {
                        // Update node data if needed (existing logic)
                        if (!data.source || !data.source.sic_codes) {
                            onNodeUpdate({
                                source: json.company,
                                subtext: `Inc: ${json.company.date_of_creation}`,
                                status: json.company.company_status,
                                address: [json.company.registered_office_address.address_line_1, json.company.registered_office_address.locality].filter(Boolean).join(', ')
                            });
                        }
                    }

                    if (json.officers) setCompanyOfficers(json.officers);
                    if (json.pscs) setCompanyPscs(json.pscs);

                } catch (err) {
                    console.error("Failed to fetch full details", err);
                } finally {
                    setIsLoadingDetails(false);
                }
            };
            fetchFullDetails();
        }
    }, [node, isOpen, onNodeUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

    const [linkedCompanies, setLinkedCompanies] = useState<any[]>([]);
    const [isLoadingLinked, setIsLoadingLinked] = useState(false);

    // Fetch linked companies for officers/PSCs
    useEffect(() => {
        if (!node || !isOpen) return;
        const { data } = node;

        if ((data.type === 'officer' || data.type === 'psc') && data.officer_id) {
            const fetchLinked = async () => {
                setIsLoadingLinked(true);
                try {
                    const res = await fetch(`/api/officer/${data.officer_id}/appointments`);
                    const json = await res.json();
                    if (json.items) {
                        setLinkedCompanies(json.items);
                    }
                } catch (err) {
                    console.error("Failed to fetch linked companies", err);
                } finally {
                    setIsLoadingLinked(false);
                }
            };
            fetchLinked();
        } else {
            setLinkedCompanies([]);
        }
    }, [node, isOpen]);

    if (!node) return null;

    const { data } = node;
    const isCompany = data.type === 'company';
    const isOfficer = data.type === 'officer';
    const isPsc = data.type === 'psc';
    const isAddress = data.type === 'address';

    // Helper to format date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div
            className={cn(
                "absolute top-0 right-0 h-full w-[400px] bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border",
                            isCompany ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                isOfficer ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    isPsc ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-slate-50 text-slate-700 border-slate-200'
                        )}>
                            {data.type}
                        </span>
                        {data.status && (
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border",
                                data.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                            )}>
                                {data.status}
                            </span>
                        )}
                        {isLoadingDetails && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border bg-slate-100 text-slate-500 border-slate-200 animate-pulse">
                                Updating...
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 leading-tight pr-4">{data.label}</h2>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                        {isCompany ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {data.role}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

                {/* Overview Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        Overview
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {isCompany && (
                            <>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Number</span>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">{node.id}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incorporated</span>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">{data.subtext?.replace('Inc: ', '') || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</span>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">{formatCompanyType(data.source?.type)}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jurisdiction</span>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">{formatJurisdiction(data.source?.jurisdiction)}</p>
                                </div>
                            </>
                        )}
                        {(isOfficer || isPsc) && (
                            <>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appointed</span>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">{formatDate(data.appointed_on)}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nationality</span>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">{data.nationality || 'N/A'}</p>
                                </div>
                            </>
                        )}
                    </div>
                    {isCompany && data.source?.sic_codes && (
                        <div className="pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Nature of Business</span>
                            <div className="flex flex-col gap-2">
                                {data.source.sic_codes.map((code: string) => (
                                    <div key={code} className="px-2 py-1.5 bg-slate-50 text-slate-700 rounded text-xs font-medium border border-slate-100">
                                        <span className="font-bold text-slate-900 mr-2">{code}</span>
                                        {getSicDescription(code)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Officers & PSCs Card (Company Only) */}
                {isCompany && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            Officers & PSCs ({companyOfficers.length + companyPscs.length})
                        </h3>
                        {isLoadingDetails ? (
                            <div className="space-y-2">
                                <div className="h-8 bg-slate-100 rounded animate-pulse" />
                                <div className="h-8 bg-slate-100 rounded animate-pulse" />
                            </div>
                        ) : (companyOfficers.length > 0 || companyPscs.length > 0) ? (
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {companyPscs.map((psc, i) => (
                                    <div key={`psc-${i}`} className="p-2 bg-amber-50 rounded border border-amber-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{psc.name}</p>
                                            <p className="text-[10px] text-slate-500">{psc.nationality}</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">PSC</span>
                                    </div>
                                ))}
                                {companyOfficers.map((officer, i) => (
                                    <div key={`officer-${i}`} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{officer.name}</p>
                                            <p className="text-[10px] text-slate-500">{officer.officer_role}</p>
                                        </div>
                                        {officer.resigned_on ? (
                                            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Resigned</span>
                                        ) : (
                                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic">No officers found.</p>
                        )}
                    </div>
                )}

                {/* Linked Companies Card (Officers/PSCs) */}
                {(isOfficer || isPsc) && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            Linked Companies ({linkedCompanies.length})
                        </h3>
                        {isLoadingLinked ? (
                            <div className="space-y-2">
                                <div className="h-8 bg-slate-100 rounded animate-pulse" />
                                <div className="h-8 bg-slate-100 rounded animate-pulse" />
                            </div>
                        ) : linkedCompanies.length > 0 ? (
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                {linkedCompanies.map((item: any, i) => (
                                    <div key={i} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{item.appointed_to.company_name}</p>
                                            <p className="text-[10px] text-slate-500">{item.company_status}</p>
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-400">{item.officer_role}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic">No other linked companies found.</p>
                        )}
                    </div>
                )}

                {/* Address Card */}
                {(isCompany || isAddress) && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                Registered Address
                            </h3>
                            {/* Placeholder for "View on Map" action */}
                            <button className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                                View Map <ExternalLink className="h-3 w-3" />
                            </button>
                        </div>

                        {/* Map Visual Placeholder */}
                        <div className="h-24 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px]"></div>
                            <MapPin className="h-6 w-6 text-slate-400" />
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed">
                            {data.source?.registered_office_address?.address_line_1}<br />
                            {data.source?.registered_office_address?.address_line_2 && <>{data.source.registered_office_address.address_line_2}<br /></>}
                            {data.source?.registered_office_address?.locality}<br />
                            {data.source?.registered_office_address?.postal_code}<br />
                            {data.source?.registered_office_address?.country}
                        </p>
                    </div>
                )}

                {/* Financials Card */}
                {isCompany && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <PoundSterling className="h-4 w-4 text-slate-400" />
                            Financials
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-xs text-slate-500">Next Accounts Due</span>
                                <span className="text-sm font-medium text-slate-900">{formatDate(data.source?.accounts?.next_accounts?.due_on)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-xs text-slate-500">Last Accounts</span>
                                <span className="text-sm font-medium text-slate-900">{formatDate(data.source?.accounts?.last_accounts?.made_up_to)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-xs text-slate-500">Next Confirmation</span>
                                <span className="text-sm font-medium text-slate-900">{formatDate(data.source?.confirmation_statement?.next_due)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Personal Card */}
                {(isOfficer || isPsc) && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            Personal Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occupation</span>
                                <p className="text-sm font-medium text-slate-900 mt-0.5">{data.occupation || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Residence</span>
                                <p className="text-sm font-medium text-slate-900 mt-0.5">{data.country_of_residence || 'N/A'}</p>
                            </div>
                            {data.source?.date_of_birth && (
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Born</span>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                                        {data.source.date_of_birth.month}/{data.source.date_of_birth.year}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Customize Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-slate-400" />
                        Investigation
                    </h3>

                    <div className="space-y-3">
                        <span className="text-xs font-medium text-slate-500">Node Color</span>
                        <div className="flex gap-2 flex-wrap">
                            {['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'].map((color) => (
                                <button
                                    key={color}
                                    className={cn(
                                        "w-6 h-6 rounded-full border-2 transition-all",
                                        customColor === color ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'
                                    )}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setCustomColor(color)}
                                />
                            ))}
                            <button
                                className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all",
                                    !customColor ? 'border-slate-900 bg-slate-100 text-slate-900' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                )}
                                onClick={() => setCustomColor("")}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-medium text-slate-500">Notes</span>
                        <textarea
                            className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[80px] resize-none bg-slate-50"
                            placeholder="Add private notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex flex-col gap-3">
                <Button onClick={() => onSave(customColor, notes)} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                    Save Changes
                </Button>
                <Button variant="outline" onClick={onExpand} className="w-full border-slate-200 hover:bg-slate-50 text-slate-700">
                    Expand Connections <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
