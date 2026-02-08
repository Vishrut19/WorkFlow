'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/lib/supabase';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { format, subDays } from 'date-fns';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DAY_MAP_ID = 'day-route-map';
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const MAX_POINTS = 80;
const DEFAULT_CENTER = { lat: 22.5, lng: 82.0 };
const DEFAULT_ZOOM = 10;
const GREEN_PIN =
  'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
const RED_PIN = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';

function simplifyPath(
  coords: { lat: number; lng: number }[]
): { lat: number; lng: number }[] {
  if (coords.length <= MAX_POINTS) return coords;
  const result: { lat: number; lng: number }[] = [];
  result.push(coords[0]);
  const step = (coords.length - 2) / (MAX_POINTS - 2);
  for (let i = 1; i <= MAX_POINTS - 2; i++) {
    const idx = Math.round(i * step);
    result.push(coords[Math.min(idx, coords.length - 2)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

function boundsForCoords(coords: { lat: number; lng: number }[]) {
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

function RouteMapInner({
  coordinates,
  checkIn,
  checkOut,
}: {
  coordinates: { lat: number; lng: number }[];
  checkIn: { lat: number; lng: number } | null;
  checkOut: { lat: number; lng: number } | null;
}) {
  const map = useMap(DAY_MAP_ID);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || coordinates.length < 2) return;
    const path = coordinates.map((c) => ({ lat: c.lat, lng: c.lng }));
    const line = new google.maps.Polyline({
      path,
      strokeColor: '#6366F1',
      strokeOpacity: 1,
      strokeWeight: 4,
      map,
    });
    polylineRef.current = line;
    return () => {
      line.setMap(null);
      polylineRef.current = null;
    };
  }, [map, coordinates]);

  useEffect(() => {
    if (!map || coordinates.length === 0) return;
    const b = boundsForCoords(coordinates);
    if (!b) return;
    const bounds = new google.maps.LatLngBounds(
      { lat: b.south, lng: b.west },
      { lat: b.north, lng: b.east }
    );
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }, [map, coordinates]);

  return (
    <>
      {checkIn && (
        <Marker
          position={checkIn}
          title="Check-in"
          icon={{
            url: GREEN_PIN,
            scaledSize: new google.maps.Size(40, 40),
          }}
        />
      )}
      {checkOut && (
        <Marker
          position={checkOut}
          title="Check-out"
          icon={{
            url: RED_PIN,
            scaledSize: new google.maps.Size(40, 40),
          }}
        />
      )}
    </>
  );
}

export default function StaffDayMapPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : params.id;
  const dateParam = searchParams.get('date');
  const selectedDate = dateParam || format(new Date(), 'yyyy-MM-dd');

  const [member, setMember] = useState<any>(null);
  const [trail, setTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
      setMember(profile || null);

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

      const { data: attRow } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', id)
        .eq('attendance_date', selectedDate)
        .maybeSingle();

      const moveLogs = (locationData ?? []).map((l: any) => ({
        ...l,
        type: 'move',
        trailId: `move-${l.id}`,
      }));

      const build: any[] = [];
      if (attRow?.check_in_time) {
        build.push({
          type: 'check_in',
          trailId: `check_in-${attRow.id}`,
          recorded_at: attRow.check_in_time,
          latitude: attRow.check_in_lat,
          longitude: attRow.check_in_lng,
        });
      }
      build.push(...moveLogs);
      if (attRow?.check_out_time) {
        build.push({
          type: 'check_out',
          trailId: `check_out-${attRow.id}`,
          recorded_at: attRow.check_out_time,
          latitude: attRow.check_out_lat,
          longitude: attRow.check_out_lng,
        });
      }
      build.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      setTrail(build);
    } catch (e) {
      console.error('Day map load error:', e);
    } finally {
      setLoading(false);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const coordsForPolyline = useMemo(() => {
    const points = trail
      .filter((l: any) => l.latitude != null && l.longitude != null)
      .map((l: any) => ({ lat: l.latitude, lng: l.longitude }));
    return simplifyPath(points);
  }, [trail]);

  const checkIn = useMemo(() => trail.find((l: any) => l.type === 'check_in'), [trail]);
  const checkOut = useMemo(() => trail.find((l: any) => l.type === 'check_out'), [trail]);
  const checkInPos = checkIn ? { lat: checkIn.latitude, lng: checkIn.longitude } : null;
  const checkOutPos = checkOut ? { lat: checkOut.latitude, lng: checkOut.longitude } : null;
  const hasRoute = coordsForPolyline.length >= 2;

  const dateLabel =
    selectedDate === format(new Date(), 'yyyy-MM-dd')
      ? 'Today'
      : selectedDate === format(subDays(new Date(), 1), 'yyyy-MM-dd')
        ? 'Yesterday'
        : format(new Date(selectedDate + 'T12:00:00'), 'EEE, MMM d, yyyy');

  if (loading && !member) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader size="lg" />
          <p className="text-sm font-medium text-muted-foreground">Loading route…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!id || !member) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
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
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/staff/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground truncate">
              {member.full_name}&apos;s route
            </h2>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
        </div>
      </div>

      {!hasRoute ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-xl border border-dashed border-border bg-muted/30">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">No location data for this date.</p>
          <Button variant="outline" onClick={() => router.push(`/staff/${id}`)}>
            Back to details
          </Button>
        </div>
      ) : !GOOGLE_MAPS_API_KEY ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-xl border border-dashed border-border bg-muted/30">
          <p className="text-muted-foreground text-center">Map is not configured.</p>
          <Button variant="outline" onClick={() => router.push(`/staff/${id}`)}>
            Back to details
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden bg-muted/30" style={{ height: 420 }}>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <Map
                id={DAY_MAP_ID}
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={DEFAULT_ZOOM}
                gestureHandling="greedy"
                style={{ width: '100%', height: '100%' }}
                mapId={undefined}
              >
                <RouteMapInner
                  coordinates={coordsForPolyline}
                  checkIn={checkInPos}
                  checkOut={checkOutPos}
                />
              </Map>
            </APIProvider>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Start</span>
              <span className="text-sm font-medium text-foreground">
                {checkIn ? format(new Date(checkIn.recorded_at), 'h:mm a') : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs text-muted-foreground">End</span>
              <span className="text-sm font-medium text-foreground">
                {checkOut ? format(new Date(checkOut.recorded_at), 'h:mm a') : '—'}
              </span>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
