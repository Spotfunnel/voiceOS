import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useData } from '@/contexts/DataContext';
import { getIntentColor } from '@/shared_ui/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared_ui/components/ui/Card';
import { Button } from '@/shared_ui/components/ui/Button';
import { Input } from '@/shared_ui/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared_ui/components/ui/Select';
import { Checkbox } from '@/shared_ui/components/ui/Checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/shared_ui/components/ui/DropdownMenu";
import { Phone, Calendar, Activity, Clock, Search, Filter, X, ChevronDown, ChevronUp, ChevronRight, FileText, MapPin, Archive, Download, TrendingUp, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

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

type TimePeriod = 'last-7-days' | 'last-30-days' | 'this-month' | 'last-month' | 'all-time';

export default function Overview() {
    const { calls, archiveCalls, isLoading } = useData();
    const [period, setPeriod] = useState<TimePeriod>('last-7-days');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [selectedIntents, setSelectedIntents] = useState<Set<string>>(new Set());
    const [selectedBookingStatuses, setSelectedBookingStatuses] = useState<Set<string>>(new Set());
    const [selectedTransferStatuses, setSelectedTransferStatuses] = useState<Set<string>>(new Set());
    const [selectedAddressStatuses, setSelectedAddressStatuses] = useState<Set<string>>(new Set());

    const ALLOWED_INTENTS = ['New Lead', 'Old Quote', 'Upgrade Request', 'Support', 'Complaint', 'Reschedule', 'Off Topic', 'Commercial Lead', 'Callback Request', 'General Enquiry'];
    const ALLOWED_BOOKING_STATUSES = ['Booked', 'Rescheduled', 'Cancelled', 'Callback Required', 'Follow Up Required'];
    const ALLOWED_TRANSFER_STATUSES = ['Transferred Success', 'Transferred Failed'];
    const ALLOWED_ADDRESS_STATUSES = ['Verified', 'Invalid'];

    // Calculate action items (calls requiring follow-up)
    const actionItems = useMemo(() => {
        return calls.filter(call =>
            call.booking_status === 'Callback Required' ||
            call.booking_status === 'Follow Up Required'
        );
    }, [calls]);

    // Filter calls by period
    const filteredByPeriod = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return calls.filter(call => {
            const callDate = new Date(call.date);
            switch (period) {
                case 'this-month':
                    return callDate >= startOfMonth;
                case 'last-month':
                    return callDate >= startOfLastMonth && callDate <= endOfLastMonth;
                case 'last-30-days':
                    return callDate >= thirtyDaysAgo;
                case 'last-7-days':
                    return callDate >= sevenDaysAgo;
                case 'all-time':
                default:
                    return true;
            }
        });
    }, [calls, period]);

    // Apply search and filters
    const filteredCalls = useMemo(() => {
        return filteredByPeriod.filter(call => {
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

            // Intent filter
            if (selectedIntents.size > 0) {
                const normalizedIntent = (call.intent || '').replace(/_/g, ' ');
                const hasMatch = Array.from(selectedIntents).some(sel => sel.toLowerCase() === normalizedIntent.toLowerCase());
                if (!hasMatch) return false;
            }

            // Booking status filter
            if (selectedBookingStatuses.size > 0) {
                const normalizedBooking = (call.booking_status || '').replace(/_/g, ' ');
                const hasMatch = Array.from(selectedBookingStatuses).some(sel => sel.toLowerCase() === normalizedBooking.toLowerCase());
                if (!hasMatch) return false;
            }

            return true;
        });
    }, [filteredByPeriod, searchQuery, selectedIntents, selectedBookingStatuses]);

    // Calculate metrics
    const metrics = useMemo(() => {
        const total = filteredByPeriod.length;
        const progressed = filteredByPeriod.filter(c => c.booking_status === 'confirmed' || c.booking_status === 'booked' || c.intent === 'booking').length;
        const actionRequired = filteredByPeriod.filter(c => c.resolution_status === 'Action Required' || c.resolution_status === 'action_required').length;

        return { total, progressed, actionRequired };
    }, [filteredByPeriod]);

    // Outcome distribution for pie chart
    const outcomes = useMemo(() => {
        const progressed = filteredByPeriod.filter(c => c.booking_status === 'confirmed' || c.booking_status === 'booked').length;
        const actionRequired = filteredByPeriod.filter(c => c.resolution_status === 'Action Required' || c.resolution_status === 'action_required').length;
        const resolved = filteredByPeriod.filter(c => c.resolution_status === 'resolved' || c.resolution_status === 'Resolved').length;
        const other = filteredByPeriod.length - progressed - actionRequired - resolved;

        return [
            { name: 'Progressed', value: progressed },
            { name: 'Action Required', value: actionRequired },
            { name: 'Resolved', value: resolved },
            { name: 'Other', value: other }
        ].filter(item => item.value > 0);
    }, [filteredByPeriod]);

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

    const handleBulkArchive = async () => {
        if (selectedCallIds.size === 0) return;
        await archiveCalls(Array.from(selectedCallIds));
        setSelectedCallIds(new Set());
    };

    const handleExport = () => {
        if (filteredCalls.length === 0) return;
        const headers = ['Date', 'Time', 'Caller Name', 'Phone', 'Intent', 'Status', 'Booking Status', 'Duration', 'Summary'];
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
                `"${(call.summary || '').replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `call_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const activeFiltersCount = selectedIntents.size + selectedBookingStatuses.size;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Activity className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
                            System Overview
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                            Everything running smoothly
                        </p>
                    </div>

                    {/* Period Selector Toggle */}
                    <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-border/40">
                        {['day', 'week', 'month'].map((p) => {
                            const isSelected = (p === 'day' && period === 'last-7-days') ||
                                (p === 'week' && period === 'last-30-days') ||
                                (p === 'month' && period === 'this-month');
                            return (
                                <Button
                                    key={p}
                                    variant={isSelected ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => {
                                        if (p === 'day') setPeriod('last-7-days');
                                        if (p === 'week') setPeriod('last-30-days');
                                        if (p === 'month') setPeriod('this-month');
                                    }}
                                    className={`px-4 py-1.5 h-auto text-xs font-bold capitalize rounded-md transition-all ${isSelected ? 'bg-teal-500 text-white shadow-sm' : 'text-muted-foreground'
                                        }`}
                                >
                                    {p}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content with Proper Spacing */}
                <div className="space-y-6">


                    {/* Metrics Row */}
                    <div className="grid lg:grid-cols-4 gap-4">
                        <Card className="bg-card border-slate-300 shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
                                <Phone className="w-4 h-4 text-teal-500" />
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <div className="text-4xl font-bold">{metrics.total}</div>
                                <p className="text-xs text-muted-foreground mt-1 font-medium">Today</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-slate-300 shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Booked</CardTitle>
                                <Calendar className="w-4 h-4 text-orange-400" />
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <div className="text-4xl font-bold">{metrics.progressed}</div>
                                <p className="text-xs text-muted-foreground mt-1 font-medium">Today</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-slate-300 shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
                                <span className="text-lg font-bold text-teal-600">$</span>
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <div className="text-4xl font-bold">$0</div>
                                <p className="text-xs text-muted-foreground mt-1 font-medium">Est. revenue</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-slate-300 shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Intent Distribution</CardTitle>
                                <Activity className="w-4 h-4 text-teal-500" />
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                {outcomes.length > 0 ? (
                                    <div className="flex items-center gap-3">
                                        {/* Compact legend */}
                                        <div className="flex-1 space-y-1">
                                            {(() => {
                                                const total = outcomes.reduce((sum, entry) => sum + entry.value, 0);
                                                return outcomes.slice(0, 4).map((entry, index) => {
                                                    const percentage = ((entry.value / total) * 100).toFixed(0);
                                                    return (
                                                        <div key={entry.name} className="flex items-center gap-1.5">
                                                            <div
                                                                className="w-2 h-2 rounded-sm flex-shrink-0"
                                                                style={{ backgroundColor: ['#14b8a6', '#f59e0b', '#8b5cf6', '#94a3b8'][index % 4] }}
                                                            />
                                                            <span className="text-xs text-muted-foreground leading-tight">{entry.name} {percentage}%</span>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        {/* Compact pie chart */}
                                        <div className="flex-shrink-0">
                                            <ResponsiveContainer width={70} height={70}>
                                                <PieChart>
                                                    <Pie
                                                        data={outcomes}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={20}
                                                        outerRadius={32}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                    >
                                                        {outcomes.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#14b8a6', '#f59e0b', '#8b5cf6', '#94a3b8'][index % 4]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number) => {
                                                        const total = outcomes.reduce((sum, entry) => sum + entry.value, 0);
                                                        return `${((value / total) * 100).toFixed(0)}%`;
                                                    }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground italic h-[70px] flex items-center justify-center">No data</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Needs Attention Banner */}
                    <div>
                        {actionItems.length > 0 && (
                            <Link href="/dashboard/action-required">
                                <Card className="cursor-pointer hover:bg-teal-500/5 transition-all duration-300 bg-teal-500/5 border-teal-500/10 shadow-sm overflow-hidden relative group">
                                    <CardContent className="flex items-center justify-between py-6 px-8 relative z-10">
                                        <div className="flex items-center gap-6 flex-1">
                                            <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Activity className="w-6 h-6 text-teal-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-2xl font-black text-teal-700">{actionItems.length} Items Need Attention</p>
                                                    <span className="animate-pulse flex h-3 w-3 rounded-full bg-teal-500" />
                                                </div>
                                                <p className="text-sm text-teal-600/70 font-bold uppercase tracking-wider mt-0.5">Follow-up suggested for recent inquiries</p>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                            <ChevronRight className="w-5 h-5 text-teal-600" />
                                        </div>
                                    </CardContent>
                                    <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-teal-500/5 to-transparent pointer-events-none" />
                                </Card>
                            </Link>
                        )}
                    </div>


                    {/* Call History List */}
                    <Card className="bg-card border-slate-300 shadow-md">
                        <CardHeader className="p-5 border-b">
                            <CardTitle className="text-lg font-bold">Call History ({filteredCalls.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2">
                            {filteredCalls.length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
                                    <Search className="w-10 h-10 opacity-30 mb-3" />
                                    <p className="text-lg font-bold">No calls found</p>
                                    <p className="text-sm mt-1">Try adjusting your filters or search</p>
                                </div>
                            ) : (
                                filteredCalls.map((call) => (
                                    <div key={call.id} className="flex flex-col">
                                        <div
                                            className={`bg-card border rounded-xl p-4 flex items-start gap-3 transition-all cursor-pointer ${selectedCallIds.has(call.id) ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-slate-300 hover:border-primary/50'
                                                } ${expandedRowId === call.id ? 'rounded-b-none border-b-0' : ''}`}
                                            onClick={() => setExpandedRowId(expandedRowId === call.id ? null : call.id)}
                                        >
                                            <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedCallIds.has(call.id)}
                                                    onCheckedChange={() => toggleSelectCall(call.id)}
                                                />
                                            </div>

                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Phone className="w-5 h-5 text-primary" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <p className="font-bold text-foreground text-base">
                                                        {call.caller_name || 'Unknown'}
                                                    </p>
                                                    {call.intent && (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold ${getIntentColor(call.intent)}`}>
                                                            {call.intent.replace(/_/g, ' ')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <span>{call.customer_phone}</span>
                                                    <span>•</span>
                                                    <span>{call.called_at || new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span>•</span>
                                                    <span>{call.date || new Date(call.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex self-center">
                                                {expandedRowId === call.id ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                            </div>
                                        </div>

                                        {expandedRowId === call.id && (
                                            <div className="border-x border-b border-slate-300 bg-muted/[0.02] p-6 rounded-b-xl">
                                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                                    <div className="space-y-6">
                                                        <div>
                                                            <h4 className="text-lg font-extrabold mb-3 flex items-center gap-2">
                                                                <FileText className="w-5 h-5 text-primary" />
                                                                Summary
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground leading-relaxed p-4 bg-white border border-slate-300 rounded-xl">
                                                                {call.summary || 'No summary available.'}
                                                            </p>
                                                        </div>

                                                        {call.customer_address && (
                                                            <div className="p-4 bg-muted/30 rounded-xl border">
                                                                <div className="flex items-center gap-3">
                                                                    <MapPin className="w-5 h-5 text-primary shrink-0" />
                                                                    <div>
                                                                        <span className="block text-xs font-bold text-muted-foreground uppercase mb-1">Address</span>
                                                                        <span className="text-sm font-bold">{call.customer_address}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(call.appointment_date || call.appointment_time) && (
                                                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                                                                <div className="flex items-center gap-3">
                                                                    <Calendar className="w-5 h-5 text-primary shrink-0" />
                                                                    <div>
                                                                        <span className="block text-xs font-bold text-primary uppercase mb-1">Appointment</span>
                                                                        <div className="text-sm font-bold">
                                                                            {call.appointment_date && new Date(call.appointment_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                                            {call.appointment_time && ` @ ${call.appointment_time}`}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h4 className="text-lg font-extrabold flex items-center gap-2">
                                                            <Phone className="w-5 h-5 text-muted-foreground" />
                                                            Transcript
                                                        </h4>
                                                        <div className="bg-white border border-slate-300 rounded-xl p-4">
                                                            <TranscriptView text={call.transcript} />
                                                        </div>
                                                        {call.recording_url && (
                                                            <audio controls className="w-full" src={call.recording_url} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
    );
}
