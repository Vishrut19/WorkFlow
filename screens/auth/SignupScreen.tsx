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
            // Clean email
            const cleanEmail = email.trim().toLowerCase();
            
            // Validate email format more strictly
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleanEmail)) {
                throw new Error('Please enter a valid email address.');
            }
            
            // Create user account
            // Note: If email confirmation is enabled in Supabase, you may need to:
            // 1. Disable it in Supabase Dashboard > Authentication > Settings
            // 2. Or configure email templates and redirect URLs
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        role: 'staff',
                    },
                    // Disable email redirect if email confirmation is causing issues
                    // emailRedirectTo: undefined,
                },
            });

            if (authError) {
                // Log the full error for debugging
                console.error('Supabase Auth Error:', {
                    message: authError.message,
                    status: authError.status,
                    name: authError.name,
                });
                
                // Provide more user-friendly error messages
                let errorMessage = authError.message;
                
                // Handle common Supabase auth errors
                if (authError.message.includes('already registered') || 
                    authError.message.includes('already exists') ||
                    authError.message.includes('User already registered') ||
                    authError.message.includes('already been registered')) {
                    errorMessage = 'This email is already registered. Please try logging in instead.';
                } else if (authError.message.includes('invalid') && authError.message.includes('email')) {
                    // This often happens when:
                    // 1. Email confirmation is enabled but not configured
                    // 2. Email already exists (Supabase sometimes returns "invalid" for existing emails)
                    // 3. Email domain is blocked
                    errorMessage = `Email signup failed. This might be because:\n\n• Email confirmation is required but not configured\n• Email already exists (try logging in)\n• Email domain restrictions\n\nError: ${authError.message}\n\nPlease check your Supabase Auth settings or try a different email.`;
                } else if (authError.message.includes('password')) {
                    errorMessage = 'Password does not meet requirements. Please use at least 6 characters.';
                } else if (authError.message.includes('Email rate limit')) {
                    errorMessage = 'Too many signup attempts. Please wait a moment and try again.';
                }
                
                throw new Error(errorMessage);
            }

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
                    device_uuid: deviceInfo.deviceId,
                    model: deviceInfo.modelName || deviceInfo.deviceName || null,
                    os_version: deviceInfo.platform || null,
                });

            if (deviceError) {
                console.error('Device registration error:', deviceError);
            }

            // Profile should be created automatically by trigger
            // Wait a moment for trigger to complete, then update with email
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update profile with email (trigger creates it with phone/email from auth metadata)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    role: 'staff',
                    is_active: true,
                })
                .eq('id', authData.user.id);
            
            if (profileError) {
                console.error('Profile update error:', profileError);
                // Don't throw - profile might already be correct from trigger
                // Just log the error
            }

            Alert.alert(
                'Account Created!',
                'Your account has been created and this device is now registered.',
                [{ text: 'OK', onPress: () => router.replace('/') }]
            );
        } catch (err: any) {
            console.error('Signup error:', err);
            const errorMessage = err.message || 'An unexpected error occurred';
            Alert.alert('Signup Failed', errorMessage);
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
