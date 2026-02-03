import { AuthProvider, useAuth } from '@/lib/auth-context';
import { getDeviceInfo } from '@/lib/device';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
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
      } else {
        // Has session - verify device before redirecting or allowing access
        // BUT: Skip device check if we're on auth pages (signup just completed)
        // The device will be registered by the signup flow before we leave auth pages
        if (inAuthGroup) {
          // On auth pages with a session - the signup flow will handle device registration
          // Wait a moment then redirect to home (signup screen will do device registration)
          console.log('➡️ On auth page with session, waiting for signup to complete...');
          // Don't do device check here - let the signup process complete first
          // The user will be redirected to home by the signup alert callback
          return;
        }

        // Not on auth pages - do device verification
        try {
          const deviceInfo = await getDeviceInfo();

          // Retry device check a few times (device might still be registering)
          let devices = null;
          let retries = 3;

          while (retries > 0) {
            const { data, error } = await supabase
              .from('user_devices')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('device_uuid', deviceInfo.deviceId)
              .eq('is_active', true);

            if (error) {
              console.error('Error verifying device:', error);
              break;
            }

            if (data && data.length > 0) {
              devices = data;
              break;
            }

            // No device found - wait and retry
            console.log('⏳ Device not found, retrying...');
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          const isDeviceValid = devices && devices.length > 0;

          if (!isDeviceValid) {
            console.log('🚫 Device not authorized after retries. Signing out.');
            await supabase.auth.signOut();
            Alert.alert('Unauthorized Device', 'This device is not registered for your account. Please contact your administrator.');
            return; // Exit, signOut will trigger re-route
          }

          console.log('✅ Device verified successfully');
        } catch (e) {
          console.error('Device check failed', e);
        }
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
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
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
