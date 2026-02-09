/**
 * Day map – manager view of a member's location trail for a selected date.
 * Shows a simplified route (polyline) with start (check-in) and end (check-out) markers.
 * Matches common pattern in employee tracking apps: "View route" from day's data.
 */
import { formatDisplayDate } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;
let PROVIDER_DEFAULT: any = null;
let mapLoadError: string | null = null;

try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
} catch (e: any) {
  mapLoadError = e?.message || "Failed to load map library";
}

const MAX_POINTS = 80; // cap polyline points to keep path readable

/** Reduce path to at most MAX_POINTS while keeping first and last. */
function simplifyPath(
  coords: { latitude: number; longitude: number }[],
): { latitude: number; longitude: number }[] {
  if (coords.length <= MAX_POINTS) return coords;
  const result: { latitude: number; longitude: number }[] = [];
  result.push(coords[0]);
  const step = (coords.length - 2) / (MAX_POINTS - 2);
  for (let i = 1; i <= MAX_POINTS - 2; i++) {
    const idx = Math.round(i * step);
    result.push(coords[Math.min(idx, coords.length - 2)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

/** Region that fits all coordinates with padding. */
function regionForCoordinates(
  coords: { latitude: number; longitude: number }[],
  padding = 1.5,
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  if (coords.length === 0) {
    return {
      latitude: 28.6139,
      longitude: 77.209,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latDelta = Math.max((maxLat - minLat) * padding, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * padding, 0.01);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T12:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().split("T")[0];
  if (dateStr === y) return "Yesterday";
  return formatDisplayDate(d);
}

export default function MemberDayMapScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : params.id;
  const dateParam = typeof params.date === "string" ? params.date : Array.isArray(params.date) ? params.date[0] : params.date;
  const selectedDate = dateParam || new Date().toISOString().split("T")[0];

  const router = useRouter();
  const [member, setMember] = useState<any>(null);
  const [trail, setTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(mapLoadError);

  const loadData = useCallback(async () => {
    if (!id || typeof id !== "string") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
      setMember(profile || null);

      const dayStart = selectedDate + "T00:00:00.000Z";
      const nextDay = new Date(new Date(selectedDate + "T12:00:00").getTime() + 24 * 60 * 60 * 1000);
      const dayEnd = nextDay.toISOString().slice(0, 10) + "T00:00:00.000Z";

      const { data: locationData } = await supabase
        .from("location_logs")
        .select("*")
        .eq("user_id", id)
        .gte("recorded_at", dayStart)
        .lt("recorded_at", dayEnd)
        .order("recorded_at", { ascending: true });

      const { data: attRow } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", id)
        .eq("attendance_date", selectedDate)
        .maybeSingle();

      const moveLogs = (locationData ?? []).map((l: any) => ({
        ...l,
        type: "move",
        trailId: `move-${l.id}`,
      }));

      const build: any[] = [];
      if (attRow?.check_in_time) {
        build.push({
          type: "check_in",
          trailId: `check_in-${attRow.id}`,
          recorded_at: attRow.check_in_time,
          latitude: attRow.check_in_lat,
          longitude: attRow.check_in_lng,
        });
      }
      build.push(...moveLogs);
      if (attRow?.check_out_time) {
        build.push({
          type: "check_out",
          trailId: `check_out-${attRow.id}`,
          recorded_at: attRow.check_out_time,
          latitude: attRow.check_out_lat,
          longitude: attRow.check_out_lng,
        });
      }
      build.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      setTrail(build);
    } catch (e) {
      console.error("Day map load error:", e);
      Alert.alert("Error", "Could not load location data");
    } finally {
      setLoading(false);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const coordsForPolyline = useMemo(() => {
    const points = trail
      .filter((l: any) => l.latitude != null && l.longitude != null)
      .map((l: any) => ({ latitude: l.latitude, longitude: l.longitude }));
    return simplifyPath(points);
  }, [trail]);

  const checkIn = useMemo(() => trail.find((l: any) => l.type === "check_in"), [trail]);
  const checkOut = useMemo(() => trail.find((l: any) => l.type === "check_out"), [trail]);

  const initialRegion = useMemo(
    () => regionForCoordinates(coordsForPolyline),
    [coordsForPolyline],
  );

  const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
  const dateLabel = formatDateLabel(selectedDate);
  const hasRoute = coordsForPolyline.length >= 2;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-gray-400 text-sm mt-3">Loading route…</Text>
      </View>
    );
  }

  if (!id || !member) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">Invalid member</Text>
          <TouchableOpacity onPress={() => router.back()} className="px-4 py-2 bg-blue-600 rounded-lg">
            <Text className="text-white font-medium">Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View className="items-center flex-1 mx-2">
          <Text className="text-base font-bold text-gray-900 dark:text-white" numberOfLines={1}>
            {member.full_name}'s route
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}</Text>
        </View>
        <View className="w-10" />
      </View>

      {mapError || !MapView || !Polyline ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-gray-500 dark:text-gray-400 text-center">Map is not available.</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 bg-blue-600 rounded-lg">
            <Text className="text-white font-medium">Go back</Text>
          </TouchableOpacity>
        </View>
      ) : !hasRoute ? (
        <View className="flex-1 items-center justify-center px-6">
          <MapPin size={48} color="#9CA3AF" className="mb-3" />
          <Text className="text-gray-500 dark:text-gray-400 text-center">No location data for this date.</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 bg-blue-600 rounded-lg">
            <Text className="text-white font-medium">Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <MapView
            style={{ width, height: height - 140 }}
            provider={mapProvider}
            initialRegion={initialRegion}
            onError={(e: any) => setMapError(e?.nativeEvent?.error || "Map error")}
          >
            <Polyline
              coordinates={coordsForPolyline}
              strokeColor="#6366F1"
              strokeWidth={4}
            />
            {checkIn && (
              <Marker
                coordinate={{ latitude: checkIn.latitude, longitude: checkIn.longitude }}
                title="Check-in"
                pinColor="green"
              />
            )}
            {checkOut && (
              <Marker
                coordinate={{ latitude: checkOut.latitude, longitude: checkOut.longitude }}
                title="Check-out"
                pinColor="red"
              />
            )}
          </MapView>
          {/* Trip details strip */}
          <View className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-green-500" />
                <Text className="text-xs text-gray-500 dark:text-gray-400">Start</Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  {checkIn ? new Date(checkIn.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-red-500" />
                <Text className="text-xs text-gray-500 dark:text-gray-400">End</Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  {checkOut ? new Date(checkOut.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
