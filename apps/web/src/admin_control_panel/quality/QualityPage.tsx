
import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Filter, Search, FileWarning, CheckCircle, ArrowUpRight } from "lucide-react";
import { DashboardLayout } from "@/shared_ui/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared_ui/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared_ui/components/ui/Table";
import { Badge } from "@/shared_ui/components/ui/Badge";
import { Button } from "@/shared_ui/components/ui/Button";
import { Input } from "@/shared_ui/components/ui/Input";

export function QualityPage() {
    const [errors, setErrors] = useState<any[]>([]);

    useEffect(() => {
        const fetchErrors = async () => {
            try {
                const response = await fetch('/api/admin/quality/errors');
                if (response.ok) {
                    const data = await response.json();
                    setErrors(Array.isArray(data) ? data : data.errors || []);
                }
            } catch (error) {
                console.error('Failed to load quality errors:', error);
            }
        };
        fetchErrors();
    }, []);

    const groupedErrors = useMemo(() => {
        const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
        const map = new Map<string, { type: string; frequency: number; impact: string; agent: string }>();
        errors.forEach((err) => {
            const key = err.error_type || 'Unknown';
            const existing = map.get(key);
            const impact = (err.severity || 'low').toLowerCase();
            if (!existing) {
                map.set(key, {
                    type: key,
                    frequency: 1,
                    impact,
                    agent: err.tenant_id || 'Unknown',
                });
            } else {
                existing.frequency += 1;
                if (severityOrder.indexOf(impact) < severityOrder.indexOf(existing.impact)) {
                    existing.impact = impact;
                }
            }
        });
        return Array.from(map.values());
    }, [errors]);

    const topError = groupedErrors[0];

    return (
        <DashboardLayout activeResult="quality">
            <div className="space-y-8">
                {/* Hero Feature */}
                <Card className="bg-primary overflow-hidden border-none text-white shadow-2xl shadow-primary/20">
                    <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative">
                        <div className="space-y-4 z-10">
                            <Badge className="bg-white/20 text-white border-none py-1 px-3">Weekly Quality Insight</Badge>
                            <h2 className="text-3xl font-bold tracking-tight">
                                {topError ? `Top issue: ${topError.type}` : 'No critical quality issues detected.'}
                            </h2>
                            <p className="text-white/80 max-w-lg text-lg">
                                {topError
                                    ? `Detected ${topError.frequency} instances. Severity: ${topError.impact}.`
                                    : 'Quality monitoring is active and tracking system errors.'}
                            </p>
                            <Button variant="secondary" className="text-primary hover:bg-white border-none transition-all scale-110">Apply Training Hotfix</Button>
                        </div>
                        <div className="w-48 h-48 bg-white/10 rounded-full blur-3xl absolute -right-12 -top-12" />
                        <FileWarning className="w-32 h-32 opacity-10 hidden md:block" />
                    </CardContent>
                </Card>

                {/* Filters Strip */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Search logs for keywords..." className="pl-10 h-10" />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none">
                            <Filter className="w-4 h-4" />
                            Filter
                        </Button>
                        <Button size="sm" className="flex-1 sm:flex-none">Export Audit CSV</Button>
                    </div>
                </div>

                {/* Main Issues Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Failure Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Failure Mode</TableHead>
                                    <TableHead>Frequency</TableHead>
                                    <TableHead>Impact</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedErrors.map((err) => (
                                    <TableRow key={err.type}>
                                        <TableCell className="font-semibold text-foreground">{err.type}</TableCell>
                                        <TableCell className="tabular-nums">{err.frequency} instances</TableCell>
                                        <TableCell>
                                            <Badge variant={err.impact === 'critical' || err.impact === 'high' ? 'destructive' : 'warning'}>
                                                {err.impact}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{err.agent}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="gap-1 group">
                                                Analyze
                                                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
