
import React, { useState } from 'react';
import { DashboardLayout } from '@/shared_ui/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared_ui/components/ui/Card';
import { Input } from '@/shared_ui/components/ui/Input';
import { Button } from '@/shared_ui/components/ui/Button';
import { Badge } from '@/shared_ui/components/ui/Badge';
import { Check, ChevronRight, PlayCircle, Smartphone } from 'lucide-react';
import { cn } from '@/shared_ui/lib/utils';

const STEPS = [
    { id: 1, title: "Basics", status: "complete" },
    { id: 2, title: "Phone Config", status: "active" },
    { id: 3, title: "Behavior", status: "pending" },
    { id: 4, title: "Knowledge", status: "pending" },
    { id: 5, title: "Review", status: "pending" },
];

export function NewAgentPage() {
    return (
        <DashboardLayout activeResult="new_agent">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* 1. Progress Indicator */}
                <div className="flex items-center justify-between px-4">
                    {STEPS.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-3">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white",
                                step.status === 'complete' ? "bg-emerald-600 text-white" :
                                    step.status === 'active' ? "bg-primary text-white" :
                                        "bg-slate-100 text-slate-400"
                            )}>
                                {step.status === 'complete' ? <Check className="w-4 h-4" /> : step.id}
                            </div>
                            <span className={cn(
                                "text-sm font-medium hidden sm:block",
                                step.status === 'active' ? "text-slate-900" : "text-slate-500"
                            )}>{step.title}</span>
                            {index < STEPS.length - 1 && (
                                <div className="w-12 h-px bg-slate-200 hidden sm:block mx-2" />
                            )}
                        </div>
                    ))}
                </div>

                {/* 2. Main Config Card */}
                <Card className="border-t-4 border-t-primary shadow-lg">
                    <CardHeader>
                        <CardTitle>Phone Configuration</CardTitle>
                        <CardDescription>Provision a number and set hours of operation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Section: Number Provisioning */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Inbound Number</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-white hover:border-primary/50 cursor-pointer transition-all">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white rounded-md border border-slate-100"><Smartphone className="w-4 h-4 text-slate-600" /></div>
                                        <span className="font-medium text-slate-900">Get New Number</span>
                                    </div>
                                    <p className="text-xs text-slate-500">Provision a fresh Twilio +61 number.</p>
                                </div>
                                <div className="border border-primary bg-primary/5 rounded-lg p-4 cursor-pointer relative">
                                    <div className="absolute top-3 right-3"><CheckCircle2 className="w-4 h-4 text-primary" /></div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white rounded-md border border-slate-100"><Smartphone className="w-4 h-4 text-primary" /></div>
                                        <span className="font-bold text-primary">Use Existing</span>
                                    </div>
                                    <p className="text-xs text-primary/80">Port or verify an existing line.</p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone Number to Verify</label>
                                <div className="flex gap-2">
                                    <Input placeholder="+61 4..." className="font-mono" defaultValue="+61 412 345 678" />
                                    <Button variant="secondary">Verify</Button>
                                </div>
                                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Number ownership verified.
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 my-6" />

                        {/* Section: Validation Summary */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3">Pre-Flight Check</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    <span>Business Profile Complete</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    <span>Voice Model Generated</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-900 font-medium">
                                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
                                    <span>Waiting for knowledge base indexing...</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex justify-between bg-slate-50/50 border-t border-slate-100 p-6">
                        <Button variant="ghost">Back</Button>
                        <Button className="pl-6 pr-4">
                            Continue <ChevronRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* 3. Test Call Section - "Is it working?" */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                            <PlayCircle className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-900">Test Simulation</p>
                            <p className="text-xs text-slate-500">Preview how the agent sounds with current settings.</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm">Run Test Call</Button>
                </div>
            </div>
        </DashboardLayout>
    );
}

// Icon helper
function CheckCircle2(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}
