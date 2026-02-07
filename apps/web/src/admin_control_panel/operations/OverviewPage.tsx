
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Activity, Clock, Search, ChevronRight, TrendingUp, AlertCircle, Zap, Users, Mail, UserPlus, RefreshCw } from 'lucide-react';
import { cn } from "@/shared_ui/lib/utils";
import { DashboardLayout } from "@/shared_ui/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared_ui/components/ui/Card";
import { Button } from "@/shared_ui/components/ui/Button";
import { Input } from "@/shared_ui/components/ui/Input";
import { Badge } from "@/shared_ui/components/ui/Badge";
import { StatsCard } from "@/shared_ui/components/ui/StatsCard";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared_ui/components/ui/Table";
import { InviteUserModal } from "./InviteUserModal";

// Specific trade industries
const INDUSTRIES = [
    "Solar Installation",
    "Plumbing",
    "HVAC",
    "Electrical",
    "Roofing",
    "Landscaping",
    "Pool Services",
    "Pest Control",
    "Locksmith",
    "Garage Doors",
    "Window Cleaning",
    "Carpet Cleaning",
    "Painting",
    "Flooring",
    "Fencing"
];

// User status types
type UserStatus = 'not_invited' | 'invited' | 'active' | 'invitation_expired' | 'inactive';

interface Agent {
    id: string;
    name: string;
    company: string;
    industry: string;
    status: 'active' | 'standby';
    callsHandled: number;
    successRate: string;
    totalMinutes: number;
    userStatus?: UserStatus;
    userEmail?: string;
    lastLogin?: Date;
}

export function OverviewPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndustry, setSelectedIndustry] = useState('All Industries');
    const [timeRange, setTimeRange] = useState<'Today' | 'This Week' | 'This Month'>('Today');
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch real agents from API
    const fetchAgents = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/agents');
            if (!response.ok) {
                throw new Error('Failed to fetch agents');
            }
            const data = await response.json();
            console.log('[OverviewPage] Fetched agents:', data);
            const agentsList = data.agents || data;
            // Debug: Log each agent's user status
            agentsList.forEach((agent: Agent) => {
                console.log(`[Agent ${agent.id}] userStatus: ${agent.userStatus}, userEmail: ${agent.userEmail}`);
            });
            setAgents(agentsList);
        } catch (err: any) {
            console.error('Error fetching agents:', err);
            setError(err.message);
            // Fallback to empty array on error
            setAgents([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const filteredAgents = useMemo(() => {
        return agents.filter(agent => {
            const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                agent.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                agent.industry.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesIndustry = selectedIndustry === 'All Industries' || agent.industry === selectedIndustry;

            return matchesSearch && matchesIndustry;
        });
    }, [agents, searchQuery, selectedIndustry]);

    const handleInviteUser = (agent: Agent, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedAgent(agent);
        setInviteModalOpen(true);
    };

    const handleResendInvitation = async (agent: Agent, e: React.MouseEvent) => {
        e.stopPropagation();
        
        try {
            const response = await fetch(`/api/admin/resend-invitation/${agent.id}`, {
                method: 'POST',
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to resend invitation');
            }
            
            alert('Invitation resent successfully!');
            // Refresh agent data after resending
            await fetchAgents();
        } catch (error: any) {
            console.error('Error resending invitation:', error);
            alert(error.message || 'Failed to resend invitation. Please try again.');
        }
    };

    const handleInviteSent = () => {
        // Refresh agent data after invitation sent
        fetchAgents();
    };

    const getUserStatusBadge = (status: UserStatus) => {
        switch (status) {
            case 'not_invited':
                return <Badge variant="secondary" className="text-xs">🔴 Not Invited</Badge>;
            case 'invited':
                return <Badge variant="default" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">🟡 Pending</Badge>;
            case 'active':
                return <Badge variant="success" className="text-xs">🟢 Active</Badge>;
            case 'invitation_expired':
                return <Badge variant="destructive" className="text-xs">⏰ Expired</Badge>;
            case 'inactive':
                return <Badge variant="secondary" className="text-xs">⚫ Inactive</Badge>;
            default:
                return null;
        }
    };

    const activeAgents = agents.filter(a => a.status === 'active').length;

    // Adjust metrics based on time range
    const multiplier = timeRange === 'Today' ? 1 : timeRange === 'This Week' ? 7 : 30;

    const totalCalls = agents.reduce((sum, a) => sum + ((a.callsHandled || 0) * multiplier), 0);
    const avgSuccessRate = agents.length > 0 ? (agents.reduce((sum, a) => sum + (parseInt(a.successRate) || 0), 0) / agents.length).toFixed(1) : '0';
    const totalMinutes = agents.reduce((sum, a) => sum + ((a.totalMinutes || 0) * multiplier), 0);

    // Show loading state
    if (isLoading) {
        return (
            <DashboardLayout activeResult="overview">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading agents...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Show error state
    if (error) {
        return (
            <DashboardLayout activeResult="overview">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Failed to Load Agents</h3>
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <Button onClick={fetchAgents}>Retry</Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout activeResult="overview">
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-primary">Agent Overview</h2>
                        <p className="text-muted-foreground">Monitor all {agents.length} deployed AI agents across your customer base.</p>
                    </div>
                    <div className="flex gap-2">
                        {/* Time Range Selector */}
                        <div className="flex bg-secondary/20 p-1 rounded-lg border border-border">
                            {['Today', 'This Week', 'This Month'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range as any)}
                                    className={cn(
                                        "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                                        timeRange === range
                                            ? "bg-primary text-white shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                                    )}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>

                        <select
                            className="bg-card border border-border rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                            value={selectedIndustry}
                            onChange={(e) => setSelectedIndustry(e.target.value)}
                        >
                            <option>All Industries</option>
                            {INDUSTRIES.map((industry) => (
                                <option key={industry} value={industry}>
                                    {industry}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
                    <StatsCard
                        title="Needs Attention"
                        value="3"
                        trend="down"
                        trendValue="2 less"
                        icon={AlertCircle}
                        className="bg-amber-50/50 border-amber-200"
                    />
                    <StatsCard
                        title="Total Agents"
                        value={agents.length.toString()}
                        trend="neutral"
                        trendValue={`${activeAgents} active`}
                        icon={Users}
                    />
                    <StatsCard
                        title={`Calls (${timeRange})`}
                        value={totalCalls.toLocaleString()}
                        trend="up"
                        trendValue="12%"
                        icon={Phone}
                    />
                    <StatsCard
                        title={`Minutes (${timeRange})`}
                        value={totalMinutes.toLocaleString()}
                        trend="up"
                        trendValue="18%"
                        icon={Clock}
                    />
                    <StatsCard
                        title="Avg Success Rate"
                        value={`${avgSuccessRate}%`}
                        trend="up"
                        trendValue="2.4%"
                        icon={Zap}
                    />
                </div>

                {/* Agent List */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-secondary/10 py-4">
                        <div>
                            <CardTitle className="text-lg">All Agents</CardTitle>
                            <CardDescription>Click on any agent to view detailed call activity and performance metrics.</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search agents..."
                                className="pl-9 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[600px] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-secondary/10 z-10">
                                    <TableRow>
                                        <TableHead>Agent Name</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Industry</TableHead>
                                        <TableHead>Agent Status</TableHead>
                                        <TableHead>User Status</TableHead>
                                        <TableHead className="text-right">Calls Today</TableHead>
                                        <TableHead className="text-right">Success Rate</TableHead>
                                        <TableHead className="text-right">Minutes</TableHead>
                                        <TableHead className="text-center">Actions</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAgents.map((agent) => (
                                        <TableRow
                                            key={agent.id}
                                            className="group hover:bg-primary/5 transition-colors"
                                        >
                                            <TableCell className="font-medium">{agent.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{agent.company}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal text-xs">
                                                    {agent.industry}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={agent.status === 'active' ? 'success' : 'secondary'} className="text-xs">
                                                    {agent.status === 'active' ? '🟢 Active' : '⏸️ Standby'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {getUserStatusBadge(agent.userStatus || 'not_invited')}
                                                    {agent.userStatus === 'active' && agent.lastLogin && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Last: {new Date(agent.lastLogin).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">{agent.callsHandled || 0}</TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">{agent.successRate || '0%'}</TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">{(agent.totalMinutes || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-center">
                                                {(agent.userStatus === 'not_invited' || !agent.userStatus) && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => handleInviteUser(agent, e)}
                                                        className="text-xs"
                                                    >
                                                        <UserPlus className="w-3 h-3 mr-1" />
                                                        Invite
                                                    </Button>
                                                )}
                                                {(agent.userStatus === 'invited' || agent.userStatus === 'invitation_expired') && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => handleResendInvitation(agent, e)}
                                                        className="text-xs"
                                                    >
                                                        <RefreshCw className="w-3 h-3 mr-1" />
                                                        Resend
                                                    </Button>
                                                )}
                                                {agent.userStatus === 'active' && (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <button
                                                    onClick={() => {
                                                        const params = new URLSearchParams({
                                                            agentId: agent.id,
                                                            name: agent.name,
                                                            company: agent.company,
                                                            industry: agent.industry,
                                                            status: agent.status,
                                                        });
                                                        router.push(`/admin/operations?${params.toString()}`);
                                                    }}
                                                    className="inline-flex items-center"
                                                >
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {filteredAgents.length === 0 && (
                            <div className="p-12 text-center text-muted-foreground">
                                <p>No agents found matching "{searchQuery}"</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Invite User Modal */}
            {selectedAgent && (
                <InviteUserModal
                    isOpen={inviteModalOpen}
                    onClose={() => {
                        setInviteModalOpen(false);
                        setSelectedAgent(null);
                    }}
                    agentId={selectedAgent.id}
                    agentName={selectedAgent.name}
                    businessName={selectedAgent.company}
                    onInviteSent={handleInviteSent}
                />
            )}
        </DashboardLayout>
    );
}
