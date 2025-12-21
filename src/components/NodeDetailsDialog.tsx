import React, { useState } from 'react';
import {
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Node } from 'reactflow';
import { Building2, User, MapPin, FileText, Calendar, Globe, Briefcase, PoundSterling } from 'lucide-react';

interface NodeDetailsDialogProps {
    node: Node | null;
    onClose: () => void;
    onExpand: () => void;
    onSave: (customColor: string, notes: string) => void;
    onNodeUpdate: (data: any) => void;
}

export function NodeDetailsDialog({ node, onClose, onExpand, onSave, onNodeUpdate }: NodeDetailsDialogProps) {
    const [activeTab, setActiveTab] = useState('overview');
    const [customColor, setCustomColor] = useState(node?.data.customColor || "");
    const [notes, setNotes] = useState(node?.data.notes || "");
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Fetch full details if missing
    React.useEffect(() => {
        if (!node) return;
        const { data } = node;

        // Check if it's a company and missing rich data (e.g. sic_codes or accounts)
        // We use 'sic_codes' as a proxy for "full profile loaded"
        if (data.type === 'company' && data.source && !data.source.sic_codes && !isLoadingDetails) {
            const fetchFullDetails = async () => {
                setIsLoadingDetails(true);
                try {
                    const res = await fetch(`/api/company/${node.id}`);
                    const json = await res.json();

                    if (json.company) {
                        // Update the node data with the full company profile
                        onNodeUpdate({
                            source: json.company,
                            // Also update top-level fields if needed, but source is the main one
                            subtext: `Inc: ${json.company.date_of_creation}`,
                            status: json.company.company_status,
                            address: [json.company.registered_office_address.address_line_1, json.company.registered_office_address.locality].filter(Boolean).join(', ')
                        });
                    }
                } catch (err) {
                    console.error("Failed to fetch full details", err);
                } finally {
                    setIsLoadingDetails(false);
                }
            };
            fetchFullDetails();
        }
    }, [node, onNodeUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!node) return null;

    const { data } = node;
    const isCompany = data.type === 'company';
    const isOfficer = data.type === 'officer';
    const isPsc = data.type === 'psc';
    const isAddress = data.type === 'address';

    // Helper to format keys
    const formatKey = (k: string) => k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Helper to format date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const renderTabButton = (id: string, label: string, icon: React.ReactNode) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${isCompany ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                isOfficer ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    isPsc ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                {data.type}
                            </span>
                            {data.status && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${data.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                    {data.status}
                                </span>
                            )}
                            {isLoadingDetails && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border bg-slate-100 text-slate-500 border-slate-200 animate-pulse">
                                    Updating...
                                </span>
                            )}
                        </div>
                        <DialogTitle className="text-2xl font-bold text-slate-900 leading-tight">
                            {data.label}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 mt-1 flex items-center gap-2">
                            {isCompany && <Building2 className="h-3 w-3" />}
                            {isOfficer && <User className="h-3 w-3" />}
                            {isAddress && <MapPin className="h-3 w-3" />}
                            {data.role}
                        </DialogDescription>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex px-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                {renderTabButton('overview', 'Overview', <FileText className="h-3 w-3" />)}
                {(isCompany || isAddress) && renderTabButton('address', 'Address', <MapPin className="h-3 w-3" />)}
                {isCompany && renderTabButton('financials', 'Financials', <PoundSterling className="h-3 w-3" />)}
                {(isOfficer || isPsc) && renderTabButton('personal', 'Personal', <User className="h-3 w-3" />)}
                {renderTabButton('customize', 'Customize', <Briefcase className="h-3 w-3" />)}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            {isCompany && (
                                <>
                                    <div className="space-y-1">
                                        <span className="text-xs font-medium text-slate-400 uppercase">Company Number</span>
                                        <p className="text-sm font-medium text-slate-900">{node.id}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs font-medium text-slate-400 uppercase">Incorporated</span>
                                        <p className="text-sm font-medium text-slate-900">{data.subtext?.replace('Inc: ', '') || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs font-medium text-slate-400 uppercase">Type</span>
                                        <p className="text-sm font-medium text-slate-900">{data.source?.type || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs font-medium text-slate-400 uppercase">Jurisdiction</span>
                                        <p className="text-sm font-medium text-slate-900">{data.source?.jurisdiction || 'N/A'}</p>
                                    </div>
                                </>
                            )}
                            {(isOfficer || isPsc) && (
                                <>
                                    <div className="space-y-1">
                                        <span className="text-xs font-medium text-slate-400 uppercase">Appointed On</span>
                                        <p className="text-sm font-medium text-slate-900">{formatDate(data.appointed_on)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs font-medium text-slate-400 uppercase">Nationality</span>
                                        <p className="text-sm font-medium text-slate-900">{data.nationality || 'N/A'}</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {isCompany && data.source?.sic_codes && (
                            <div className="space-y-2">
                                <span className="text-xs font-medium text-slate-400 uppercase">Nature of Business (SIC)</span>
                                <div className="flex flex-wrap gap-2">
                                    {data.source.sic_codes.map((code: string) => (
                                        <span key={code} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                            {code}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'address' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-900">Registered Office Address</p>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {data.source?.registered_office_address?.address_line_1}<br />
                                        {data.source?.registered_office_address?.address_line_2 && <>{data.source.registered_office_address.address_line_2}<br /></>}
                                        {data.source?.registered_office_address?.locality}<br />
                                        {data.source?.registered_office_address?.postal_code}<br />
                                        {data.source?.registered_office_address?.country}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'financials' && isCompany && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-400 uppercase">Next Accounts Due</span>
                                <p className="text-sm font-medium text-slate-900">{formatDate(data.source?.accounts?.next_accounts?.due_on)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-400 uppercase">Last Accounts Made Up To</span>
                                <p className="text-sm font-medium text-slate-900">{formatDate(data.source?.accounts?.last_accounts?.made_up_to)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-400 uppercase">Next Confirmation Statement</span>
                                <p className="text-sm font-medium text-slate-900">{formatDate(data.source?.confirmation_statement?.next_due)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-400 uppercase">Last Confirmation Statement</span>
                                <p className="text-sm font-medium text-slate-900">{formatDate(data.source?.confirmation_statement?.last_made_up_to)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'personal' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-400 uppercase">Occupation</span>
                                <p className="text-sm font-medium text-slate-900">{data.occupation || 'N/A'}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-slate-400 uppercase">Country of Residence</span>
                                <p className="text-sm font-medium text-slate-900">{data.country_of_residence || 'N/A'}</p>
                            </div>
                            {data.source?.date_of_birth && (
                                <div className="space-y-1">
                                    <span className="text-xs font-medium text-slate-400 uppercase">Born</span>
                                    <p className="text-sm font-medium text-slate-900">
                                        {data.source.date_of_birth.month}/{data.source.date_of_birth.year}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'customize' && (
                    <div className="space-y-6">
                        {/* Customization: Color */}
                        <div className="space-y-3">
                            <span className="text-sm font-medium text-slate-900">Node Color</span>
                            <div className="flex gap-2 flex-wrap">
                                {['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'].map((color) => (
                                    <button
                                        key={color}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${customColor === color ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setCustomColor(color)}
                                    />
                                ))}
                                <button
                                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${!customColor ? 'border-slate-900 bg-slate-100 text-slate-900' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                    onClick={() => setCustomColor("")}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Customization: Notes */}
                        <div className="space-y-2">
                            <span className="text-sm font-medium text-slate-900">Investigation Notes</span>
                            <textarea
                                className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[120px] resize-none bg-slate-50"
                                placeholder="Add private notes about this entity..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 justify-end">
                <Button variant="outline" onClick={onExpand} className="border-slate-200 hover:bg-white hover:text-slate-900">
                    Expand Network
                </Button>
                <Button onClick={() => {
                    onSave(customColor, notes);
                    onClose();
                }} className="bg-slate-900 text-white hover:bg-slate-800">
                    Save Changes
                </Button>
            </div>
        </DialogContent>
    );
}
