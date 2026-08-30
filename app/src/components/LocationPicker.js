import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import { theme } from '../theme';

/**
 * Point the plant at any island on Earth.
 *
 * Search resolves through Open-Meteo's geocoder; picking a result fetches that
 * location's real solar and temperature forecast and re-runs the demand model
 * on-device. If the network is unavailable the app stays on the island bundled
 * at build time and says so.
 */
export default function LocationPicker({ island, onSelect, onReset, isCustom, search }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

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

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose an island</Text>
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

            {searching && (
              <View style={styles.row}>
                <ActivityIndicator color={theme.water} />
                <Text style={styles.dim}>Searching…</Text>
              </View>
            )}
            {error && <Text style={styles.err}>{error}</Text>}

            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
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

            <Pressable onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          </View>
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
  btn: {
    borderWidth: 1, borderColor: theme.water, borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  btnText: { color: theme.water, fontSize: 13, fontWeight: '700' },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 4, alignItems: 'center' },
  btnGhostText: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 28, maxHeight: '88%',
  },
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
