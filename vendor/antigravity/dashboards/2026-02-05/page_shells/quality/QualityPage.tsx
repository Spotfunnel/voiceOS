
import React from 'react';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui_kit/components/ui/Card';
import { Badge } from '../../ui_kit/components/ui/Badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../ui_kit/components/ui/Table';
import { Filter, Calendar, Zap, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '../../ui_kit/components/ui/Button';

const ERRORS = [
    { type: "Capture Failure", count: 12, impact: "High", lastSeen: "10m ago", category: "Voice" },
    { type: "API Timeout", count: 4, impact: "Med", lastSeen: "2h ago", category: "System" },
    { type: "Intent Mismatch", count: 34, impact: "Low", lastSeen: "5m ago", category: "Model" },
    { type: "Silence Detection", count: 8, impact: "Med", lastSeen: "1d ago", category: "Voice" },
];

export function QualityPage() {
    return (
        <DashboardLayout activeResult="quality">
            <div className="space-y-6">

                {/* 1. Top Filters */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Filter className="w-4 h-4" /> Filter
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2 text-slate-500">
                            All Agents
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2 text-slate-500">
                            Last 7 Days
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" /> Jan 28 - Feb 4
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* 2. Improvement Opportunity (Hero Card) */}
                    <Card className="lg:col-span-3 bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex gap-4">
                                <div className="p-3 bg-indigo-100 rounded-lg h-fit">
                                    <Zap className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Top Improvement Opportunity</h3>
                                    <p className="text-slate-600 max-w-xl mt-1">
                                        We detected 34 "Intent Mismatch" errors primarily in the <strong>Booking Concierge</strong> agent.
                                        Adding 5 more examples to the "Reschedule" intent could reduce this by ~40%.
                                    </p>
                                </div>
                            </div>
                            <Button className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md border-indigo-700">
                                Review & Fix <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* 3. Error Categories Table */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Error Frequency</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Error Type</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Count (7d)</TableHead>
                                        <TableHead>Impact</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ERRORS.map((err) => (
                                        <TableRow key={err.type}>
                                            <TableCell className="font-medium text-slate-900">{err.type}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600">{err.category}</Badge>
                                            </TableCell>
                                            <TableCell>{err.count}</TableCell>
                                            <TableCell>
                                                <Badge variant={err.impact === 'High' ? 'destructive' : 'warning'}>
                                                    {err.impact}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* 4. Detail Panel (Placeholder) */}
                    <Card className="bg-slate-50 border-dashed border-slate-300">
                        <CardHeader>
                            <CardTitle className="text-slate-500 text-sm">Error Detail</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center text-center py-12 text-slate-400">
                            <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
                            <p>Select an error from the list to analyze specific call traces and replay voice segments.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
