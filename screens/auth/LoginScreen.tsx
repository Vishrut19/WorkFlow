import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { getDeviceInfo } from '@/lib/device';
import { getNetworkErrorMessage, supabase } from '@/lib/supabase';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, SafeAreaView, Text, useColorScheme, View } from 'react-native';

const TINT_LIGHT = '#0a7ea4';

export default function LoginScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
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
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

            if (authError) throw authError;

            const deviceInfo = await getDeviceInfo();

            const { data: devices, error: deviceError } = await supabase
                .from('user_devices')
                .select('*')
                .eq('user_id', authData.user.id)
                .eq('device_uuid', deviceInfo.deviceId)
                .eq('is_active', true);

            if (deviceError) throw deviceError;

            if (!devices || devices.length === 0) {
                await supabase.auth.signOut();
                throw new Error('This device is not authorized. Please contact admin or login from your registered device.');
            }

            router.replace('/');
        } catch (err: any) {
            const networkMsg = getNetworkErrorMessage(err);
            const message = networkMsg || err.message || 'An unexpected error occurred';
            Alert.alert(networkMsg ? 'Connection Error' : 'Login Failed', message);
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const linkColor = colorScheme === 'dark' ? '#fff' : TINT_LIGHT;

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    paddingHorizontal: 24,
                    paddingVertical: 32,
                }}
                keyboardShouldPersistTaps="handled"
            >
                <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    WorkFlow
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                    Sign in to continue tracking your attendance
                </Text>

                <View
                    className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6 w-full self-center"
                    style={{ maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
                >
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Welcome Back
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm mb-5">
                        Enter your credentials to continue
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
                        showPasswordToggle
                        error={error && password ? error : ''}
                    />

                    <AuthButton
                        title="Login"
                        onPress={handleLogin}
                        loading={loading}
                        disabled={!email || !password}
                    />

                    <View className="mt-6 flex-row justify-center flex-wrap">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm">Don't have an account? </Text>
                        <Link href="/auth/signup" asChild>
                            <Pressable>
                                <Text style={{ color: linkColor }} className="font-bold text-sm">
                                    Sign Up
                                </Text>
                            </Pressable>
                        </Link>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
