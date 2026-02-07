import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { getIntentColor } from '@/shared_ui/lib/utils';
import { Card } from '@/shared_ui/components/ui/Card';
import { Input } from '@/shared_ui/components/ui/Input';
import { Button } from '@/shared_ui/components/ui/Button';
import { Badge } from '@/shared_ui/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger } from '@/shared_ui/components/ui/Tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/shared_ui/components/ui/DropdownMenu";
import { Checkbox } from "@/shared_ui/components/ui/Checkbox";
import { Search, Phone, Clock, Archive, Download, RefreshCcw, MapPin, ChevronDown, ChevronUp, FileText, Filter, X, Trash2, Calendar, Check } from 'lucide-react';

// Transcript Formatter Component
const TranscriptView = ({ text }: { text: string }) => {
    if (!text) return <span className="text-muted-foreground italic">No transcript available.</span>;

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
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {turns.length === 0 ? (
                <p className="text-muted-foreground">{text}</p>
            ) : (
                turns.map((turn, i) => (
                    <div key={i} className="flex gap-3 text-xs sm:text-sm">
                        <span className={`font-semibold shrink-0 w-10 ${turn.speaker === 'AI' ? 'text-primary' : 'text-foreground'}`}>
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

export default function CallLogs() {
    const { calls, archiveCalls, fetchData, isLoading } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    // Filter States
    const [selectedIntents, setSelectedIntents] = useState<Set<string>>(new Set());
    const [selectedBookingStatuses, setSelectedBookingStatuses] = useState<Set<string>>(new Set());
    const [selectedTransferStatuses, setSelectedTransferStatuses] = useState<Set<string>>(new Set());
    const [selectedAddressStatuses, setSelectedAddressStatuses] = useState<Set<string>>(new Set());

    // Hardcoded allowed values for filters
    const ALLOWED_INTENTS = ['New Lead', 'Old Quote', 'Upgrade Request', 'Support', 'Complaint', 'Reschedule', 'Off Topic', 'Commercial Lead', 'Callback Request', 'General Enquiry'];
    const ALLOWED_TRANSFER_STATUSES = ['Transferred Success', 'Transferred Failed'];
    const ALLOWED_BOOKING_STATUSES = ['Booked', 'Rescheduled', 'Cancelled', 'Callback Required', 'Follow Up Required'];
    const ALLOWED_ADDRESS_STATUSES = ['Verified', 'Invalid'];

    // Filter calls based on all criteria
    const filteredCalls = useMemo(() => {
        return calls.filter(call => {
            // Tab filter
            const isArchived = call.archived === true;
            if (activeTab === 'active' && isArchived) return false;
            if (activeTab === 'archived' && !isArchived) return false;

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch =
                    call.caller_name?.toLowerCase().includes(query) ||
                    call.customer_phone?.toLowerCase().includes(query) ||
                    call.summary?.toLowerCase().includes(query) ||
                    call.transcript?.toLowerCase().includes(query) ||
                    (call.intent && call.intent.toLowerCase().includes(query));
                if (!matchesSearch) return false;
            }

            // Filters
            if (selectedIntents.size > 0) {
                const normalizedIntent = (call.intent || '').replace(/_/g, ' ');
                const hasMatch = Array.from(selectedIntents).some(sel => sel.toLowerCase() === normalizedIntent.toLowerCase());
                if (!hasMatch) return false;
            }

            if (selectedBookingStatuses.size > 0) {
                const normalizedBooking = (call.booking_status || '').replace(/_/g, ' ');
                const hasMatch = Array.from(selectedBookingStatuses).some(sel => sel.toLowerCase() === normalizedBooking.toLowerCase());
                if (!hasMatch) return false;
            }

            if (selectedTransferStatuses.size > 0) {
                const normalizedTransfer = (call.transfer_status || '').replace(/_/g, ' ');
                const hasMatch = Array.from(selectedTransferStatuses).some(sel => sel.toLowerCase() === normalizedTransfer.toLowerCase());
                if (!hasMatch) return false;
            }

            if (selectedAddressStatuses.size > 0) {
                const normalizedAddress = (call.verified || '').toLowerCase();
                const hasMatch = Array.from(selectedAddressStatuses).some(sel => sel.toLowerCase() === normalizedAddress);
                if (!hasMatch) return false;
            }

            return true;
        });
    }, [calls, searchQuery, activeTab, selectedIntents, selectedBookingStatuses, selectedTransferStatuses, selectedAddressStatuses]);

    const toggleSelectAll = () => {
        if (selectedCallIds.size === filteredCalls.length && filteredCalls.length > 0) {
            setSelectedCallIds(new Set());
        } else {
            setSelectedCallIds(new Set(filteredCalls.map(c => c.id)));
        }
    };

    const toggleSelectCall = (id: string) => {
        const newSelected = new Set(selectedCallIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedCallIds(newSelected);
    };

    const handleRowClick = (id: string) => {
        setExpandedRowId(current => current === id ? null : id);
    };

    const handleBulkArchive = async () => {
        if (selectedCallIds.size === 0) return;
        await archiveCalls(Array.from(selectedCallIds));
        setSelectedCallIds(new Set());
    };

    const handleExport = () => {
        if (filteredCalls.length === 0) return;
        const headers = ['Date', 'Time', 'Caller Name', 'Phone', 'Intent', 'Status', 'Booking Status', 'Duration', 'Summary', 'Transcript'];
        const csvContent = [
            headers.join(','),
            ...filteredCalls.map(call => [
                call.date || new Date(call.created_at).toLocaleDateString(),
                call.called_at || new Date(call.created_at).toLocaleTimeString(),
                `"${(call.caller_name || '').replace(/"/g, '""')}"`,
                `"${(call.customer_phone || '').replace(/"/g, '""')}"`,
                `"${(call.intent || '').replace(/"/g, '""')}"`,
                `"${(call.resolution_status || '').replace(/"/g, '""')}"`,
                `"${(call.booking_status || '').replace(/"/g, '""')}"`,
                call.duration || 0,
                `"${(call.summary || '').replace(/"/g, '""')}"`,
                `"${(call.transcript || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `call_logs_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleFilter = (set: Set<string>, val: string, setFn: (s: Set<string>) => void) => {
        const newSet = new Set(set);
        if (newSet.has(val)) newSet.delete(val);
        else newSet.add(val);
        setFn(newSet);
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setSelectedIntents(new Set());
        setSelectedBookingStatuses(new Set());
        setSelectedTransferStatuses(new Set());
        setSelectedAddressStatuses(new Set());
    };

    const activeFiltersCount = selectedIntents.size + selectedBookingStatuses.size + selectedTransferStatuses.size + selectedAddressStatuses.size;

    const FilterContent = () => (
        <DropdownMenuContent align="end" className="w-[280px] p-0 max-h-[80vh] overflow-y-auto">
            <div className="p-2 border-b border-border sticky top-0 bg-popover z-10 flex items-center justify-between">
                <span className="font-semibold text-sm pl-2">Filter Records</span>
                {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                        Clear all
                    </Button>
                )}
            </div>

            <div className="p-2 space-y-4">
                <div className="space-y-3">
                    {[
                        { label: 'Leads', intents: ['New Lead', 'Commercial Lead', 'Upgrade Request', 'Old Quote'] },
                        { label: 'Issues', intents: ['Complaint', 'Off Topic'] },
                        { label: 'Support', intents: ['Support', 'General Enquiry'] },
                        { label: 'Scheduling', intents: ['Reschedule', 'Callback Request'] }
                    ].map((group) => (
                        <div key={group.label} className="space-y-1">
                            <h4 className="text-[10px] font-semibold text-muted-foreground px-2 uppercase tracking-wider opacity-70 mb-1">{group.label}</h4>
                            {group.intents.map(intent => (
                                <DropdownMenuCheckboxItem
                                    key={intent}
                                    checked={selectedIntents.has(intent)}
                                    onCheckedChange={() => toggleFilter(selectedIntents, intent, setSelectedIntents)}
                                    className="text-xs py-1.5 pl-4"
                                >
                                    <span className="text-foreground/90">
                                        {intent}
                                    </span>
                                </DropdownMenuCheckboxItem>
                            ))}
                        </div>
                    ))}
                </div>

                <DropdownMenuSeparator />

                <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground px-2 uppercase tracking-wider">Booking</h4>
                    {ALLOWED_BOOKING_STATUSES.map(status => (
                        <DropdownMenuCheckboxItem
                            key={status}
                            checked={selectedBookingStatuses.has(status)}
                            onCheckedChange={() => toggleFilter(selectedBookingStatuses, status, setSelectedBookingStatuses)}
                            className="text-xs py-1.5 capitalize"
                        >
                            {status}
                        </DropdownMenuCheckboxItem>
                    ))}
                </div>

                <DropdownMenuSeparator />

                <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground px-2 uppercase tracking-wider">Transfer</h4>
                    {ALLOWED_TRANSFER_STATUSES.map(status => (
                        <DropdownMenuCheckboxItem
                            key={status}
                            checked={selectedTransferStatuses.has(status)}
                            onCheckedChange={() => toggleFilter(selectedTransferStatuses, status, setSelectedTransferStatuses)}
                            className="text-xs py-1.5 capitalize"
                        >
                            {status}
                        </DropdownMenuCheckboxItem>
                    ))}
                </div>

                <DropdownMenuSeparator />

                <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground px-2 uppercase tracking-wider">Address</h4>
                    {ALLOWED_ADDRESS_STATUSES.map(status => (
                        <DropdownMenuCheckboxItem
                            key={status}
                            checked={selectedAddressStatuses.has(status)}
                            onCheckedChange={() => toggleFilter(selectedAddressStatuses, status, setSelectedAddressStatuses)}
                            className="text-xs py-1.5 capitalize"
                        >
                            {status}
                        </DropdownMenuCheckboxItem>
                    ))}
                </div>
            </div>
        </DropdownMenuContent>
    );

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-24 md:pb-8 flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
                        Activity History
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                        Manage and review all system interactions
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto self-end">
                    <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={isLoading} className="hidden lg:inline-flex text-muted-foreground hover:bg-muted h-9">
                        <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>

                </div>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden bg-white/70 backdrop-blur-md border-slate-300 shadow-xl rounded-2xl">
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSelectedCallIds(new Set()); setExpandedRowId(null); }} className="flex-1 flex flex-col">
                    <div className="p-4 border-b border-border/40 space-y-4 bg-muted/5">
                        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                            <div className="flex items-center justify-between w-full xl:w-auto overflow-x-auto">
                                {/* Action Dropdown (Active/Archived/Export) */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 px-3 gap-2 rounded-xl text-sm font-medium bg-white">
                                            {activeTab === 'active' ? (
                                                <><Phone className="w-4 h-4 text-primary" /> Active Calls</>
                                            ) : (
                                                <><Archive className="w-4 h-4 text-muted-foreground" /> Archived</>
                                            )}
                                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-[180px]">
                                        <DropdownMenuItem onClick={() => setActiveTab('active')} className="gap-2">
                                            <Phone className="w-4 h-4" />
                                            Active Calls
                                            {activeTab === 'active' && <Check className="w-3 h-3 ml-auto text-primary" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setActiveTab('archived')} className="gap-2">
                                            <Archive className="w-4 h-4" />
                                            Archived
                                            {activeTab === 'archived' && <Check className="w-3 h-3 ml-auto text-primary" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleExport} className="gap-2">
                                            <Download className="w-4 h-4" /> Export Data
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <div className="xl:hidden ml-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className={`h-10 border-dashed rounded-xl ${activeFiltersCount > 0 ? 'bg-primary/5 border-primary text-primary shadow-sm' : ''}`}>
                                                <Filter className="mr-2 h-4 w-4" />
                                                Filters
                                                {activeFiltersCount > 0 && (
                                                    <span className="ml-2 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                                        {activeFiltersCount}
                                                    </span>
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <FilterContent />
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                                <div className="relative flex-1 sm:w-72 w-full">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        placeholder="Search records or transcripts..."
                                        className="pl-11 h-11 rounded-xl bg-white border-muted-foreground/10 focus-visible:ring-primary shadow-sm text-sm"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="hidden xl:flex items-center gap-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className={`h-11 px-4 border-dashed rounded-xl hover:bg-muted ${activeFiltersCount > 0 ? 'bg-primary/5 border-primary text-primary shadow-sm' : ''}`}>
                                                <Filter className="mr-2 h-4 w-4" />
                                                Filters
                                                {activeFiltersCount > 0 && (
                                                    <span className="ml-2 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                                        {activeFiltersCount}
                                                    </span>
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <FilterContent />
                                    </DropdownMenu>
                                </div>

                                {activeFiltersCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-11 px-3 text-muted-foreground hover:text-foreground rounded-xl"
                                        onClick={clearAllFilters}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </div>

                        {selectedCallIds.size > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10 animate-in slide-in-from-top-2 shadow-sm">
                                <span className="text-sm font-bold text-primary pl-1">{selectedCallIds.size} records selected</span>
                                <div className="h-5 w-px bg-primary/20 mx-1" />
                                {activeTab === 'active' && (
                                    <Button size="sm" variant="secondary" onClick={handleBulkArchive} className="h-9 gap-2 rounded-lg font-semibold shadow-sm">
                                        <Archive className="w-3.5 h-3.5" />
                                        Archive
                                    </Button>
                                )}
                                <Button size="sm" variant="destructive" className="h-9 gap-2 rounded-lg font-semibold shadow-sm">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto bg-muted/5 p-4 sm:p-6 lg:p-8 flex justify-center">
                        <div className="w-full max-w-7xl bg-white rounded-2xl border border-border/40 shadow-xl overflow-hidden h-fit flex flex-col">
                            {/* Card List Body */}
                            <div className="space-y-3 p-4 bg-muted/5">
                                {filteredCalls.map((call) => (
                                    <div key={call.id} className="flex flex-col">
                                        <div
                                            className={`
                                                bg-card border rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 transition-all duration-300 shadow-md cursor-pointer
                                                ${selectedCallIds.has(call.id) ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-slate-300 hover:border-primary/50'}
                                                ${expandedRowId === call.id ? 'rounded-b-none border-b-0' : ''}
                                            `}
                                            onClick={() => handleRowClick(call.id)}
                                        >
                                            <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedCallIds.has(call.id)}
                                                    onCheckedChange={() => toggleSelectCall(call.id)}
                                                    className="border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                            </div>

                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 mt-1 sm:mt-0">
                                                <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <p className="font-bold text-foreground text-sm sm:text-base">
                                                        {call.caller_name || 'Anonymous Caller'}
                                                    </p>
                                                    {call.intent && (
                                                        <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold whitespace-nowrap shadow-sm ${getIntentColor(call.intent)}`}>
                                                            {call.intent.replace(/_/g, ' ')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground font-medium italic mb-2">
                                                    <span className="truncate">{call.customer_phone}</span>
                                                    <span className="text-border">•</span>
                                                    <span className="truncate">{call.booking_status || 'Status Pending'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-bold bg-muted/40 px-2 py-0.5 rounded border border-border/50">
                                                        <Clock className="w-3 h-3" />
                                                        {call.called_at?.slice(0, 5) || new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        <span className="opacity-50">|</span>
                                                        {call.date || new Date(call.created_at).toLocaleDateString()}
                                                    </div>
                                                    {expandedRowId !== call.id && (
                                                        <span className="text-[10px] text-primary font-bold flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            View Details <ChevronDown className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex self-center">
                                                <div className={`p-2 rounded-full transition-all duration-300 ${expandedRowId === call.id ? 'bg-primary/20 text-primary rotate-180' : 'text-muted-foreground opacity-30 hover:opacity-100 hover:bg-muted'}`}>
                                                    <ChevronDown className="h-5 w-5" />
                                                </div>
                                            </div>
                                        </div>

                                        {expandedRowId === call.id && (
                                            <div className="border-t border-slate-300 bg-muted/[0.02] animate-in slide-in-from-top-1">
                                                <div className="p-6 sm:p-8 space-y-8">
                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 sm:gap-12">
                                                        {/* Left Column: Summary & Info */}
                                                        <div className="space-y-8">
                                                            <div className="space-y-4">
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
                                                                            <FileText className="w-5 h-5 text-primary" />
                                                                        </div>
                                                                        <h4 className="text-lg font-extrabold text-foreground tracking-tight">
                                                                            Call Summary
                                                                        </h4>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                                        {call.intent && (
                                                                            <Badge variant="outline" className={`sm:hidden text-[10px] font-bold px-3 py-1 rounded-lg border-2 shadow-sm ${getIntentColor(call.intent)}`}>
                                                                                REASON: {call.intent.replace(/_/g, ' ')}
                                                                            </Badge>
                                                                        )}
                                                                        {call.booking_status && (
                                                                            <Badge variant="secondary" className="text-[10px] font-extrabold px-3 py-1 rounded-lg shadow-sm border border-border/40">
                                                                                {call.booking_status.toUpperCase()}
                                                                            </Badge>
                                                                        )}
                                                                        {call.transfer_status && (
                                                                            <Badge variant="outline" className={`text-[10px] font-extrabold px-3 py-1 rounded-lg shadow-sm ${call.transfer_status.toLowerCase().includes('success') ? 'text-green-600 border-green-200 bg-green-50' : 'text-orange-600 border-orange-200 bg-orange-50'}`}>
                                                                                {call.transfer_status.toUpperCase()}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed p-5 bg-white border border-slate-300 rounded-2xl shadow-sm italic font-medium">
                                                                    {call.summary || 'No summary available.'}
                                                                </p>
                                                            </div>

                                                            {/* Appointment Details - Elegant Card */}
                                                            {(call.booking_status === 'booked' || call.booking_status === 'confirmed' || call.booking_status === 'rescheduled') && (call.appointment_date || call.appointment_time) && (
                                                                <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/[0.02] rounded-2xl border border-primary/20 space-y-4 shadow-sm relative overflow-hidden group/appt">
                                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                                                                    <div className="flex items-center gap-4 relative">
                                                                        <div className="w-12 h-12 rounded-2xl bg-white border border-primary/20 shadow-sm flex items-center justify-center shrink-0 group-hover/appt:scale-105 transition-transform duration-300">
                                                                            <Calendar className="w-6 h-6 text-primary" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="block text-xs font-extrabold text-primary uppercase tracking-widest mb-1">Scheduled Appointment</span>
                                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                                                {call.appointment_date && (
                                                                                    <span className="text-lg font-black text-foreground tracking-tight">
                                                                                        {new Date(call.appointment_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                                                    </span>
                                                                                )}
                                                                                {call.appointment_time && (
                                                                                    <span className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                                                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                                                                        {call.appointment_time}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="p-6 bg-muted/30 rounded-2xl border border-slate-300 space-y-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 rounded-2xl bg-white border border-border/60 shadow-sm flex items-center justify-center">
                                                                        <MapPin className="w-6 h-6 text-primary" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-xs font-extrabold text-muted-foreground uppercase tracking-widest mb-0.5">Physical Address</span>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-sm sm:text-base font-bold text-foreground break-words">{call.customer_address || 'Not provided'}</span>
                                                                            {call.verified && (
                                                                                <Badge variant="outline" className={`text-[9px] font-extrabold px-2 py-0 h-5 border-2 shrink-0 ${call.verified.toLowerCase() === 'verified' ? 'text-green-600 border-green-100 bg-green-50' : 'text-red-500 border-red-100 bg-red-50'}`}>
                                                                                    {call.verified.toUpperCase()}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right Column: Transcript */}
                                                        <div className="space-y-6">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center">
                                                                    <Phone className="w-5 h-5 text-muted-foreground" />
                                                                </div>
                                                                <h4 className="text-lg font-extrabold text-foreground tracking-tight">Full Transcript</h4>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-300 bg-white shadow-inner overflow-hidden">
                                                                <div className="p-1">
                                                                    <div className="bg-muted/[0.03] rounded-xl p-4 sm:p-6 min-h-[300px]">
                                                                        <TranscriptView text={call.transcript} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {call.recording_url && (
                                                                <div className="bg-muted/30 p-4 rounded-2xl border border-border/40">
                                                                    <span className="block text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-3 px-1">Audio Recording</span>
                                                                    <audio controls className="w-full h-10" src={call.recording_url} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Bottom Action Bar */}
                                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-border/40">
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider bg-muted/40 px-3 py-1.5 rounded-full">
                                                            <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
                                                            Record ID: {call.id.slice(0, 8)}
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                                                            <Button size="lg" variant="outline" onClick={() => archiveCalls([call.id])} className="flex-1 sm:flex-initial h-12 rounded-xl border-dashed hover:border-solid gap-2 font-bold transition-all hover:bg-primary/5 hover:text-primary hover:border-primary/40">
                                                                <Archive className="w-4 h-4" />
                                                                Archive Record
                                                            </Button>
                                                            <Button size="lg" className="flex-1 sm:flex-initial h-12 rounded-xl gap-2 font-extrabold shadow-lg shadow-primary/20">
                                                                <Download className="w-4 h-4" />
                                                                Export PDF
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {filteredCalls.length === 0 && (
                                    <div className="h-80 flex flex-col items-center justify-center text-muted-foreground bg-muted/[0.02]">
                                        <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mb-6 shadow-inner">
                                            <Search className="w-10 h-10 opacity-30" />
                                        </div>
                                        <p className="text-xl font-extrabold text-foreground/80 tracking-tight">No records found</p>
                                        <p className="text-sm font-medium mt-1 mb-6 opacity-60">Try adjusting your search or filters</p>
                                        <Button variant="outline" onClick={clearAllFilters} className="rounded-xl border-2 font-bold px-8 h-12 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-md">
                                            Reset All Filters
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Tabs>
            </Card>
        </div>
    );
}
