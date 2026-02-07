
import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';
import { StatsCard } from '../../ui_kit/components/ui/StatsCard';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui_kit/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui_kit/components/ui/Select';
import { TrendingUp, RefreshCcw, DollarSign, Activity, Users, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Mock Data
const MOCK_INDUSTRIES = ['All Industries', 'Solar', 'HVAC', 'Plumbing', 'Roofing', 'Real Estate'];
const MOCK_COMPANIES = {
    'Solar': ['SunPower Pros', 'Green Energy Sol', 'EcoHome Systems'],
    'HVAC': ['Cool Breeze Inc', 'Heating Experts', 'Ventilation Guys'],
    'Plumbing': ['Rapid Plumbers', 'Pipe Masters', 'LeakFixers'],
    'Roofing': ['Top Shield', 'Elite Roofs', 'Covered'],
    'Real Estate': ['Prime Properties', 'City Realty', 'HomeFinders']
};

const MOCK_DATA = {
    'All Industries': { revenue: 125000, calls: 4500, successRate: 78, pipeline: 850000 },
    'Solar': { revenue: 45000, calls: 1200, successRate: 65, pipeline: 320000 },
    'HVAC': { revenue: 35000, calls: 1500, successRate: 82, pipeline: 210000 },
    'Plumbing': { revenue: 25000, calls: 1100, successRate: 88, pipeline: 150000 },
    'Roofing': { revenue: 15000, calls: 500, successRate: 60, pipeline: 120000 },
    'Real Estate': { revenue: 5000, calls: 200, successRate: 45, pipeline: 50000 }
};

const INDUSTRY_PERFORMANCE = [
    { name: 'Solar', successRate: 65, revenue: 320000 },
    { name: 'HVAC', successRate: 82, revenue: 210000 },
    { name: 'Plumbing', successRate: 88, revenue: 150000 },
    { name: 'Roofing', successRate: 60, revenue: 120000 },
    { name: 'Real Estate', successRate: 45, revenue: 50000 },
];

const OUTCOME_DATA = [
    { name: 'Appointment Booked', value: 45 },
    { name: 'Quote Sent', value: 25 },
    { name: 'Transferred', value: 15 },
    { name: 'Callback Scheduled', value: 10 },
    { name: 'Not Interested', value: 5 },
];

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export function IntelligencePage() {
    const [timePeriod, setTimePeriod] = useState('last-30');
    const [selectedIndustry, setSelectedIndustry] = useState('All Industries');
    const [selectedCompany, setSelectedCompany] = useState('All Companies');

    const availableCompanies = selectedIndustry === 'All Industries'
        ? Object.values(MOCK_COMPANIES).flat()
        : MOCK_COMPANIES[selectedIndustry as keyof typeof MOCK_COMPANIES] || [];

    // Get active metrics based on selection
    const currentMetrics = useMemo(() => {
        // If specific industry selected, return its data
        // If "All Industries", returns the aggregate
        // In a real app, filtering by company would further drill down
        return MOCK_DATA[selectedIndustry as keyof typeof MOCK_DATA];
    }, [selectedIndustry, selectedCompany]);

    const formattedRevenue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(currentMetrics.pipeline);

    return (
        <DashboardLayout activeResult="intelligence">
            <div className="space-y-8 animate-in fade-in duration-500">

                {/* Header & Controls */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Intelligence</h1>
                        <p className="text-slate-500 mt-1">Deep dive into industry performance and AI call outcomes.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Time Period */}
                        <Select value={timePeriod} onValueChange={setTimePeriod}>
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <SelectValue placeholder="Time Period" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="last-7">Last 7 Days</SelectItem>
                                <SelectItem value="last-30">Last 30 Days</SelectItem>
                                <SelectItem value="this-quarter">This Quarter</SelectItem>
                                <SelectItem value="ytd">Year to Date</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Industry Filter */}
                        <Select value={selectedIndustry} onValueChange={(val) => { setSelectedIndustry(val); setSelectedCompany('All Companies'); }}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Industry" />
                            </SelectTrigger>
                            <SelectContent>
                                {MOCK_INDUSTRIES.map(ind => (
                                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Company Filter */}
                        <Select value={selectedCompany} onValueChange={setSelectedCompany} disabled={selectedIndustry === 'All Industries'}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Company" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All Companies">All Companies</SelectItem>
                                {availableCompanies.map(comp => (
                                    <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Pipeline Generated"
                        value={formattedRevenue}
                        trend="up"
                        trendValue="+12.4%"
                        icon={DollarSign}
                        className="bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900"
                    />
                    <StatsCard
                        title="Avg. Success Rate"
                        value={`${currentMetrics.successRate}%`}
                        trend={currentMetrics.successRate > 70 ? 'up' : 'neutral'}
                        trendValue={currentMetrics.successRate > 70 ? '+5.2%' : '-1.1%'}
                        icon={TrendingUp}
                    />
                    <StatsCard
                        title="Total Calls"
                        value={currentMetrics.calls.toLocaleString()}
                        trend="up"
                        trendValue="+8.1%"
                        icon={Activity}
                    />
                    <StatsCard
                        title="Active Companies"
                        value={selectedIndustry === 'All Industries' ? '15' : availableCompanies.length.toString()}
                        trend="neutral"
                        trendValue="Stable"
                        icon={Building2}
                    />
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Main Chart: Success Rates by Industry */}
                    <Card className="lg:col-span-2 shadow-sm border-slate-200">
                        <CardHeader>
                            <CardTitle>Industry Performance</CardTitle>
                            <CardDescription>Comparison of success rates across different sectors.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={INDUSTRY_PERFORMANCE} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                                    <XAxis type="number" domain={[0, 100]} hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="successRate" name="Success Rate %" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24}>
                                        {INDUSTRY_PERFORMANCE.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.successRate > 80 ? '#10b981' : entry.successRate > 60 ? '#3b82f6' : '#f59e0b'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Outcome Distribution */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                            <CardTitle>Call Outcomes</CardTitle>
                            <CardDescription>Distribution of AI call results.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[350px] flex flex-col items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={OUTCOME_DATA}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {OUTCOME_DATA.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full mt-[-40px]">
                                {OUTCOME_DATA.map((item, index) => (
                                    <div key={item.name} className="flex items-center gap-2 text-xs">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="text-slate-600 truncate">{item.name}</span>
                                        <span className="ml-auto font-medium">{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Revenue Leaders Table */}
                    <Card className="lg:col-span-3 shadow-sm border-slate-200">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Revenue Generation by Industry</CardTitle>
                                    <CardDescription>Total pipeline revenue generated by AI agents.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border border-slate-100">
                                <div className="grid grid-cols-4 bg-slate-50 p-3 font-medium text-xs text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-1">Industry</div>
                                    <div className="col-span-1 text-right">Calls Handled</div>
                                    <div className="col-span-1 text-right">Success Rate</div>
                                    <div className="col-span-1 text-right">Pipeline Value</div>
                                </div>
                                {INDUSTRY_PERFORMANCE.sort((a, b) => b.revenue - a.revenue).map((ind, i) => (
                                    <div key={ind.name} className={`grid grid-cols-4 p-4 text-sm items-center hover:bg-slate-50/50 transition-colors ${i !== INDUSTRY_PERFORMANCE.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                        <div className="col-span-1 font-semibold text-slate-900 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                {i + 1}
                                            </div>
                                            {ind.name}
                                        </div>
                                        <div className="col-span-1 text-right text-slate-600 font-mono">
                                            {MOCK_DATA[ind.name as keyof typeof MOCK_DATA].calls.toLocaleString()}
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ind.successRate > 80 ? 'bg-emerald-100 text-emerald-800' : ind.successRate > 60 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {ind.successRate}%
                                            </span>
                                        </div>
                                        <div className="col-span-1 text-right font-bold text-slate-900">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(ind.revenue)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
