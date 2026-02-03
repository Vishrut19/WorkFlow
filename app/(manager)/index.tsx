import { ActionCard } from '@/components/ActionCard';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { CheckCircle2, Clock, History as HistoryIcon, LogOut, Map as MapIcon, Users } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManagerDashboard() {
    const { session, loading, signOut } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // Attendance State (for Manager themselves)
    const [attendance, setAttendance] = useState<any>(null);
    const [loadingAttendance, setLoadingAttendance] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Team Stats State
    const [stats, setStats] = useState({
        totalMembers: 0,
        currentlyCheckedIn: 0,
        activeTracking: 0,
    });
    const [loadingStats, setLoadingStats] = useState(true);

    // Timer State
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
    const timerRef = useRef<any>(null);

    // Location Tracking
    const { isTracking, startTracking, stopTracking, checkStatus } = useLocationTracking();

    useEffect(() => {
        if (!loading && session?.user) {
            loadProfile();
            checkAttendance();
            loadTeamStats();
        }
    }, [session, loading]);

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
            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [attendance]);

    const loadProfile = async () => {
        if (!session?.user) return;
        setLoadingProfile(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (!error) setProfile(data);
        } catch (error) {
            console.error('Error loading profile:', error);
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

            if (!error) setAttendance(data);
        } catch (error) {
            console.error('Error checking attendance:', error);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const loadTeamStats = async () => {
        if (!session?.user) return;
        setLoadingStats(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Get managed teams
            const { data: managedTeams } = await supabase
                .from('teams')
                .select('id')
                .eq('manager_id', session.user.id);

            const teamIds = managedTeams?.map(t => t.id) || [];

            if (teamIds.length === 0) {
                setStats({ totalMembers: 0, currentlyCheckedIn: 0, activeTracking: 0 });
                return;
            }

            const { data: members } = await supabase
                .from('team_members')
                .select('user_id')
                .in('team_id', teamIds);

            const userIds = members?.map(m => m.user_id) || [];

            if (userIds.length === 0) {
                setStats({ totalMembers: 0, currentlyCheckedIn: 0, activeTracking: 0 });
                return;
            }

            // 2. Count checked in today
            const { count: checkedInCount } = await supabase
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .in('user_id', userIds)
                .eq('attendance_date', today)
                .is('check_out_time', null);

            setStats({
                totalMembers: userIds.length,
                currentlyCheckedIn: checkedInCount || 0,
                activeTracking: checkedInCount || 0, // Simplified: tracking same as checked in
            });

        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoadingStats(false);
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
                        await signOut();
                        router.replace('/auth/login');
                    }
                }
            ]
        );
    };

    const getLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied');
            return null;
        }
        let location = await Location.getCurrentPositionAsync({});
        return { lat: location.coords.latitude, lng: location.coords.longitude };
    };

    const handleCheckIn = async () => {
        setActionLoading(true);
        try {
            const loc = await getLocation();
            if (!loc) return;
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase.from('attendance').insert({
                user_id: session?.user.id,
                attendance_date: today,
                check_in_time: new Date().toISOString(),
                check_in_lat: loc.lat,
                check_in_lng: loc.lng,
                status: 'present',
            }).select().single();
            if (error) throw error;
            setAttendance(data);
            await startTracking();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        try {
            const loc = await getLocation();
            if (!loc) return;
            let totalMinutes = 0;
            if (attendance?.check_in_time) {
                const diffMs = new Date().getTime() - new Date(attendance.check_in_time).getTime();
                totalMinutes = Math.round(diffMs / 60000);
            }
            const { data, error } = await supabase.from('attendance').update({
                check_out_time: new Date().toISOString(),
                check_out_lat: loc.lat,
                check_out_lng: loc.lng,
                total_minutes: totalMinutes,
            }).eq('id', attendance.id).select().single();
            if (error) throw error;
            setAttendance(data);
            await stopTracking();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || loadingProfile || loadingAttendance || loadingStats) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-black">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
            {/* Custom Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <View>
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">Trackora</Text>
                    <Text className="text-xs text-blue-600 font-bold uppercase tracking-widest">Manager Dashboard</Text>
                </View>
                <TouchableOpacity
                    onPress={handleLogout}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
                >
                    <LogOut size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                {/* Manager Welcome */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        Hi, {profile?.full_name?.split(' ')[0] || 'Manager'}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                </View>

                {/* Team Overview Stats */}
                <View className="flex-row gap-4 mb-8">
                    <View className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                        <Users size={20} color="#2563EB" className="mb-2" />
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalMembers}</Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400">Team Members</Text>
                    </View>
                    <View className="flex-1 bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-800">
                        <Clock size={20} color="#10B981" className="mb-2" />
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white">{stats.currentlyCheckedIn}</Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400">Checked In</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <View className="mb-8">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Oversight</Text>
                    <View className="flex-row gap-4">
                        <TouchableOpacity
                            onPress={() => router.push('/(manager)/team')}
                            className="flex-1 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 items-center"
                        >
                            <Users size={24} color="#6B7280" className="mb-2" />
                            <Text className="text-gray-900 dark:text-white font-medium text-center">Manage Team</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/(manager)/map')}
                            className="flex-1 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 items-center"
                        >
                            <MapIcon size={24} color="#6B7280" className="mb-2" />
                            <Text className="text-gray-900 dark:text-white font-medium text-center">Live Map</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* My Attendance Section (Personal Tracking) */}
                <View className="mb-8">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">My Attendance</Text>

                    {!attendance ? (
                        <ActionCard
                            title="Check In"
                            subtitle="Start your manager shift"
                            icon="log-in"
                            color="#10B981"
                            onPress={handleCheckIn}
                            loading={actionLoading}
                        />
                    ) : !attendance.check_out_time ? (
                        <View className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-800">
                            <View className="flex-row justify-between items-center mb-4">
                                <View>
                                    <View className="flex-row items-center mb-1">
                                        <CheckCircle2 size={16} color="#10B981" className="mr-2" />
                                        <Text className="text-green-800 dark:text-green-300 font-bold">ACTIVE SHIFT</Text>
                                    </View>
                                    <Text className="text-gray-500 dark:text-gray-400 text-xs">Started at {new Date(attendance.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{elapsedTime}</Text>
                                </View>
                            </View>
                            <ActionCard
                                title="Check Out"
                                subtitle="End your shift"
                                icon="log-out"
                                color="#EF4444"
                                onPress={handleCheckOut}
                                loading={actionLoading}
                            />
                        </View>
                    ) : (
                        <View className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex-row items-center justify-between">
                            <View>
                                <Text className="text-gray-900 dark:text-white font-bold">Today's Shift Completed</Text>
                                <Text className="text-gray-500 text-xs mt-1">
                                    Duration: {Math.floor(attendance.total_minutes / 60)}h {attendance.total_minutes % 60}m
                                </Text>
                            </View>
                            <HistoryIcon size={20} color="#9CA3AF" />
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
