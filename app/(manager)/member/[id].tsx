import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Info, LogOut, MapPin, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MemberDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { signOut } = useAuth();

    const [member, setMember] = useState<any>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [locationLogs, setLocationLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'attendance' | 'location'>('attendance');

    useEffect(() => {
        loadMemberData();
    }, [id]);

    const loadMemberData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // 1. Load Member Profile
            const { data: profile, error: profError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();
            if (profError) throw profError;
            setMember(profile);

            // 2. Load Recent Attendance (Last 7 days)
            const { data: attData } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', id)
                .order('attendance_date', { ascending: false })
                .limit(7);
            setAttendance(attData || []);

            // 3. Load Today's Location Logs for the location tab
            const today = new Date().toISOString().split('T')[0];
            const { data: logs } = await supabase
                .from('location_logs')
                .select('*')
                .eq('user_id', id)
                .gte('recorded_at', today)
                .order('recorded_at', { ascending: false });
            setLocationLogs(logs || []);

        } catch (error) {
            console.error('Error loading member data:', error);
            Alert.alert('Error', 'Could not load member details');
        } finally {
            setLoading(false);
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

    const renderAttendanceItem = ({ item }: { item: any }) => (
        <View className="bg-white dark:bg-gray-900 p-4 rounded-2xl mb-3 border border-gray-100 dark:border-gray-800">
            <View className="flex-row justify-between items-center mb-2">
                <Text className="font-bold text-gray-900 dark:text-white">
                    {new Date(item.attendance_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <View className="px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded">
                    <Text className="text-xs text-green-700 dark:text-green-300 font-bold uppercase">{item.status}</Text>
                </View>
            </View>
            <View className="flex-row justify-between border-t border-gray-50 dark:border-gray-800 pt-3">
                <View>
                    <Text className="text-xs text-gray-400 font-medium mb-1">CHECK IN</Text>
                    <Text className="text-gray-900 dark:text-white font-medium">
                        {item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </Text>
                </View>
                <View className="items-end">
                    <Text className="text-xs text-gray-400 font-medium mb-1">CHECK OUT</Text>
                    <Text className="text-gray-900 dark:text-white font-medium">
                        {item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </Text>
                </View>
            </View>
            {item.total_minutes && (
                <Text className="text-xs text-gray-500 mt-2 text-right">
                    Total Hours: {Math.floor(item.total_minutes / 60)}h {item.total_minutes % 60}m
                </Text>
            )}
        </View>
    );

    const renderLocationItem = ({ item }: { item: any }) => (
        <View className="flex-row mb-4">
            <View className="items-center mr-4">
                <View className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                <View className="w-0.5 h-full bg-blue-100 dark:bg-blue-900/30" />
            </View>
            <View className="flex-1 pb-4">
                <Text className="text-gray-900 dark:text-white font-bold">
                    {new Date(item.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Lat: {item.latitude.toFixed(6)}, Lng: {item.longitude.toFixed(6)}
                </Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-black">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                    <ArrowLeft size={20} color="#111827" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900 dark:text-white">Member Details</Text>
                <TouchableOpacity
                    onPress={handleLogout}
                    className="w-10 h-10 items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                    <LogOut size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Profile Header */}
                <View className="px-6 py-6 items-center">
                    <View className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/50 items-center justify-center mb-4">
                        <User size={48} color="#2563EB" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">{member?.full_name}</Text>
                    <Text className="text-gray-500 dark:text-gray-400">{member?.email || 'No email provided'}</Text>
                    <View className="mt-2 px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">
                        <Text className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">{member?.role}</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View className="flex-row px-6 mb-6">
                    <TouchableOpacity
                        onPress={() => setActiveTab('attendance')}
                        className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'attendance' ? 'border-blue-600' : 'border-transparent'}`}
                    >
                        <View className="flex-row items-center">
                            <Calendar size={18} color={activeTab === 'attendance' ? '#2563EB' : '#9CA3AF'} className="mr-2" />
                            <Text className={`font-bold ${activeTab === 'attendance' ? 'text-blue-600' : 'text-gray-400'}`}>Attendance</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('location')}
                        className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'location' ? 'border-blue-600' : 'border-transparent'}`}
                    >
                        <View className="flex-row items-center">
                            <MapPin size={18} color={activeTab === 'location' ? '#2563EB' : '#9CA3AF'} className="mr-2" />
                            <Text className={`font-bold ${activeTab === 'location' ? 'text-blue-600' : 'text-gray-400'}`}>Location Trail</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View className="px-6">
                    {activeTab === 'attendance' ? (
                        <FlatList
                            data={attendance}
                            keyExtractor={(item) => item.id}
                            renderItem={renderAttendanceItem}
                            scrollEnabled={false}
                            ListEmptyComponent={
                                <View className="items-center py-10 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                                    <Info size={40} color="#D1D5DB" className="mb-2" />
                                    <Text className="text-gray-400">No attendance records found</Text>
                                </View>
                            }
                        />
                    ) : (
                        <View className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-6">Today's Trail</Text>
                            <FlatList
                                data={locationLogs}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderLocationItem}
                                scrollEnabled={false}
                                ListEmptyComponent={
                                    <View className="items-center py-4">
                                        <Text className="text-gray-400 text-center">No location logs for today</Text>
                                        <Text className="text-gray-400 text-center text-xs mt-1">(Tracking only occurs when user is checked in)</Text>
                                    </View>
                                }
                            />
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
