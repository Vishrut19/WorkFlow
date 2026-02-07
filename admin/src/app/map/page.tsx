'use client';

import DashboardLayout from '@/components/DashboardLayout';
import type { LiveLocation, LocationStatus } from '@/components/LiveMap';
import { Loader } from '@/components/ui/loader';
import { Clock, Filter, Map as MapIcon, MapPin, Navigation, Search, Users, X, ZoomOut } from 'lucide-react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center w-full h-[600px] bg-muted/50 rounded-2xl border border-border">
            <Loader size="lg" />
        </div>
    )
});

const STATUS_CONFIG: Record<LocationStatus, { label: string; dotClass: string }> = {
    live: { label: 'Live', dotClass: 'bg-emerald-500' },
    lastSeen: { label: 'Last Seen', dotClass: 'bg-amber-400' },
    offline: { label: 'Offline', dotClass: 'bg-gray-400' },
};

export default function MapPage() {
    const [locations, setLocations] = useState<LiveLocation[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<Set<LocationStatus>>(new Set(['live', 'lastSeen', 'offline']));
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const handleLocationsUpdated = useCallback((next: LiveLocation[]) => {
        setLocations(next);
        setLastUpdated(new Date());
    }, []);

    const handleSelectUser = useCallback((userId: string | null) => {
        setSelectedUserId(userId);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        if (!filterOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [filterOpen]);

    const toggleFilter = (status: LocationStatus) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(status)) {
                // Don't allow deselecting all
                if (next.size > 1) next.delete(status);
            } else {
                next.add(status);
            }
            return next;
        });
    };

    const selectedLocation = useMemo(
        () => (selectedUserId ? locations.find((l) => l.user_id === selectedUserId) : undefined),
        [locations, selectedUserId]
    );

    const filteredLocations = useMemo(() => {
        let result = locations.filter(l => activeFilters.has(l.status));
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(loc =>
                (loc.profiles?.full_name ?? '').toLowerCase().includes(q) ||
                (loc.placeName ?? '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [locations, searchQuery, activeFilters]);

    const allFiltersActive = activeFilters.size === 3;

    // Status counts
    const counts = useMemo(() => {
        const c = { live: 0, lastSeen: 0, offline: 0 };
        locations.forEach(l => c[l.status]++);
        return c;
    }, [locations]);

    return (
        <DashboardLayout>
            <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-foreground flex items-center">
                        <MapIcon className="mr-3 text-destructive" />
                        Live Team Map
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Today&apos;s locations for all checked-in staff. Click on a staff member to zoom in.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {selectedUserId && (
                        <button
                            type="button"
                            onClick={() => setSelectedUserId(null)}
                            className="bg-primary/10 border border-primary/30 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-primary/20 transition-colors"
                        >
                            <ZoomOut size={14} className="text-primary" />
                            <span className="text-xs font-bold text-primary uppercase tracking-widest">
                                Show All
                            </span>
                        </button>
                    )}
                    <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                            Live · Updates every 60s
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 h-[600px]">
                    <LiveMap
                        onLocationsUpdated={handleLocationsUpdated}
                        selectedUserId={selectedUserId}
                        onSelectUser={handleSelectUser}
                    />
                </div>

                <div className="space-y-4">
                    {/* Selected User Detail Card */}
                    {selectedLocation && selectedLocation.status !== 'offline' && (
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                                    <Navigation size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-foreground truncate text-base">
                                        {selectedLocation.profiles?.full_name ?? 'Unknown'}
                                    </p>
                                    <p className={`text-xs font-semibold uppercase tracking-wider ${selectedLocation.status === 'lastSeen' ? 'text-amber-600' : 'text-primary'}`}>
                                        {selectedLocation.status === 'live' ? 'Live Location' : 'Last Known Location'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock size={14} className="text-muted-foreground shrink-0" />
                                    <span className="text-muted-foreground">Last seen:</span>
                                    <span className="font-medium text-foreground">
                                        {format(new Date(selectedLocation.recorded_at), 'hh:mm a')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin size={14} className="text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground">
                                        {selectedLocation.placeName || 'Loading location...'}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedUserId(null)}
                                className="mt-4 w-full text-center text-xs font-medium text-primary hover:text-primary/80 transition-colors py-2 border border-primary/20 rounded-lg hover:bg-primary/5"
                            >
                                Back to overview
                            </button>
                        </div>
                    )}

                    {/* Staff List Card */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="px-5 pt-5 pb-3">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-foreground flex items-center gap-2 text-sm">
                                    <Users size={16} className="text-primary" />
                                    Team
                                    <span className="text-xs font-normal text-muted-foreground">
                                        ({locations.length})
                                    </span>
                                </h3>
                                {lastUpdated && (
                                    <span className="text-[10px] text-muted-foreground">
                                        {format(lastUpdated, 'h:mm a')}
                                    </span>
                                )}
                            </div>

                            {/* Search + Filter row */}
                            {locations.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search..."
                                            className="w-full pl-8 pr-7 py-1.5 text-sm rounded-lg border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Filter button */}
                                    <div ref={filterRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setFilterOpen(prev => !prev)}
                                            className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                                                filterOpen || !allFiltersActive
                                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                                    : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <Filter size={14} />
                                            {!allFiltersActive && (
                                                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                                                    {activeFilters.size}
                                                </span>
                                            )}
                                        </button>

                                        {/* Filter dropdown */}
                                        {filterOpen && (
                                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-popover border border-border rounded-xl shadow-lg z-50 py-1.5">
                                                {(Object.keys(STATUS_CONFIG) as LocationStatus[]).map((status) => {
                                                    const cfg = STATUS_CONFIG[status];
                                                    const active = activeFilters.has(status);
                                                    return (
                                                        <button
                                                            key={status}
                                                            type="button"
                                                            onClick={() => toggleFilter(status)}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                                                        >
                                                            <span className={`flex items-center justify-center w-4 h-4 rounded border ${
                                                                active
                                                                    ? 'border-primary bg-primary'
                                                                    : 'border-muted-foreground/40 bg-transparent'
                                                            }`}>
                                                                {active && (
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                )}
                                                            </span>
                                                            <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
                                                            <span className="text-foreground">{cfg.label}</span>
                                                            <span className="ml-auto text-xs text-muted-foreground">{counts[status]}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* List */}
                        <div className="px-3 pb-3">
                            {locations.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-2 pb-2">
                                    No staff on duty today yet.
                                </p>
                            ) : filteredLocations.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    No results found
                                </p>
                            ) : (
                                <ul className="space-y-0.5 max-h-[420px] overflow-y-auto">
                                    {filteredLocations.map((loc) => {
                                        const isSelected = selectedUserId === loc.user_id;
                                        const isOffline = loc.status === 'offline';
                                        const cfg = STATUS_CONFIG[loc.status];

                                        return (
                                            <li key={loc.user_id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (isOffline) return;
                                                        setSelectedUserId(isSelected ? null : loc.user_id);
                                                    }}
                                                    className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left transition-colors ${
                                                        isOffline
                                                            ? 'cursor-default opacity-60'
                                                            : isSelected
                                                                ? 'bg-primary/10 ring-1 ring-primary/30'
                                                                : 'hover:bg-muted/60'
                                                    }`}
                                                >
                                                    {/* Status dot */}
                                                    <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dotClass}`} />

                                                    {/* Name + subtitle */}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-foreground truncate leading-tight">
                                                            {loc.profiles?.full_name ?? 'Unknown'}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                                            {isOffline
                                                                ? `Checked in ${format(new Date(loc.check_in_time || loc.recorded_at), 'h:mm a')}`
                                                                : `${loc.status === 'live' ? 'Live' : 'Last seen'} at ${format(new Date(loc.recorded_at), 'h:mm a')}`
                                                            }
                                                        </p>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
