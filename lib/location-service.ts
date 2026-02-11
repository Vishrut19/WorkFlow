import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "./supabase";

// Background task name
const LOCATION_TRACKING_TASK = "background-location-tracking";

// Minimum distance (meters) from last location to record a new point (record only on location change)
const MIN_DISTANCE_METERS = 100;

/** Rough distance in meters between two lat/lng points (Haversine). */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Define the background task
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("❌ Location tracking error:", error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (!location) return;

    const timestamp = new Date(location.timestamp);
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    const timeString = timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    console.log("\n" + "=".repeat(60));
    console.log("📍 LOCATION UPDATE - " + timeString);
    console.log("=".repeat(60));
    console.log("📊 Coordinates:");
    console.log("   Latitude:  " + lat.toFixed(6));
    console.log("   Longitude: " + lng.toFixed(6));
    console.log(
      "   Accuracy:  " + location.coords.accuracy.toFixed(2) + " meters",
    );
    console.log("⏰ Timestamp:  " + timestamp.toISOString());

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        console.warn("⚠️  No active session, stopping location tracking");
        await stopLocationTracking();
        return;
      }

      console.log("👤 User ID:    " + session.user.id);

      // Record only when location has changed: compare with last saved location
      const { data: lastLog } = await supabase
        .from("location_logs")
        .select("latitude, longitude")
        .eq("user_id", session.user.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastLog?.latitude != null && lastLog?.longitude != null) {
        const dist = distanceMeters(
          lat,
          lng,
          lastLog.latitude,
          lastLog.longitude,
        );
        if (dist < MIN_DISTANCE_METERS) {
          console.log(
            "⏭️  Location unchanged (~" + dist.toFixed(0) + "m), skipping save",
          );
          console.log("=".repeat(60) + "\n");
          return;
        }
      }

      const { error: insertError } = await supabase
        .from("location_logs")
        .insert({
          user_id: session.user.id,
          latitude: lat,
          longitude: lng,
          accuracy: location.coords.accuracy,
          recorded_at: timestamp.toISOString(),
        });

      if (insertError) {
        console.error("❌ Database save FAILED:", insertError.message);
      } else {
        console.log("✅ Database save SUCCESS");
      }
    } catch (err) {
      console.error("❌ Error in location tracking task:", err);
    }

    console.log("=".repeat(60) + "\n");
  }
});

/**
 * Start background location tracking
 * Records when location changes (every ~100m); when stationary, at most one update every 10 min.
 */
export async function startLocationTracking(): Promise<boolean> {
  try {
    // Request permissions
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== "granted") {
      console.error("Foreground location permission not granted");
      return false;
    }

    // Request background permission (Android)
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== "granted") {
      console.warn(
        "Background location permission not granted - tracking will only work in foreground",
      );
      // Continue anyway - foreground tracking is better than nothing
    }

    // Check if already tracking
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TRACKING_TASK,
    );

    if (isTracking) {
      console.log("Location tracking already active");
      return true;
    }

    // Start location tracking — record only when location changes (after moving ~100m)
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10 * 60 * 1000, // Max 10 min between updates when stationary
      distanceInterval: MIN_DISTANCE_METERS, // Fire when user has moved this many meters
      foregroundService: {
        notificationTitle: "WorkFlow - Location Tracking",
        notificationBody: "Recording location when you move",
        notificationColor: "#2563EB",
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log("\n" + "🚀".repeat(30));
    console.log("✅ LOCATION TRACKING STARTED");
    console.log(
      "📍 Records when location changes (every ~" +
        MIN_DISTANCE_METERS +
        "m), max every 10 min when stationary",
    );
    console.log("🔋 Accuracy: Balanced (battery-friendly)");
    console.log("📱 Foreground service: Active");
    console.log("🚀".repeat(30) + "\n");
    return true;
  } catch (error) {
    console.error("❌ Error starting location tracking:", error);
    return false;
  }
}

/**
 * Stop background location tracking
 */
export async function stopLocationTracking(): Promise<boolean> {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TRACKING_TASK,
    );

    if (!isTracking) {
      console.log("Location tracking already stopped");
      return true;
    }

    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    console.log("\n" + "⏹️ ".repeat(30));
    console.log("✅ LOCATION TRACKING STOPPED");
    console.log("⏹️ ".repeat(30) + "\n");
    return true;
  } catch (error) {
    console.error("❌ Error stopping location tracking:", error);
    return false;
  }
}

/**
 * Check if location tracking is currently active
 */
export async function isLocationTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TRACKING_TASK,
    );
  } catch (error) {
    console.error("Error checking tracking status:", error);
    return false;
  }
}

/**
 * Get the last recorded location from the database
 */
export async function getLastRecordedLocation(userId: string) {
  try {
    const { data, error } = await supabase
      .from("location_logs")
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching last location:", error);
    return null;
  }
}
