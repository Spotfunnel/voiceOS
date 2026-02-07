
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui_kit/components/ui/Card';
import { Button } from '../../ui_kit/components/ui/Button';
import { Input } from '../../ui_kit/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui_kit/components/ui/Table';
import { Badge } from '../../ui_kit/components/ui/Badge';
import { Phone, Search, Filter, PhoneForwarded, Play, Download } from 'lucide-react';
import { DashboardLayout } from '../../ui_kit/components/DashboardLayout';
import { getIntentColor } from '../../ui_kit/lib/utils';
import { PullToRefresh } from '../../ui_kit/components/PullToRefresh';

const MOCK_CALLS = [
    { id: '1', date: '2024-02-05', called_at: '10:30 AM', caller_name: 'John Doe', customer_phone: '0412 345 678', intent: 'New_Lead', booking_status: 'booked', duration: '3m 45s' },
    { id: '2', date: '2024-02-05', called_at: '11:15 AM', caller_name: 'Jane Smith', customer_phone: '0498 765 432', intent: 'Support', booking_status: 'pending', duration: '5m 12s' },
    { id: '3', date: '2024-02-04', called_at: '09:00 AM', caller_name: 'Bob Brown', customer_phone: '0400 111 222', intent: 'Reschedule', booking_status: 'rescheduled', duration: '2m 30s' },
    { id: '4', date: '2024-02-04', called_at: '02:45 PM', caller_name: 'Alice White', customer_phone: '0433 999 000', intent: 'General_Enquiry', booking_status: 'cancelled', duration: '1m 50s' },
    { id: '5', date: '2024-02-03', called_at: '04:20 PM', caller_name: 'Charlie Green', customer_phone: '0455 666 777', intent: 'Complaint', booking_status: 'pending', duration: '8m 15s' },
    { id: '6', date: '2024-02-03', called_at: '01:10 PM', caller_name: 'David Black', customer_phone: '0411 222 333', intent: 'New_Lead', booking_status: 'booked', duration: '4m 05s' },
];

export function CustomerCallLogs() {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCalls = MOCK_CALLS.filter(call =>
        call.caller_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.customer_phone.includes(searchQuery) ||
        call.intent.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout activeResult="customer_call_logs">
            <PullToRefresh onRefresh={async () => { }}>
                <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-primary">Call Logs</h1>
                            <p className="text-sm text-muted-foreground font-medium">History of all interactions</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button variant="outline" size="sm">
                                <Download className="w-4 h-4 mr-2" />
                                Export CSV
                            </Button>
                        </div>
                    </div>

                    <Card className="bg-card border-slate-300 shadow-md">
                        <CardHeader className="p-4 border-b">
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search calls by name, phone, or intent..."
                                        className="pl-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <Filter className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="rounded-md border-t border-l border-r border-slate-200 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider">Date & Time</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider">Caller</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider">Intent</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider">Duration</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCalls.map((call) => (
                                            <TableRow key={call.id} className="hover:bg-muted/30">
                                                <TableCell className="text-xs font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{call.date}</span>
                                                        <span className="text-muted-foreground">{call.called_at}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm">{call.caller_name}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{call.customer_phone}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={`text-[10px] uppercase tracking-wider font-bold ${getIntentColor(call.intent)}`}>
                                                        {call.intent.replace(/_/g, ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs font-mono text-muted-foreground">
                                                    {call.duration}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                            <Play className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                            <PhoneForwarded className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </PullToRefresh>
        </DashboardLayout>
    );
}
