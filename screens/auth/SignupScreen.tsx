import { AuthButton } from '@/components/ui/AuthButton';
import { AuthInput } from '@/components/ui/AuthInput';
import { getDeviceInfo } from '@/lib/device';
import { supabase } from '@/lib/supabase';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';

export default function SignupScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({ name: '', email: '', password: '', confirm: '' });

    const handleSignup = async () => {
        const newErrors = { name: '', email: '', password: '', confirm: '' };
        let hasError = false;

        if (!fullName.trim()) {
            newErrors.name = 'Full name is required';
            hasError = true;
        }

        if (!email.trim()) {
            newErrors.email = 'Email is required';
            hasError = true;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email';
            hasError = true;
        }

        if (!password) {
            newErrors.password = 'Password is required';
            hasError = true;
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
            hasError = true;
        }

        if (password !== confirmPassword) {
            newErrors.confirm = 'Passwords do not match';
            hasError = true;
        }

        if (hasError) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        setErrors({ name: '', email: '', password: '', confirm: '' });

        try {
            // Create user account
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        role: 'staff',
                    },
                },
            });

            if (authError) throw authError;

            if (!authData.user) {
                throw new Error('Failed to create account');
            }

            // Get device info
            const deviceInfo = await getDeviceInfo();

            // Register device for this user
            const { error: deviceError } = await supabase
                .from('user_devices')
                .insert({
                    user_id: authData.user.id,
                    device_id: deviceInfo.deviceId,
                    device_name: deviceInfo.deviceName,
                    platform: deviceInfo.platform,
                    brand: deviceInfo.brand,
                    model_name: deviceInfo.modelName,
                });

            if (deviceError) {
                console.error('Device registration error:', deviceError);
            }

            // Create profile in profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    full_name: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    role: 'staff',
                    is_active: true,
                });

            if (profileError) {
                console.error('Profile creation error:', profileError);
            }

            Alert.alert(
                'Account Created!',
                'Your account has been created and this device is now registered.',
                [{ text: 'OK', onPress: () => router.replace('/') }]
            );
        } catch (err: any) {
            Alert.alert('Signup Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            <View className="flex-1 px-6 justify-center">
                <Text className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
                    Create Account
                </Text>
                <Text className="text-gray-500 mb-8 dark:text-gray-400">
                    Join Trackora to start tracking your work
                </Text>

                <AuthInput
                    label="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="John Doe"
                    error={errors.name}
                />

                <AuthInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email}
                />

                <AuthInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Create a password"
                    secureTextEntry
                    error={errors.password}
                />

                <AuthInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm your password"
                    secureTextEntry
                    error={errors.confirm}
                />

                <AuthButton
                    title="Sign Up"
                    onPress={handleSignup}
                    loading={loading}
                    disabled={!fullName || !email || !password || !confirmPassword}
                />

                <View className="mt-8 flex-row justify-center">
                    <Text className="text-gray-500 dark:text-gray-400">Already have an account? </Text>
                    <Link href="/auth/login" className="font-bold text-black dark:text-white">
                        Login
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}
