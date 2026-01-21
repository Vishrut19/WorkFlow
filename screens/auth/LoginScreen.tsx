import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { getDeviceInfo } from '@/lib/device';
import { supabase } from '@/lib/supabase';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            setError('Please enter email and password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // First, authenticate user
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

            if (authError) throw authError;

            // Get device info
            const deviceInfo = await getDeviceInfo();

            // Check if device is registered for this user
            const { data: devices, error: deviceError } = await supabase
                .from('user_devices')
                .select('*')
                .eq('user_id', authData.user.id)
                .eq('device_uuid', deviceInfo.deviceId)
                .eq('is_active', true);

            if (deviceError) throw deviceError;

            if (!devices || devices.length === 0) {
                // Device not registered - sign out and show error
                await supabase.auth.signOut();
                throw new Error('This device is not authorized. Please contact admin or login from your registered device.');
            }

            // Success - navigation handled by auth context
            router.replace('/');
        } catch (err: any) {
            Alert.alert('Login Failed', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            <View className="flex-1 px-6 justify-center">
                <Text className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
                    Welcome Back
                </Text>
                <Text className="text-gray-500 mb-8 dark:text-gray-400">
                    Sign in to continue tracking your attendance
                </Text>

                <AuthInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={error && !password ? error : ''}
                />

                <AuthInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    secureTextEntry
                    error={error && password ? error : ''}
                />

                <AuthButton
                    title="Login"
                    onPress={handleLogin}
                    loading={loading}
                    disabled={!email || !password}
                />

                <View className="mt-8 flex-row justify-center">
                    <Text className="text-gray-500 dark:text-gray-400">Don't have an account? </Text>
                    <Link href="/auth/signup" className="font-bold text-black dark:text-white">
                        Sign Up
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}
