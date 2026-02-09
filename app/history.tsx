import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate } from '@/lib/date-utils';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AttendanceRecord {
    id: string;
    user_id: string;
    attendance_date: string;
    check_in_time: string;
    check_in_lat: number;
    check_in_lng: number;
    check_in_city: string | null;
    check_in_state: string | null;
    check_in_pincode: string | null;
    check_in_address: string | null;
    check_out_time: string | null;
    check_out_lat: number | null;
    check_out_lng: number | null;
    check_out_city: string | null;
    check_out_state: string | null;
    check_out_pincode: string | null;
    check_out_address: string | null;
    total_minutes: number | null;
    status: string;
}

interface GroupedRecords {
    today: AttendanceRecord[];
    yesterday: AttendanceRecord[];
    pastDays: AttendanceRecord[];
}

export default function AttendanceHistoryScreen() {
    const { session, loading: authLoading } = useAuth();
    const router = useRouter();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!authLoading && session?.user) {
            fetchAttendanceHistory();
        } else if (!authLoading && !session) {
            setRecords([]);
            setLoading(false);
        }
    }, [session, authLoading]);

    const fetchAttendanceHistory = async () => {
        if (!session?.user) return;

        try {
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', session.user.id)
                .order('attendance_date', { ascending: false })
                .limit(30); // Limit to last 30 records

            if (error) throw error;
            setRecords(data || []);
        } catch (error) {
            console.error('Error fetching attendance history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAttendanceHistory();
    };

    const groupRecordsByDate = (): GroupedRecords => {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        return records.reduce(
            (acc, record) => {
                if (record.attendance_date === today) {
                    acc.today.push(record);
                } else if (record.attendance_date === yesterday) {
                    acc.yesterday.push(record);
                } else {
                    acc.pastDays.push(record);
                }
                return acc;
            },
            { today: [], yesterday: [], pastDays: [] } as GroupedRecords
        );
    };

    const formatDate = (dateString: string) => formatDisplayDate(dateString);

    const formatTime = (timeString: string) => {
        const date = new Date(timeString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (minutes: number | null) => {
        if (minutes === null || minutes === undefined) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const renderAttendanceCard = (record: AttendanceRecord) => {
        const isComplete = !!record.check_out_time;

        return (
            <View
                key={record.id}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-3"
            >
                {/* Date Header */}
                <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                    {formatDate(record.attendance_date)}
                </Text>

                {/* Check-in Section */}
                <View className="mb-3">
                    <View className="flex-row items-center mb-1">
                        <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                        <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
                            Check In
                        </Text>
                    </View>
                    <Text className="text-gray-900 dark:text-white font-medium ml-4">
                        {formatTime(record.check_in_time)}
                    </Text>
                    {(record.check_in_city || record.check_in_address) && (
                        <Text className="text-xs text-gray-500 dark:text-gray-400 ml-4 mt-1">
                            📍{' '}
                            {record.check_in_city && record.check_in_state
                                ? `${record.check_in_city}, ${record.check_in_state}${record.check_in_pincode ? ` - ${record.check_in_pincode}` : ''}`
                                : record.check_in_address}
                        </Text>
                    )}
                </View>

                {/* Check-out Section */}
                {isComplete ? (
                    <View className="mb-3">
                        <View className="flex-row items-center mb-1">
                            <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                            <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">
                                Check Out
                            </Text>
                        </View>
                        <Text className="text-gray-900 dark:text-white font-medium ml-4">
                            {formatTime(record.check_out_time!)}
                        </Text>
                        {(record.check_out_city || record.check_out_address) && (
                            <Text className="text-xs text-gray-500 dark:text-gray-400 ml-4 mt-1">
                                📍{' '}
                                {record.check_out_city && record.check_out_state
                                    ? `${record.check_out_city}, ${record.check_out_state}${record.check_out_pincode ? ` - ${record.check_out_pincode}` : ''}`
                                    : record.check_out_address}
                            </Text>
                        )}
                    </View>
                ) : (
                    <View className="mb-3">
                        <View className="flex-row items-center mb-1">
                            <View className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                            <Text className="text-xs text-yellow-600 dark:text-yellow-400 uppercase font-bold">
                                In Progress
                            </Text>
                        </View>
                        <Text className="text-gray-500 dark:text-gray-400 ml-4 italic">
                            Not checked out yet
                        </Text>
                    </View>
                )}

                {/* Total Duration */}
                {isComplete && (
                    <View className="pt-3 border-t border-gray-200 dark:border-gray-600">
                        <Text className="text-center text-gray-600 dark:text-gray-400">
                            Total Duration:{' '}
                            <Text className="font-bold text-gray-900 dark:text-white">
                                {formatDuration(record.total_minutes)}
                            </Text>
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    const renderSection = (title: string, sectionRecords: AttendanceRecord[]) => {
        if (sectionRecords.length === 0) return null;

        return (
            <View className="mb-6">
                <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 px-1">
                    {title}
                </Text>
                {sectionRecords.map(renderAttendanceCard)}
            </View>
        );
    };

    if (authLoading || loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-black">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    const groupedRecords = groupRecordsByDate();
    const hasRecords = records.length > 0;

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
            {/* Header with Back Button */}
            <View className="flex-row items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 mr-3"
                >
                    <ChevronLeft size={24} color="#6B7280" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                        Attendance History
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm">
                        Your past attendance records
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {!hasRecords ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="text-6xl mb-4">📅</Text>
                        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            No Attendance Records
                        </Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-center">
                            Your attendance history will appear here once you start checking in.
                        </Text>
                    </View>
                ) : (
                    <>
                        {renderSection('Today', groupedRecords.today)}
                        {renderSection('Yesterday', groupedRecords.yesterday)}
                        {renderSection('Past Days', groupedRecords.pastDays)}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
