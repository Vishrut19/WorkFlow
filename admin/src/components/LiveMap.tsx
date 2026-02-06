'use client';

import { Loader } from '@/components/ui/loader';
import { Mapcn } from '@/components/ui/map';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Marker, Popup } from 'react-map-gl/maplibre';

export interface LiveLocation {
    user_id: string;
    latitude: number;
    longitude: number;
    recorded_at: string;
    profiles?: { full_name?: string } | null;
}

interface LiveMapProps {
    onLocationsUpdated?: (locations: LiveLocation[]) => void;
    selectedUserId?: string | null;
    onSelectUser?: (userId: string | null) => void;
}

function getBounds(locations: LiveLocation[]) {
    if (locations.length === 0) return null;
    const lats = locations.map(l => l.latitude);
    const lngs = locations.map(l => l.longitude);
    const padding = 0.02;
    return {
        minLng: Math.min(...lngs) - padding,
        minLat: Math.min(...lats) - padding,
        maxLng: Math.max(...lngs) + padding,
        maxLat: Math.max(...lats) + padding,
    };
}

export default function LiveMap({ onLocationsUpdated, selectedUserId, onSelectUser }: LiveMapProps) {
    const [locations, setLocations] = useState<LiveLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<LiveLocation | null>(null);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        loadLocations();
        const interval = setInterval(loadLocations, 60000);
        return () => clearInterval(interval);
    }, []);

    // Sync selection from parent (e.g. list click) and fly to that user
    useEffect(() => {
        if (!selectedUserId) {
            setSelectedUser(null);
            return;
        }
        const loc = locations.find(l => l.user_id === selectedUserId);
        if (!loc) return;
        setSelectedUser(loc);
        const raw = mapRef.current;
        const map = typeof raw?.getMap === 'function' ? raw.getMap() : raw;
        if (map?.flyTo) {
            try {
                map.flyTo({
                    center: [loc.longitude, loc.latitude],
                    zoom: 15,
                    duration: 600,
                });
            } catch (_) {}
        }
    }, [selectedUserId, locations]);

    // When no selection, fit bounds to all locations
    useEffect(() => {
        if (locations.length === 0 || selectedUserId) return;
        const raw = mapRef.current;
        const map = typeof raw?.getMap === 'function' ? raw.getMap() : raw;
        if (!map?.fitBounds) return;
        const b = getBounds(locations);
        if (!b) return;
        try {
            map.fitBounds(
                [[b.minLng, b.minLat], [b.maxLng, b.maxLat]],
                { padding: 60, maxZoom: 14, duration: 800 }
            );
        } catch (_) {}
    }, [locations, selectedUserId]);

    async function loadLocations() {
        try {
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
            const { data: logs, error } = await supabase
                .from('location_logs')
                .select(`
          user_id,
          latitude,
          longitude,
          recorded_at,
          profiles:user_id (full_name)
        `)
                .gte('recorded_at', thirtyMinsAgo)
                .order('recorded_at', { ascending: false });

            if (error) throw error;

            const uniqueLocations: LiveLocation[] = [];
            const seen = new Set<string>();
            logs?.forEach((log: any) => {
                if (!seen.has(log.user_id)) {
                    seen.add(log.user_id);
                    const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                    uniqueLocations.push({ ...log, profiles: profile ?? null });
                }
            });

            setLocations(uniqueLocations);
            onLocationsUpdated?.(uniqueLocations);
        } catch (error) {
            console.error('Error loading locations:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading && locations.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-muted/50 rounded-2xl border border-border">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <Mapcn ref={mapRef}>
            {locations.map((loc) => (
                <Fragment key={loc.user_id}>
                    <Marker
                        latitude={loc.latitude}
                        longitude={loc.longitude}
                        onClick={e => {
                            e.originalEvent.stopPropagation();
                            setSelectedUser(loc);
                            onSelectUser?.(loc.user_id);
                        }}
                    >
                        <div className="cursor-pointer group">
                            <div className="bg-destructive text-destructive-foreground p-1.5 rounded-full shadow-lg border-2 border-background group-hover:scale-110 transition-transform ring-2 ring-destructive/30 animate-[pulse_2s_ease-in-out_infinite]">
                                <MapPin size={18} />
                            </div>
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-1 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md z-10">
                                {loc.profiles?.full_name ?? 'Unknown'}
                            </div>
                        </div>
                    </Marker>
                    {selectedUser?.user_id === loc.user_id && (
                        <Popup
                            latitude={loc.latitude}
                            longitude={loc.longitude}
                            anchor="bottom"
                            onClose={() => {
                                setSelectedUser(null);
                                onSelectUser?.(null);
                            }}
                            closeButton={true}
                            closeOnClick={false}
                            className="live-map-popup z-50"
                        >
                            <div className="min-w-[220px] bg-card text-card-foreground rounded-xl border border-border shadow-lg overflow-hidden">
                                <div className="px-4 pt-10 pr-10 pb-3">
                                    <p className="font-semibold text-base text-foreground truncate">
                                        {loc.profiles?.full_name ?? 'Unknown'}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {format(new Date(loc.recorded_at), 'h:mm a')} · Live
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/80 mt-2 font-mono tabular-nums">
                                        {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                                    </p>
                                </div>
                                <div className="h-1 bg-primary/20" aria-hidden />
                            </div>
                        </Popup>
                    )}
                </Fragment>
            ))}
        </Mapcn>
    );
}
