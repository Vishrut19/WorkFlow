import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Clock,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  User,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

// Lazy import MapView to catch load errors
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
let PROVIDER_GOOGLE: any = null;
let PROVIDER_DEFAULT: any = null;

let mapLoadError: string | null = null;

try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
} catch (e: any) {
  mapLoadError = e?.message || "Failed to load map library";
  console.error("Failed to load react-native-maps:", e);
}

// Simple reverse geocoding using OpenStreetMap Nominatim (free, no API key needed)
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
      { headers: { "Accept-Language": "en" } },
    );
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    const addr = data.address;
    if (!addr) {
      return (
        data.display_name?.split(",").slice(0, 2).join(",").trim() ||
        `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    }
    const locality =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.hamlet ||
      addr.suburb ||
      "";
    const state = addr.state || "";
    if (locality && state) return `${locality}, ${state}`;
    if (locality) return locality;
    if (state) return state;
    return (
      data.display_name?.split(",").slice(0, 2).join(",").trim() ||
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    );
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export default function LiveMapScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();

  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapError, setMapError] = useState<string | null>(mapLoadError);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [addressLoading, setAddressLoading] = useState(false);

  // Bottom sheet animation
  const slideAnim = useRef(new Animated.Value(300)).current;
  const mapRef = useRef<any>(null);

  useEffect(() => {
    loadTeamLocations();

    // Polling for updates every 1 minute
    const interval = setInterval(loadTeamLocations, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadTeamLocations = async () => {
    if (!session?.user) return;
    if (!refreshing) setRefreshing(true);

    try {
      // 1. Get managed teams (required first - other queries depend on this)
      const { data: managedTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("manager_id", session.user.id);

      const teamIds = managedTeams?.map((t) => t.id) || [];
      if (teamIds.length === 0) {
        setLocations([]);
        return;
      }

      // 2. Get members of those teams
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id, profiles:user_id(full_name)")
        .in("team_id", teamIds);

      const userIds = teamMembers?.map((m) => m.user_id) || [];
      if (userIds.length === 0) {
        setLocations([]);
        return;
      }

      // 3. Get latest location for each user from location_logs
      // Fetch logs from the last 30 minutes for these users (increased from 15 min window).
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();

      const { data: logs, error } = await supabase
        .from("location_logs")
        .select("user_id, latitude, longitude, recorded_at")
        .in("user_id", userIds)
        .gte("recorded_at", thirtyMinsAgo)
        .order("recorded_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // 4. Map back to user names (taking only the latest for each)
      const latestLocations: any[] = [];
      const processedUsers = new Set();

      logs?.forEach((log) => {
        if (!processedUsers.has(log.user_id)) {
          processedUsers.add(log.user_id);
          const profile = teamMembers?.find(
            (m) => m.user_id === log.user_id,
          )?.profiles;
          latestLocations.push({
            ...log,
            full_name: (profile as any)?.full_name || "Unknown",
          });
        }
      });

      setLocations(latestLocations);
    } catch (error) {
      console.error("Error loading map locations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle marker press - show bottom sheet with user details
  const handleMarkerPress = useCallback(
    async (loc: any) => {
      setSelectedUser(loc);
      setSelectedAddress("");
      setAddressLoading(true);

      // Animate bottom sheet up
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      // Center map on the selected user
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      }

      // Reverse geocode the address
      try {
        const address = await reverseGeocode(loc.latitude, loc.longitude);
        setSelectedAddress(address);
      } catch {
        setSelectedAddress(`${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
      } finally {
        setAddressLoading(false);
      }
    },
    [slideAnim],
  );

  // Close bottom sheet
  const closeBottomSheet = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSelectedUser(null);
      setSelectedAddress("");
    });
  }, [slideAnim]);

  // Open in external maps app
  const openInMaps = useCallback(() => {
    if (!selectedUser) return;
    const { latitude, longitude } = selectedUser;
    const label = encodeURIComponent(selectedUser.full_name || "Team Member");
    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${label}@${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps URL
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      );
    });
  }, [selectedUser]);

  // Navigate to member detail screen
  const viewMemberProfile = useCallback(() => {
    if (!selectedUser) return;
    closeBottomSheet();
    router.push(`/(manager)/member/${selectedUser.user_id}`);
  }, [selectedUser, router, closeBottomSheet]);

  // Get time ago string
  const getTimeAgo = (dateStr: string) => {
    const now = Date.now();
    const recorded = new Date(dateStr).getTime();
    const diffMs = now - recorded;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m ago`;
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // Default center (can be improved by averaging locations)
  const initialRegion =
    locations.length > 0
      ? {
          latitude: locations[0].latitude,
          longitude: locations[0].longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : {
          latitude: 28.6139, // Default to New Delhi if no data
          longitude: 77.209,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };

  // Determine the map provider: Google Maps on Android (requires API key), Apple Maps on iOS
  const mapProvider =
    Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900"
        >
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Live Team Map
          </Text>
          <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            {locations.length} Members Online
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900"
        >
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View className="flex-1">
        {/* Map Error Fallback */}
        {mapError || !MapView ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800 items-center w-full">
              <AlertTriangle size={40} color="#EF4444" />
              <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4 text-center">
                Map Unavailable
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-sm text-center mt-2">
                {mapError ||
                  "The map component could not be loaded. Please ensure the app is built with native map support."}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMapError(null);
                  loadTeamLocations();
                }}
                className="mt-4 bg-blue-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-medium">Retry</Text>
              </TouchableOpacity>
            </View>

            {/* Show team member locations as a list fallback */}
            {locations.length > 0 && (
              <View className="mt-6 w-full">
                <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Team Locations (List View)
                </Text>
                {locations.map((loc, index) => (
                  <View
                    key={`${loc.user_id}-${index}`}
                    className="flex-row items-center bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 mb-2"
                  >
                    <View className="bg-blue-600 p-2 rounded-full mr-3">
                      <User size={14} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-medium text-gray-900 dark:text-white">
                        {loc.full_name}
                      </Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Last seen:{" "}
                        {new Date(loc.recorded_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <MapPin size={16} color="#9CA3AF" />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Actual Map View */
          <MapView
            ref={mapRef}
            provider={mapProvider}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            onPress={() => {
              // Close bottom sheet when tapping on the map
              if (selectedUser) closeBottomSheet();
            }}
            onMapReady={() => {
              console.log("Map is ready");
            }}
            onError={(e: any) => {
              console.error("MapView error:", e?.nativeEvent?.error || e);
              setMapError(
                e?.nativeEvent?.error ||
                  "Map failed to load. Please check your Google Maps API key configuration.",
              );
            }}
          >
            {locations.map((loc, index) => (
              <Marker
                key={`${loc.user_id}-${index}`}
                coordinate={{
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }}
                onPress={() => handleMarkerPress(loc)}
                title={loc.full_name}
                description={`Last seen: ${new Date(loc.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              >
                <View
                  style={[
                    styles.markerContainer,
                    selectedUser?.user_id === loc.user_id && styles.markerSelected,
                  ]}
                >
                  <User size={16} color="white" />
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        {/* Refresh Button */}
        <TouchableOpacity
          onPress={loadTeamLocations}
          disabled={refreshing}
          className="absolute bottom-10 right-6 bg-white dark:bg-gray-900 p-4 rounded-full shadow-lg border border-gray-100 dark:border-gray-800"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <RefreshCw size={24} color="#2563EB" />
          )}
        </TouchableOpacity>

        {!mapError && MapView && locations.length === 0 && (
          <View className="absolute top-1/2 left-0 right-0 items-center">
            <View className="bg-white/90 dark:bg-black/90 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <Text className="text-gray-900 dark:text-white font-medium">
                No team members are currently online
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-xs text-center mt-1">
                Check back later or check the team list
              </Text>
            </View>
          </View>
        )}

        {/* Bottom Sheet - Member Detail Panel */}
        {selectedUser && (
          <Animated.View
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Close button */}
            <TouchableOpacity
              onPress={closeBottomSheet}
              style={styles.closeButton}
            >
              <X size={18} color="#6B7280" />
            </TouchableOpacity>

            {/* User Info Row */}
            <View style={styles.userInfoRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {selectedUser.full_name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
              <View style={styles.userTextContainer}>
                <Text style={styles.userName}>{selectedUser.full_name}</Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Online</Text>
                  <Text style={styles.statusDivider}>·</Text>
                  <Clock size={12} color="#6B7280" />
                  <Text style={styles.timeAgoText}>
                    {getTimeAgo(selectedUser.recorded_at)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Location Info */}
            <View style={styles.locationCard}>
              <MapPin size={16} color="#2563EB" />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Current Location</Text>
                {addressLoading ? (
                  <ActivityIndicator
                    size="small"
                    color="#2563EB"
                    style={{ marginTop: 2 }}
                  />
                ) : (
                  <Text style={styles.locationAddress}>
                    {selectedAddress || `${selectedUser.latitude.toFixed(4)}, ${selectedUser.longitude.toFixed(4)}`}
                  </Text>
                )}
                <Text style={styles.locationCoords}>
                  {selectedUser.latitude.toFixed(6)}, {selectedUser.longitude.toFixed(6)}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButtonPrimary}
                onPress={viewMemberProfile}
              >
                <User size={16} color="white" />
                <Text style={styles.actionButtonPrimaryText}>View Profile</Text>
                <ChevronRight size={16} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={openInMaps}
              >
                <Navigation size={16} color="#2563EB" />
                <Text style={styles.actionButtonSecondaryText}>Directions</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: width,
    height: height - 150,
  },
  markerContainer: {
    backgroundColor: "#2563EB",
    padding: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerSelected: {
    backgroundColor: "#1D4ED8",
    borderColor: "#BFDBFE",
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  statusDivider: {
    fontSize: 13,
    color: "#9CA3AF",
    marginHorizontal: 2,
  },
  timeAgoText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 2,
  },
  locationCard: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    alignItems: "flex-start",
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginTop: 2,
  },
  locationCoords: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  actionButtonPrimaryText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  actionButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  actionButtonSecondaryText: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "700",
  },
});
