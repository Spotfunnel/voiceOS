
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui_kit/components/ui/Card';
import { Button } from '../../ui_kit/components/ui/Button';
import { Input } from '../../ui_kit/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui_kit/components/ui/Select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "../../ui_kit/components/ui/DropdownMenu";
import { Phone, Activity, Search, Filter, X, TrendingUp, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PullToRefresh } from '../../ui_kit/components/PullToRefresh';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';

// Mock Data
const MOCK_CALLS = [
    { id: '1', date: '2024-02-05', called_at: '10:30 AM', caller_name: 'John Doe', customer_phone: '0412 345 678', intent: 'New_Lead', booking_status: 'booked', resolution_status: 'resolved', summary: 'Customer interested in solar quote.', transcript: 'User: Hi... AI: Hello...' },
    { id: '2', date: '2024-02-05', called_at: '11:15 AM', caller_name: 'Jane Smith', customer_phone: '0498 765 432', intent: 'Support', booking_status: 'pending', resolution_status: 'Action Required', summary: 'Issue with invoice #442.', transcript: 'User: My bill is wrong...' },
    { id: '3', date: '2024-02-04', called_at: '09:00 AM', caller_name: 'Bob Brown', customer_phone: '0400 111 222', intent: 'Reschedule', booking_status: 'rescheduled', resolution_status: 'resolved', summary: 'Moved appointment to Tuesday.', transcript: 'User: Can I change...' },
    { id: '4', date: '2024-02-04', called_at: '02:45 PM', caller_name: 'Alice White', customer_phone: '0433 999 000', intent: 'General_Enquiry', booking_status: 'cancelled', resolution_status: 'resolved', summary: 'Asking about opening hours.', transcript: 'User: When are you open...' },
    { id: '5', date: '2024-02-03', called_at: '04:20 PM', caller_name: 'Charlie Green', customer_phone: '0455 666 777', intent: 'Complaint', booking_status: 'pending', resolution_status: 'Action Required', summary: 'Technician was late.', transcript: 'User: I am not happy...' },
];

const MOCK_METRICS = {
    total: 145,
    progressed: 89,
    actionRequired: 4
};

type TimePeriod = 'last-7-days' | 'last-30-days' | 'this-month' | 'last-month' | 'all-time';

export function CustomerOverview() {
    // const { calls, archiveCalls, isLoading, fetchData } = useData(); // REMOVED
    const calls = MOCK_CALLS; // MOCK
    const metrics = MOCK_METRICS; // MOCK
    const isLoading = false;

    const [period, setPeriod] = useState<TimePeriod>('last-7-days');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
    // const [expandedRowId, setExpandedRowId] = useState<string | null>(null); // Not used in this simplified view port
    const [selectedIntents, setSelectedIntents] = useState<Set<string>>(new Set());
    const [selectedBookingStatuses, setSelectedBookingStatuses] = useState<Set<string>>(new Set());

    const ALLOWED_INTENTS = ['New Lead', 'Old Quote', 'Upgrade Request', 'Support', 'Complaint', 'Reschedule', 'Off Topic', 'Commercial Lead', 'Callback Request', 'General Enquiry'];
    const ALLOWED_BOOKING_STATUSES = ['Booked', 'Rescheduled', 'Cancelled', 'Callback Required', 'Follow Up Required'];

    // Filter calls by period (Mock logic: just passing through for display mostly)
    const filteredByPeriod = useMemo(() => {
        return calls; // Simplified for static export
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

    // Outcome distribution for pie chart (Mocked based on static data)
    const outcomes = useMemo(() => {
        return [
            { name: 'Progressed', value: 89 },
            { name: 'Action Required', value: 4 },
            { name: 'Resolved', value: 42 },
            { name: 'Other', value: 10 }
        ].filter(item => item.value > 0);
    }, []);

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

    const activeFiltersCount = selectedIntents.size + selectedBookingStatuses.size;

    return (
        <DashboardLayout activeResult="overview"> {/* Added Wrapper */}
            <PullToRefresh onRefresh={async () => { }}>
                <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-500">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
                                System Overview
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                                Everything at a glance
                            </p>
                        </div>

                        {/* Period Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground shrink-0">Period:</span>
                            <Select value={period} onValueChange={(value: TimePeriod) => setPeriod(value)}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="last-7-days">Last 7 days</SelectItem>
                                    <SelectItem value="last-30-days">Last 30 days</SelectItem>
                                    <SelectItem value="this-month">This month ({new Date().toLocaleString('default', { month: 'long' })})</SelectItem>
                                    <SelectItem value="last-month">Last month</SelectItem>
                                    <SelectItem value="all-time">All time</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Metrics + Pie Chart Row */}
                    <div className="grid lg:grid-cols-12 gap-4">
                        {/* Metrics Cards */}
                        <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Card className="bg-card border-slate-300 shadow-md">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
                                    <Phone className="w-4 h-4 text-primary" />
                                </CardHeader>
                                <CardContent className="p-5 pt-0">
                                    <div className="text-2xl font-bold">{metrics.total}</div>
                                    <p className="text-xs text-emerald-600 font-medium mt-1">Current period</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-card border-slate-300 shadow-md">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Progressed</CardTitle>
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                </CardHeader>
                                <CardContent className="p-5 pt-0">
                                    <div className="text-2xl font-bold">{metrics.progressed}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">Or progressed</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-card border-slate-300 shadow-md">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Action Items</CardTitle>
                                    <Activity className="w-4 h-4 text-amber-600" />
                                </CardHeader>
                                <CardContent className="p-5 pt-0">
                                    <div className="text-2xl font-bold">{metrics.actionRequired}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">Needs review</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Outcome Pie Chart */}
                        <Card className="lg:col-span-4 bg-card border-slate-300 shadow-md">
                            <CardHeader className="pb-2 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Call Outcomes</CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 pt-0 flex items-center justify-center">
                                <div className="w-[140px] h-[140px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <defs>
                                                <linearGradient id="gradProgressed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.6} />
                                                </linearGradient>
                                                <linearGradient id="gradAction" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.6} />
                                                </linearGradient>
                                                <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6} />
                                                </linearGradient>
                                                <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                                                    <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                                                </linearGradient>
                                            </defs>
                                            <Pie
                                                data={outcomes}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={65}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {outcomes.map((entry, index) => {
                                                    const gradients = ['url(#gradProgressed)', 'url(#gradAction)', 'url(#gradResolved)', 'url(#gradOther)'];
                                                    return <Cell key={`cell-${index}`} fill={gradients[index % gradients.length]} stroke="none" />;
                                                })}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-2xl font-bold tracking-tighter text-foreground">{metrics.total}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Required Banner */}
                    {metrics.actionRequired > 0 && (
                        <Link to="/customer/action-required">
                            <Card className="cursor-pointer hover:bg-primary/5 transition-colors bg-primary/5 border-primary/20">
                                <CardContent className="flex items-center justify-between py-4 px-6">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <AlertCircle className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-primary">{metrics.actionRequired} Items Need Attention</p>
                                            <p className="text-sm text-muted-foreground">Review and resolve pending actions</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )}

                    {/* Search & Filter Bar */}
                    <Card className="bg-card border-slate-300 shadow-md">
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <Input
                                        placeholder="Search calls..."
                                        className="pl-11 h-11 rounded-xl"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className={`h-11 px-4 ${activeFiltersCount > 0 ? 'bg-primary/5 border-primary text-primary' : ''}`}>
                                                <Filter className="mr-2 h-4 w-4" />
                                                Filters
                                                {activeFiltersCount > 0 && (
                                                    <span className="ml-2 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                                        {activeFiltersCount}
                                                    </span>
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[280px] p-0 max-h-[80vh] overflow-y-auto">
                                            <div className="p-2 border-b border-border sticky top-0 bg-popover z-10 flex items-center justify-between">
                                                <span className="font-semibold text-sm pl-2">Filter Records</span>
                                                {activeFiltersCount > 0 && (
                                                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 px-2 text-xs">
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
                                                                    {intent}
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
                                            </div>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {activeFiltersCount > 0 && (
                                        <Button variant="ghost" size="sm" className="h-11 px-3" onClick={clearAllFilters}>
                                            <X className="h-4 w-4 mr-2" />
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </PullToRefresh>
        </DashboardLayout>
    );
}
