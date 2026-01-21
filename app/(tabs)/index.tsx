import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (session?.user) {
      loadProfile();
    }
  }, [session]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session?.user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/auth/login');
  };

  if (loading || loadingProfile) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-black p-6">
      <View className="flex-1 justify-center items-center">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to Trackora
        </Text>

        {profile && (
          <View className="mt-6 bg-gray-100 dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Profile
            </Text>
            <Text className="text-gray-700 dark:text-gray-300 mb-1">
              Name: {profile.full_name}
            </Text>
            <Text className="text-gray-700 dark:text-gray-300 mb-1">
              Email: {profile.email || profile.phone}
            </Text>
            <Text className="text-gray-700 dark:text-gray-300">
              Role: {profile.role}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleLogout}
          className="mt-8 bg-red-500 px-8 py-4 rounded-lg active:bg-red-600"
        >
          <Text className="text-white font-semibold text-lg">Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
