import { useAuth } from "@/lib/auth-context";
import { formatDisplayDate } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Calendar, Info, LogOut, MapPin } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RETENTION_DAYS = 30;

function todayYYYYMMDD(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  const today = todayYYYYMMDD();
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T12:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().split("T")[0];
  if (dateStr === y) return "Yesterday";
  return formatDisplayDate(d);
}

function getMinMaxDates(): { min: string; max: string } {
  const max = todayYYYYMMDD();
  const minD = new Date();
  minD.setDate(minD.getDate() - RETENTION_DAYS);
  const min = minD.toISOString().split("T")[0];
  return { min, max };
}

const GEOCODE_TIMEOUT_MS = 12000;
const CACHE_KEY_PRECISION = 4; // round lat/lng to 4 decimals (~11m) so nearby points reuse result

function geocodeCacheKey(lat: number, lng: number): string {
  return `${Number(lat).toFixed(CACHE_KEY_PRECISION)},${Number(lng).toFixed(CACHE_KEY_PRECISION)}`;
}

type GeocodeCache = Map<string, { place: string | null; state: string | null }>;

/** Reverse-geocode to place name + state only. Uses cache to avoid repeated API calls for same area. */
async function reverseGeocode(
  lat: number,
  lng: number,
  cache: GeocodeCache,
): Promise<{ place: string | null; state: string | null }> {
  const key = geocodeCacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached !== undefined) {
    console.log("[LocationTrail] reverseGeocode cache hit", key);
    return cached;
  }

  console.log("[LocationTrail] reverseGeocode start", { lat, lng });

  const fetchOpts = (url: string) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), GEOCODE_TIMEOUT_MS);
    return fetch(url, {
      signal: c.signal,
      headers: { "Accept-Language": "en", "User-Agent": "WorkFlow/1.0 (iOS)" },
    }).then((res) => {
      clearTimeout(t);
      return res;
    });
  };

  // 1) Expo native (works only if user granted location permission)
  try {
    const result = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    if (result?.length > 0) {
      const r = result[0];
      const place = r.city ?? r.subregion ?? r.district ?? null;
      const state = r.region ?? null;
      if (place || state) {
        const result = { place, state };
        cache.set(key, result);
        console.log("[LocationTrail] reverseGeocode OK (Expo)", {
          place,
          state,
        });
        return result;
      }
    }
  } catch (e) {
    console.log(
      "[LocationTrail] reverseGeocode Expo failed (grant location for this to work)",
      e,
    );
  }

  // 2) Photon (free, no key; often works when Nominatim fails from app)
  try {
    const res = await fetchOpts(
      `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=en`,
    );
    if (!res.ok) {
      console.log("[LocationTrail] reverseGeocode Photon HTTP", res.status);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const features = data?.features;
    if (Array.isArray(features) && features.length > 0) {
      const props = features[0]?.properties ?? {};
      const place =
        props.city ||
        props.town ||
        props.name ||
        props.locality ||
        props.county ||
        null;
      const state = props.state || props.county || null;
      if (place || state) {
        const result = { place, state };
        cache.set(key, result);
        console.log("[LocationTrail] reverseGeocode OK (Photon)", {
          place,
          state,
        });
        return result;
      }
    }
  } catch (e) {
    console.log("[LocationTrail] reverseGeocode Photon failed", e);
  }

  // 3) Nominatim (same as admin: city/town/village/hamlet/suburb + state)
  try {
    const res = await fetchOpts(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
    );
    if (!res.ok) {
      console.log("[LocationTrail] reverseGeocode Nominatim HTTP", res.status);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const addr = data?.address;
    if (addr) {
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.hamlet ||
        addr.suburb ||
        "";
      const state = addr.state || "";
      if (city || state) {
        const result = { place: city || null, state: state || null };
        cache.set(key, result);
        console.log("[LocationTrail] reverseGeocode OK (Nominatim)", result);
        return result;
      }
    }
    const displayName = data?.display_name;
    if (typeof displayName === "string" && displayName.trim()) {
      const parts = displayName
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const place = parts[0] || null;
      const state =
        parts.length >= 2
          ? parts[parts.length - 2] || parts[parts.length - 1]
          : null;
      const result = { place, state };
      cache.set(key, result);
      console.log(
        "[LocationTrail] reverseGeocode OK (Nominatim display_name)",
        result,
      );
      return result;
    }
  } catch (e) {
    console.log("[LocationTrail] reverseGeocode Nominatim failed", e);
  }

  cache.set(key, { place: null, state: null });
  console.log("[LocationTrail] reverseGeocode no result");
  return { place: null, state: null };
}

export default function MemberDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : params.id;
  const router = useRouter();
  const { signOut } = useAuth();

  const [member, setMember] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [locationLogs, setLocationLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [activeTab, setActiveTab] = useState<"attendance" | "location">(
    "attendance",
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayYYYYMMDD());
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const { min: minDate, max: maxDate } = useMemo(() => getMinMaxDates(), []);
  const selectedDateLabel = useMemo(
    () => formatDateLabel(selectedDate),
    [selectedDate],
  );
  const pickerDate = useMemo(
    () => new Date(selectedDate + "T12:00:00"),
    [selectedDate],
  );
  const minDateObj = useMemo(() => new Date(minDate + "T00:00:00"), [minDate]);
  const maxDateObj = useMemo(() => new Date(maxDate + "T23:59:59"), [maxDate]);

  // Clamp selectedDate to allowed range (e.g. after midnight or when retention changes)
  useEffect(() => {
    const { min, max } = getMinMaxDates();
    if (selectedDate < min || selectedDate > max) setSelectedDate(max);
  }, [selectedDate]);

  useEffect(() => {
    loadMemberData();
  }, [id, selectedDate]);

  // Safety: stop "Resolving..." after 15s so UI updates even if geocode hangs
  useEffect(() => {
    if (!geocoding) return;
    const t = setTimeout(() => setGeocoding(false), 15000);
    return () => clearTimeout(t);
  }, [geocoding]);

  const loadMemberData = async () => {
    if (!id || typeof id !== "string") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Load Member Profile (only set if not already set or id changed)
      const { data: profile, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (profError) throw profError;
      setMember(profile);

      // 2. Load attendance for selected date only (0 or 1 row)
      const { data: attRow } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", id)
        .eq("attendance_date", selectedDate)
        .maybeSingle();
      setAttendance(attRow ? [attRow] : []);

      // 3. Build Location Trail for selected date: check-in + moves + check-out
      const dayStart = selectedDate + "T00:00:00.000Z";
      const nextDay = new Date(
        new Date(selectedDate + "T12:00:00").getTime() + 24 * 60 * 60 * 1000,
      );
      const dayEnd = nextDay.toISOString().slice(0, 10) + "T00:00:00.000Z";

      const { data: locationData } = await supabase
        .from("location_logs")
        .select("*")
        .eq("user_id", id)
        .gte("recorded_at", dayStart)
        .lt("recorded_at", dayEnd)
        .order("recorded_at", { ascending: true });
      const moveLogs = (locationData ?? []).map((l: any) => ({
        ...l,
        type: "move",
        trailId: `move-${l.id}`,
      }));

      const dayAtt = attRow;
      const trail: any[] = [];
      if (dayAtt?.check_in_time) {
        trail.push({
          type: "check_in",
          trailId: `check_in-${dayAtt.id}`,
          recorded_at: dayAtt.check_in_time,
          place_name: dayAtt.check_in_city ?? null,
          state: dayAtt.check_in_state ?? null,
          latitude: dayAtt.check_in_lat,
          longitude: dayAtt.check_in_lng,
        });
      }
      trail.push(...moveLogs);
      if (dayAtt?.check_out_time) {
        trail.push({
          type: "check_out",
          trailId: `check_out-${dayAtt.id}`,
          recorded_at: dayAtt.check_out_time,
          place_name: dayAtt.check_out_city ?? null,
          state: dayAtt.check_out_state ?? null,
          latitude: dayAtt.check_out_lat,
          longitude: dayAtt.check_out_lng,
        });
      }
      trail.sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );
      setLocationLogs(trail);

      // Only geocode check-in and check-out to minimize API calls (max 2 per day).
      // Move logs are not geocoded; we show a count summary instead.
      const toGeocode = trail.filter(
        (l: any) =>
          (l.type === "check_in" || l.type === "check_out") &&
          (l.place_name == null || l.state == null) &&
          l.latitude != null &&
          l.longitude != null,
      );
      if (toGeocode.length > 0) {
        const cache: GeocodeCache = new Map();
        console.log(
          "[LocationTrail] geocoding check-in/check-out only:",
          toGeocode.length,
          "point(s)",
        );
        setGeocoding(true);
        (async () => {
          try {
            try {
              await Location.requestForegroundPermissionsAsync();
            } catch (_) {}
            for (let i = 0; i < toGeocode.length; i++) {
              const log = toGeocode[i];
              const idKey = log.trailId ?? log.id;
              const { place, state: st } = await reverseGeocode(
                log.latitude,
                log.longitude,
                cache,
              );
              setLocationLogs((prev) =>
                prev.map((l: any) =>
                  (l.trailId ?? String(l.id)) === idKey
                    ? { ...l, place_name: place, state: st }
                    : l,
                ),
              );
              if (toGeocode.length > 1) {
                await new Promise((r) => setTimeout(r, 400));
              }
            }
          } catch (e) {
            console.log("[LocationTrail] geocode error", e);
          } finally {
            setGeocoding(false);
          }
        })();
      }
    } catch (error) {
      console.error("Error loading member data:", error);
      Alert.alert("Error", "Could not load member details");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const renderAttendanceItem = ({ item }: { item: any }) => (
    <View className="bg-white dark:bg-gray-900 p-4 rounded-2xl mb-3 border border-gray-100 dark:border-gray-800">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-bold text-gray-900 dark:text-white">
          {formatDisplayDate(item.attendance_date)}
        </Text>
        <View className="px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded">
          <Text className="text-xs text-green-700 dark:text-green-300 font-bold uppercase">
            {item.status}
          </Text>
        </View>
      </View>
      <View className="flex-row justify-between border-t border-gray-50 dark:border-gray-800 pt-3">
        <View>
          <Text className="text-xs text-gray-400 font-medium mb-1">
            CHECK IN
          </Text>
          <Text className="text-gray-900 dark:text-white font-medium">
            {item.check_in_time
              ? new Date(item.check_in_time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-gray-400 font-medium mb-1">
            CHECK OUT
          </Text>
          <Text className="text-gray-900 dark:text-white font-medium">
            {item.check_out_time
              ? new Date(item.check_out_time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </Text>
        </View>
      </View>
      {item.total_minutes && (
        <Text className="text-xs text-gray-500 mt-2 text-right">
          Total Hours: {Math.floor(item.total_minutes / 60)}h{" "}
          {item.total_minutes % 60}m
        </Text>
      )}
    </View>
  );

  const locationText = (item: any) => {
    const has = Boolean(item.place_name || item.state);
    return has
      ? [item.place_name, item.state].filter(Boolean).join(", ")
      : geocoding
        ? "Resolving..."
        : "—";
  };

  const timeStr = (item: any) =>
    item?.recorded_at
      ? new Date(item.recorded_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
            Invalid member
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="px-4 py-2 bg-blue-600 rounded-lg"
          >
            <Text className="text-white font-medium">Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Info size={48} color="#9CA3AF" className="mb-3" />
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
            Member not found
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="px-4 py-2 bg-blue-600 rounded-lg"
          >
            <Text className="text-white font-medium">Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
        >
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">
          Member Details
        </Text>
        <TouchableOpacity
          onPress={handleLogout}
          className="w-10 h-10 items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
        >
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile Header */}
        <View className="px-6 py-6 items-center">
          <View className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/50 items-center justify-center mb-4">
            <Text className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {member?.full_name?.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            {member?.full_name}
          </Text>
          <Text className="text-gray-500 dark:text-gray-400">
            {member?.email || "No email provided"}
          </Text>
          <View className="mt-2 px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full">
            <Text className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">
              {member?.role}
            </Text>
          </View>
        </View>

        {/* Date selector: tap to open calendar / date picker */}
        <TouchableOpacity
          onPress={() => setDatePickerVisible(true)}
          className="mx-6 mb-4 flex-row items-center justify-between py-3 px-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800"
        >
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {selectedDateLabel}
          </Text>
          <Calendar size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Native calendar / date picker */}
        {datePickerVisible && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display={Platform.OS === "android" ? "calendar" : "spinner"}
            minimumDate={minDateObj}
            maximumDate={maxDateObj}
            onChange={(event, date) => {
              if (Platform.OS === "android") setDatePickerVisible(false);
              if (event?.type === "set" && date)
                setSelectedDate(date.toISOString().split("T")[0]);
            }}
          />
        )}
        {datePickerVisible && Platform.OS === "ios" && (
          <View className="mx-6 mt-2 flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={() => setDatePickerVisible(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
            >
              <Text className="font-semibold text-gray-900 dark:text-white">
                Done
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <View className="flex-row px-6 mb-6">
          <TouchableOpacity
            onPress={() => setActiveTab("attendance")}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === "attendance" ? "border-blue-600" : "border-transparent"}`}
          >
            <View className="flex-row items-center">
              <Calendar
                size={18}
                color={activeTab === "attendance" ? "#2563EB" : "#9CA3AF"}
                className="mr-2"
              />
              <Text
                className={`font-bold ${activeTab === "attendance" ? "text-blue-600" : "text-gray-400"}`}
              >
                Attendance
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("location")}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === "location" ? "border-blue-600" : "border-transparent"}`}
          >
            <View className="flex-row items-center">
              <MapPin
                size={18}
                color={activeTab === "location" ? "#2563EB" : "#9CA3AF"}
                className="mr-2"
              />
              <Text
                className={`font-bold ${activeTab === "location" ? "text-blue-600" : "text-gray-400"}`}
              >
                Location
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className="px-6">
          {activeTab === "attendance" ? (
            <FlatList
              data={attendance}
              keyExtractor={(item) => item.id}
              renderItem={renderAttendanceItem}
              scrollEnabled={false}
              ListEmptyComponent={
                <View className="items-center py-10 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <Info size={40} color="#D1D5DB" className="mb-2" />
                  <Text className="text-gray-400">
                    No attendance for {selectedDateLabel}
                  </Text>
                </View>
              }
            />
          ) : (
            <View className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Text className="text-base font-bold text-gray-900 dark:text-white mb-3">
                {selectedDate === todayYYYYMMDD()
                  ? "Today's locations"
                  : `Locations for ${selectedDateLabel}`}
              </Text>

              {(() => {
                const checkIn = locationLogs.find(
                  (l: any) => l.type === "check_in",
                );
                const changes = locationLogs.filter(
                  (l: any) => l.type === "move",
                );
                const checkOut = locationLogs.find(
                  (l: any) => l.type === "check_out",
                );
                const hasAny = checkIn || changes.length > 0 || checkOut;

                if (!hasAny) {
                  return (
                    <View className="items-center py-8">
                      <Info size={40} color="#9CA3AF" className="mb-2" />
                      <Text className="text-gray-400 text-center">
                        No locations for this date
                      </Text>
                      <Text className="text-gray-400 text-center text-xs mt-1">
                        Check-in to see check-in and check-out location
                      </Text>
                    </View>
                  );
                }

                return (
                  <>
                    {/* Check-in */}
                    <View className="mb-3">
                      <Text className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Check-in
                      </Text>
                      <View className="flex-row items-center gap-1.5 py-1.5 px-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <Text className="text-gray-900 dark:text-white text-sm font-medium w-12">
                          {checkIn ? timeStr(checkIn) : "—"}
                        </Text>
                        <Text
                          className="text-gray-700 dark:text-gray-300 text-sm font-semibold flex-1"
                          numberOfLines={1}
                        >
                          {checkIn ? locationText(checkIn) : "No check-in yet"}
                        </Text>
                      </View>
                    </View>

                    {/* Total hours between check-in and check-out */}
                    {attendance[0]?.total_minutes != null &&
                      attendance[0].total_minutes > 0 && (
                        <View className="mb-2 py-1">
                          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                            Total: {Math.floor(attendance[0].total_minutes / 60)}
                            h {attendance[0].total_minutes % 60}m
                          </Text>
                        </View>
                      )}

                    {/* Check-out */}
                    <View className="mb-4">
                      <Text className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Check-out
                      </Text>
                      <View className="flex-row items-center gap-1.5 py-1.5 px-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <Text className="text-gray-900 dark:text-white text-sm font-medium w-12">
                          {checkOut ? timeStr(checkOut) : "—"}
                        </Text>
                        <Text
                          className="text-gray-700 dark:text-gray-300 text-sm font-semibold flex-1"
                          numberOfLines={1}
                        >
                          {checkOut
                            ? locationText(checkOut)
                            : "Not checked out yet"}
                        </Text>
                      </View>
                    </View>

                    {/* View day on map – matches common "View route" in other apps */}
                    <TouchableOpacity
                      onPress={() =>
                        router.push(
                          `/(manager)/member/${id}/day-map?date=${selectedDate}`,
                        )
                      }
                      className="flex-row items-center justify-center gap-2 py-3 px-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800"
                    >
                      <MapPin size={18} color="#6366F1" />
                      <Text className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                        View day on map
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
