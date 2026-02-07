
import { useState } from 'react';
import { Card, CardContent } from '../../ui_kit/components/ui/Card';
import { Button } from '../../ui_kit/components/ui/Button';
import { Checkbox } from '../../ui_kit/components/ui/Checkbox';
import { Badge } from '../../ui_kit/components/ui/Badge';
import { AlertCircle, CheckCircle2, PhoneForwarded, CheckSquare, ChevronDown, ChevronUp, FileText, MapPin, Calendar, Clock } from 'lucide-react';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';
import { getIntentColor } from '../../ui_kit/lib/utils';

// Shared Transcript Formatter Component
const TranscriptView = ({ text }: { text: string }) => {
    if (!text) return <span className="text-muted-foreground italic text-xs">No transcript available.</span>;

    const parts = text.split(/(AI:|User:)/g).filter(p => p.trim());
    const turns = [];

    if (parts.length > 0 && !parts[0].match(/^(AI:|User:)$/)) {
        turns.push({ speaker: 'Unknown', text: parts[0].trim() });
        for (let i = 1; i < parts.length; i += 2) {
            turns.push({ speaker: parts[i].replace(':', ''), text: parts[i + 1]?.trim() || '' });
        }
    } else {
        for (let i = 0; i < parts.length; i += 2) {
            turns.push({ speaker: parts[i].replace(':', ''), text: parts[i + 1]?.trim() || '' });
        }
    }

    return (
        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {turns.length === 0 ? (
                <p className="text-muted-foreground text-xs">{text}</p>
            ) : (
                turns.map((turn, i) => (
                    <div key={i} className="flex gap-3 text-[11px] sm:text-xs">
                        <span className={`font-bold shrink-0 w-8 ${turn.speaker === 'AI' ? 'text-primary' : 'text-foreground'}`}>
                            {turn.speaker}:
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                            {turn.text}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
};

const MOCK_ACTION_ITEMS = [
    {
        id: '2',
        date: '2024-02-05',
        called_at: '11:15 AM',
        caller_name: 'Jane Smith',
        customer_phone: '0498 765 432',
        customer_address: '123 Main St',
        intent: 'Support',
        booking_status: 'pending',
        resolution_status: 'Action Required',
        summary: 'Issue with invoice #442. Customer is upset about overcharge.',
        transcript: 'User: My bill is wrong... AI: I can help with that... User: It says $500 but should be $300...',
        verified: 'Verified'
    },
    {
        id: '5',
        date: '2024-02-03',
        called_at: '04:20 PM',
        caller_name: 'Charlie Green',
        customer_phone: '0455 666 777',
        customer_address: '456 Oak Rd',
        intent: 'Complaint',
        booking_status: 'pending',
        resolution_status: 'Action Required',
        summary: 'Technician was late. Wants a refund.',
        transcript: 'User: I am not happy... AI: I apologize... User: The tech arrived 2 hours late!',
        verified: 'Unverified'
    },
];

export function CustomerActionRequired() {
    const actionItems = MOCK_ACTION_ITEMS;
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleSelectAll = () => {
        if (selectedIds.size === actionItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(actionItems.map(c => c.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const handleBulkResolve = () => {
        alert(`Resolved ${selectedIds.size} items (Mock)`);
        setSelectedIds(new Set());
    };

    return (
        <DashboardLayout activeResult="customer_dashboard">
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-24 sm:pb-16">
                <div className="flex flex-col gap-1 sm:gap-2">
                    <div className="flex items-center gap-3 flex-wrap justify-between">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
                                Needs Your Attention
                            </h1>
                            <span className="px-3 py-1 text-xs sm:text-sm font-extrabold rounded-full bg-primary text-white shadow-sm ring-4 ring-primary/10">
                                {actionItems.length}
                            </span>
                        </div>

                        {selectedIds.size > 0 && (
                            <Button size="sm" onClick={handleBulkResolve} className="animate-in fade-in shadow-sm">
                                <CheckSquare className="w-4 h-4 mr-2" />
                                Resolve Selected ({selectedIds.size})
                            </Button>
                        )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold opacity-70 uppercase tracking-widest">
                        High-priority items requiring manual review or follow-up.
                    </p>
                </div>

                <div className="space-y-6 sm:space-y-10">
                    {actionItems.length > 0 && (
                        <div className="flex items-center gap-2 px-3 mb-1">
                            <Checkbox
                                checked={selectedIds.size === actionItems.length && actionItems.length > 0}
                                onCheckedChange={toggleSelectAll}
                            />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select All</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {actionItems.map((item) => (
                            <div key={item.id} className="flex flex-col">
                                <div
                                    className={`
                                        bg-card border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all duration-300 shadow-sm cursor-pointer
                                        ${selectedIds.has(item.id) ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-slate-300 shadow-md hover:border-primary/50'}
                                        ${expandedId === item.id ? 'rounded-b-none border-b-0' : ''}
                                    `}
                                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                >
                                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                                        <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.has(item.id)}
                                                onCheckedChange={() => toggleSelect(item.id)}
                                                className="border-border/40"
                                            />
                                        </div>

                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <p className="font-bold text-foreground text-sm sm:text-base">
                                                    {item.caller_name || 'Unknown'}
                                                </p>
                                                <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold whitespace-nowrap shadow-sm ${getIntentColor(item.intent)}`}>
                                                    {item.intent?.replace(/_/g, ' ') || 'Review'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:gap-3 text-xs sm:text-sm text-muted-foreground font-medium italic">
                                                <span className="truncate">{item.customer_phone}</span>
                                                <span className="hidden sm:inline opacity-30">•</span>
                                                <span className="truncate">{item.booking_status || 'Status Pending'}</span>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex self-center">
                                            {expandedId === item.id ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded View */}
                                {expandedId === item.id && (
                                    <div className="bg-white border-x border-b border-slate-300 rounded-b-[2rem] p-6 sm:p-12 space-y-8 animate-in slide-in-from-top-4 duration-300 shadow-xl overflow-hidden">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16">
                                            {/* Summary Section */}
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between gap-4 mb-2">
                                                    <h4 className="text-sm sm:text-base font-black flex items-center gap-3 text-primary uppercase tracking-wider">
                                                        <div className="p-2 bg-primary/10 rounded-lg">
                                                            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                                        </div>
                                                        Context
                                                    </h4>
                                                </div>

                                                <div className="relative">
                                                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium">
                                                        {item.summary}
                                                    </p>
                                                </div>

                                                <div className="flex gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 group/address">
                                                    <div className="p-2.5 bg-white rounded-xl shadow-sm">
                                                        <MapPin className="w-5 h-5 text-primary shrink-0" />
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="block font-black text-foreground uppercase tracking-widest text-[10px] sm:text-[11px] mb-1.5 opacity-60">Location Details</span>
                                                        <div className="flex flex-wrap items-center gap-2 text-foreground font-bold">
                                                            {item.customer_address || 'Not provided'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Transcript Section */}
                                            <div className="space-y-6">
                                                <h4 className="text-sm sm:text-base font-black flex items-center gap-3 text-primary uppercase tracking-wider">
                                                    <div className="p-2 bg-primary/10 rounded-lg">
                                                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                                    </div>
                                                    Transcription
                                                </h4>
                                                <div className="bg-muted/20 border border-border/40 rounded-3xl p-5 sm:p-8 backdrop-blur-sm relative group/transcript overflow-hidden">
                                                    <TranscriptView text={item.transcript} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
