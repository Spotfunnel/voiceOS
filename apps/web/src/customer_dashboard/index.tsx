import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { getIntentColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Calendar, Activity, Clock, ArrowRight, TrendingUp, Zap, CheckCircle2, MapPin, Mail, Target, CheckCircle, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

type TimePeriod = 'day' | 'week' | 'month';

export default function Overview() {
    const { calls, pendingJobs, isLoading } = useData();
    const [period, setPeriod] = useState<TimePeriod>('day');

    // Items needing action
    const actionCount = calls.filter(c => c.resolution_status === 'Action Required' || c.resolution_status === 'action_required').length;

    // Date filtering logic
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const getStartDate = () => {
        const date = new Date();
        if (period === 'week') {
            date.setDate(date.getDate() - 7);
        } else if (period === 'month') {
            date.setMonth(date.getMonth() - 1);
        }
        return date;
    };

    const startDate = getStartDate();

    const filteredCalls = calls.filter(c => {
        if (!c.date) return false;
        const callDate = new Date(c.date);
        if (period === 'day') {
            return c.date === todayStr;
        }
        return callDate >= startDate;
    });

    const callsCount = filteredCalls.length;
    const bookedCount = filteredCalls.filter(c =>
        c.booking_status === 'confirmed' ||
        c.booking_status === 'booked' ||
        c.intent === 'booking'
    ).length;

    // Legacy variables for compatibility
    const callsToday = calls.filter(c => c.date === todayStr).length;
    const bookedToday = calls.filter(c => c.date === todayStr && (c.booking_status === 'confirmed' || c.booking_status === 'booked' || c.intent === 'booking')).length;

    // Intent distribution for pie chart
    const intentCounts = filteredCalls.reduce((acc, call) => {
        const intent = call.intent || 'Unknown';
        acc[intent] = (acc[intent] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const intentData = Object.entries(intentCounts)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5 intents

    const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

    // Pipeline value calculation (estimated $500 per booked call)
    const pipelineValue = bookedCount * 500;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Activity className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Loading dashboard data...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* DESKTOP VIEW (Original Layout from Zip) - Visible on lg+ */}
            <div className="hidden lg:block space-y-6 animate-in fade-in duration-500">
                {/* Header with Period Toggle */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-4xl font-bold tracking-tight text-primary">
                            System Overview
                        </h1>
                        <p className="text-sm text-muted-foreground">Everything running smoothly</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={period === 'day' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPeriod('day')}
                        >
                            Day
                        </Button>
                        <Button
                            variant={period === 'week' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPeriod('week')}
                        >
                            Week
                        </Button>
                        <Button
                            variant={period === 'month' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPeriod('month')}
                        >
                            Month
                        </Button>
                    </div>
                </div>

                {/* Outcome Metrics */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
                            <CardTitle className="text-base font-medium text-muted-foreground leading-tight">Total Calls</CardTitle>
                            <Phone className="w-5 h-5 text-primary" />
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <div className="text-4xl font-bold">{callsCount}</div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {period === 'day' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
                            <CardTitle className="text-base font-medium text-muted-foreground leading-tight">Booked</CardTitle>
                            <Calendar className="w-5 h-5 text-accent" />
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <div className="text-4xl font-bold">{bookedCount}</div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {period === 'day' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
                            <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Call Reasons</CardTitle>
                            <Activity className="w-4 h-4 text-primary" />
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <ResponsiveContainer width="100%" height={120}>
                                <PieChart>
                                    <Pie
                                        data={intentData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={50}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {intentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
                            <CardTitle className="text-base font-medium text-muted-foreground leading-tight">Pipeline Value</CardTitle>
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <div className="text-4xl font-bold">${pipelineValue.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Est. revenue
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Action Required Banner */}
                {actionCount > 0 && (
                    <Link to="/dashboard/action-required" className="block">
                        <Card className="bg-primary/5 border-primary/20 cursor-pointer hover:bg-primary/5 transition-colors">
                            <CardContent className="flex items-center justify-between py-4 px-6">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Activity className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xl font-bold tracking-tight text-primary">{actionCount} Items Need Attention</p>
                                        <p className="text-sm text-muted-foreground block">Follow-up suggested for recent inquiries</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-primary shrink-0 ml-2" />
                            </CardContent>
                        </Card>
                    </Link>
                )}

                {/* Recent Activity - Enhanced with rich data */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Recent Activity
                    </h2>
                    <div className="bg-card border border-border rounded-xl divide-y divide-border">
                        {calls.slice(0, 5).map((call) => (
                            <div key={call.id} className="p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        {/* Name & Status */}
                                        <div className="flex items-center gap-3">
                                            <p className="text-base font-semibold text-foreground leading-none translate-y-[1px]">{call.caller_name}</p>
                                            <span className={`px-2.5 py-0.5 text-[10px] rounded-full border uppercase tracking-wide ${getIntentColor(call.intent)}`}>
                                                {call.intent ? call.intent.replace(/_/g, ' ') : 'Interaction'}
                                            </span>
                                        </div>

                                        {/* Phone */}
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Phone className="w-3 h-3" />
                                            <span>{call.customer_phone}</span>
                                        </div>

                                        {/* Address if available */}
                                        {call.customer_address && (
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <MapPin className="w-3 h-3" />
                                                <span className="truncate">{call.customer_address}</span>
                                            </div>
                                        )}

                                        {/* Email if available */}
                                        {call.customer_email && (
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <Mail className="w-3 h-3" />
                                                <span className="truncate">{call.customer_email}</span>
                                            </div>
                                        )}

                                        {/* Intent & Resolution */}
                                        <div className="flex items-center gap-3 text-xs">
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Target className="w-3 h-3" />
                                                <span>{call.intent}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <CheckCircle className="w-3 h-3" />
                                                <span className="capitalize">{call.resolution_status?.replace(/_/g, ' ')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Time */}
                                    <div className="text-right shrink-0">
                                        <span className="text-xs text-muted-foreground block">
                                            {call.called_at?.slice(0, 5) || (call.created_at ? new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-')}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{call.date}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {calls.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                System monitoring active. Waiting for calls...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MOBILE/TABLET VIEW (Current Workspace Layout) - Visible on lg- */}
            <div className="lg:hidden space-y-6 animate-in fade-in duration-700 pb-16">
                {/* Period Toggle - Mobile */}
                <div className="flex gap-2 justify-center">
                    <Button
                        variant={period === 'day' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod('day')}
                        className="flex-1"
                    >
                        Day
                    </Button>
                    <Button
                        variant={period === 'week' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod('week')}
                        className="flex-1"
                    >
                        Week
                    </Button>
                    <Button
                        variant={period === 'month' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod('month')}
                        className="flex-1"
                    >
                        Month
                    </Button>
                </div>

                {/* Hero Stats - White Cards with Teal Borders */}
                <div className="relative">
                    {/* Main Hero Card - Total Calls */}
                    <div className="relative overflow-hidden rounded-2xl bg-white border-2 border-primary p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                                    <Phone className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                                        Calls {period === 'day' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}
                                    </p>
                                    <p className="text-foreground text-sm font-semibold">Daily Activity</p>
                                </div>
                            </div>
                            <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
                                <div className="text-xs font-bold text-primary text-center">{calls.length}</div>
                                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">All Time</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-5xl sm:text-6xl font-black text-primary tracking-tighter">
                                {callsCount}
                            </div>
                            <div className="flex items-center gap-2 text-foreground">
                                <Zap className="w-4 h-4 text-yellow-500" />
                                <span className="text-xs font-bold text-muted-foreground">
                                    {period === 'day' ? 'Handled today' : period === 'week' ? 'This week' : 'This month'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Stats - Side by Side */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        {/* Booked Appointments */}
                        <div className="relative overflow-hidden rounded-xl bg-white border-2 border-primary p-4 shadow-md">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 border border-primary/20">
                                <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-3xl font-black text-primary mb-1">{bookedCount}</div>
                            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                                Booked {period === 'day' ? 'Today' : period === 'week' ? 'Week' : 'Month'}
                            </p>
                        </div>

                        {/* Call Reasons Chart */}
                        <div className="relative overflow-hidden rounded-xl bg-white border-2 border-primary p-4 shadow-md">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 border border-primary/20">
                                <Activity className="w-5 h-5 text-primary" />
                            </div>
                            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-3">Call Reasons</p>
                            <ResponsiveContainer width="100%" height={100}>
                                <PieChart>
                                    <Pie
                                        data={intentData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={20}
                                        outerRadius={40}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {intentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Pipeline Value */}
                        <div className="relative overflow-hidden rounded-xl bg-white border-2 border-primary p-4 shadow-md">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3 border border-primary/20">
                                <DollarSign className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-3xl font-black text-primary mb-1">${pipelineValue.toLocaleString()}</div>
                            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Pipeline Value</p>
                        </div>
                    </div>
                </div>

                {/* Priority Action Alert */}
                {actionCount > 0 && (
                    <Link to="/dashboard/action-required" className="block group">
                        <div className="relative overflow-hidden rounded-xl bg-white border-2 border-primary p-5 shadow-lg hover:shadow-xl hover:border-primary/80 transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                                        <Activity className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-3xl font-black text-primary">{actionCount}</span>
                                            <span className="text-muted-foreground text-sm font-bold uppercase">Items</span>
                                        </div>
                                        <p className="text-muted-foreground font-bold uppercase text-xs tracking-wider">Need Attention</p>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all border-2 border-primary/30">
                                    <ArrowRight className="w-5 h-5 text-primary group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Recent Activity - Compact & Clean */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-black text-foreground tracking-tight">Recent</h2>
                        </div>
                        <Link to="/dashboard/call-logs">
                            <button className="text-[10px] uppercase tracking-widest font-black text-primary hover:text-primary/70 transition-colors flex items-center gap-1">
                                View All <ArrowRight className="w-3 h-3" />
                            </button>
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {calls.slice(0, 4).map((call) => (
                            <Card key={call.id} className="group border-2 border-primary/20 hover:border-primary hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden bg-white shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                <Phone className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-foreground leading-none mb-1.5 truncate">{call.caller_name}</p>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                                    <span className="truncate">{call.customer_phone}</span>
                                                    <span>•</span>
                                                    <span>{call.called_at}</span>
                                                    {(call.appointment_date || call.appointment_time) && (
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-border">|</span>
                                                            <span className="text-primary font-bold flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {call.appointment_date && new Date(call.appointment_date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                                                                {call.appointment_time && ` @ ${call.appointment_time}`}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 text-[9px] font-black rounded-lg border-2 shadow-sm uppercase tracking-wider shrink-0 ${getIntentColor(call.intent)}`}>
                                            {call.intent ? call.intent.replace(/_/g, ' ').substring(0, 8) : 'Call'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {calls.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-semibold">No recent activity</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
