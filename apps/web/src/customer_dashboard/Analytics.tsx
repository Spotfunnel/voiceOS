import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, TrendingUp, Activity, Calendar, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, Cell, PieChart, Pie } from 'recharts';

type TimePeriod = 'this-month' | 'last-month' | 'last-30-days' | 'last-7-days' | 'all-time';

export default function Analytics() {
    const { calls, isLoading } = useData();
    const [period, setPeriod] = useState<TimePeriod>('this-month');

    // Filter calls by period
    const filteredCalls = useMemo(() => {
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

    // Calculate metrics
    const metrics = useMemo(() => {
        const total = filteredCalls.length;
        const booked = filteredCalls.filter(c => c.booking_status === 'confirmed' || c.booking_status === 'booked' || c.intent === 'booking').length;
        const actionRequired = filteredCalls.filter(c => c.resolution_status === 'Action Required' || c.resolution_status === 'action_required').length;
        const conversionRate = total > 0 ? ((booked / total) * 100).toFixed(1) : '0';

        return { total, booked, actionRequired, conversionRate };
    }, [filteredCalls]);

    // Group calls by date for chart
    const callsByDate = useMemo(() => {
        const grouped: Record<string, number> = {};
        filteredCalls.forEach(call => {
            const date = call.date;
            grouped[date] = (grouped[date] || 0) + 1;
        });

        return Object.entries(grouped)
            .map(([date, count]) => ({ date, calls: count }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-14); // Last 14 days
    }, [filteredCalls]);

    // Outcome distribution as bar data
    const outcomes = useMemo(() => {
        const booked = filteredCalls.filter(c => c.booking_status === 'confirmed' || c.booking_status === 'booked').length;
        const actionRequired = filteredCalls.filter(c => c.resolution_status === 'Action Required' || c.resolution_status === 'action_required').length;
        const resolved = filteredCalls.filter(c => c.resolution_status === 'resolved' || c.resolution_status === 'Resolved').length;
        const other = filteredCalls.length - booked - actionRequired - resolved;

        return [
            { name: 'Booked', value: booked },
            { name: 'Action Required', value: actionRequired },
            { name: 'Resolved', value: resolved },
            { name: 'Other', value: other }
        ].filter(item => item.value > 0);
    }, [filteredCalls]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Activity className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-16 lg:pb-6 animate-in fade-in duration-500">
            {/* Header - Spacious and Elegant */}
            <div className="space-y-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold tracking-tight text-primary">Performance Insights</h1>
                    <p className="text-sm text-muted-foreground">Track call outcomes and trends</p>
                </div>

                {/* Period Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">Period:</span>
                    <Select value={period} onValueChange={(value: TimePeriod) => setPeriod(value)}>
                        <SelectTrigger className="w-[280px] max-w-full">
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

            {/* Main Content Layout */}
            <div className="grid grid-rows-[auto_1fr] gap-4 min-h-0">
                {/* Top Section: Metrics Grid + Pie Chart */}
                <div className="grid lg:grid-cols-12 gap-6">
                    {/* Left: Metric Cards (2x2 Grid) */}
                    <div className="lg:col-span-8 grid grid-cols-2 gap-4">
                        <Card className="bg-card border-slate-300 shadow-md flex flex-col justify-center hover:shadow-md transition-all duration-200">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Total Calls</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Phone className="w-4 h-4 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <div className="text-2xl font-bold">{metrics.total}</div>
                                <p className="text-xs text-emerald-600 font-medium mt-1">↑ 12% from last period</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-slate-300 shadow-md flex flex-col justify-center hover:shadow-md transition-all duration-200">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Conversion</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
                                <p className="text-xs text-muted-foreground mt-0.5">{metrics.booked} booked</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-slate-300 shadow-md flex flex-col justify-center hover:shadow-md transition-all duration-200">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Action Required</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Activity className="w-4 h-4 text-amber-600" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <div className="text-2xl font-bold">{metrics.actionRequired}</div>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-slate-300 shadow-md flex flex-col justify-center hover:shadow-md transition-all duration-200">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">Booked</CardTitle>
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <div className="text-2xl font-bold">{metrics.booked}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Compact Pie Chart */}
                    <Card className="lg:col-span-4 bg-card border-slate-300 shadow-md h-full flex flex-col hover:shadow-md transition-all duration-200">
                        <CardHeader className="pb-2 p-5 shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
                                    Call Outcomes
                                </CardTitle>
                                <div className="text-xs text-muted-foreground">
                                    {filteredCalls.length} calls
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 pt-0 flex-1 min-h-0 flex items-center">
                            <div className="w-[140px] h-[140px] relative mx-auto lg:mx-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <defs>
                                            <linearGradient id="gradBooked" x1="0" y1="0" x2="0" y2="1">
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
                                                const gradients = ['url(#gradBooked)', 'url(#gradAction)', 'url(#gradResolved)', 'url(#gradOther)'];
                                                return <Cell key={`cell-${index}`} fill={gradients[index % gradients.length]} stroke="none" />;
                                            })}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                                zIndex: 50
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Total */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-bold tracking-tighter text-foreground">{metrics.total}</span>
                                </div>
                            </div>

                            {/* Side Legend - Compact */}
                            <div className="flex-1 pl-4 space-y-2.5">
                                {outcomes.map((outcome, index) => {
                                    const colors = ['#14b8a6', '#f59e0b', '#8b5cf6', 'hsl(var(--muted-foreground))'];
                                    return (
                                        <div key={outcome.name} className="flex items-center gap-2 group cursor-default">
                                            <div
                                                className="w-2 h-2 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                                                style={{ backgroundColor: colors[index % colors.length] }}
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] text-muted-foreground leading-none mb-0.5 truncate">{outcome.name}</span>
                                                <span className="text-sm font-bold leading-none">{outcome.value}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom: Full-Width Stretched Chart */}
                <Card className="bg-card border-slate-300 shadow-md flex-1 min-h-[250px] hover:shadow-md transition-all duration-200">
                    <CardHeader className="pb-2 p-5">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
                                Call Volume Trend
                            </CardTitle>
                            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                ↑ 2.54%
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={callsByDate} margin={{ top: 5, bottom: 5, left: 0, right: 0 }}>
                                <defs>
                                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return `${date.getMonth() + 1}/${date.getDate()}`;
                                    }}
                                    dy={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    width={30}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="calls"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    fill="url(#colorCalls)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="calls"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Empty State */}
                {filteredCalls.length === 0 && (
                    <Card className="bg-card border-slate-300 shadow-md">
                        <CardContent className="py-12 text-center">
                            <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                            <p className="text-sm text-muted-foreground">No calls in this period</p>
                            <p className="text-xs text-muted-foreground mt-1">Try selecting a different time range</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
