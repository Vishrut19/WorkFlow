import { Stack } from 'expo-router';

export default function ManagerLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="team" />
            <Stack.Screen name="map" />
            <Stack.Screen name="member/[id]" />
        </Stack>
    );
}
