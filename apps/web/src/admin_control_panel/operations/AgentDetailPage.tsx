
import { useState } from "react";
import { ArrowLeft, Phone, Clock, Activity, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { DashboardLayout } from "@/shared_ui/components/DashboardLayout";
import { StatsCard } from "@/shared_ui/components/ui/StatsCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/shared_ui/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared_ui/components/ui/Table";
import { Badge } from "@/shared_ui/components/ui/Badge";
import { Button } from "@/shared_ui/components/ui/Button";

// Mock call data for the selected agent
const MOCK_CALLS = [
    {
        id: "1",
        caller: "John Smith",
        phone: "+61 412 345 678",
        time: "2 min ago",
        outcome: "Booked",
        duration: "4m 12s",
        summary: "Customer interested in high-end residential property. Booked a viewing for next Tuesday.",
        transcript: "AI: Hello, this is your AI assistant. How can I help you today?\nUser: Hi, I saw a listing for the penthouse. Is it still available?\nAI: Yes, it is! Would you like to schedule a viewing?\nUser: That would be great. How about next Tuesday at 2 PM?\nAI: Perfect. I've booked that in for you."
    },
    {
        id: "2",
        caller: "Sarah Johnson",
        phone: "+61 498 765 432",
        time: "8 min ago",
        outcome: "Follow-up",
        duration: "2m 45s",
        summary: "Customer having trouble accessing the portal. Technical support ticket raised.",
        transcript: "AI: Support here. How can I assist?\nUser: I can't log in to my account. It keeps saying 'Invalid Credentials'.\nAI: I'm sorry to hear that. Let me look into your account details..."
    },
    {
        id: "3",
        caller: "Mike Davis",
        phone: "+61 422 111 222",
        time: "15 min ago",
        outcome: "Booked",
        duration: "5m 30s",
        summary: "Inquiry about office space leasing for a 50-person team.",
        transcript: "AI: How can I help?\nUser: We're looking for about 500sqm of office space in the CBD.\nAI: We have several options. I'll have one of our commercial agents give you a call back."
    },
];

export function AgentDetailPage() {
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

    // In a real app, this would come from route params
    const agentName = "Company 1 AI";
    const companyName = "Company 1";
    const industry = "Real Estate";

    return (
        <DashboardLayout activeResult="operations">
            <div className="space-y-8">
                {/* Back Button + Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.history.back()}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Overview
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-primary">{agentName}</h2>
                        <p className="text-muted-foreground">{companyName} • {industry}</p>
                    </div>
                    <Badge variant="success" className="px-4 py-2 text-sm w-fit">
                        🟢 Active
                    </Badge>
                </div>

                {/* Agent Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                        title="Calls Handled Today"
                        value="342"
                        trend="up"
                        trendValue="12%"
                        icon={Phone}
                    />
                    <StatsCard
                        title="Success Rate"
                        value="92%"
                        trend="up"
                        trendValue="1.4%"
                        icon={Activity}
                    />
                    <StatsCard
                        title="Avg Call Duration"
                        value="3m 24s"
                        trend="down"
                        trendValue="8%"
                        icon={Clock}
                    />
                    <StatsCard
                        title="Total Minutes (Feb)"
                        value="1,164"
                        trend="up"
                        trendValue="18%"
                        icon={Clock}
                    />
                </div>

                {/* Call Activity Table */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="border-b bg-secondary/10">
                        <CardTitle>Call Activity</CardTitle>
                        <CardDescription>All calls handled by this agent. Click to expand for details.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {MOCK_CALLS.map((call) => (
                            <div key={call.id} className="border-b last:border-0">
                                <div
                                    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/20 transition-colors ${expandedCallId === call.id ? 'bg-primary/5' : ''}`}
                                    onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {call.caller[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{call.caller}</p>
                                            <p className="text-xs text-muted-foreground">{call.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="hidden md:block text-right">
                                            <p className="text-xs font-medium">{call.time}</p>
                                            <p className="text-[10px] text-muted-foreground">{call.duration}</p>
                                        </div>
                                        <Badge variant={call.outcome === 'Booked' ? 'success' : 'secondary'} className="w-24 justify-center">
                                            {call.outcome}
                                        </Badge>
                                        {expandedCallId === call.id ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                    </div>
                                </div>
                                {expandedCallId === call.id && (
                                    <div className="p-6 bg-secondary/5 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-primary/10 animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-primary font-bold text-sm">
                                                <FileText className="w-4 h-4" />
                                                Call Summary
                                            </div>
                                            <p className="text-sm leading-relaxed p-4 bg-white rounded-lg border shadow-sm italic">
                                                "{call.summary}"
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                                                <Activity className="w-4 h-4" />
                                                Transcript
                                            </div>
                                            <div className="h-48 overflow-y-auto bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs leading-relaxed border shadow-inner">
                                                {call.transcript.split('\n').map((line, i) => (
                                                    <div key={i} className="mb-2 last:mb-0">
                                                        <span className={line.startsWith('AI:') ? 'text-primary' : 'text-emerald-400'}>
                                                            {line}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
