
import React from 'react';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui_kit/components/ui/Card';
import { Button } from '../../ui_kit/components/ui/Button';
import { Input } from '../../ui_kit/components/ui/Input';
import { Badge } from '../../ui_kit/components/ui/Badge';
import { Save, AlertOctagon, RefreshCw, GitBranch } from 'lucide-react';

export function ConfigurePage() {
    return (
        <DashboardLayout activeResult="configure">
            <div className="flex flex-col md:flex-row gap-8">

                {/* 1. Left-Side Config Nav */}
                <nav className="w-full md:w-48 flex-shrink-0 space-y-1">
                    <p className="px-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">System</p>
                    <a href="#" className="block px-3 py-2 text-sm font-medium text-primary bg-primary/5 rounded-md border-l-2 border-primary">Core Behavior</a>
                    <a href="#" className="block px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-md">Prompts</a>
                    <a href="#" className="block px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-md">Tools & API</a>
                    <a href="#" className="block px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-md">Escalation</a>

                    <p className="px-2 mt-6 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Danger Zone</p>
                    <a href="#" className="block px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md">Reset Agent</a>
                </nav>

                {/* 2. Main Config Panel */}
                <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">Core Behavior</h1>
                            <Badge variant="secondary" className="font-mono text-xs">v3.4.1-stable</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Last edited by Kai 2h ago</span>
                            <Button size="sm" className="gap-2">
                                <Save className="w-4 h-4" /> Save Changes
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <CardTitle className="text-base">Global Objectives</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-2">Primary Directive</label>
                                <textarea
                                    className="w-full h-32 p-3 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    defaultValue="You are a helpful receptionist for SpotFunnel. Your goal is to qualify leads and book appointments. You must be polite, concise, and professional."
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    ⚠️ Changes here affect all active calls immediately.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-2">Tone Temperature (0.0 - 1.0)</label>
                                    <Input defaultValue="0.7" className="font-mono" />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-2">Max Turn Count</label>
                                    <Input defaultValue="20" className="font-mono" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <CardTitle className="text-base">Integrations & Webhooks</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded text-emerald-700">
                                        <RefreshCw className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">CRM Sync</p>
                                        <p className="text-xs text-slate-500">Active • Syncing every 5m</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">Configure</Button>
                            </div>

                            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg opacity-60">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded text-slate-500">
                                        <GitBranch className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Zapier Webhook</p>
                                        <p className="text-xs text-slate-500">Not configured</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">Enable</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg flex items-start gap-4">
                        <AlertOctagon className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-sm text-amber-900">Experimental Model Active</h4>
                            <p className="text-sm text-amber-800">
                                You are currently using 'GPT-5-preview'. This may result in higher latency.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}
