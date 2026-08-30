/**
 * Point the plant at any island on Earth.
 *
 * Two Open-Meteo endpoints, neither of which needs an API key:
 *   - geocoding, to turn a typed name into coordinates and a population
 *   - forecast, for that location's real solar radiation and temperature
 *
 * Demand is then predicted on-device from the exported model table, so the only
 * thing the network provides is weather. With no network the app falls back to
 * the island bundled at build time and keeps working.
 */

import { predictDemandLph } from '../logic/demand.js';
import { scalePlant } from '../logic/plant.js';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;

const HORIZON_HOURS = 48;
const WARMUP_HOURS = 24;
// Population is missing from the geocoding response for many small settlements.
// An island community of this size keeps the plant in a sensible range.
const FALLBACK_POPULATION = 3000;

function withTimeout(promise, ms = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function getJson(url) {
  const res = await withTimeout(fetch(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function geocode(name) {
  const data = await getJson(
    `${GEO_URL}?name=${encodeURIComponent(name)}&count=8&language=en&format=json`,
  );
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country || '',
    admin: r.admin1 || '',
    lat: r.latitude,
    lon: r.longitude,
    population: r.population || null,
    timezone: r.timezone,
  }));
}

/**
 * Typed name -> candidate locations. Returns [] rather than throwing.
 *
 * The geocoder matches a settlement name only, so "Male Maldives" and
 * "Apia, Samoa" both return nothing on a literal query. Fall back to the first
 * token and, when the rest of the string names the country, prefer the matches
 * in it.
 */
export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const direct = await geocode(q);
    if (direct.length) return direct;

    const parts = q.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) return [];

    const head = parts[0];
    const rest = parts.slice(1).join(' ').toLowerCase();
    const loose = await geocode(head);

    const matches = loose.filter(
      (r) =>
        r.country.toLowerCase().includes(rest) ||
        r.admin.toLowerCase().includes(rest) ||
        rest.includes(r.country.toLowerCase()),
    );
    return matches.length ? matches : loose;
  } catch {
    return [];
  }
}

/**
 * Build the same `hourly` array shape that ml/train_model.py exports, but for a
 * location chosen at runtime. Timestamps come back in the location's own local
 * time (timezone=auto) - without that, an island at UTC+12 would have its peak
 * solar land at local midnight and every pump decision would invert.
 */
export async function buildLocationForecast(place, basePlant, demandModel) {
  const data = await getJson(
    `${WX_URL}?latitude=${place.lat}&longitude=${place.lon}` +
      '&hourly=shortwave_radiation,temperature_2m,cloud_cover' +
      // past_days gives us yesterday, which the app replays through the
      // scheduler so the starting tank level reflects this island's weather.
      '&past_days=1&forecast_days=3&timezone=auto',
  );

  const h = data.hourly;
  const population = place.population || FALLBACK_POPULATION;
  const plant = scalePlant(basePlant, population, demandModel.reference_population);

  const n = Math.min(WARMUP_HOURS + HORIZON_HOURS, h.time.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const t = h.time[i];
    const d = new Date(t);
    const tempC = h.temperature_2m[i];
    const radiation = h.shortwave_radiation[i] || 0;

    rows.push({
      time: t,
      hour: d.getHours(),
      solar_kw: Number(((radiation * plant.array_m2 * plant.array_efficiency) / 1000).toFixed(2)),
      temp_c: tempC,
      cloud_pct: h.cloud_cover[i],
      predicted_demand_lph: Number(
        predictDemandLph(demandModel, {
          hour: d.getHours(),
          dayOfWeek: (d.getDay() + 6) % 7, // JS Sunday=0 -> model Monday=0
          month: d.getMonth() + 1,
          tempC,
          population,
        }).toFixed(1),
      ),
    });
  }

  const warmup = rows.slice(0, WARMUP_HOURS);
  const hourly = rows.slice(warmup.length);
  if (!hourly.length) throw new Error('no forecast hours returned');

  return {
    island: {
      name: [place.name, place.country].filter(Boolean).join(', '),
      lat: place.lat,
      lon: place.lon,
      population,
      population_estimated: !place.population,
    },
    plant,
    warmup,
    hourly,
    weather_source: 'open-meteo (live)',
    fetched_at: new Date().toISOString(),
  };
}
