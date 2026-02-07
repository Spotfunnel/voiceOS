import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';
import { StatsCard } from '../../ui_kit/components/ui/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui_kit/components/ui/Card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../ui_kit/components/ui/Table';
import { Badge } from '../../ui_kit/components/ui/Badge';
import { Input } from '../../ui_kit/components/ui/Input';
import { Phone, Users, AlertTriangle, CheckCircle2, Clock, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { mockId } from '../../ui_kit/lib/utils';

// Mock Data
const AGENTS = [
    { id: mockId(), name: "Inbound Reception A", status: "Active", minutes: "450 / 1000", lastError: "None", health: "healthy" },
    { id: mockId(), name: "Sales Outreach B", status: "Active", minutes: "890 / 1000", lastError: "20m ago", health: "warning" },
    { id: mockId(), name: "Support Tier 1", status: "Paused", minutes: "120 / 500", lastError: "2h ago", health: "healthy" },
    { id: mockId(), name: "After Hours", status: "Active", minutes: "12 / 200", lastError: "None", health: "healthy" },
    { id: mockId(), name: "Booking Concierge", status: "Error", minutes: "0 / 1000", lastError: "Now", health: "critical" },
];

type SortConfig = {
    key: keyof typeof AGENTS[0] | null;
    direction: 'asc' | 'desc';
};

export function OperationsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

    // Filter and Sort Logic
    const processedAgents = useMemo(() => {
        let data = [...AGENTS];

        // 1. Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(agent =>
                agent.name.toLowerCase().includes(lowerTerm) ||
                agent.status.toLowerCase().includes(lowerTerm) ||
                agent.minutes.toLowerCase().includes(lowerTerm) ||
                agent.lastError.toLowerCase().includes(lowerTerm)
            );
        }

        // 2. Sort
        if (sortConfig.key) {
            data.sort((a, b) => {
                const aValue = a[sortConfig.key!];
                const bValue = b[sortConfig.key!];

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [searchTerm, sortConfig]);

    const handleSort = (key: keyof typeof AGENTS[0]) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }: { columnKey: keyof typeof AGENTS[0] }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4 text-primary" />
            : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
    };

    return (
        <DashboardLayout activeResult="operations">
            <div className="space-y-8">
                {/* 1. Global Health Strip */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">System Healthy</h2>
                            <p className="text-sm text-slate-500">All primary voice circuits operational.</p>
                        </div>
                    </div>
                    <div className="flex gap-8 px-8 border-l border-slate-100">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Uptime (24h)</p>
                            <p className="text-lg font-mono font-medium text-slate-900">99.98%</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Avg Latency</p>
                            <p className="text-lg font-mono font-medium text-slate-900">420ms</p>
                        </div>
                    </div>
                </div>

                {/* 2. Key Metrics - "Float to Top" */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Active Calls Now"
                        value="12"
                        trend="neutral"
                        trendValue="Normal Load"
                        icon={Phone}
                    />
                    <StatsCard
                        title="Calls (24h)"
                        value="1,248"
                        trend="up"
                        trendValue="+12% vs avg"
                        icon={Users}
                    />
                    <StatsCard
                        title="Errors (24h)"
                        value="3"
                        trend="down"
                        trendValue="-2 from yest"
                        icon={AlertTriangle}
                    />
                    <StatsCard
                        title="Minutes Used (Feb)"
                        value="14,204"
                        trend="up"
                        trendValue="82% of Cap"
                        icon={Clock}
                        className="border-amber-200 bg-amber-50/30" // Subtle warning indication
                    />
                </div>

                {/* 3. Agent Status Table */}
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CardTitle>Agent Status</CardTitle>
                            <Badge variant="outline" className="bg-slate-50">{processedAgents.length} Agents</Badge>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search agents..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead
                                        className="cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center">
                                            Agent Name <SortIcon columnKey="name" />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center">
                                            Status <SortIcon columnKey="status" />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('minutes')}
                                    >
                                        <div className="flex items-center">
                                            Minutes Usage <SortIcon columnKey="minutes" />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('lastError')}
                                    >
                                        <div className="flex items-center">
                                            Last Incident <SortIcon columnKey="lastError" />
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedAgents.length > 0 ? (
                                    processedAgents.map((agent) => (
                                        <TableRow key={agent.id}>
                                            <TableCell className="font-medium text-slate-900">{agent.name}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    agent.health === 'healthy' ? 'success' :
                                                        agent.health === 'warning' ? 'warning' : 'destructive'
                                                }>
                                                    {agent.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{agent.minutes}</TableCell>
                                            <TableCell className="text-slate-500">{agent.lastError}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                            No agents found matching "{searchTerm}"
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 4. Alerts Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-800">Capacity Warning</h4>
                            <p className="text-sm text-amber-700 mt-1">
                                Sales Outreach B is approaching its hard minute cap (89%). Consider increasing allocation before weekend surge.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
