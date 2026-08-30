import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ActivityIndicator, ScrollView,
  StyleSheet, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { theme } from '../theme';
import { listCached, describeAge } from '../lib/store';

/**
 * Point the plant at any island on Earth.
 *
 * Search resolves through Open-Meteo's geocoder; picking a result fetches that
 * location's real solar and temperature forecast and re-runs the demand model
 * on-device. If the network is unavailable the app stays on the island bundled
 * at build time and says so.
 */
export default function LocationPicker({ island, onSelect, onReset, isCustom, search, onUseGps, freshness }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [recents, setRecents] = useState([]);
  const [gpsBusy, setGpsBusy] = useState(false);

  // Islands already held offline. Shown when the search box is empty, so the
  // picker is useful with no signal at all.
  useEffect(() => {
    if (open) listCached().then(setRecents);
  }, [open]);

  const useGps = async () => {
    setGpsBusy(true);
    setError(null);
    try {
      await onUseGps();
      setOpen(false);
      setQuery('');
    } catch (e) {
      setError(
        String(e?.message).includes('permission')
          ? 'Location permission denied. Search by name instead.'
          : 'Could not get a GPS fix. Search by name instead.',
      );
    } finally {
      setGpsBusy(false);
    }
  };

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await search(query);
      if (!cancelled) {
        setResults(r);
        setSearching(false);
        if (!r.length) setError('No match — check the spelling, or you may be offline.');
        else setError(null);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open, search]);

  const pick = async (place) => {
    setLoading(place.id);
    setError(null);
    try {
      await onSelect(place);
      setOpen(false);
      setQuery('');
      setResults([]);
    } catch {
      setError('Could not reach the weather service. Still running on the bundled forecast.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>PLANT LOCATION</Text>
          <Text style={styles.name}>{island.name}</Text>
          <Text style={styles.meta}>
            pop. {island.population.toLocaleString()}
            {island.population_estimated ? ' (est.)' : ''} · {island.lat.toFixed(2)}°, {island.lon.toFixed(2)}°
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={styles.btnText}>Change</Text>
          </Pressable>
          {isCustom && (
            <Pressable onPress={onReset} style={({ pressed }) => [styles.btnGhost, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={styles.btnGhostText}>Reset</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        {/* Anchored to the top of the screen: the software keyboard occupies the
            bottom half, and a bottom sheet would put the results underneath it. */}
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Choose an island</Text>
              <Pressable onPress={() => { Keyboard.dismiss(); setOpen(false); }} hitSlop={12}>
                <Text style={styles.closeX}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.sheetSub}>
              Any location on Earth. We fetch its real solar and temperature forecast, then
              run the demand model on-device and size the plant to its population.
            </Text>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Malé, Nuku'alofa, Santorini…"
              placeholderTextColor={theme.textDim}
              autoCorrect={false}
              autoFocus
              style={styles.input}
              returnKeyType="search"
            />

            <Pressable
              onPress={useGps}
              disabled={gpsBusy}
              style={({ pressed }) => [styles.gps, { opacity: pressed || gpsBusy ? 0.6 : 1 }]}>
              {gpsBusy
                ? <ActivityIndicator color={theme.water} />
                : <Text style={styles.gpsText}>◎  Use my current location</Text>}
            </Pressable>

            {searching && (
              <View style={styles.row}>
                <ActivityIndicator color={theme.water} />
                <Text style={styles.dim}>Searching…</Text>
              </View>
            )}
            {error && <Text style={styles.err}>{error}</Text>}

            <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
              {!query.trim() && recents.length > 0 && (
                <>
                  <Text style={styles.groupLabel}>AVAILABLE OFFLINE</Text>
                  {recents.map((r) => (
                    <Pressable
                      key={`c-${r.place.lat},${r.place.lon}`}
                      onPress={() => pick(r.place)}
                      style={({ pressed }) => [styles.result, { opacity: pressed ? 0.55 : 1 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rName}>{r.forecast.island.name}</Text>
                        <Text style={styles.rMeta}>cached {describeAge(r.cachedAt)}</Text>
                      </View>
                      <Text style={styles.offlineDot}>●</Text>
                    </Pressable>
                  ))}
                </>
              )}
              {results.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => pick(p)}
                  disabled={loading !== null}
                  style={({ pressed }) => [styles.result, { opacity: pressed || loading === p.id ? 0.55 : 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rName}>
                      {p.name}{p.country ? `, ${p.country}` : ''}
                    </Text>
                    <Text style={styles.rMeta}>
                      {p.admin ? `${p.admin} · ` : ''}
                      {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
                      {p.population ? ` · pop. ${p.population.toLocaleString()}` : ' · population unknown'}
                    </Text>
                  </View>
                  {loading === p.id && <ActivityIndicator color={theme.water} />}
                </Pressable>
              ))}
            </ScrollView>

          </View>

          {/* Tapping the dimmed area below the sheet closes it. */}
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setOpen(false); }}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1,
    borderRadius: theme.radius, padding: theme.pad,
    marginHorizontal: theme.pad, marginBottom: 12,
  },
  label: { color: theme.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  name: { color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  meta: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  gps: {
    borderWidth: 1, borderColor: theme.water, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 12,
  },
  gpsText: { color: theme.water, fontSize: 14, fontWeight: '700' },
  groupLabel: {
    color: theme.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1.2,
    marginTop: 14, marginBottom: 4,
  },
  offlineDot: { color: theme.good, fontSize: 10 },
  btn: {
    borderWidth: 1, borderColor: theme.water, borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  btnText: { color: theme.water, fontSize: 13, fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 4, alignItems: 'center' },
  btnGhostText: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-start' },
  sheet: {
    backgroundColor: theme.surface,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    borderBottomWidth: 1, borderColor: theme.border,
    paddingHorizontal: 20, paddingBottom: 18,
    paddingTop: 64, // clears the status bar / notch
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeX: { color: theme.textDim, fontSize: 20, fontWeight: '700' },
  results: { maxHeight: 260 },
  sheetTitle: { color: theme.text, fontSize: 19, fontWeight: '800' },
  sheetSub: { color: theme.textDim, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 14 },
  input: {
    backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1, borderRadius: 10,
    color: theme.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  dim: { color: theme.textDim, fontSize: 13 },
  err: { color: theme.warn, fontSize: 12, lineHeight: 17, marginTop: 12 },
  result: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  rName: { color: theme.text, fontSize: 15, fontWeight: '600' },
  rMeta: { color: theme.textDim, fontSize: 11, marginTop: 3 },
  close: { paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  closeText: { color: theme.water, fontSize: 15, fontWeight: '700' },
});
