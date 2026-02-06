'use client';

import DashboardLayout from '@/components/DashboardLayout';
import type { LiveLocation } from '@/components/LiveMap';
import { Loader } from '@/components/ui/loader';
import { Map as MapIcon, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center w-full h-[600px] bg-muted/50 rounded-2xl border border-border">
            <Loader size="lg" />
        </div>
    )
});

export default function MapPage() {
    const [locations, setLocations] = useState<LiveLocation[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const handleLocationsUpdated = (next: LiveLocation[]) => {
        setLocations(next);
        setLastUpdated(new Date());
    };

    const handleSelectUser = (userId: string | null) => {
        setSelectedUserId(userId);
    };

    return (
        <DashboardLayout>
            <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-foreground flex items-center">
                        <MapIcon className="mr-3 text-destructive" />
                        Live Team Map
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Current locations from the last 30 minutes. Map zooms to show all active staff.
                    </p>
                </div>

                <div className="flex items-center gap-3">
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

                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                            <Users size={18} className="text-primary" />
                            Live now
                        </h3>
                        {locations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No location data in the last 30 minutes. Check-ins will appear here when staff share location.
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {locations.map((loc) => {
                                    const isSelected = selectedUserId === loc.user_id;
                                    return (
                                        <li key={loc.user_id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedUserId(isSelected ? null : loc.user_id)}
                                                className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border text-left transition-colors ${
                                                    isSelected
                                                        ? 'bg-primary/15 border-primary/40 ring-1 ring-primary/30'
                                                        : 'border-transparent hover:bg-muted/60'
                                                }`}
                                            >
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-primary/20 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                                                    <MapPin size={16} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-foreground truncate">
                                                        {loc.profiles?.full_name ?? 'Unknown'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Last at {format(new Date(loc.recorded_at), 'hh:mm a')}
                                                    </p>
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {lastUpdated && (
                            <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border">
                                Last updated {format(lastUpdated, 'hh:mm:ss a')}
                            </p>
                        )}
                    </div>

                    <div className="bg-muted/50 border border-border rounded-2xl p-4">
                        <p className="text-xs text-muted-foreground leading-5">
                            Select a person in the list to focus the map on their location and see details. Click a red marker on the map to do the same. Select again to clear.
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
