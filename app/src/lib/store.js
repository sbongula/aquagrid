/**
 * Offline persistence for fetched locations.
 *
 * The bundled island needs no network at all. Anything the operator navigates
 * to afterwards does - once. This caches the result so an island you have
 * visited keeps working with no signal, which is the situation the whole app
 * is designed around.
 *
 * Cached forecasts carry the weather that was live when they were fetched, so
 * we record the time and let the UI say how old it is rather than pretending
 * it is current.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_LAST = 'aquagrid:lastLocation';
const KEY_CACHE = 'aquagrid:forecastCache';
const MAX_CACHED = 8;

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or unavailable store must never break the app; the bundled
    // island still works and everything recomputes from it.
  }
}

const idOf = (place) => `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;

/** Persist a fetched forecast and remember it as the active location. */
export async function saveLocation(place, forecast) {
  const cache = await readJson(KEY_CACHE, {});
  cache[idOf(place)] = { place, forecast, cachedAt: new Date().toISOString() };

  // Keep the store small and bounded - drop the oldest beyond MAX_CACHED.
  const entries = Object.entries(cache).sort(
    (a, b) => new Date(b[1].cachedAt) - new Date(a[1].cachedAt),
  );
  const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHED));

  await writeJson(KEY_CACHE, trimmed);
  await writeJson(KEY_LAST, idOf(place));
}

/** The location the operator was last looking at, if we still hold it. */
export async function loadLastLocation() {
  const id = await readJson(KEY_LAST, null);
  if (!id) return null;
  const cache = await readJson(KEY_CACHE, {});
  return cache[id] || null;
}

export async function loadCached(place) {
  const cache = await readJson(KEY_CACHE, {});
  return cache[idOf(place)] || null;
}

/** Every island held offline, newest first - for the picker's recent list. */
export async function listCached() {
  const cache = await readJson(KEY_CACHE, {});
  return Object.values(cache).sort((a, b) => new Date(b.cachedAt) - new Date(a.cachedAt));
}

export async function clearLocation() {
  await writeJson(KEY_LAST, null);
}

/** "3 min ago" / "yesterday" - so the UI never implies data is fresher than it is. */
export function describeAge(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
