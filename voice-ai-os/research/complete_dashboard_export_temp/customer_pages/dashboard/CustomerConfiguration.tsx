
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui_kit/components/ui/Card';
import { Button } from '../../ui_kit/components/ui/Button';
import { Textarea } from '../../ui_kit/components/ui/Textarea';
import { Mic, BookOpen, Mail, Check, ChevronRight } from 'lucide-react';
import { cn } from '../../ui_kit/lib/utils';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';

const VOICE_OPTIONS = [
    { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
    { id: 'echo', name: 'Echo', description: 'Warm and friendly' },
    { id: 'fable', name: 'Fable', description: 'Professional and clear' },
    { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
];

const DEFAULT_KNOWLEDGE_BASE = `# Company Information
- Business: SpotFunnel AI Phone Assistant
- Services: Automated call handling, appointment booking, lead qualification
- Hours: 24/7 availability
- Service Area: Australia-wide

# Common Questions
Q: What services do you offer?
A: We provide AI-powered phone answering, appointment scheduling, and lead management.

Q: How much does it cost?
A: Plans start at $99/month. Visit our pricing page for details.
`;

const DEFAULT_EMAIL_TEMPLATES = {
    booking_confirmation: `Subject: Appointment Confirmed - {{date}} at {{time}}

Hi {{customer_name}},

Your appointment has been confirmed for {{date}} at {{time}}.

If you need to reschedule, please call us at {{business_phone}}.

Best regards,
{{business_name}}`,

    follow_up: `Subject: Following Up - {{business_name}}

Hi {{customer_name}},

Thank you for your recent call. We wanted to follow up regarding {{topic}}.

{{custom_message}}

Best regards,
{{business_name}}`
};

type ConfigSection = 'voice' | 'knowledge' | 'emails';

const NAV_ITEMS = [
    { id: 'voice' as ConfigSection, label: 'Voice', icon: Mic, description: 'AI voice settings' },
    { id: 'knowledge' as ConfigSection, label: 'Knowledge Base', icon: BookOpen, description: 'Information & FAQs' },
    { id: 'emails' as ConfigSection, label: 'Email Templates', icon: Mail, description: 'Automated emails' },
];

export function CustomerConfiguration() {
    const [activeSection, setActiveSection] = useState<ConfigSection>('voice');
    const [selectedVoice, setSelectedVoice] = useState('echo');
    const [knowledgeBase, setKnowledgeBase] = useState(DEFAULT_KNOWLEDGE_BASE);
    const [emailTemplates, setEmailTemplates] = useState(DEFAULT_EMAIL_TEMPLATES);

    const handleSave = () => {
        // Mock save
        alert("Settings saved! (This is a mock)");
    };

    return (
        <DashboardLayout activeResult="customer_dashboard">
            <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)] gap-6 pb-24 md:pb-8">
                {/* Left Sidebar Navigation */}
                <div className="w-full md:w-64 shrink-0">
                    <Card className="bg-card border-slate-300 shadow-md h-full">
                        <CardHeader className="p-5 border-b">
                            <CardTitle className="text-lg font-bold">Configuration</CardTitle>
                            <CardDescription className="text-xs">Customize your AI assistant</CardDescription>
                        </CardHeader>
                        <CardContent className="p-3">
                            <nav className="space-y-1 flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-2 md:gap-0">
                                {NAV_ITEMS.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeSection === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveSection(item.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left group whitespace-nowrap md:whitespace-normal",
                                                isActive
                                                    ? "bg-primary text-primary-foreground shadow-md"
                                                    : "hover:bg-muted/50"
                                            )}
                                        >
                                            <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary-foreground" : "text-primary")} />
                                            <div className="hidden md:block flex-1 min-w-0">
                                                <div className={cn("font-semibold text-sm", isActive ? "text-primary-foreground" : "text-foreground")}>
                                                    {item.label}
                                                </div>
                                                <div className={cn("text-xs truncate", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                                    {item.description}
                                                </div>
                                            </div>
                                            <span className="md:hidden font-semibold text-sm">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto w-full">
                    <div className="animate-in fade-in duration-300 space-y-6">
                        {/* Voice Selection Section */}
                        {activeSection === 'voice' && (
                            <Card className="bg-card border-slate-300 shadow-md">
                                <CardHeader className="p-6 border-b">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-primary/10 rounded-xl">
                                            <Mic className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-2xl font-bold">Voice Selection</CardTitle>
                                            <CardDescription className="mt-1">Choose how your AI sounds on calls</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {VOICE_OPTIONS.map((voice) => (
                                            <button
                                                key={voice.id}
                                                onClick={() => setSelectedVoice(voice.id)}
                                                className={cn(
                                                    "p-5 rounded-xl border-2 transition-all text-left relative overflow-hidden group",
                                                    selectedVoice === voice.id
                                                        ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 ring-2 ring-primary/30 shadow-lg"
                                                        : "border-slate-300 hover:border-primary/50 hover:bg-muted/30 hover:shadow-md"
                                                )}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <span className="font-bold text-base">{voice.name}</span>
                                                    {selectedVoice === voice.id && (
                                                        <div className="p-1 bg-primary rounded-full">
                                                            <Check className="w-3.5 h-3.5 text-primary-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{voice.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Knowledge Base Section */}
                        {activeSection === 'knowledge' && (
                            <Card className="bg-card border-slate-300 shadow-md">
                                <CardHeader className="p-6 border-b">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-primary/10 rounded-xl">
                                            <BookOpen className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <CardTitle className="text-2xl font-bold">Knowledge Base</CardTitle>
                                            <CardDescription className="mt-1">Information your AI uses to answer questions</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <Textarea
                                        value={knowledgeBase}
                                        onChange={(e) => setKnowledgeBase(e.target.value)}
                                        className="min-h-[400px] font-mono text-sm resize-none"
                                        placeholder="Enter your knowledge base in markdown format..."
                                    />
                                    <div className="flex gap-3 mt-4">
                                        <Button onClick={handleSave} size="lg" className="px-6">
                                            <Check className="w-4 h-4 mr-2" />
                                            Save Changes
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Email Templates Section */}
                        {activeSection === 'emails' && (
                            <div className="space-y-4">
                                {Object.entries(emailTemplates).map(([key, template]) => (
                                    <Card key={key} className="bg-card border-slate-300 shadow-md">
                                        <CardHeader className="p-5 border-b bg-muted/20">
                                            <CardTitle className="text-lg font-bold capitalize">
                                                {key.replace(/_/g, ' ')}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-5">
                                            <Textarea
                                                value={template}
                                                onChange={(e) => setEmailTemplates({ ...emailTemplates, [key]: e.target.value })}
                                                className="min-h-[150px] font-mono text-sm resize-none"
                                            />
                                            <Button onClick={handleSave} size="sm" className="mt-4">
                                                <Check className="w-3 h-3 mr-2" />
                                                Save
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
