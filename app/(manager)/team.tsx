import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, LogOut, Search, Trash2, User, UserPlus, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TeamManagementScreen() {
    const { session, signOut } = useAuth();
    const router = useRouter();

    // State
    const [allStaff, setAllStaff] = useState<any[]>([]);
    const [myTeamMembers, setMyTeamMembers] = useState<string[]>([]);
    const [managedTeam, setManagedTeam] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Team Creation State
    const [newTeamName, setNewTeamName] = useState('');
    const [creatingTeam, setCreatingTeam] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        if (!session?.user) return;
        setLoading(true);
        try {
            // 1. Get manager's team
            const { data: teams } = await supabase
                .from('teams')
                .select('*')
                .eq('manager_id', session.user.id)
                .eq('is_active', true)
                .limit(1);

            const team = teams && teams.length > 0 ? teams[0] : null;
            setManagedTeam(team);

            // 2. Get all staff profiles
            const { data: staff } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('role', 'staff')
                .eq('is_active', true);
            setAllStaff(staff || []);

            // 3. Get my team members
            if (team) {
                const { data: members } = await supabase
                    .from('team_members')
                    .select('user_id')
                    .eq('team_id', team.id);
                setMyTeamMembers(members?.map(m => m.user_id) || []);
            } else {
                setMyTeamMembers([]);
            }

        } catch (error) {
            console.error('Error loading management data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) {
            Alert.alert('Error', 'Please enter a team name');
            return;
        }
        setCreatingTeam(true);
        try {
            const { data, error } = await supabase
                .from('teams')
                .insert({
                    name: newTeamName.trim(),
                    manager_id: session?.user.id
                })
                .select()
                .single();

            if (error) throw error;
            setManagedTeam(data);
            Alert.alert('Success', 'Team created! Now you can recruit staff.');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not create team');
        } finally {
            setCreatingTeam(false);
        }
    };

    const handleRecruit = async (staffId: string) => {
        if (!managedTeam) return;
        setActionLoadingId(staffId);
        try {
            const { error } = await supabase
                .from('team_members')
                .insert({
                    team_id: managedTeam.id,
                    user_id: staffId
                });

            if (error) throw error;
            setMyTeamMembers(prev => [...prev, staffId]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not add member');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRemove = async (staffId: string) => {
        if (!managedTeam) return;
        setActionLoadingId(staffId);
        try {
            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('team_id', managedTeam.id)
                .eq('user_id', staffId);

            if (error) throw error;
            setMyTeamMembers(prev => prev.filter(id => id !== staffId));
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not remove member');
        } finally {
            setActionLoadingId(null);
        }
    };

    const filteredStaff = allStaff.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    const renderStaffItem = ({ item }: { item: any }) => {
        const isMember = myTeamMembers.includes(item.id);
        const isLoading = actionLoadingId === item.id;

        return (
            <View className="flex-row items-center bg-white dark:bg-gray-900 p-4 rounded-2xl mb-3 border border-gray-100 dark:border-gray-800">
                <TouchableOpacity
                    onPress={() => router.push(`/(manager)/member/${item.id}`)}
                    className="flex-1 flex-row items-center"
                >
                    <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3">
                        <User size={20} color="#9CA3AF" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-bold text-gray-900 dark:text-white" numberOfLines={1}>{item.full_name}</Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-[10px]" numberOfLines={1}>{item.email}</Text>
                    </View>
                </TouchableOpacity>

                {isMember ? (
                    <TouchableOpacity
                        onPress={() => handleRemove(item.id)}
                        disabled={isLoading}
                        className="px-3 py-2 rounded-full bg-red-50 dark:bg-red-900/20 flex-row items-center"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                            <>
                                <Trash2 size={14} color="#EF4444" className="mr-1" />
                                <Text className="text-red-600 font-bold text-[10px] uppercase">Remove</Text>
                            </>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={() => handleRecruit(item.id)}
                        disabled={isLoading || !managedTeam}
                        className={`px-3 py-2 rounded-full ${managedTeam ? 'bg-blue-600' : 'bg-gray-300'} flex-row items-center`}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <UserPlus size={14} color="white" className="mr-1" />
                                <Text className="text-white font-bold text-[10px] uppercase">Recruit</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

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
                <View className="items-center">
                    <Text className="text-xl font-bold text-gray-900 dark:text-white">Manage Team</Text>
                    {managedTeam && (
                        <Text className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">
                            {managedTeam.name} • {myTeamMembers.length} Members
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    onPress={handleLogout}
                    className="w-10 h-10 items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                    <LogOut size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : (
                <View className="flex-1">
                    {/* Team Creation UI (if no team) */}
                    {!managedTeam && (
                        <View className="mx-6 mb-6 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800">
                            <View className="flex-row items-center mb-4">
                                <Users size={24} color="#2563EB" className="mr-3" />
                                <Text className="text-lg font-bold text-gray-900 dark:text-white">Setup Your Team</Text>
                            </View>
                            <Text className="text-gray-500 dark:text-gray-400 text-xs mb-4">You need to create a team before you can recruit staff members.</Text>
                            <View className="flex-row gap-2">
                                <TextInput
                                    placeholder="Enter Team Name (e.g. Sales Team)"
                                    placeholderTextColor="#9CA3AF"
                                    value={newTeamName}
                                    onChangeText={setNewTeamName}
                                    className="flex-1 bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                />
                                <TouchableOpacity
                                    onPress={handleCreateTeam}
                                    disabled={creatingTeam}
                                    className="bg-blue-600 px-6 items-center justify-center rounded-2xl"
                                >
                                    {creatingTeam ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Create</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Search & List */}
                    <View className="flex-1">
                        <View className="px-6 mb-4">
                            <View className="flex-row items-center bg-white dark:bg-gray-900 px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <Search size={20} color="#9CA3AF" className="mr-3" />
                                <TextInput
                                    placeholder="Search all employees..."
                                    placeholderTextColor="#9CA3AF"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    className="flex-1 text-gray-900 dark:text-white font-medium"
                                />
                            </View>
                        </View>

                        <FlatList
                            data={filteredStaff}
                            keyExtractor={(item) => item.id}
                            renderItem={renderStaffItem}
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                            ListHeaderComponent={
                                <View className="mb-4">
                                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">Available Staff ({filteredStaff.length})</Text>
                                </View>
                            }
                            ListEmptyComponent={
                                <View className="items-center py-20">
                                    <Text className="text-gray-500 dark:text-gray-400 text-center">No employees found</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}
