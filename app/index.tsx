import { ActionCard } from '@/components/ActionCard';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { History as HistoryIcon, LogOut } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const { session, loading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // Attendance State
    const [attendance, setAttendance] = useState<any>(null);
    const [loadingAttendance, setLoadingAttendance] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Timer State
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
    const timerRef = useRef<any>(null);

    // Location Tracking
    const { isTracking, startTracking, stopTracking, checkStatus } = useLocationTracking();

    useEffect(() => {
        // Only load data after session is confirmed (loading is false) and session exists
        if (!loading && session?.user) {
            loadProfile();
            checkAttendance();
        } else if (!loading && !session) {
            // Session confirmed but no user - reset state
            setProfile(null);
            setAttendance(null);
            setLoadingProfile(false);
            setLoadingAttendance(false);
        }
    }, [session, loading]);

    // Role-based redirection for managers
    useEffect(() => {
        if (profile?.role === 'manager') {
            console.log('➡️ Manager detected on staff home, redirecting to MANAGER dashboard');
            router.replace('/(manager)');
        }
    }, [profile]);

    // Timer Effect
    useEffect(() => {
        if (attendance?.check_in_time && !attendance.check_out_time) {
            const startTime = new Date(attendance.check_in_time).getTime();

            const updateTimer = () => {
                const now = new Date().getTime();
                const diff = now - startTime;

                const seconds = Math.floor((diff / 1000) % 60);
                const minutes = Math.floor((diff / (1000 * 60)) % 60);
                const hours = Math.floor((diff / (1000 * 60 * 60)));

                setElapsedTime(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            };

            // Initial call
            updateTimer();

            // Setup interval
            timerRef.current = setInterval(updateTimer, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [attendance]);

    // Check and resume tracking if user is checked in
    useEffect(() => {
        if (attendance?.check_in_time && !attendance.check_out_time) {
            // User is checked in, ensure tracking is active
            checkStatus().then(async () => {
                if (!isTracking) {
                    // Only start tracking if app is in foreground (Android restriction)
                    const appState = AppState.currentState;
                    if (appState === 'active') {
                        console.log('User is checked in but tracking is not active, resuming...');
                        await startTracking();
                    } else {
                        console.log('App is in background, will resume tracking when app becomes active');
                    }
                }
            });
        }
    }, [attendance, isTracking]);

    // Resume tracking when app comes to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active' && attendance?.check_in_time && !attendance.check_out_time) {
                // App came to foreground and user is checked in
                const trackingActive = await checkStatus();
                if (!trackingActive) {
                    console.log('App became active, resuming tracking...');
                    await startTracking();
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [attendance]);

    const loadProfile = async () => {
        // Double check session is confirmed and user exists
        if (!session?.user || loading) {
            setLoadingProfile(false);
            return;
        }

        setLoadingProfile(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

            if (error) {
                console.error('Error loading profile:', error);
                setProfile(null);
                return;
            }

            if (!data) {
                // Profile doesn't exist - try to create it from auth user data
                console.log('Profile not found, creating from auth data...');
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert({
                        id: session.user.id,
                        full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                        email: session.user.email || null,
                        role: session.user.user_metadata?.role || 'staff',
                        is_active: true,
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error('Error creating profile:', createError);
                    setProfile(null);
                } else {
                    setProfile(newProfile);
                }
            } else {
                setProfile(data);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            setProfile(null);
        } finally {
            setLoadingProfile(false);
        }
    };

    const checkAttendance = async () => {
        if (!session?.user) return;

        setLoadingAttendance(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('attendance_date', today)
                .maybeSingle();

            if (error) throw error;
            setAttendance(data);
        } catch (error) {
            console.error('Error checking attendance:', error);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const getLocation = async () => {
        try {
            // Check if location services are enabled
            const isEnabled = await Location.hasServicesEnabledAsync();
            if (!isEnabled) {
                Alert.alert(
                    'Location Services Disabled',
                    'Please enable location services in your device settings to check in.',
                    [{ text: 'OK' }]
                );
                return null;
            }

            // Request foreground permissions
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Location permission is required to check in. Please grant location access in app settings.',
                    [{ text: 'OK' }]
                );
                return null;
            }

            // Get current location
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 0,
            });

            const { latitude, longitude } = location.coords;

            // Reverse geocode to get address details (India only - no country field needed)
            let address = {
                city: null as string | null,
                state: null as string | null,
                pincode: null as string | null,
                fullAddress: null as string | null,
            };

            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude,
                    longitude,
                });

                if (reverseGeocode && reverseGeocode.length > 0) {
                    const geo = reverseGeocode[0];
                    address = {
                        city: geo.city || geo.subregion || null,
                        state: geo.region || null,
                        pincode: geo.postalCode || null,
                        fullAddress: [
                            geo.streetNumber,
                            geo.street,
                            geo.district,
                            geo.city || geo.subregion,
                            geo.region,
                            geo.postalCode,
                        ]
                            .filter(Boolean)
                            .join(', ') || null,
                    };
                    console.log('📍 Reverse geocoded address:', address);
                }
            } catch (geoError) {
                console.warn('Reverse geocoding failed:', geoError);
                // Continue without address - lat/lng is more important
            }

            return {
                lat: latitude,
                lng: longitude,
                ...address,
            };
        } catch (error: any) {
            console.error('Location error:', error);
        }
    };

    const handleCheckIn = async () => {
        setActionLoading(true);
        try {
            const location = await getLocation();
            if (!location) {
                setActionLoading(false);
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('attendance')
                .insert({
                    user_id: session?.user.id,
                    attendance_date: today,
                    check_in_time: new Date().toISOString(),
                    check_in_lat: location.lat,
                    check_in_lng: location.lng,
                    check_in_city: location.city,
                    check_in_state: location.state,
                    check_in_pincode: location.pincode,
                    check_in_address: location.fullAddress,
                    status: 'present',
                })
                .select()
                .single();

            if (error) throw error;

            setAttendance(data);

            // Start location tracking
            const trackingStarted = await startTracking();
            if (!trackingStarted) {
                console.warn('Failed to start location tracking');
                Alert.alert(
                    'Warning',
                    'Check-in successful, but location tracking could not be started. Please check location permissions.'
                );
            }

            // Show success with location info
            const locationInfo = location.city && location.state
                ? `\n📍 ${location.city}, ${location.state}`
                : '';
            const trackingInfo = trackingStarted ? '\n\n🔄 Location tracking started' : '';
            Alert.alert('Success', `You have checked in successfully!${locationInfo}${trackingInfo}`);
        } catch (error: any) {
            console.error('Check-in error:', error);
            Alert.alert('Error', error.message || 'Failed to check in');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        try {
            const location = await getLocation();
            if (!location) {
                setActionLoading(false);
                return;
            }

            // Calculate total minutes if possible (simple diff)
            // This is a rough calculation, triggers/functions are better for this but we do it here for immediate feedback
            let totalMinutes = 0;
            if (attendance?.check_in_time) {
                const start = new Date(attendance.check_in_time);
                const end = new Date();
                const diffMs = end.getTime() - start.getTime();
                totalMinutes = Math.round(diffMs / 60000);
            }

            const { data, error } = await supabase
                .from('attendance')
                .update({
                    check_out_time: new Date().toISOString(),
                    check_out_lat: location.lat,
                    check_out_lng: location.lng,
                    check_out_city: location.city,
                    check_out_state: location.state,
                    check_out_pincode: location.pincode,
                    check_out_address: location.fullAddress,
                    total_minutes: totalMinutes,
                })
                .eq('id', attendance.id)
                .select()
                .single();

            if (error) throw error;

            setAttendance(data);

            // Stop location tracking
            const trackingStopped = await stopTracking();
            if (!trackingStopped) {
                console.warn('Failed to stop location tracking');
            }

            // Show success with location info
            const locationInfo = location.city && location.state
                ? `\n📍 ${location.city}, ${location.state}`
                : '';
            const trackingInfo = trackingStopped ? '\n\n⏹️ Location tracking stopped' : '';
            Alert.alert('Success', `You have checked out successfully!${locationInfo}${trackingInfo}`);
        } catch (error: any) {
            console.error('Check-out error:', error);
            Alert.alert('Error', error.message || 'Failed to check out');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await supabase.auth.signOut();
                        router.replace('/auth/login');
                    }
                }
            ]
        );
    };

    if (loading || loadingProfile || loadingAttendance) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-black">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // Determine current status
    const isCheckedIn = !!attendance?.check_in_time;

    const renderAttendanceSection = () => {
        if (!attendance) {
            return (
                <ActionCard
                    title="Check In"
                    subtitle="Start your work shift"
                    icon="log-in"
                    color="#10B981" // Green
                    onPress={handleCheckIn}
                    loading={actionLoading}
                />
            );
        }

        const isCheckedOut = !!attendance.check_out_time;

        if (!isCheckedOut) {
            return (
                <View className="gap-4">
                    <View className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                        <Text className="text-green-800 dark:text-green-300 font-medium mb-2">
                            Checked in at {new Date(attendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>

                        {/* Show check-in location */}
                        {(attendance.check_in_city || attendance.check_in_address) && (
                            <Text className="text-green-700 dark:text-green-400 text-xs mb-2">
                                📍 {attendance.check_in_city && attendance.check_in_state
                                    ? `${attendance.check_in_city}, ${attendance.check_in_state}${attendance.check_in_pincode ? ` - ${attendance.check_in_pincode}` : ''}`
                                    : attendance.check_in_address}
                            </Text>
                        )}

                        {/* Location tracking status */}
                        {isTracking && (
                            <View className="flex-row items-center mb-2 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                                <Text className="text-blue-600 dark:text-blue-400 text-xs font-medium">🔄 Location Tracking Active</Text>
                            </View>
                        )}

                        <View className="flex-row items-center justify-center py-4 bg-white/50 dark:bg-black/20 rounded mb-2">
                            <Text className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                                {elapsedTime}
                            </Text>
                            <Text className="text-xs text-gray-500 dark:text-gray-400 ml-2 mt-2">HRS</Text>
                        </View>
                    </View>

                    <ActionCard
                        title="Check Out"
                        subtitle="End your work shift"
                        icon="log-out"
                        color="#EF4444" // Red
                        onPress={handleCheckOut}
                        loading={actionLoading}
                    />
                </View>
            );
        }

        return (
            <View className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-100 dark:border-gray-700">
                <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 items-center justify-center mr-3">
                        <Text className="text-green-600 dark:text-green-400 font-bold">✓</Text>
                    </View>
                    <View>
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">Shift Completed</Text>
                        <Text className="text-gray-500 dark:text-gray-400">Great job today!</Text>
                    </View>
                </View>

                <View className="flex-row justify-between border-t border-gray-200 dark:border-gray-600 pt-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs text-gray-400 uppercase font-bold">Check In</Text>
                        <Text className="text-gray-900 dark:text-white font-medium">
                            {new Date(attendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {attendance.check_in_city && (
                            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                📍 {attendance.check_in_city}
                            </Text>
                        )}
                    </View>
                    <View className="items-end flex-1 ml-2">
                        <Text className="text-xs text-gray-400 uppercase font-bold">Check Out</Text>
                        <Text className="text-gray-900 dark:text-white font-medium">
                            {new Date(attendance.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {attendance.check_out_city && (
                            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                📍 {attendance.check_out_city}
                            </Text>
                        )}
                    </View>
                </View>
                {(attendance.total_minutes !== null && attendance.total_minutes !== undefined) && (
                    <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 items-center">
                        <Text className="text-gray-500 dark:text-gray-400">
                            Total Duration: <Text className="font-bold text-gray-900 dark:text-white">
                                {Math.floor(attendance.total_minutes / 60)}h {attendance.total_minutes % 60}m
                            </Text>
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
            {/* Header with History Icon - Standardized height and padding */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-transparent">
                <TouchableOpacity
                    onPress={() => router.push('/profile')}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
                >
                    <Text className="text-base font-bold text-gray-600 dark:text-gray-300">
                        {profile?.full_name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        onPress={() => router.push('/history')}
                        className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
                    >
                        <HistoryIcon size={24} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
                    >
                        <LogOut size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                <View className="flex-1 justify-center items-center mb-8 mt-4">
                    <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                        Welcome, {profile?.full_name?.split(' ')[0] || 'User'}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </Text>
                </View>

                {/* Action Section */}
                <View className="mb-8">
                    <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        Today's Attendance
                    </Text>

                    {renderAttendanceSection()}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
