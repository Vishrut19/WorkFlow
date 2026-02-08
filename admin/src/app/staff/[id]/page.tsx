'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Info,
  MapPin,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const RETENTION_DAYS = 30;

function todayYYYYMMDD(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function formatDateLabel(dateStr: string): string {
  const today = todayYYYYMMDD();
  if (dateStr === today) return 'Today';
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  if (dateStr === yesterday) return 'Yesterday';
  return format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d, yyyy');
}

function getMinMaxDates(): { min: string; max: string } {
  const max = todayYYYYMMDD();
  const min = format(subDays(new Date(), RETENTION_DAYS), 'yyyy-MM-dd');
  return { min, max };
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : params.id;

  const [member, setMember] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [locationLogs, setLocationLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayYYYYMMDD());
  const [activeTab, setActiveTab] = useState<'attendance' | 'location'>('attendance');

  const { min: minDate, max: maxDate } = useMemo(() => getMinMaxDates(), []);
  const selectedDateLabel = useMemo(() => formatDateLabel(selectedDate), [selectedDate]);
  const pickerDate = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate]);

  const loadData = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (profError) throw profError;
      setMember(profile);

      const { data: attRow } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', id)
        .eq('attendance_date', selectedDate)
        .maybeSingle();
      setAttendance(attRow ? [attRow] : []);

      const dayStart = selectedDate + 'T00:00:00.000Z';
      const nextDay = new Date(new Date(selectedDate + 'T12:00:00').getTime() + 24 * 60 * 60 * 1000);
      const dayEnd = nextDay.toISOString().slice(0, 10) + 'T00:00:00.000Z';

      const { data: locationData } = await supabase
        .from('location_logs')
        .select('*')
        .eq('user_id', id)
        .gte('recorded_at', dayStart)
        .lt('recorded_at', dayEnd)
        .order('recorded_at', { ascending: true });

      const moveLogs = (locationData ?? []).map((l: any) => ({
        ...l,
        type: 'move',
        trailId: `move-${l.id}`,
      }));

      const trail: any[] = [];
      if (attRow?.check_in_time) {
        trail.push({
          type: 'check_in',
          trailId: `check_in-${attRow.id}`,
          recorded_at: attRow.check_in_time,
          place_name: attRow.check_in_city ?? null,
          state: attRow.check_in_state ?? null,
        });
      }
      trail.push(...moveLogs);
      if (attRow?.check_out_time) {
        trail.push({
          type: 'check_out',
          trailId: `check_out-${attRow.id}`,
          recorded_at: attRow.check_out_time,
          place_name: attRow.check_out_city ?? null,
          state: attRow.check_out_state ?? null,
        });
      }
      trail.sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      );
      setLocationLogs(trail);
    } catch (error) {
      console.error('Error loading staff detail:', error);
    } finally {
      setLoading(false);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const checkIn = useMemo(() => locationLogs.find((l: any) => l.type === 'check_in'), [locationLogs]);
  const changes = useMemo(() => locationLogs.filter((l: any) => l.type === 'move'), [locationLogs]);
  const checkOut = useMemo(() => locationLogs.find((l: any) => l.type === 'check_out'), [locationLogs]);
  const hasAnyLocation = checkIn || changes.length > 0 || checkOut;

  const locationText = (item: any) => {
    const has = Boolean(item?.place_name || item?.state);
    return has ? [item.place_name, item.state].filter(Boolean).join(', ') : '—';
  };

  const timeStr = (item: any) =>
    item?.recorded_at
      ? format(new Date(item.recorded_at), 'h:mm a')
      : '—';

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="rounded-md border-0 bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Admin
          </Badge>
        );
      case 'manager':
        return (
          <Badge className="rounded-md border-0 bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Manager
          </Badge>
        );
      default:
        return (
          <Badge className="rounded-md border-0 bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Staff
          </Badge>
        );
    }
  };

  if (loading && !member) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader size="lg" />
          <p className="text-sm font-medium text-muted-foreground">Loading…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!id || !member) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Info className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Invalid staff member</p>
          <Button variant="outline" onClick={() => router.push('/staff')}>
            Back to Staff
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push('/staff')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold text-foreground truncate">Member Details</h2>
      </div>

      <Card className="mb-6 overflow-hidden border-border bg-card">
        <CardContent className="p-6">
          {/* Profile header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-2xl text-primary ring-2 ring-primary/20">
              {member.full_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <h3 className="mt-3 text-xl font-bold text-foreground">{member.full_name}</h3>
            <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
            <div className="mt-2">{getRoleBadge(member.role)}</div>
          </div>

          {/* Date selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-between font-semibold border-border bg-background',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <span>{selectedDateLabel}</span>
                <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={pickerDate}
                onSelect={(date) => date && setSelectedDate(format(date, 'yyyy-MM-dd'))}
                disabled={(date) => {
                  const d = format(date, 'yyyy-MM-dd');
                  return d < minDate || d > maxDate;
                }}
                defaultMonth={pickerDate}
              />
            </PopoverContent>
          </Popover>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'attendance' | 'location')}
            className="mt-6"
          >
            <TabsList variant="line" className="grid w-full grid-cols-2">
              <TabsTrigger value="attendance" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="location" className="gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendance" className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader size="md" />
                </div>
              ) : attendance.length === 0 ? (
                <div className="flex flex-col items-center py-10 rounded-xl border border-dashed border-border bg-muted/30">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No attendance for {selectedDateLabel}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(attendance[0].attendance_date), 'EEE, MMM d')}
                    </span>
                    <Badge
                      className={
                        attendance[0].status === 'present'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }
                    >
                      {attendance[0].status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Check in
                      </p>
                      <p className="font-medium text-foreground">
                        {attendance[0].check_in_time
                          ? format(new Date(attendance[0].check_in_time), 'h:mm a')
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Check out
                      </p>
                      <p className="font-medium text-foreground">
                        {attendance[0].check_out_time
                          ? format(new Date(attendance[0].check_out_time), 'h:mm a')
                          : '—'}
                      </p>
                    </div>
                  </div>
                  {attendance[0].total_minutes != null && attendance[0].total_minutes > 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-sm font-semibold text-muted-foreground">
                        Total: {Math.floor(attendance[0].total_minutes / 60)}h{' '}
                        {attendance[0].total_minutes % 60}m
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="location" className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader size="md" />
                </div>
              ) : !hasAnyLocation ? (
                <div className="flex flex-col items-center py-10 rounded-xl border border-dashed border-border bg-muted/30">
                  <MapPin className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-muted-foreground text-center">
                    No locations for this date
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check-in to see check-in and check-out location
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Check-in */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Check-in
                    </p>
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50 px-3 py-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-medium text-foreground w-20 shrink-0">
                        {checkIn ? timeStr(checkIn) : '—'}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate">
                        {checkIn ? locationText(checkIn) : 'No check-in yet'}
                      </span>
                    </div>
                  </div>

                  {/* Total hours */}
                  {attendance[0]?.total_minutes != null && attendance[0].total_minutes > 0 && (
                    <p className="text-sm font-semibold text-center text-muted-foreground py-1">
                      Total: {Math.floor(attendance[0].total_minutes / 60)}h{' '}
                      {attendance[0].total_minutes % 60}m
                    </p>
                  )}

                  {/* Check-out */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Check-out
                    </p>
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 px-3 py-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                      <span className="text-sm font-medium text-foreground w-20 shrink-0">
                        {checkOut ? timeStr(checkOut) : '—'}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate">
                        {checkOut ? locationText(checkOut) : 'Not checked out yet'}
                      </span>
                    </div>
                  </div>

                  {/* View day on map */}
                  <Link href={`/staff/${id}/day-map?date=${selectedDate}`}>
                    <Button
                      variant="outline"
                      className="w-full border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      View day on map
                    </Button>
                  </Link>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
