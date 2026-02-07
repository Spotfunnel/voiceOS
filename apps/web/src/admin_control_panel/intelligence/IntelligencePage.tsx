import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/shared_ui/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared_ui/components/ui/Card';
import { Button } from '@/shared_ui/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared_ui/components/ui/Select';
import { TrendingUp, DollarSign, Target, BarChart3, PieChart as PieChartIcon, Filter as FilterIcon, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

// Mock Data
const INDUSTRIES = ['All Industries', 'Real Estate', 'Solar Energy', 'Legal', 'Healthcare', 'E-commerce'];
const COMPANIES = {
    'All Industries': ['All Companies', 'Skyline Reality', 'SunPower Solutions', 'Justice Partners', 'City Health', 'EcoShop'],
    'Real Estate': ['All Companies', 'Skyline Reality', 'Urban Living', 'Coastal Homes'],
    'Solar Energy': ['All Companies', 'SunPower Solutions', 'GreenGrid', 'SolarWave'],
    'Legal': ['All Companies', 'Justice Partners', 'LegalEagle'],
    'Healthcare': ['All Companies', 'City Health', 'CarePlus'],
    'E-commerce': ['All Companies', 'EcoShop', 'Trendify']
};


export function IntelligencePage() {
    const [industry, setIndustry] = useState('All Industries');
    const [company, setCompany] = useState('All Companies');
    const [timeRange, setTimeRange] = useState('last-30-days');
    const [outcomesData, setOutcomesData] = useState({
        total_calls: 0,
        leads_captured: 0,
        bookings: 0,
        escalated: 0,
        abandoned: 0,
        conversion_rate: 0,
        escalation_rate: 0,
        outcome_breakdown: {} as Record<string, number>,
    });
    const [reasonsData, setReasonsData] = useState<{ name: string; count: number }[]>([]);
    const [costData, setCostData] = useState({
        total_cost: 0,
        avg_cost_per_min: 0,
        total_minutes: 0,
        cost_per_lead: 0,
        cost_per_booking: 0,
    });

    useEffect(() => {
        const fetchIntelligence = async () => {
            try {
                const [outcomesRes, reasonsRes, costRes] = await Promise.all([
                    fetch(`/api/admin/intelligence/outcomes?period=${timeRange}`),
                    fetch(`/api/admin/intelligence/reason-taxonomy?period=${timeRange}`),
                    fetch(`/api/admin/intelligence/cost-analytics?period=${timeRange}`),
                ]);

                if (outcomesRes.ok) {
                    const data = await outcomesRes.json();
                    setOutcomesData(data);
                }
                if (reasonsRes.ok) {
                    const data = await reasonsRes.json();
                    setReasonsData(
                        (data || []).map((row: any) => ({
                            name: row.reason,
                            count: row.count,
                        }))
                    );
                }
                if (costRes.ok) {
                    const data = await costRes.json();
                    setCostData(data);
                }
            } catch (error) {
                console.error('Failed to load intelligence data:', error);
            }
        };

        fetchIntelligence();
    }, [timeRange]);

    const filteredPerformance = useMemo(() => {
        if (industry === 'All Industries') return reasonsData;
        return reasonsData;
    }, [industry, reasonsData]);

    const outcomeDistribution = useMemo(() => {
        const colors = ['#0d9488', '#0ea5e9', '#f59e0b', '#94a3b8', '#a855f7'];
        const entries = Object.entries(outcomesData.outcome_breakdown || {});
        return entries.map(([name, value], index) => ({
            name,
            value,
            color: colors[index % colors.length],
        }));
    }, [outcomesData]);

    return (
        <DashboardLayout activeResult="intelligence">
            <div className="space-y-6 pb-12 animate-in fade-in duration-500">
                {/* Header & Global Filters */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Intelligence</h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            Deep insights across industries and partners
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
                            <Select value={industry} onValueChange={(val) => { setIndustry(val); setCompany('All Companies'); }}>
                                <SelectTrigger className="w-[160px] border-none shadow-none h-8 text-xs font-semibold focus:ring-0">
                                    <FilterIcon size={14} className="mr-2 text-slate-400" />
                                    <SelectValue placeholder="Industry" />
                                </SelectTrigger>
                                <SelectContent>
                                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="h-4 w-[1px] bg-slate-200" />
                            <Select value={company} onValueChange={setCompany}>
                                <SelectTrigger className="w-[160px] border-none shadow-none h-8 text-xs font-semibold focus:ring-0">
                                    <SelectValue placeholder="Company" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(COMPANIES[industry as keyof typeof COMPANIES] || COMPANIES['All Industries']).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[140px] h-10 text-xs font-semibold">
                                <Calendar size={14} className="mr-2 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                                <SelectItem value="last-90-days">Last 90 Days</SelectItem>
                                <SelectItem value="ytd">Year to Date</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Cost</p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                        ${costData.total_cost.toFixed(2)}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium mt-2">
                                        Avg ${costData.avg_cost_per_min.toFixed(2)}/min
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                    <DollarSign size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conversion Rate</p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                        {(outcomesData.conversion_rate * 100).toFixed(1)}%
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium mt-2">
                                        Leads captured: {outcomesData.leads_captured}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <Target size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Calls</p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{outcomesData.total_calls}</h3>
                                    <p className="text-xs text-slate-400 font-medium mt-2">
                                        Bookings: {outcomesData.bookings}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                                    <BarChart3 size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escalation Rate</p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                        {(outcomesData.escalation_rate * 100).toFixed(1)}%
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium mt-2">
                                        Escalated calls: {outcomesData.escalated}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                                    <TrendingUp size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Visualizations */}
                <div className="grid lg:grid-cols-12 gap-6">
                    {/* Performance Bar Chart */}
                    <Card className="lg:col-span-8 border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-0">
                            <div>
                                <CardTitle className="text-lg font-bold">Top Call Reasons</CardTitle>
                                <p className="text-xs text-slate-400 font-medium uppercase mt-0.5 tracking-tighter">Most frequent reasons</p>
                            </div>
                            <BarChart3 className="text-slate-300 w-5 h-5" />
                        </CardHeader>
                        <CardContent className="pt-8">
                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={filteredPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }}
                                            tickFormatter={(val) => `${val}`}
                                        />
                                        <ReTooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                                            {filteredPerformance.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#0ea5e9'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Outcome Pie Chart */}
                    <Card className="lg:col-span-4 border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-0">
                            <div>
                                <CardTitle className="text-lg font-bold">Call Outcomes</CardTitle>
                                <p className="text-xs text-slate-400 font-medium uppercase mt-0.5 tracking-tighter">Overall distribution</p>
                            </div>
                            <PieChartIcon className="text-slate-300 w-5 h-5" />
                        </CardHeader>
                        <CardContent className="pt-2 flex flex-col items-center">
                            <div className="h-[280px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={outcomeDistribution}
                                            innerRadius={75}
                                            outerRadius={95}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            {outcomeDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ReTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                    <p className="text-sm font-bold text-slate-400 uppercase">Conversion</p>
                                    <p className="text-3xl font-black text-slate-900 tracking-tighter">
                                        {(outcomesData.conversion_rate * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            <div className="w-full space-y-2 mt-2">
                                {OUTCOME_DISTRIBUTION.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between text-xs font-bold">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-slate-600">{item.name}</span>
                                        </div>
                                        <span className="text-slate-900">{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Revenue Table */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Top Performing Companies</CardTitle>
                            <p className="text-xs text-slate-400 font-medium uppercase mt-0.5 tracking-tighter">Ranked by pipeline value</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-bold bg-slate-50">
                            View All Data
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 border-y border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Industry</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pipeline Value</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Conversion</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Trend</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { name: 'Skyline Reality', industry: 'Real Estate', value: '$142,500', conv: '64%', trend: '+8.2%' },
                                        { name: 'SunPower Solutions', industry: 'Solar Energy', value: '$98,200', conv: '71%', trend: '+12.4%' },
                                        { name: 'Justice Partners', industry: 'Legal', value: '$84,000', conv: '45%', trend: '-2.1%' },
                                        { name: 'EcoShop', industry: 'E-commerce', value: '$76,500', conv: '32%', trend: '+5.6%' },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors cursor-pointer">
                                            <td className="px-6 py-4 font-bold text-slate-900 text-sm">{row.name}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                                    {row.industry}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700 text-sm">{row.value}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary" style={{ width: row.conv }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-900">{row.conv}</span>
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 text-right text-xs font-black ${row.trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {row.trend}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
