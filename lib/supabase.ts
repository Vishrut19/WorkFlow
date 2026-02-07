import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Check if an error is a network connectivity failure.
 * Returns a user-friendly message if so, otherwise null.
 */
export function getNetworkErrorMessage(error: any): string | null {
  const msg = error?.message || '';
  if (
    error instanceof TypeError && msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('network') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT')
  ) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  return null;
}
