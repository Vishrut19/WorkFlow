/**
 * Lightweight in-memory + sessionStorage cache for admin data.
 * Keys: string. Values: JSON-serializable. TTL in ms.
 */

const MEMORY = new Map<string, { value: unknown; expires: number }>();
const STORAGE_KEY = 'workflow_admin_cache';
const MAX_AGE_MS = 60 * 1000; // 1 min default

function getFromStorage(): Record<string, { value: unknown; expires: number }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, { value: unknown; expires: number }>) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed: Record<string, { value: unknown; expires: number }> = {};
    const now = Date.now();
    for (const [k, v] of Object.entries(data)) {
      if (v.expires > now) trimmed[k] = v;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota or disabled
  }
}

export function getCached<T>(key: string): T | null {
  const hit = MEMORY.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const stored = getFromStorage()[key];
  if (stored && stored.expires > Date.now()) {
    MEMORY.set(key, stored);
    return stored.value as T;
  }
  return null;
}

export function setCached<T>(key: string, value: T, ttlMs = MAX_AGE_MS) {
  const expires = Date.now() + ttlMs;
  const entry = { value, expires };
  MEMORY.set(key, entry);
  const all = getFromStorage();
  all[key] = entry;
  saveToStorage(all);
}

export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard_stats',
  STAFF_LIST: 'staff_list',
  ATTENDANCE: (date: string) => `attendance_${date}`,
  DEVICES: 'devices_list',
  REPORTS: 'reports_stats',
  PROFILE: (id: string) => `profile_${id}`,
} as const;
