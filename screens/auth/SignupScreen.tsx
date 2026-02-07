import { AuthButton } from "@/components/ui/AuthButton";
import { AuthInput } from "@/components/ui/AuthInput";
import { getDeviceInfo } from "@/lib/device";
import { getNetworkErrorMessage, supabase } from "@/lib/supabase";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from "react-native";

const TINT_LIGHT = "#0a7ea4";

export default function SignupScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const handleSignup = async () => {
    const newErrors = { name: "", email: "", password: "", confirm: "" };
    let hasError = false;

    if (!fullName.trim()) {
      newErrors.name = "Full name is required";
      hasError = true;
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
      hasError = true;
    }

    if (!password) {
      newErrors.password = "Password is required";
      hasError = true;
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      hasError = true;
    }

    if (password !== confirmPassword) {
      newErrors.confirm = "Passwords do not match";
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({ name: "", email: "", password: "", confirm: "" });

    try {
      const cleanEmail = email.trim().toLowerCase();

      const ADMIN_EMAILS = ["admin@workflow.com", "vishrutagarwalla@gmail.com"];

      const isSystemAdmin = ADMIN_EMAILS.includes(cleanEmail);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error("Please enter a valid email address.");
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: isSystemAdmin ? "admin" : "staff",
          },
        },
      });

      if (authError) {
        console.error("Supabase Auth Error:", {
          message: authError.message,
          status: authError.status,
          name: authError.name,
        });

        let errorMessage = authError.message;

        if (
          authError.message.includes("already registered") ||
          authError.message.includes("already exists") ||
          authError.message.includes("User already registered") ||
          authError.message.includes("already been registered")
        ) {
          errorMessage =
            "This email is already registered. Please try logging in instead.";
        } else if (
          authError.message.includes("invalid") &&
          authError.message.includes("email")
        ) {
          errorMessage = `Email signup failed. This might be because:\n\n• Email confirmation is required but not configured\n• Email already exists (try logging in)\n• Email domain restrictions\n\nError: ${authError.message}\n\nPlease check your Supabase Auth settings or try a different email.`;
        } else if (authError.message.includes("password")) {
          errorMessage =
            "Password does not meet requirements. Please use at least 6 characters.";
        } else if (authError.message.includes("Email rate limit")) {
          errorMessage =
            "Too many signup attempts. Please wait a moment and try again.";
        }

        throw new Error(errorMessage);
      }

      if (!authData.user) {
        throw new Error("Failed to create account");
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const deviceInfo = await getDeviceInfo();

      let deviceInserted = false;
      let retries = 3;

      while (!deviceInserted && retries > 0) {
        const { error: deviceError } = await supabase
          .from("user_devices")
          .insert({
            user_id: authData.user.id,
            device_uuid: deviceInfo.deviceId,
            model: deviceInfo.modelName || deviceInfo.deviceName || null,
            os_version: deviceInfo.platform || null,
          });

        if (!deviceError) {
          deviceInserted = true;
          console.log("✅ Device registered successfully");
        } else if (deviceError.code === "23503") {
          console.log("⏳ Waiting for profile to be created...");
          retries--;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.error("Device registration error:", deviceError);
          break;
        }
      }

      if (!deviceInserted) {
        console.warn("⚠️ Device registration failed after retries");
      }

      Alert.alert(
        "Account Created!",
        "Your account has been created and this device is now registered.",
        [{ text: "OK", onPress: () => router.replace("/") }],
      );
    } catch (err: any) {
      console.error("Signup error:", err);
      const networkMsg = getNetworkErrorMessage(err);
      const errorMessage = networkMsg || err.message || "An unexpected error occurred";
      Alert.alert(networkMsg ? "Connection Error" : "Signup Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const linkColor = colorScheme === "dark" ? "#fff" : TINT_LIGHT;

  const cardStyle = {
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            WorkFlow
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Join to start tracking your work
          </Text>

          <View
            className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6 w-full self-center"
            style={cardStyle}
          >
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Create Account
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-sm mb-5">
              Enter your details to get started
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
              showPasswordToggle
              error={errors.password}
            />

            <AuthInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              secureTextEntry
              showPasswordToggle
              error={errors.confirm}
            />

            <AuthButton
              title="Sign Up"
              onPress={handleSignup}
              loading={loading}
              disabled={!fullName || !email || !password || !confirmPassword}
            />

            <View className="mt-6 flex-row justify-center flex-wrap">
              <Text className="text-gray-500 dark:text-gray-400 text-sm">
                Already have an account?{" "}
              </Text>
              <Link href="/auth/login" asChild>
                <Pressable>
                  <Text
                    style={{ color: linkColor }}
                    className="font-bold text-sm"
                  >
                    Login
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
