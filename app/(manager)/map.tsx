import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ArrowLeft, LogOut, RefreshCw, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function LiveMapScreen() {
    const { session, signOut } = useAuth();
    const router = useRouter();

    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadTeamLocations();

        // Polling for updates every 1 minute
        const interval = setInterval(loadTeamLocations, 60000);
        return () => clearInterval(interval);
    }, []);

    const loadTeamLocations = async () => {
        if (!session?.user) return;
        if (!refreshing) setRefreshing(true);

        try {
            // 1. Get managed teams
            const { data: managedTeams } = await supabase
                .from('teams')
                .select('id')
                .eq('manager_id', session.user.id);

            const teamIds = managedTeams?.map(t => t.id) || [];
            if (teamIds.length === 0) {
                setLocations([]);
                return;
            }

            // 2. Get members of those teams
            const { data: teamMembers } = await supabase
                .from('team_members')
                .select('user_id, profiles:user_id(full_name)')
                .in('team_id', teamIds);

            const userIds = teamMembers?.map(m => m.user_id) || [];
            if (userIds.length === 0) {
                setLocations([]);
                return;
            }

            // 3. Get latest location for each user from location_logs
            // Since we can't easily do a "group by" latest in one simple PostgREST call with RLS,
            // we'll fetch logs from the last 15 minutes for these users.
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();

            const { data: logs, error } = await supabase
                .from('location_logs')
                .select('user_id, latitude, longitude, recorded_at')
                .in('user_id', userIds)
                .gte('recorded_at', fifteenMinsAgo)
                .order('recorded_at', { ascending: false });

            if (error) throw error;

            // 4. Map back to user names (taking only the latest for each)
            const latestLocations: any[] = [];
            const processedUsers = new Set();

            logs?.forEach(log => {
                if (!processedUsers.has(log.user_id)) {
                    processedUsers.add(log.user_id);
                    const profile = teamMembers.find(m => m.user_id === log.user_id)?.profiles;
                    latestLocations.push({
                        ...log,
                        full_name: profile?.full_name || 'Unknown'
                    });
                }
            });

            setLocations(latestLocations);
        } catch (error) {
            console.error('Error loading map locations:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout', style: 'destructive', onPress: async () => {
                    await signOut();
                    router.replace('/auth/login');
                }
            }
        ]);
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-black">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    // Default center (can be improved by averaging locations)
    const initialRegion = locations.length > 0
        ? {
            latitude: locations[0].latitude,
            longitude: locations[0].longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        }
        : {
            latitude: 28.6139, // Default to New Delhi if no data
            longitude: 77.2090,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
        };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black z-10">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900"
                >
                    <ArrowLeft size={20} color="#111827" />
                </TouchableOpacity>
                <View className="items-center">
                    <Text className="text-xl font-bold text-gray-900 dark:text-white">Live Team Map</Text>
                    <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        {locations.length} Members Online
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={handleLogout}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900"
                >
                    <LogOut size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <View className="flex-1">
                <MapView
                    provider={PROVIDER_DEFAULT}
                    style={styles.map}
                    initialRegion={initialRegion}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                >
                    {locations.map((loc, index) => (
                        <Marker
                            key={`${loc.user_id}-${index}`}
                            coordinate={{
                                latitude: loc.latitude,
                                longitude: loc.longitude,
                            }}
                            title={loc.full_name}
                            description={`Last seen: ${new Date(loc.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        >
                            <View className="bg-blue-600 p-2 rounded-full border-2 border-white">
                                <User size={16} color="white" />
                            </View>
                            <Callout>
                                <View className="p-2 min-w-[120px]">
                                    <Text className="font-bold text-gray-900">{loc.full_name}</Text>
                                    <Text className="text-xs text-gray-500 mt-1">
                                        Updated: {new Date(loc.recorded_at).toLocaleTimeString()}
                                    </Text>
                                </View>
                            </Callout>
                        </Marker>
                    ))}
                </MapView>

                {/* Legend / Refresh Info */}
                <TouchableOpacity
                    onPress={loadTeamLocations}
                    disabled={refreshing}
                    className="absolute bottom-10 right-6 bg-white dark:bg-gray-900 p-4 rounded-full shadow-lg border border-gray-100 dark:border-gray-800"
                >
                    {refreshing ? (
                        <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                        <RefreshCw size={24} color="#2563EB" />
                    )}
                </TouchableOpacity>

                {locations.length === 0 && (
                    <View className="absolute top-1/2 left-0 right-0 items-center">
                        <View className="bg-white/90 dark:bg-black/90 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <Text className="text-gray-900 dark:text-white font-medium">No team members are currently online</Text>
                            <Text className="text-gray-500 dark:text-gray-400 text-xs text-center mt-1">Check back later or check the team list</Text>
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    map: {
        width: width,
        height: height - 150, // Approximate header + padding
    },
});
