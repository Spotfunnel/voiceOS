
import React from 'react';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';
import { StatsCard } from '../../ui_kit/components/ui/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui_kit/components/ui/Card';
import { TrendingUp, RefreshCcw, DollarSign } from 'lucide-react';

export function IntelligencePage() {
    return (
        <DashboardLayout activeResult="intelligence">
            <div className="space-y-8">

                {/* 1. ROI / High Level Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatsCard
                        title="Estimated Savings"
                        value="$4,250"
                        trend="up"
                        trendValue="Last 30 Days"
                        icon={DollarSign}
                        className="bg-emerald-50/50 border-emerald-100"
                    />
                    <StatsCard
                        title="Success Rate"
                        value="84.2%"
                        trend="up"
                        trendValue="+2.1%"
                        icon={TrendingUp}
                    />
                    <StatsCard
                        title="Calls Handled"
                        value="3,402"
                        trend="neutral"
                        trendValue="Stable"
                        icon={RefreshCcw}
                    />
                </div>

                {/* 2. Visual Charts (CSS-only for static export) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Reason for Calling Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Intent Distribution</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700">Appointments</span>
                                    <span className="text-slate-500">45%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-[45%]" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700">Service Inquiry</span>
                                    <span className="text-slate-500">30%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 w-[30%]" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700">Support / Issues</span>
                                    <span className="text-slate-500">15%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 w-[15%]" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700">Spam / Other</span>
                                    <span className="text-slate-500">10%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-300 w-[10%]" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Cost Analysis (Simple Bar Chart) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Cost vs. Minutes (Last 6 Months)</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[240px] flex items-end justify-between gap-2 pt-4 px-8">
                            {[30, 45, 55, 40, 65, 80].map((h, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 w-1/6">
                                    <div
                                        className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-colors"
                                        style={{ height: `${h}%` }}
                                    />
                                    <span className="text-xs text-slate-400 uppercase">
                                        {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'][i]}
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
