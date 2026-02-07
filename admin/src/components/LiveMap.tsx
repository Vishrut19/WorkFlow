'use client';

import { Loader } from '@/components/ui/loader';
import { Mapcn, LIVE_MAP_ID } from '@/components/ui/map';
import { supabase } from '@/lib/supabase';
import { useMap, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LocationStatus = 'live' | 'lastSeen' | 'offline';

export interface LiveLocation {
    user_id: string;
    latitude: number;
    longitude: number;
    recorded_at: string;
    check_in_time?: string;
    profiles?: { full_name?: string } | null;
    placeName?: string;
    status: LocationStatus;
}

interface LiveMapProps {
    onLocationsUpdated?: (locations: LiveLocation[]) => void;
    selectedUserId?: string | null;
    onSelectUser?: (userId: string | null) => void;
}

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

// ============ Caching for instant display ============
const CACHE_KEY = 'admin_locations_cache';
const GEOCODE_CACHE_KEY = 'admin_geocode_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes max staleness

interface LocationCache {
    data: LiveLocation[];
    timestamp: number;
}

let memoryCache: LocationCache | null = null;
let geocodeMemoryCache: Map<string, string> | null = null;

function getCachedLocations(): LiveLocation[] | null {
    if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
        return memoryCache.data;
    }
    if (typeof window !== 'undefined') {
        try {
            const stored = sessionStorage.getItem(CACHE_KEY);
            if (stored) {
                const parsed: LocationCache = JSON.parse(stored);
                if (Date.now() - parsed.timestamp < CACHE_TTL) {
                    memoryCache = parsed;
                    return parsed.data;
                }
            }
        } catch { /* ignore */ }
    }
    return null;
}

function setCachedLocations(data: LiveLocation[]) {
    const cache: LocationCache = { data, timestamp: Date.now() };
    memoryCache = cache;
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch { /* ignore */ }
    }
}

// Persistent geocode cache (place names rarely change)
function getGeocodeCache(): Map<string, string> {
    if (geocodeMemoryCache) return geocodeMemoryCache;
    geocodeMemoryCache = new Map();
    if (typeof window !== 'undefined') {
        try {
            const stored = sessionStorage.getItem(GEOCODE_CACHE_KEY);
            if (stored) {
                const entries: [string, string][] = JSON.parse(stored);
                geocodeMemoryCache = new Map(entries);
            }
        } catch { /* ignore */ }
    }
    return geocodeMemoryCache;
}

function saveGeocodeCache() {
    if (!geocodeMemoryCache || typeof window === 'undefined') return;
    try {
        const entries = Array.from(geocodeMemoryCache.entries()).slice(-100); // keep last 100
        sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(entries));
    } catch { /* ignore */ }
}

// ============ Prefetch for instant map on navigation ============
let prefetchPromise: Promise<void> | null = null;

export function prefetchMapData() {
    if (prefetchPromise) return prefetchPromise;
    if (getCachedLocations()) return Promise.resolve(); // already have fresh data

    prefetchPromise = (async () => {
        const locations = await fetchLocations();
        if (locations.length > 0) {
            // Also prefetch geocoding
            const cache = getGeocodeCache();
            const toGeocode = locations.filter(l => {
                if (l.status === 'offline') return false;
                const key = `${l.latitude.toFixed(4)}_${l.longitude.toFixed(4)}`;
                return !cache.has(key);
            }).slice(0, 5); // prefetch first 5

            await Promise.all(toGeocode.map(async loc => {
                const key = `${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
                const name = await reverseGeocode(loc.latitude, loc.longitude);
                cache.set(key, name);
            }));
            saveGeocodeCache();
        }
        prefetchPromise = null;
    })();

    return prefetchPromise;
}

// Pure data fetcher – no React state, returns data or empty array
async function fetchLocations(): Promise<LiveLocation[]> {
    try {
        const { data: rows, error } = await supabase.rpc('get_admin_locations');

        if (error) {
            const isMissing = (error as { code?: string }).code === '42883'
                || (error as { message?: string }).message?.includes('function');
            if (isMissing) return fetchLocationsFallback();
            throw error;
        }

        const locations = (rows || []).map((row: {
            user_id: string;
            full_name: string | null;
            latitude: number;
            longitude: number;
            recorded_at: string;
            check_in_time: string | null;
            status: LocationStatus;
        }) => ({
            user_id: row.user_id,
            latitude: row.latitude,
            longitude: row.longitude,
            recorded_at: row.recorded_at,
            check_in_time: row.check_in_time ?? undefined,
            profiles: row.full_name != null ? { full_name: row.full_name } : null,
            status: row.status,
        }));

        setCachedLocations(locations);
        return locations;
    } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in err
            ? (err as { message: string }).message : String(err ?? 'Unknown');
        console.error('Error loading locations:', msg);
        return [];
    }
}

async function fetchLocationsFallback(): Promise<LiveLocation[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = todayStart.toISOString().split('T')[0];
    const thirtyMinsAgo = Date.now() - 30 * 60000;

    const { data: logs, error: logsError } = await supabase
        .from('location_logs')
        .select('user_id, latitude, longitude, recorded_at, profiles:user_id (full_name)')
        .gte('recorded_at', todayStart.toISOString())
        .order('recorded_at', { ascending: false });
    if (logsError) throw logsError;

    const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('user_id, check_in_time, profiles:user_id (full_name)')
        .eq('attendance_date', today)
        .is('check_out_time', null);
    if (attError) throw attError;

    const locationMap = new Map<string, LiveLocation>();
    logs?.forEach((log: any) => {
        if (!locationMap.has(log.user_id)) {
            const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
            const recordedTime = new Date(log.recorded_at).getTime();
            locationMap.set(log.user_id, {
                ...log, profiles: profile ?? null,
                status: recordedTime >= thirtyMinsAgo ? 'live' : 'lastSeen',
            });
        }
    });
    attendance?.forEach((att: any) => {
        if (!locationMap.has(att.user_id)) {
            const profile = Array.isArray(att.profiles) ? att.profiles[0] : att.profiles;
            locationMap.set(att.user_id, {
                user_id: att.user_id, latitude: 0, longitude: 0,
                recorded_at: att.check_in_time, check_in_time: att.check_in_time,
                profiles: profile ?? null, status: 'offline',
            });
        }
    });
    const all = Array.from(locationMap.values());
    all.sort((a, b) => {
        const order: Record<LocationStatus, number> = { live: 0, lastSeen: 1, offline: 2 };
        return order[a.status] - order[b.status];
    });
    setCachedLocations(all);
    return all;
}

function LiveMapInner({ onLocationsUpdated, selectedUserId, onSelectUser }: LiveMapProps) {
    const [locations, setLocations] = useState<LiveLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<LiveLocation | null>(null);
    const [showInfoWindow, setShowInfoWindow] = useState(false);

    const locationsRef = useRef<LiveLocation[]>([]);
    const prevSelectedRef = useRef<string | null>(null);
    const geocodeBatchRef = useRef(0);
    const onLocationsUpdatedRef = useRef(onLocationsUpdated);
    const mapRef = useRef<google.maps.Map | null>(null);
    const hasFittedRef = useRef(false);
    const fitAllLocationsRef = useRef<() => void>(() => {});

    const map = useMap(LIVE_MAP_ID);
    mapRef.current = map;
    locationsRef.current = locations;
    onLocationsUpdatedRef.current = onLocationsUpdated;

    const fitAllLocations = useCallback(() => {
        const m = mapRef.current;
        if (!m) return;
        const withCoords = locationsRef.current.filter(l => l.status !== 'offline');
        if (withCoords.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        withCoords.forEach(loc => bounds.extend({ lat: loc.latitude, lng: loc.longitude }));
        m.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
        google.maps.event.addListenerOnce(m, 'idle', () => {
            const z = m.getZoom();
            if (z !== undefined && z !== null && z > 14) m.setZoom(14);
        });
    }, []);
    fitAllLocationsRef.current = fitAllLocations;

    const geocodeLocations = useCallback(async (locs: LiveLocation[]) => {
        const batch = ++geocodeBatchRef.current;
        const cache = getGeocodeCache();

        // First pass: apply cached place names instantly
        let updated = locs.map(loc => {
            if (loc.status === 'offline' || loc.placeName) return loc;
            const cacheKey = `${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
            const cached = cache.get(cacheKey);
            return cached ? { ...loc, placeName: cached } : loc;
        });

        // Update immediately with cached names
        const hasCachedNames = updated.some((l, i) => l.placeName && !locs[i].placeName);
        if (hasCachedNames) {
            setLocations(updated);
            onLocationsUpdatedRef.current?.(updated);
        }

        // Find remaining locations that need geocoding
        const needsGeocode = updated
            .map((loc, idx) => ({ loc, idx }))
            .filter(({ loc }) => loc.status !== 'offline' && !loc.placeName);

        if (needsGeocode.length === 0) return;

        // Geocode in parallel batches of 3 (respect Nominatim rate limits)
        const BATCH_SIZE = 3;
        for (let i = 0; i < needsGeocode.length; i += BATCH_SIZE) {
            if (geocodeBatchRef.current !== batch) return;

            const batchItems = needsGeocode.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batchItems.map(async ({ loc, idx }) => {
                    const cacheKey = `${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
                    const placeName = await reverseGeocode(loc.latitude, loc.longitude);
                    cache.set(cacheKey, placeName);
                    return { idx, placeName };
                })
            );

            if (geocodeBatchRef.current !== batch) return;

            // Apply results
            updated = [...updated];
            results.forEach(({ idx, placeName }) => {
                updated[idx] = { ...updated[idx], placeName };
            });

            setLocations(updated);
            onLocationsUpdatedRef.current?.(updated);

            // Small delay between batches to respect rate limits
            if (i + BATCH_SIZE < needsGeocode.length) {
                await new Promise(r => setTimeout(r, 150));
            }
        }

        // Persist geocode cache
        saveGeocodeCache();
    }, []); // stable – reads everything from refs

    // ---- Effect 1: load data once on mount + 60s interval. No deps → never re-runs. ----
    useEffect(() => {
        let mounted = true;
        const cached = getCachedLocations();

        if (cached && cached.length > 0) {
            setLocations(cached);
            onLocationsUpdatedRef.current?.(cached);
            setLoading(false);
            if (!hasFittedRef.current) {
                hasFittedRef.current = true;
                setTimeout(() => fitAllLocationsRef.current(), 50);
            }
        }

        async function load(isInitial: boolean) {
            const allLocations = await fetchLocations();
            if (!mounted) return;
            const hasNewData = !cached?.length || allLocations.length !== cached.length ||
                allLocations.some((loc, i) => loc.recorded_at !== cached[i]?.recorded_at);

            if (hasNewData || isInitial) {
                setLocations(allLocations);
                onLocationsUpdatedRef.current?.(allLocations);
                setLoading(false);
                if (!hasFittedRef.current && allLocations.length > 0) {
                    hasFittedRef.current = true;
                    setTimeout(() => fitAllLocationsRef.current(), 100);
                }
                geocodeLocations(allLocations);
            }
        }

        load(true);
        const interval = setInterval(() => load(false), 60000);
        return () => { mounted = false; clearInterval(interval); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: run once, use refs inside

    // ---- Effect 2: selection only. Depends only on selectedUserId. ----
    useEffect(() => {
        const m = mapRef.current;
        const wasSelected = prevSelectedRef.current;
        prevSelectedRef.current = selectedUserId ?? null;

        if (!selectedUserId) {
            setSelectedUser(null);
            setShowInfoWindow(false);
            if (wasSelected && m) fitAllLocationsRef.current();
            return;
        }

        const loc = locationsRef.current.find(l => l.user_id === selectedUserId);
        if (!loc || loc.status === 'offline' || !m) return;
        setSelectedUser(loc);
        setShowInfoWindow(true);
        m.panTo({ lat: loc.latitude, lng: loc.longitude });
        m.setZoom(16);
    }, [selectedUserId]);

    // (data fetching is handled by fetchLocations, defined outside the component)

    if (loading && locations.length === 0) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-2xl z-10">
                <Loader size="lg" />
            </div>
        );
    }

    // Only render markers for live and lastSeen (they have coordinates)
    const markersData = locations.filter(l => l.status !== 'offline');

    return (
        <>
            {markersData.map((loc) => (
                <Marker
                    key={loc.user_id}
                    position={{ lat: loc.latitude, lng: loc.longitude }}
                    onClick={() => {
                        setSelectedUser(loc);
                        setShowInfoWindow(true);
                        onSelectUser?.(loc.user_id);
                    }}
                    title={loc.profiles?.full_name ?? 'Unknown'}
                    opacity={loc.status === 'lastSeen' ? 0.55 : 1}
                />
            ))}

            {selectedUser && showInfoWindow && selectedUser.status !== 'offline' && (
                <InfoWindow
                    position={{ lat: selectedUser.latitude, lng: selectedUser.longitude }}
                    onCloseClick={() => {
                        setShowInfoWindow(false);
                    }}
                    pixelOffset={[0, -35]}
                >
                    <div style={{ minWidth: 220, padding: '14px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative' }}>
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

                        <p style={{ fontWeight: 600, fontSize: 15, color: '#111827', margin: 0, paddingRight: 28 }}>
                            {selectedUser.profiles?.full_name ?? 'Unknown'}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: selectedUser.status === 'live' ? '#ecfdf5' : '#fef3c7',
                                color: selectedUser.status === 'live' ? '#059669' : '#b45309',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 999,
                                letterSpacing: '0.02em',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedUser.status === 'live' ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
                                {selectedUser.status === 'live' ? 'Live' : 'Last seen'}
                            </span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                {format(new Date(selectedUser.recorded_at), 'h:mm a')}
                            </span>
                        </div>

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
