'use client';

import { Loader } from '@/components/ui/loader';
import { Mapcn, LIVE_MAP_ID } from '@/components/ui/map';
import { supabase } from '@/lib/supabase';
import { useMap, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LiveLocation {
    user_id: string;
    latitude: number;
    longitude: number;
    recorded_at: string;
    profiles?: { full_name?: string } | null;
    placeName?: string;
}

interface LiveMapProps {
    onLocationsUpdated?: (locations: LiveLocation[]) => void;
    selectedUserId?: string | null;
    onSelectUser?: (userId: string | null) => void;
}

/**
 * Reverse-geocode a lat/lng to a human-readable place name using OpenStreetMap Nominatim.
 * Free, no API key required. Returns "City, State" or best available locality.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
        );
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
        const data = await res.json();

        const addr = data.address;
        if (!addr) {
            return data.display_name?.split(',').slice(0, 2).join(',').trim()
                || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }

        const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || '';
        const state = addr.state || '';

        if (city && state) return `${city}, ${state}`;
        if (city) return city;
        if (state) return state;

        return data.display_name?.split(',').slice(0, 2).join(',').trim()
            || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

function LiveMapInner({ onLocationsUpdated, selectedUserId, onSelectUser }: LiveMapProps) {
    const [locations, setLocations] = useState<LiveLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<LiveLocation | null>(null);
    const [showInfoWindow, setShowInfoWindow] = useState(false);
    const prevSelectedRef = useRef<string | null>(null);
    const geocodeCacheRef = useRef<Map<string, string>>(new Map());
    const map = useMap(LIVE_MAP_ID);

    useEffect(() => {
        loadLocations();
        const interval = setInterval(loadLocations, 60000);
        return () => clearInterval(interval);
    }, []);

    // Reverse geocode a location and update its placeName
    const geocodeLocation = useCallback(async (loc: LiveLocation) => {
        const cacheKey = `${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
        if (geocodeCacheRef.current.has(cacheKey)) {
            return geocodeCacheRef.current.get(cacheKey)!;
        }
        const name = await reverseGeocode(loc.latitude, loc.longitude);
        geocodeCacheRef.current.set(cacheKey, name);
        return name;
    }, []);

    // When locations load, reverse geocode all of them (sequential to respect rate limits)
    useEffect(() => {
        if (locations.length === 0) return;
        let cancelled = false;

        const geocodeAll = async () => {
            const updated: LiveLocation[] = [];
            let changed = false;

            for (const loc of locations) {
                if (cancelled) return;
                if (loc.placeName) {
                    updated.push(loc);
                    continue;
                }
                const placeName = await geocodeLocation(loc);
                updated.push({ ...loc, placeName });
                changed = true;
                // Small delay between requests (Nominatim: max 1 req/sec)
                if (locations.indexOf(loc) < locations.length - 1) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            if (!cancelled && changed) {
                setLocations(updated);
                onLocationsUpdated?.(updated);
            }
        };

        geocodeAll();
        return () => { cancelled = true; };
    }, [locations.length]); // Only re-run when the count changes, not on every update

    // Helper to fit map to all locations
    const fitAllLocations = useCallback(() => {
        if (!map || locations.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        locations.forEach(loc => {
            bounds.extend({ lat: loc.latitude, lng: loc.longitude });
        });
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
        google.maps.event.addListenerOnce(map, 'idle', () => {
            const z = map.getZoom();
            if (z !== undefined && z !== null && z > 14) map.setZoom(14);
        });
    }, [map, locations]);

    // Fly to selected user or back to overview
    useEffect(() => {
        if (!map) return;
        const wasSelected = prevSelectedRef.current;
        prevSelectedRef.current = selectedUserId ?? null;

        if (!selectedUserId) {
            setSelectedUser(null);
            setShowInfoWindow(false);
            // Only zoom out when explicitly using "Show All" -- controlled by parent
            if (wasSelected) {
                fitAllLocations();
            }
            return;
        }

        const loc = locations.find(l => l.user_id === selectedUserId);
        if (!loc) return;
        setSelectedUser(loc);
        setShowInfoWindow(true);
        map.panTo({ lat: loc.latitude, lng: loc.longitude });
        map.setZoom(16);
    }, [selectedUserId, locations, map, fitAllLocations]);

    // On initial load, fit to all locations
    useEffect(() => {
        if (locations.length === 0 || selectedUserId) return;
        fitAllLocations();
    }, [locations, selectedUserId, fitAllLocations]);

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
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-2xl z-10">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <>
            {locations.map((loc) => (
                <Marker
                    key={loc.user_id}
                    position={{ lat: loc.latitude, lng: loc.longitude }}
                    onClick={() => {
                        setSelectedUser(loc);
                        setShowInfoWindow(true);
                        onSelectUser?.(loc.user_id);
                    }}
                    title={loc.profiles?.full_name ?? 'Unknown'}
                />
            ))}

            {selectedUser && showInfoWindow && (
                <InfoWindow
                    position={{ lat: selectedUser.latitude, lng: selectedUser.longitude }}
                    onCloseClick={() => {
                        setShowInfoWindow(false);
                    }}
                    pixelOffset={[0, -35]}
                >
                    <div style={{ minWidth: 220, padding: '14px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
                        {/* Custom close button */}
                        <button
                            onClick={() => setShowInfoWindow(false)}
                            style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                border: 'none',
                                background: '#fef2f2',
                                cursor: 'pointer',
                                color: '#ef4444',
                                fontSize: 14,
                                lineHeight: 1,
                                fontWeight: 600,
                            }}
                        >
                            ✕
                        </button>

                        {/* Name */}
                        <p style={{ fontWeight: 600, fontSize: 15, color: '#111827', margin: 0, paddingRight: 28 }}>
                            {selectedUser.profiles?.full_name ?? 'Unknown'}
                        </p>

                        {/* Live badge + time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#ecfdf5',
                                color: '#059669',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 999,
                                letterSpacing: '0.02em',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                Live
                            </span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                {format(new Date(selectedUser.recorded_at), 'h:mm a')}
                            </span>
                        </div>

                        {/* Location */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, color: '#374151', fontSize: 12 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#9ca3af' }}>
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>{selectedUser.placeName || 'Loading location...'}</span>
                        </div>
                    </div>
                </InfoWindow>
            )}
        </>
    );
}

export default function LiveMap(props: LiveMapProps) {
    return (
        <Mapcn>
            <LiveMapInner {...props} />
        </Mapcn>
    );
}
