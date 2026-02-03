import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ChevronLeft, LogOut, Mail, Phone, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
    const { session, loading: authLoading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Form State
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (!authLoading && session?.user) {
            loadProfile();
        } else if (!authLoading && !session) {
            router.replace('/auth/login');
        }
    }, [session, authLoading]);

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session?.user.id)
                .single();

            if (error) throw error;
            setProfile(data);
            setFullName(data.full_name || '');
            setPhone(data.phone || '');
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile details');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) {
            Alert.alert('Error', 'Full name cannot be empty');
            return;
        }

        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName.trim(),
                    phone: phone.trim(),
                })
                .eq('id', session?.user.id);

            if (error) throw error;

            setProfile({ ...profile, full_name: fullName, phone });
            setIsEditing(false);
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error: any) {
            console.error('Update error:', error);
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setUpdating(false);
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

    if (authLoading || loading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-black">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="flex-row items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 mr-3"
                >
                    <ChevronLeft size={24} color="#6B7280" />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">Profile</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                {/* Profile Avatar Placeholder */}
                <View className="items-center mb-8">
                    <View className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mb-4 border-4 border-white dark:border-gray-800 shadow-sm">
                        <Text className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <Text className="text-xl font-bold text-gray-900 dark:text-white">{profile?.full_name}</Text>
                </View>

                {/* Form / Details */}
                <View className="space-y-6">
                    <View>
                        <View className="flex-row items-center mb-2">
                            <User size={18} color="#6B7280" className="mr-2" />
                            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Full Name</Text>
                        </View>
                        {isEditing ? (
                            <TextInput
                                className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Enter full name"
                                placeholderTextColor="#9CA3AF"
                            />
                        ) : (
                            <Text className="text-lg text-gray-900 dark:text-white bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-lg">
                                {profile?.full_name || 'Not set'}
                            </Text>
                        )}
                    </View>

                    <View className="mt-6">
                        <View className="flex-row items-center mb-2">
                            <Phone size={18} color="#6B7280" className="mr-2" />
                            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Phone Number</Text>
                        </View>
                        {isEditing ? (
                            <TextInput
                                className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="Enter phone number"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="phone-pad"
                            />
                        ) : (
                            <Text className="text-lg text-gray-900 dark:text-white bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-lg">
                                {profile?.phone || 'Not set'}
                            </Text>
                        )}
                    </View>

                    <View className="mt-6">
                        <View className="flex-row items-center mb-2">
                            <Mail size={18} color="#6B7280" className="mr-2" />
                            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Email</Text>
                        </View>
                        <Text className="text-lg text-gray-500 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-900/10 p-4 rounded-lg italic">
                            {profile?.email || 'No email linked'}
                        </Text>
                        <Text className="text-[10px] text-gray-400 mt-1 ml-1">Email cannot be changed</Text>
                    </View>
                </View>

                {/* Privacy & Tracking Disclosure */}
                <View className="mt-10 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <Text className="text-blue-800 dark:text-blue-300 font-bold mb-2">Data Privacy & Tracking</Text>
                    <Text className="text-blue-700/80 dark:text-blue-400/80 text-xs leading-5">
                        • Location tracking is only active during your work shift (after check-in).{"\n"}
                        • Tracking automatically stops when you check out.{"\n"}
                        • Data is used solely for attendance and location verification.{"\n"}
                        • This device is bound to your account for security.
                    </Text>
                </View>

                {/* Actions */}
                <View className="mt-10 gap-4">
                    {isEditing ? (
                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => {
                                    setIsEditing(false);
                                    setFullName(profile?.full_name || '');
                                    setPhone(profile?.phone || '');
                                }}
                                className="flex-1 bg-gray-100 dark:bg-gray-800 p-4 rounded-xl items-center"
                                disabled={updating}
                            >
                                <Text className="text-gray-700 dark:text-gray-300 font-bold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleUpdateProfile}
                                className="flex-2 bg-blue-600 p-4 rounded-xl items-center"
                                disabled={updating}
                            >
                                {updating ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-bold px-8">Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setIsEditing(true)}
                            className="bg-blue-600 p-4 rounded-xl items-center shadow-sm"
                        >
                            <Text className="text-white font-bold">Edit Profile</Text>
                        </TouchableOpacity>
                    )}

                    {!isEditing && (
                        <TouchableOpacity
                            onPress={handleLogout}
                            className="flex-row items-center justify-center p-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10"
                        >
                            <LogOut size={20} color="#EF4444" className="mr-2" />
                            <Text className="text-red-600 font-bold ml-2">Logout</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
