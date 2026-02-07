
import React, { useState } from "react";
import { UserPlus, Phone, Zap, Play, CheckCircle2, ShieldCheck, ArrowRight, BrainCircuit, Globe, MessageSquare, Save } from "lucide-react";
import { DashboardLayout } from "@/shared_ui/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/shared_ui/components/ui/Card";
import { Button } from "@/shared_ui/components/ui/Button";
import { Input } from "@/shared_ui/components/ui/Input";
import { Badge } from "@/shared_ui/components/ui/Badge";

const STEPS = [
    { id: 1, label: "Identity", icon: UserPlus },
    { id: 2, label: "Voice", icon: Phone },
    { id: 3, label: "Logic", icon: BrainCircuit },
    { id: 4, label: "Provision", icon: Globe },
    { id: 5, label: "Test", icon: Zap },
];

export function NewAgentPage() {
    const [step, setStep] = useState(1);

    return (
        <DashboardLayout activeResult="new_agent">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Stepper */}
                <div className="flex items-center justify-between px-4 pb-4">
                    {STEPS.map((s) => (
                        <div key={s.id} className="flex flex-col items-center gap-2 relative">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 z-10 ${step >= s.id ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-secondary text-muted-foreground'
                                }`}>
                                {step > s.id ? <CheckCircle2 className="w-6 h-6" /> : <s.icon className="w-5 h-5" />}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-tighter ${step >= s.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {s.label}
                            </span>
                            {s.id < 5 && (
                                <div className={`absolute left-10 top-5 w-[calc(100%+2rem)] h-0.5 -mx-4 rounded-full -z-0 ${step > s.id ? 'bg-primary' : 'bg-secondary'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <Card className="animate-in slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle>1. Agent Identity</CardTitle>
                            <CardDescription>Define the core persona of your automated operator.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Agent Name</label>
                                    <Input placeholder="e.g. Sarah Support" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Department</label>
                                    <Input placeholder="e.g. Inbound Sales" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Persona Description</label>
                                <textarea
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                                    placeholder="Describe the agent's tone and mannerisms..."
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-3 border-t bg-secondary/30">
                            <Button variant="ghost">Save Draft</Button>
                            <Button onClick={() => setStep(2)} className="gap-2">
                                Next: Voice Selection
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 2 && (
                    <Card className="animate-in slide-in-from-right-4 duration-500">
                        <CardHeader>
                            <CardTitle>2. Voice Synthesis</CardTitle>
                            <CardDescription>Select the neural voice that will represent your agency.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {["Emma (Warm)", "Liam (Professional)", "Sophie (Friendly)", "Noah (Direct)"].map(voice => (
                                <div key={voice} className="p-4 border rounded-xl hover:border-primary hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-between group">
                                    <div className="flex flex-col">
                                        <span className="font-bold">{voice}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">Neural HD</span>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Play className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="flex justify-between border-t bg-secondary/30">
                            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                            <Button onClick={() => setStep(3)}>Next: Conversation Logic</Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 3 && (
                    <Card className="animate-in slide-in-from-right-4 duration-500">
                        <CardHeader>
                            <CardTitle>3. Conversation Logic</CardTitle>
                            <CardDescription>Define how the agent handles complex queries and objections.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Primary Objective Script</label>
                                <textarea
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
                                    placeholder="You are a sales assistant. When the user asks for pricing, offer the Tier 1 package first..."
                                />
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                <div className="text-sm">
                                    <p className="font-bold">Hallucination Guard active</p>
                                    <p className="text-muted-foreground">Agent will default to human transfer if pricing exceeds saved values.</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t bg-secondary/30">
                            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                            <Button onClick={() => setStep(4)}>Next: Number Provision</Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 4 && (
                    <Card className="animate-in slide-in-from-right-4 duration-500">
                        <CardHeader>
                            <CardTitle>4. Number Provisioning</CardTitle>
                            <CardDescription>Assign a dedicated line for your agent to start receiving traffic.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8 py-8">
                            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl group hover:border-primary/50 transition-all cursor-pointer">
                                <Globe className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors mb-4" />
                                <p className="font-bold">Scan for Available Numbers</p>
                                <p className="text-sm text-muted-foreground">Australian or International prefixes available.</p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t bg-secondary/30">
                            <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
                            <Button onClick={() => setStep(5)}>Final Step: System Test</Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 5 && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-500">
                        <Card className="border-success/20 bg-success/5">
                            <CardHeader className="text-center py-8">
                                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                                    <Zap className="w-8 h-8 text-success" />
                                </div>
                                <CardTitle className="text-2xl text-success font-bold">Hardware Initialized</CardTitle>
                                <CardDescription>Run a diagnostic call to verify voice and logic synthesis.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center pb-8">
                                <div className="flex gap-4">
                                    <Button size="lg" className="bg-success hover:bg-success/90 gap-2">
                                        <Phone className="w-4 h-4" />
                                        Launch Test Call
                                    </Button>
                                    <Button size="lg" variant="outline">Skip & Deploy</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-center gap-4">
                            <Button variant="ghost" onClick={() => setStep(4)}>Review Logic</Button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
