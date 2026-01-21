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
    // Only load profile after session is confirmed (loading is false) and session exists
    if (!loading && session?.user) {
      loadProfile();
    } else if (!loading && !session) {
      // Session confirmed but no user - reset profile state
      setProfile(null);
      setLoadingProfile(false);
    }
  }, [session, loading]);

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
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

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
              Email: {profile.email || 'Not set'}
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
