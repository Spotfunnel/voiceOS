import { useData } from '@/contexts/DataContext';
import { getIntentColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Calendar, Activity, Clock, ArrowRight, TrendingUp, Zap, CheckCircle2, MapPin, Mail, Target, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Overview() {
    const { calls, pendingJobs, isLoading } = useData();

    // Items needing action
    const actionCount = calls.filter(c => c.resolution_status === 'Action Required' || c.resolution_status === 'action_required').length;

    // Total calls today
    const today = new Date().toISOString().split('T')[0];
    const callsToday = calls.filter(c => c.date === today).length;

    // Bookings today (calls with booking_status confirmed or similar)
    const bookedToday = calls.filter(c => c.date === today && (c.booking_status === 'confirmed' || c.booking_status === 'booked' || c.intent === 'booking')).length;

    // Calls this week
    const callsThisWeek = calls.filter(c => {
        if (!c.date) return false;
        const callDate = new Date(c.date);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return callDate >= oneWeekAgo;
    }).length;

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
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-bold tracking-tight text-primary">
                        System Overview
                    </h1>
                    <p className="text-sm text-muted-foreground">Everything running smoothly</p>
                </div>

                {/* Outcome Metrics */}
                <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-card border-slate-300 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
                            <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Total Calls</CardTitle>
                            <Phone className="w-4 h-4 text-primary" />
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <div className="text-2xl font-bold">{calls.length}</div>
                            <p className="text-xs text-muted-foreground mt-0.5">Today: {callsToday}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-slate-300 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
                            <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Booked</CardTitle>
                            <Calendar className="w-4 h-4 text-accent" />
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <div className="text-2xl font-bold">{pendingJobs}</div>
                            <p className="text-xs text-muted-foreground mt-0.5">Appointments</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-slate-300 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
                            <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Status</CardTitle>
                            <Activity className="w-4 h-4 text-success animate-pulse" />
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <div className="text-2xl font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                Live
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Systems operational</p>
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
                    <div className="bg-card border border-slate-300 rounded-xl shadow-md divide-y divide-border">
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

            {/* MOBILE/TABLET VIEW - Elegant Redesign */}
            <div className="lg:hidden space-y-5 animate-in fade-in duration-700 pb-16">
                {/* Stats Grid - Refined Cards */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Calls Today */}
                    <Card className="border-slate-300 shadow-md hover:shadow-lg transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                    <Phone className="w-4 h-4 text-primary" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">Today</p>
                            </div>
                            <div className="text-3xl font-bold text-foreground mb-1">{callsToday}</div>
                            <p className="text-xs text-muted-foreground">Calls handled</p>
                        </CardContent>
                    </Card>

                    {/* Booked */}
                    <Card className="border-slate-300 shadow-md hover:shadow-lg transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-primary" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">Booked</p>
                            </div>
                            <div className="text-3xl font-bold text-foreground mb-1">{bookedToday}</div>
                            <p className="text-xs text-muted-foreground">Appointments</p>
                        </CardContent>
                    </Card>

                    {/* Total Calls */}
                    <Card className="border-slate-300 shadow-md hover:shadow-lg transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-primary" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">This Week</p>
                            </div>
                            <div className="text-3xl font-bold text-foreground mb-1">{callsThisWeek}</div>
                            <p className="text-xs text-muted-foreground">Calls last 7 days</p>
                        </CardContent>
                    </Card>

                    {/* System Status */}
                    <Card className="border-slate-300 shadow-md hover:shadow-lg transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-green-500/5 flex items-center justify-center">
                                    <Activity className="w-4 h-4 text-green-500" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">Status</p>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-2xl font-bold text-foreground">Live</span>
                            </div>
                            <p className="text-xs text-muted-foreground">All systems go</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Action Required - Elegant Alert */}
                {actionCount > 0 && (
                    <Link to="/dashboard/action-required" className="block group">
                        <Card className="border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-all">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Activity className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-2xl font-bold text-primary">{actionCount}</span>
                                                <span className="text-xs font-medium text-muted-foreground">items</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Need attention</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )}

                {/* Recent Activity - Clean List */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
                        <Link to="/dashboard/call-logs">
                            <button className="text-xs font-medium text-primary hover:text-primary/70 transition-colors flex items-center gap-1">
                                View all <ArrowRight className="w-3 h-3" />
                            </button>
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {calls.slice(0, 5).map((call) => (
                            <Card key={call.id} className="border-slate-300 shadow-md hover:border-slate-400 hover:shadow-lg transition-all">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-foreground mb-1 truncate">{call.caller_name}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="truncate">{call.customer_phone}</span>
                                                    {call.called_at && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{call.called_at}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {(call.appointment_date || call.appointment_time) && (
                                                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-primary">
                                                        <Calendar className="w-3 h-3" />
                                                        <span className="font-medium">
                                                            {call.appointment_date && new Date(call.appointment_date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                                                            {call.appointment_time && ` @ ${call.appointment_time}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 text-[10px] font-semibold rounded-md ${getIntentColor(call.intent)} shrink-0`}>
                                            {call.intent ? call.intent.replace(/_/g, ' ').substring(0, 8) : 'Call'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {calls.length === 0 && (
                        <div className="text-center py-12">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
