import { AuthProvider, useAuth } from '@/lib/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import '../global.css';

const HAS_VISITED_KEY = 'trackora_has_visited';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isCheckingFirstVisit, setIsCheckingFirstVisit] = useState(true);

  useEffect(() => {
    const handleRouting = async () => {
      console.log('🔍 Routing check:', { loading, session: !!session, segments });

      if (loading) return;

      const inAuthGroup = segments[0] === 'auth';

      console.log('📍 Current location:', { inAuthGroup, hasSession: !!session });

      if (!session) {
        // No session - redirect to auth pages if not already there
        if (!inAuthGroup) {
          const hasVisited = await AsyncStorage.getItem(HAS_VISITED_KEY);

          console.log('👤 Not authenticated, hasVisited:', hasVisited);

          if (hasVisited) {
            console.log('➡️ Redirecting to LOGIN');
            router.replace('/auth/login');
          } else {
            console.log('➡️ Redirecting to SIGNUP');
            await AsyncStorage.setItem(HAS_VISITED_KEY, 'true');
            router.replace('/auth/signup');
          }
        }
      } else if (session && inAuthGroup) {
        // Has session but on auth pages - redirect to home
        console.log('➡️ Redirecting to HOME');
        router.replace('/');
      }

      setIsCheckingFirstVisit(false);
    };

    handleRouting();
  }, [session, loading, segments]);

  if (loading || isCheckingFirstVisit) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-black">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/signup" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
