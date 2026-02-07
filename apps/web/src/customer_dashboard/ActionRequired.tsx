import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/shared_ui/components/ui/Card';
import { Button } from '@/shared_ui/components/ui/Button';
import { AlertCircle, CheckCircle2, PhoneForwarded, CheckSquare, ChevronDown, ChevronUp, FileText, MapPin, Target, CheckCircle, Clock, Calendar } from 'lucide-react';
import { Checkbox } from '@/shared_ui/components/ui/Checkbox';
import { Badge } from '@/shared_ui/components/ui/Badge';
import { getIntentColor } from '@/shared_ui/lib/utils';

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

export default function ActionRequired() {
    const { calls, updateCall } = useData();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Filter items needing action (e.g. Action Required status)
    const actionItems = calls.filter(c =>
        c.resolution_status === 'Action Required' ||
        c.resolution_status === 'action_required'
    );

    const toggleSelectAll = () => {
        if (selectedIds.size === actionItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(actionItems.map(c => c.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkResolve = async () => {
        if (selectedIds.size === 0) return;

        // Parallel updates (could be optimized with a bulk RPC call later)
        await Promise.all(Array.from(selectedIds).map(id =>
            updateCall(id, { resolution_status: 'resolved' })
        ));

        setSelectedIds(new Set());
    };

    return (
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
                {actionItems.length === 0 ? (
                    <Card className="border-slate-300 shadow-md bg-card/50 backdrop-blur-sm rounded-xl">
                        <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                            <CheckCircle2 className="w-10 h-10 text-green-500 mb-4 opacity-50" />
                            <p className="text-lg sm:text-xl font-bold">All caught up!</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">No items require action</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* "Select All" Bar if items exist */}
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
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-bold bg-muted/40 px-2 py-0.5 rounded border border-border/50">
                                                        <Clock className="w-3 h-3" />
                                                        {item.date} • {item.called_at}
                                                    </div>
                                                    {expandedId !== item.id && (
                                                        <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                                                            Details <ChevronDown className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="hidden sm:flex self-center">
                                                {expandedId === item.id ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:shrink-0 w-full sm:w-auto pl-8 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                                            <Button size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-initial text-xs font-bold h-9 border-border">
                                                <PhoneForwarded className="w-3.5 h-3.5" />
                                                Call Back
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => updateCall(item.id, { resolution_status: 'resolved' })}
                                                className="flex-1 sm:flex-initial text-xs font-bold h-9 shadow-sm"
                                            >
                                                Resolve
                                            </Button>
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
                                                        <div className="flex items-center gap-2">
                                                            {item.booking_status && (
                                                                <Badge variant="secondary" className="text-[10px] sm:text-[11px] font-black px-3 py-1 rounded-md uppercase tracking-widest">
                                                                    {item.booking_status}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="relative">
                                                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary/20 rounded-full" />
                                                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium">
                                                            {item.summary || 'No summary available for this call.'}
                                                        </p>
                                                    </div>

                                                    <div className="flex gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 group/address">
                                                        <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover/address:scale-110 transition-transform">
                                                            <MapPin className="w-5 h-5 text-primary shrink-0" />
                                                        </div>
                                                        <div className="text-sm">
                                                            <span className="block font-black text-foreground uppercase tracking-widest text-[10px] sm:text-[11px] mb-1.5 opacity-60">Location Details</span>
                                                            <div className="flex flex-wrap items-center gap-2 text-foreground font-bold">
                                                                {item.customer_address || 'Not provided'}
                                                                {item.verified && (
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-tighter ${item.verified.toLowerCase() === 'verified' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                        {item.verified}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Appointment Scheduling - Only for booked/rescheduled */}
                                                    {(item.booking_status === 'booked' || item.booking_status === 'confirmed' || item.booking_status === 'rescheduled') && (item.appointment_date || item.appointment_time) && (
                                                        <div className="flex gap-4 p-5 bg-primary/5 rounded-2xl border border-primary/20 group/appointment">
                                                            <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover/appointment:scale-110 transition-transform">
                                                                <Calendar className="w-5 h-5 text-primary shrink-0" />
                                                            </div>
                                                            <div className="text-sm">
                                                                <span className="block font-black text-foreground uppercase tracking-widest text-[10px] sm:text-[11px] mb-1.5 opacity-60">Scheduled Appointment</span>
                                                                <div className="flex items-center gap-2 text-foreground font-bold">
                                                                    {item.appointment_date && (
                                                                        <span>{new Date(item.appointment_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                    )}
                                                                    {item.appointment_date && item.appointment_time && <span className="text-primary">•</span>}
                                                                    {item.appointment_time && (
                                                                        <span className="text-primary">{item.appointment_time}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
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
                                                        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                                                        <TranscriptView text={item.transcript} />
                                                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/10 to-transparent pointer-events-none" />
                                                    </div>
                                                    {item.recording_url && (
                                                        <div className="pt-4 px-2">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Voice Recording</p>
                                                            </div>
                                                            <audio src={item.recording_url} controls className="w-full h-10 sm:h-12 rounded-xl" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="pt-8 border-t border-border/40 flex justify-end">
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setExpandedId(null)}
                                                    className="font-bold text-muted-foreground hover:text-primary transition-colors"
                                                >
                                                    Collapse Details
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>

    );
}
