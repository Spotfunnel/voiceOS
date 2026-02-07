
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, Phone, Zap, Clock, TrendingUp, ChevronDown, Search, Mic, Volume2, Plus, Edit2, Trash2, Copy } from "lucide-react";
import { DashboardLayout } from "@/shared_ui/components/DashboardLayout";
import { StatsCard } from "@/shared_ui/components/ui/StatsCard";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/shared_ui/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared_ui/components/ui/Table";
import { Badge } from "@/shared_ui/components/ui/Badge";
import { Button } from "@/shared_ui/components/ui/Button";
import { Input } from "@/shared_ui/components/ui/Input";
import { Textarea } from "@/shared_ui/components/ui/Textarea";

// Generate 128 unique company agents
const COMPANY_NAMES = [
    "HomeStream Real Estate", "CloudScale SaaS", "ShopWave E-commerce", "MediLink Healthcare",
    "TechFlow Solutions", "BuildRight Construction", "FitLife Wellness", "AutoPro Services",
    "EduSmart Learning", "FoodHub Delivery", "TravelEase Booking", "FinanceFirst Advisory",
    "GreenLeaf Landscaping", "StyleCo Fashion", "PetCare Plus", "LegalEase Law Firm",
    // ... continuing to 128 unique companies
];

const INDUSTRIES = ["Real Estate", "SaaS", "E-commerce", "Healthcare", "Construction", "Wellness", "Automotive", "Education", "Food & Beverage", "Travel", "Finance", "Landscaping", "Fashion", "Pet Services", "Legal"];
const STATUSES = ["active", "standby"];
const OUTCOMES = ["Booked", "Follow-up", "Resolved", "Escalated", "Order Placed", "Info Provided", "Scheduled"];

// Deterministic pseudo-random generator (stable across renders)
const mulberry32 = (seed: number) => {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Generate 128 unique agents (one per company)
const generateAgents = () => {
    const agents = [];
    for (let i = 1; i <= 128; i++) {
        const rand = mulberry32(i);
        const industry = INDUSTRIES[i % INDUSTRIES.length];
        const companyName = i <= COMPANY_NAMES.length ? COMPANY_NAMES[i - 1] : `Company ${i}`;
        const status = i % 10 === 0 ? "standby" : "active"; // 10% standby
        const callsHandled = Math.floor(rand() * 500) + 50;
        const successRate = Math.floor(rand() * 20) + 75; // 75-95%
        const avgMinutes = Math.floor(rand() * 4) + 1;
        const avgSeconds = Math.floor(rand() * 60);
        const minutesFactor = rand() * 3 + 1.5;

        agents.push({
            id: i.toString(),
            name: `${companyName} AI`,
            company: companyName,
            industry: industry,
            status: status,
            callsHandled: callsHandled,
            successRate: `${successRate}%`,
            avgDuration: `${avgMinutes}m ${avgSeconds}s`,
            totalMinutes: Math.floor(callsHandled * minutesFactor), // Avg 1.5-4.5 min per call
            recentCalls: Array.from({ length: 3 }, (_, idx) => ({
                caller: `Caller ${Math.floor(rand() * 1000)}`,
                time: `${Math.floor(rand() * 60) + 1} min ago`,
                outcome: OUTCOMES[Math.floor(rand() * OUTCOMES.length)],
                duration: `${Math.floor(rand() * 5) + 1}m ${Math.floor(rand() * 60)}s`
            }))
        });
    }
    return agents;
};

const COMPANY_AGENTS = generateAgents();

export function OperationsPage() {
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [showConfigure, setShowConfigure] = useState(false);
    const [mockStatus, setMockStatus] = useState<string | null>(null);
    const [configState, setConfigState] = useState<any>({
        system_prompt: '',
        knowledge_base: '',
        n8n_workflows: [],
        dashboard_reasons: [],
        dashboard_outcomes: [],
        pipeline_values: [],
        dashboard_report_fields: [],
        telephony: {},
    });
    const [configLoading, setConfigLoading] = useState(false);
    const [configMessage, setConfigMessage] = useState<string | null>(null);
    const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
    const [knowledgeBasesDeleted, setKnowledgeBasesDeleted] = useState<string[]>([]);
    const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<any | null>(null);
    const [activeConfigTab, setActiveConfigTab] = useState<"persona" | "tools" | "telephony" | "dashboard">("persona");
    const [stressScenario, setStressScenario] = useState("peak-hour");
    const [stressDuration, setStressDuration] = useState("5");

    const externalAgent = useMemo(() => {
        const agentId = searchParams.get("agentId");
        if (!agentId) return null;

        const name = searchParams.get("name") || "Selected Agent";
        const company = searchParams.get("company") || "Unknown Company";
        const industry = searchParams.get("industry") || "General";
        const status = (searchParams.get("status") as "active" | "standby") || "active";

        return {
            id: agentId,
            name,
            company,
            industry,
            status,
            callsHandled: 0,
            successRate: "0%",
            avgDuration: "0m 0s",
            totalMinutes: 0,
            recentCalls: [],
        };
    }, [searchParams]);

    const agentsList = useMemo(() => {
        if (!externalAgent) {
            return COMPANY_AGENTS;
        }
        const exists = COMPANY_AGENTS.some((agent) => agent.id === externalAgent.id);
        return exists ? COMPANY_AGENTS : [externalAgent, ...COMPANY_AGENTS];
    }, [externalAgent]);

    const [selectedAgent, setSelectedAgent] = useState(agentsList[0]);

    useEffect(() => {
        if (externalAgent) {
            setSelectedAgent(externalAgent);
            setSearchTerm(externalAgent.name);
        }
    }, [externalAgent]);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!selectedAgent?.id) return;
            setConfigLoading(true);
            setConfigMessage(null);
            try {
                const [configRes, kbRes] = await Promise.all([
                    fetch(`/api/admin/agent-config/${selectedAgent.id}`),
                    fetch(`/api/knowledge-bases/${selectedAgent.id}`),
                ]);

                if (configRes.ok) {
                    const data = await configRes.json();
                    setConfigState({
                        system_prompt: data.system_prompt || '',
                        knowledge_base: data.knowledge_base || '',
                        n8n_workflows: data.n8n_workflows || [],
                        dashboard_reasons: data.dashboard_reasons || [],
                        dashboard_outcomes: data.dashboard_outcomes || [],
                        pipeline_values: data.pipeline_values || [],
                        dashboard_report_fields: data.dashboard_report_fields || [],
                        telephony: data.telephony || {},
                    });
                }

                if (kbRes.ok) {
                    const kbData = await kbRes.json();
                    setKnowledgeBases(kbData || []);
                    setKnowledgeBasesDeleted([]);
                }
            } catch (error) {
                console.error('Failed to load config', error);
            } finally {
                setConfigLoading(false);
            }
        };
        if (showConfigure) {
            fetchConfig();
        }
    }, [selectedAgent?.id, showConfigure]);

    const filteredAgents = agentsList.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout activeResult="operations">
            <div className="space-y-8">
                {/* Agent Selection Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Operations Monitor</h2>
                        <p className="text-muted-foreground">Real-time performance tracking for individual agents. {COMPANY_AGENTS.length} unique agents deployed.</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search agents..."
                                className="bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-[200px]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="relative">
                            <select
                                className="appearance-none bg-card border border-border rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none min-w-[280px]"
                                value={selectedAgent.id}
                                onChange={(e) => {
                                    const agent = COMPANY_AGENTS.find(a => a.id === e.target.value);
                                    if (agent) setSelectedAgent(agent);
                                }}
                            >
                                {filteredAgents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name} - {agent.company}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Agent Status Banner */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">{selectedAgent.name}</p>
                            <p className="text-sm text-muted-foreground">{selectedAgent.company} • {selectedAgent.industry}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant={selectedAgent.status === 'active' ? 'success' : 'secondary'} className="px-4 py-1.5 text-sm">
                            {selectedAgent.status === 'active' ? '🟢 Active' : '⏸️ Standby'}
                        </Badge>
                        <Button
                            variant="outline"
                            className="h-9"
                            onClick={() => setShowConfigure((prev) => !prev)}
                        >
                            Configure
                        </Button>
                    </div>
                </div>

                {showConfigure && (
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle>Agent Configuration</CardTitle>
                            <CardDescription>Configure this agent without leaving Operations.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    {[
                                        { key: "persona" as const, label: "Persona & Purpose" },
                                        { key: "tools" as const, label: "Tools" },
                                        { key: "telephony" as const, label: "Telephony Setup" },
                                        { key: "dashboard" as const, label: "Dashboard" },
                                    ].map((item) => (
                                        <button
                                            key={item.key}
                                            onClick={() => setActiveConfigTab(item.key)}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                                activeConfigTab === item.key
                                                    ? "bg-secondary text-foreground"
                                                    : "text-muted-foreground hover:bg-secondary/50"
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="lg:col-span-3 space-y-6">
                                    {activeConfigTab === "telephony" && (
                                        <>
                                            <Card className="border-slate-200 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle>Phone Number Setup</CardTitle>
                                                    <CardDescription>Primary line used for inbound calls.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-600">Assigned Phone Number</label>
                                                        <Input
                                                            value={configState.telephony?.phone_number || "+1 (555) 010-2233"}
                                                            onChange={(e) => setConfigState(prev => ({
                                                                ...prev,
                                                                telephony: { ...prev.telephony, phone_number: e.target.value }
                                                            }))}
                                                            className="bg-slate-50"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-600">Forwarding / Routing</label>
                                                        <Input
                                                            value="Forward to primary on-call queue"
                                                            readOnly
                                                            className="bg-slate-50"
                                                        />
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-slate-200 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle>Transfer Contact</CardTitle>
                                                    <CardDescription>Human contact for escalations when AI can't resolve the issue.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="grid gap-4 md:grid-cols-3">
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-slate-600">Contact Name</label>
                                                            <Input
                                                                value={configState.telephony?.transfer_contact_name || ''}
                                                                onChange={(e) => setConfigState(prev => ({
                                                                    ...prev,
                                                                    telephony: { ...prev.telephony, transfer_contact_name: e.target.value }
                                                                }))}
                                                                placeholder="John Smith"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-slate-600">Title / Role</label>
                                                            <Input
                                                                value={configState.telephony?.transfer_contact_title || ''}
                                                                onChange={(e) => setConfigState(prev => ({
                                                                    ...prev,
                                                                    telephony: { ...prev.telephony, transfer_contact_title: e.target.value }
                                                                }))}
                                                                placeholder="Service Manager"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-slate-600">Phone Number</label>
                                                            <Input
                                                                value={configState.telephony?.transfer_contact_phone || ''}
                                                                onChange={(e) => setConfigState(prev => ({
                                                                    ...prev,
                                                                    telephony: { ...prev.telephony, transfer_contact_phone: e.target.value }
                                                                }))}
                                                                placeholder="+1 555 010 4444"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                        <p className="text-xs text-amber-800">
                                                            <strong>Transfer behavior:</strong> AI reassures caller upfront: "Let me connect you to {configState.telephony?.transfer_contact_name || 'our team'}. If the line is busy, you can leave a voicemail and they'll get your message."
                                                            Call stays with the transfer target (or their voicemail) - never routes back to AI.
                                                        </p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </>
                                    )}

                                    {activeConfigTab === "persona" && (
                                        <>
                                            <Card className="border-slate-200 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle>Persona & Purpose</CardTitle>
                                                    <CardDescription>System prompt and knowledge bases that shape the agent.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-6">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-600">System Prompt (Layer 2)</label>
                                                        <p className="text-xs text-muted-foreground">
                                                            Reference knowledge base titles inside this prompt so the agent knows when to query them.
                                                        </p>
                                                        <Textarea
                                                            className="min-h-[160px] bg-slate-50"
                                                            value={configState.system_prompt}
                                                            onChange={(e) =>
                                                                setConfigState((prev: any) => ({
                                                                    ...prev,
                                                                    system_prompt: e.target.value,
                                                                }))
                                                            }
                                                        />
                                                    </div>

                                                    {knowledgeBases.length > 0 && (
                                                        <div className="rounded-lg border border-border bg-muted/40 p-3">
                                                            <p className="text-xs font-semibold text-slate-700">Available Knowledge Base Titles</p>
                                                            <p className="text-xs text-muted-foreground mb-2">
                                                                Use these exact titles in your system prompt (Layer 2) when you want the agent to query them.
                                                            </p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {knowledgeBases.map((kb) => (
                                                                    <div key={kb.id} className="flex items-center gap-1 rounded-full bg-card border border-border px-2 py-1">
                                                                        <span className="text-xs font-medium">{kb.name}</span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5"
                                                                            onClick={() => {
                                                                                const next = `${configState.system_prompt || ''}\nUse knowledge base: "${kb.name}" when ${kb.description || 'needed'}.`;
                                                                                setConfigState((prev: any) => ({
                                                                                    ...prev,
                                                                                    system_prompt: next.trim(),
                                                                                }));
                                                                            }}
                                                                            title="Insert into prompt"
                                                                        >
                                                                            <Plus className="h-3 w-3" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5"
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await navigator.clipboard.writeText(kb.name);
                                                                                } catch (err) {
                                                                                    console.error('Failed to copy KB title', err);
                                                                                }
                                                                            }}
                                                                            title="Copy title"
                                                                        >
                                                                            <Copy className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <label className="text-sm font-semibold text-slate-600">Knowledge Bases</label>
                                                                <p className="text-xs text-muted-foreground">
                                                                    The agent only queries these when needed (keeps prompts fast and efficient).
                                                                </p>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-2"
                                                                onClick={() =>
                                                                    setEditingKnowledgeBase({
                                                                        name: '',
                                                                        description: '',
                                                                        content: '',
                                                                        filler_text: 'Let me look that up for you.',
                                                                    })
                                                                }
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                                Add Knowledge Base
                                                            </Button>
                                                        </div>

                                                        <div className="space-y-2">
                                                            {knowledgeBases.length === 0 && (
                                                                <p className="text-xs text-muted-foreground">No knowledge bases yet.</p>
                                                            )}
                                                            {knowledgeBases.map((kb, idx) => (
                                                                <div key={kb.id || `${kb.name}-${idx}`} className="rounded-lg border border-border bg-card p-3">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                            <div className="font-medium text-sm">{kb.name}</div>
                                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                                {kb.description || 'No description'}
                                                                            </div>
                                                                    {kb.filler_text && (
                                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                                            Filler: “{kb.filler_text}”
                                                                        </div>
                                                                    )}
                                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                                {kb.content?.length || 0} characters
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => setEditingKnowledgeBase(kb)}
                                                                            >
                                                                                <Edit2 className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setKnowledgeBases((prev) => prev.filter((item) => item.id !== kb.id));
                                                                                    if (kb.id) {
                                                                                        setKnowledgeBasesDeleted((prev) => [...prev, kb.id]);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-slate-200 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle>Speak to Agent</CardTitle>
                                                    <CardDescription>Test the prompt and hear how the agent responds.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <Button variant="outline" className="gap-2">
                                                            <Mic className="w-4 h-4" />
                                                            Start Test Call
                                                        </Button>
                                                        <Button variant="ghost" className="gap-2">
                                                            <Volume2 className="w-4 h-4" />
                                                            Play Last Response
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-slate-200 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle>Stress Test</CardTitle>
                                                    <CardDescription>Simulate high-volume calling to validate performance.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="grid gap-4 lg:grid-cols-3">
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-slate-600">Scenario</label>
                                                            <select
                                                                className="w-full appearance-none bg-card border border-border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                                                value={stressScenario}
                                                                onChange={(e) => setStressScenario(e.target.value)}
                                                            >
                                                                <option value="peak-hour">Peak hour rush</option>
                                                                <option value="after-hours">After-hours overflow</option>
                                                                <option value="promo-blast">Promo blast</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-slate-600">Concurrent Calls</label>
                                                            <Input value="25" readOnly className="bg-slate-50" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-slate-600">Duration (min)</label>
                                                            <Input
                                                                value={stressDuration}
                                                                onChange={(e) => setStressDuration(e.target.value)}
                                                                className="bg-slate-50"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Button className="gap-2">
                                                            Start Stress Test
                                                        </Button>
                                                        <Button variant="outline">
                                                            View Last Report
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {editingKnowledgeBase && (
                                                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                                                    <div className="bg-card rounded-lg border border-border p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                                                        <h3 className="text-lg font-semibold mb-4">
                                                            {editingKnowledgeBase.id ? 'Edit' : 'Add'} Knowledge Base
                                                        </h3>

                                                        <div className="space-y-4">
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">Title</label>
                                                                <Input
                                                                    value={editingKnowledgeBase.name}
                                                                    onChange={(e) =>
                                                                        setEditingKnowledgeBase((prev: any) => ({
                                                                            ...prev,
                                                                            name: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder='e.g., "FAQs", "Product A Troubleshooting"'
                                                                />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">Description (When to use)</label>
                                                                <Input
                                                                    value={editingKnowledgeBase.description}
                                                                    onChange={(e) =>
                                                                        setEditingKnowledgeBase((prev: any) => ({
                                                                            ...prev,
                                                                            description: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="Common questions about hours, pricing, policies"
                                                                />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">Content</label>
                                                                <Textarea
                                                                    rows={12}
                                                                    value={editingKnowledgeBase.content}
                                                                    onChange={(e) =>
                                                                        setEditingKnowledgeBase((prev: any) => ({
                                                                            ...prev,
                                                                            content: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="Paste knowledge base content..."
                                                                />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">Filler Line (spoken while searching)</label>
                                                                <Input
                                                                    value={editingKnowledgeBase.filler_text || ''}
                                                                    onChange={(e) =>
                                                                        setEditingKnowledgeBase((prev: any) => ({
                                                                            ...prev,
                                                                            filler_text: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="Let me look that up for you."
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                    This line is spoken when this knowledge base is queried.
                                                                </p>
                                                            </div>

                                                            <div className="rounded-lg border border-border bg-muted/40 p-3">
                                                                <p className="text-xs text-muted-foreground">
                                                                    <strong>Title usage:</strong> Use the exact title above inside your system prompt when you want the agent to query this KB.
                                                                    Example: Use knowledge base: "{editingKnowledgeBase.name || 'FAQs'}" for common questions.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-end gap-2 mt-6">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                onClick={() => setEditingKnowledgeBase(null)}
                                                            >
                                                                Cancel
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!editingKnowledgeBase.name || !editingKnowledgeBase.content) return;
                                                                    if (editingKnowledgeBase.id) {
                                                                        setKnowledgeBases((prev) =>
                                                                            prev.map((item) =>
                                                                                item.id === editingKnowledgeBase.id ? editingKnowledgeBase : item
                                                                            )
                                                                        );
                                                                    } else {
                                                                        setKnowledgeBases((prev) => [...prev, editingKnowledgeBase]);
                                                                    }
                                                                    setEditingKnowledgeBase(null);
                                                                }}
                                                                disabled={!editingKnowledgeBase.name || !editingKnowledgeBase.content}
                                                            >
                                                                {editingKnowledgeBase.id ? 'Update' : 'Add'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {activeConfigTab === "tools" && (
                                        <>
                                            <div className="grid gap-6 lg:grid-cols-2">
                                                <Card className="border-slate-200 shadow-sm">
                                                    <CardHeader>
                                                        <CardTitle>n8n Workflows</CardTitle>
                                                        <CardDescription>Automation tied to this agent.</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {configState.n8n_workflows.length === 0 && (
                                                            <p className="text-xs text-muted-foreground">No workflows configured.</p>
                                                        )}
                                                        <div className="space-y-4">
                                                            {configState.n8n_workflows.map((wf: any, idx: number) => (
                                                                <div key={idx} className="space-y-2">
                                                                    <Input
                                                                        value={wf.name || ''}
                                                                        onChange={(e) => {
                                                                            const next = [...configState.n8n_workflows];
                                                                            next[idx] = { ...next[idx], name: e.target.value };
                                                                            setConfigState((prev: any) => ({
                                                                                ...prev,
                                                                                n8n_workflows: next,
                                                                            }));
                                                                        }}
                                                                        placeholder="Workflow name"
                                                                    />
                                                                    <Input
                                                                        value={wf.webhook_url || ''}
                                                                        onChange={(e) => {
                                                                            const next = [...configState.n8n_workflows];
                                                                            next[idx] = { ...next[idx], webhook_url: e.target.value };
                                                                            setConfigState((prev: any) => ({
                                                                                ...prev,
                                                                                n8n_workflows: next,
                                                                            }));
                                                                        }}
                                                                        placeholder="Webhook URL"
                                                                    />
                                                                    <Input
                                                                        value={wf.workflow_url || ''}
                                                                        onChange={(e) => {
                                                                            const next = [...configState.n8n_workflows];
                                                                            next[idx] = { ...next[idx], workflow_url: e.target.value };
                                                                            setConfigState((prev: any) => ({
                                                                                ...prev,
                                                                                n8n_workflows: next,
                                                                            }));
                                                                        }}
                                                                        placeholder="Workflow link"
                                                                    />
                                                                </div>
                                                            ))}
                                                            <Button
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setConfigState((prev: any) => ({
                                                                        ...prev,
                                                                        n8n_workflows: [
                                                                            ...prev.n8n_workflows,
                                                                            { name: '', webhook_url: '', workflow_url: '' },
                                                                        ],
                                                                    }))
                                                                }
                                                            >
                                                                Add workflow
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                <Card className="border-slate-200 shadow-sm">
                                                    <CardHeader>
                                                        <CardTitle>Email Template</CardTitle>
                                                        <CardDescription>Used for automated follow-ups.</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <Textarea
                                                            className="min-h-[140px] bg-slate-50"
                                                            value="Subject: Your SpotFunnel booking confirmation\n\nHi {{first_name}},\nYour appointment is confirmed for {{date_time}}. Reply to this email if you need changes."
                                                            readOnly
                                                        />
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            <Card className="border-slate-200 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle>Dashboard Signals</CardTitle>
                                                    <CardDescription>What the agent sends to the dashboard.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="grid gap-4 lg:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-600">Reasons</label>
                                                        <Textarea
                                                            className="min-h-[100px] bg-slate-50"
                                                            value={(configState.dashboard_reasons || []).join('\n')}
                                                            onChange={(e) =>
                                                                setConfigState((prev: any) => ({
                                                                    ...prev,
                                                                    dashboard_reasons: e.target.value
                                                                        .split('\n')
                                                                        .filter(Boolean),
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-slate-600">Outcomes</label>
                                                        <Textarea
                                                            className="min-h-[100px] bg-slate-50"
                                                            value={(configState.dashboard_outcomes || [])
                                                                .map((o: any) => o.label || '')
                                                                .join('\n')}
                                                            onChange={(e) =>
                                                                setConfigState((prev: any) => ({
                                                                    ...prev,
                                                                    dashboard_outcomes: e.target.value
                                                                        .split('\n')
                                                                        .filter(Boolean)
                                                                        .map((label) => ({
                                                                            label,
                                                                            action_required: false,
                                                                            pipeline_values: [],
                                                                        })),
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-slate-200 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle>Admin Utilities</CardTitle>
                                                    <CardDescription>Mock data + customer dashboard access.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <Button
                                                            variant="outline"
                                                            onClick={async () => {
                                                                const res = await fetch('/api/admin/mock-data', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ enabled: true }),
                                                                });
                                                                setMockStatus(res.ok ? 'Mock data enabled.' : 'Failed to enable mock data.');
                                                            }}
                                                        >
                                                            Send mock data
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            onClick={async () => {
                                                                const res = await fetch('/api/admin/mock-data', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ enabled: false }),
                                                                });
                                                                setMockStatus(res.ok ? 'Mock data cleared.' : 'Failed to clear mock data.');
                                                            }}
                                                        >
                                                            Clear mock data
                                                        </Button>
                                                        <Button
                                                            onClick={async () => {
                                                                const res = await fetch('/api/admin/universal-login', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        tenantId: selectedAgent.id,
                                                                        tenantName: selectedAgent.company,
                                                                    }),
                                                                });
                                                                if (res.ok) {
                                                                    window.location.href = '/dashboard';
                                                                } else {
                                                                    setMockStatus('Unable to open customer dashboard.');
                                                                }
                                                            }}
                                                        >
                                                            Open customer dashboard
                                                        </Button>
                                                    </div>
                                                    {mockStatus && (
                                                        <p className="text-xs text-muted-foreground">{mockStatus}</p>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </>
                                    )}
                                    {showConfigure && (
                                        <div className="flex items-center gap-3">
                                            <Button
                                                onClick={async () => {
                                                    setConfigMessage(null);
                                                    const res = await fetch(`/api/admin/agent-config/${selectedAgent.id}`, {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            tenant_id: selectedAgent.id,
                                                            ...configState,
                                                        }),
                                                    });

                                                    // Sync knowledge bases
                                                    let kbOk = true;
                                                    try {
                                                        // Delete removed KBs
                                                        for (const id of knowledgeBasesDeleted) {
                                                            const delRes = await fetch(
                                                                `/api/knowledge-bases/${selectedAgent.id}/${id}`,
                                                                { method: 'DELETE' }
                                                            );
                                                            if (!delRes.ok) kbOk = false;
                                                        }

                                                        // Upsert current KBs
                                                        for (const kb of knowledgeBases) {
                                                            const payload = {
                                                                name: kb.name,
                                                                description: kb.description || '',
                                                                content: kb.content,
                                                                filler_text: kb.filler_text || 'Let me look that up for you.',
                                                            };
                                                            if (kb.id) {
                                                                const putRes = await fetch(
                                                                    `/api/knowledge-bases/${selectedAgent.id}/${kb.id}`,
                                                                    {
                                                                        method: 'PUT',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify(payload),
                                                                    }
                                                                );
                                                                if (!putRes.ok) kbOk = false;
                                                            } else {
                                                                const postRes = await fetch(
                                                                    `/api/knowledge-bases/${selectedAgent.id}`,
                                                                    {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify(payload),
                                                                    }
                                                                );
                                                                if (!postRes.ok) kbOk = false;
                                                            }
                                                        }

                                                        // Refresh list to get IDs
                                                        const refreshed = await fetch(`/api/knowledge-bases/${selectedAgent.id}`);
                                                        if (refreshed.ok) {
                                                            const kbData = await refreshed.json();
                                                            setKnowledgeBases(kbData || []);
                                                            setKnowledgeBasesDeleted([]);
                                                        } else {
                                                            kbOk = false;
                                                        }
                                                    } catch (err) {
                                                        console.error('Failed to save knowledge bases', err);
                                                        kbOk = false;
                                                    }

                                                    setConfigMessage(res.ok && kbOk ? 'Configuration saved.' : 'Failed to save configuration.');
                                                }}
                                            >
                                                Save configuration
                                            </Button>
                                            {configLoading && (
                                                <span className="text-xs text-muted-foreground">Loading…</span>
                                            )}
                                            {configMessage && (
                                                <span className="text-xs text-muted-foreground">{configMessage}</span>
                                            )}
                                        </div>
                                    )}

                                    {activeConfigTab === "dashboard" && (
                                        <Card className="border-slate-200 shadow-sm">
                                            <CardHeader>
                                                <CardTitle>Dashboard Signals</CardTitle>
                                                <CardDescription>Select which reasons and outcomes appear in reporting.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="grid gap-6 lg:grid-cols-2">
                                                <div className="space-y-3">
                                                    <p className="text-sm font-semibold text-slate-600">Reasons for Calling</p>
                                                    {[
                                                        "New booking",
                                                        "Reschedule",
                                                        "Pricing inquiry",
                                                        "Service follow-up",
                                                        "Emergency request",
                                                    ].map((reason) => (
                                                        <label key={reason} className="flex items-center gap-2 text-sm text-slate-700">
                                                            <input type="checkbox" defaultChecked className="h-4 w-4" />
                                                            {reason}
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="space-y-3">
                                                    <p className="text-sm font-semibold text-slate-600">Outcomes</p>
                                                    {[
                                                        "Booked",
                                                        "Quote sent",
                                                        "Follow-up required",
                                                        "No answer",
                                                        "Unqualified",
                                                    ].map((outcome) => (
                                                        <label key={outcome} className="flex items-center gap-2 text-sm text-slate-700">
                                                            <input type="checkbox" defaultChecked className="h-4 w-4" />
                                                            {outcome}
                                                        </label>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Agent Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                        title="Calls Handled Today"
                        value={selectedAgent.callsHandled.toString()}
                        trend="up"
                        trendValue="12%"
                        icon={Phone}
                    />
                    <StatsCard
                        title="Success Rate"
                        value={selectedAgent.successRate}
                        trend="up"
                        trendValue="1.4%"
                        icon={Zap}
                    />
                    <StatsCard
                        title="Avg Call Duration"
                        value={selectedAgent.avgDuration}
                        trend="down"
                        trendValue="8%"
                        icon={Clock}
                    />
                    <StatsCard
                        title="Total Minutes (Feb)"
                        value={selectedAgent.totalMinutes.toLocaleString()}
                        trend="up"
                        trendValue="18%"
                        icon={Clock}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Call Activity */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Recent Call Activity</CardTitle>
                            <CardDescription>Latest calls handled by {selectedAgent.name}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Caller</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Outcome</TableHead>
                                        <TableHead className="text-right">Duration</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedAgent.recentCalls.map((call, idx) => (
                                        <TableRow key={idx} className="group cursor-pointer hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium">{call.caller}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{call.time}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal">
                                                    {call.outcome}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">{call.duration}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="mt-4">
                                <Button variant="ghost" className="w-full text-sm">
                                    View All Calls →
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Performance Trends */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Performance Trend</CardTitle>
                            <CardDescription>Success rate over the last 7 days</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px] flex items-end justify-between px-4 py-4">
                            {[85, 88, 87, 90, 92, 91, parseInt(selectedAgent.successRate)].map((value, i) => (
                                <div key={i} className="w-10 group relative flex flex-col items-center gap-4">
                                    <div className="absolute -top-8 bg-primary text-white font-bold px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                        {value}%
                                    </div>
                                    <div
                                        className="w-full bg-primary/20 rounded-t-lg group-hover:bg-primary transition-all duration-300"
                                        style={{ height: `${value}%` }}
                                    />
                                    <span className="text-xs text-muted-foreground uppercase">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
