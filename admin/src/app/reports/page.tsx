'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCached, setCached, CACHE_KEYS } from '@/lib/data-cache';
import { supabase } from '@/lib/supabase';
import { BarChart3, Download, FileSpreadsheet, PieChart, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const INITIAL_STATS = { totalAttendance: 0, presentRate: 0, lateRate: 0, averageHours: 0 };

export default function ReportsPage() {
    const [loading, setLoading] = useState(!getCached<typeof INITIAL_STATS>(CACHE_KEYS.REPORTS));
    const [reportStats, setReportStats] = useState<typeof INITIAL_STATS>(
        () => getCached<typeof INITIAL_STATS>(CACHE_KEYS.REPORTS) ?? INITIAL_STATS
    );

    const loadReportData = useCallback(async () => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startDate = thirtyDaysAgo.toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('attendance')
                .select('status, total_minutes')
                .gte('attendance_date', startDate);
            if (error) throw error;

            if (data?.length) {
                const total = data.length;
                const present = data.filter((a) => a.status === 'present').length;
                const late = data.filter((a) => a.status === 'late').length;
                const totalMinutes = data.reduce((acc, curr) => acc + (curr.total_minutes || 0), 0);
                const next = {
                    totalAttendance: total,
                    presentRate: Math.round((present / total) * 100),
                    lateRate: Math.round((late / total) * 100),
                    averageHours: Math.round((totalMinutes / total) / 60 * 10) / 10,
                };
                setReportStats(next);
                setCached(CACHE_KEYS.REPORTS, next, 2 * 60 * 1000);
            }
        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const cached = getCached<typeof INITIAL_STATS>(CACHE_KEYS.REPORTS);
        if (cached) setReportStats(cached);
        loadReportData();
    }, [loadReportData]);

    return (
        <DashboardLayout>
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-foreground flex items-center">
                        <BarChart3 className="mr-3 text-blue-500" />
                        System Reports
                    </h2>
                    <p className="text-muted-foreground mt-1">Analytics and performance insights for the last 30 days</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground">
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Full CSV Report
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{reportStats.totalAttendance}</div>
                        <p className="text-xs text-muted-foreground mt-1">Logs in last 30 days</p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Punctuality</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">{reportStats.presentRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">On-time arrival rate</p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Average Shift</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">{reportStats.averageHours} hrs</div>
                        <p className="text-xs text-muted-foreground mt-1">Duration per member</p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Late Incidence</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{reportStats.lateRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Follow-up required</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center">
                            <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                            Activity Trends
                        </CardTitle>
                        <CardDescription>Daily attendance volume across all teams</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center border-t border-border">
                        <div className="text-center text-muted-foreground">
                            <TrendingUp size={48} className="mx-auto mb-4 opacity-10" />
                            <p className="text-sm">Activity visualization will appear as data historical depth increases.</p>
                            <p className="text-[10px] mt-1 text-muted-foreground/70 uppercase tracking-widest font-bold font-mono">Real-time Data Streaming Active</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center">
                            <PieChart className="mr-2 h-5 w-5 text-purple-500" />
                            Distribution
                        </CardTitle>
                        <CardDescription>Status breakdown for current period</CardDescription>
                    </CardHeader>
                    <CardContent className="border-t border-border pt-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter">
                                    <span className="text-muted-foreground">Present</span>
                                    <span className="text-green-500">{reportStats.presentRate}%</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${reportStats.presentRate}%` }} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter">
                                    <span className="text-muted-foreground">Late</span>
                                    <span className="text-red-500">{reportStats.lateRate}%</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${reportStats.lateRate}%` }} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter">
                                    <span className="text-muted-foreground">Others</span>
                                    <span className="text-blue-500">{100 - reportStats.presentRate - reportStats.lateRate}%</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${100 - reportStats.presentRate - reportStats.lateRate}%` }} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
