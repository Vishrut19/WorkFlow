'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Download, History, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AttendanceRecords() {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        loadRecords();
    }, [dateFilter]);

    async function loadRecords() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('attendance')
                .select(`
          *,
          profiles:user_id (full_name, email)
        `)
                .eq('attendance_date', dateFilter)
                .order('check_in_time', { ascending: false });

            if (error) throw error;
            setRecords(data || []);
        } catch (error) {
            console.error('Error loading records:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredRecords = records.filter(record =>
        record.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownloadCSV = () => {
        if (filteredRecords.length === 0) return;

        const headers = ['Employee', 'Email', 'Date', 'Check In Location', 'Check Out Location', 'Check In', 'Check Out', 'Total Minutes', 'Status'];
        const rows = filteredRecords.map(r => [
            r.profiles?.full_name,
            r.profiles?.email,
            r.attendance_date,
            [r.check_in_city, r.check_in_state].filter(Boolean).join(', ') || '-',
            [r.check_out_city, r.check_out_state].filter(Boolean).join(', ') || '-',
            r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm:ss') : '-',
            r.check_out_time ? format(new Date(r.check_out_time), 'HH:mm:ss') : '-',
            r.total_minutes || 0,
            r.status
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `attendance_${dateFilter}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <DashboardLayout>
            <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 px-1">
                <div>
                    <h2 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center">
                        <History className="mr-4 text-primary" size={32} />
                        Workforce Attendance
                    </h2>
                    <p className="text-muted-foreground mt-2 font-medium">Daily check-in logs and duration reports</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative w-full sm:w-auto">
                        <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring shadow-sm"
                        />
                    </div>

                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring w-[200px]"
                        />
                    </div>

                    <Button
                        onClick={handleDownloadCSV}
                        variant="default"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 px-6"
                        disabled={filteredRecords.length === 0}
                    >
                        <Download size={18} />
                        Export CSV
                    </Button>
                </div>
            </div>

            <Card className="mb-10 overflow-hidden border-border bg-card shadow-md py-0">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <Loader size="lg" />
                            <p className="text-sm font-medium text-muted-foreground">Loading attendance…</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/80 bg-muted/40 hover:bg-transparent">
                                    <TableHead className="w-[1%] min-w-[180px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</TableHead>
                                    <TableHead className="min-w-[140px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Check In Location</TableHead>
                                    <TableHead className="min-w-[140px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Check Out Location</TableHead>
                                    <TableHead className="w-0 whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</TableHead>
                                    <TableHead className="w-0 whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRecords.map((record) => (
                                    <TableRow key={record.id} className="border-b border-border/60 transition-colors hover:bg-muted/40">
                                        <TableCell className="px-3 py-3">
                                            <div className="font-semibold text-foreground">{record.profiles?.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{record.profiles?.email}</div>
                                        </TableCell>
                                        <TableCell className="px-3 py-3">
                                            <div className="font-medium text-foreground">
                                                {[record.check_in_city, record.check_in_state].filter(Boolean).length
                                                    ? [record.check_in_city, record.check_in_state].filter(Boolean).join(', ')
                                                    : '—'}
                                            </div>
                                            {record.check_in_time && (
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    {format(new Date(record.check_in_time), 'hh:mm a')}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-3 py-3">
                                            <div className="font-medium text-foreground">
                                                {record.check_out_time
                                                    ? [record.check_out_city, record.check_out_state].filter(Boolean).length
                                                        ? [record.check_out_city, record.check_out_state].filter(Boolean).join(', ')
                                                        : '—'
                                                    : <span className="text-emerald-600 dark:text-emerald-400">On duty</span>}
                                            </div>
                                            {record.check_out_time && (
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    {format(new Date(record.check_out_time), 'hh:mm a')}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-3 py-3">
                                            <Badge variant="secondary" className="rounded-md border-0 bg-primary/10 font-mono text-xs font-medium text-primary">
                                                {record.total_minutes ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m` : '—'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-center">
                                            <Badge
                                                variant="secondary"
                                                className={`rounded-md border-0 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${record.status === 'present'
                                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                                    }`}
                                            >
                                                {record.status || 'Unknown'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredRecords.length === 0 && (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={5} className="py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
                                                    <History size={24} className="text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">No activity for this date</p>
                                                    <p className="mt-0.5 text-sm text-muted-foreground">Select another date or wait for check-ins</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
