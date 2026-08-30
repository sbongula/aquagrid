import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export default function Header({ island, weatherSource, generatedAt, live: isLive, freshness, describeAge }) {
  const kind = freshness?.kind || (weatherSource.includes('live') ? 'live' : 'bundled');
  const live = kind === 'live';
  const cached = kind === 'cached';
  const pill = live ? 'Live forecast' : cached ? 'Offline · cached' : 'Bundled forecast';
  const pillColor = live ? theme.good : cached ? theme.warn : theme.textDim;
  const stamp = new Date(generatedAt).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.brand}>AquaGrid</Text>
        <View style={[styles.pill, { borderColor: pillColor }]}>
          <View style={[styles.dot, { backgroundColor: pillColor }]} />
          <Text style={[styles.pillText, { color: pillColor }]}>{pill}</Text>
        </View>
      </View>
      <Text style={styles.island}>
        {island.name} · pop. {island.population.toLocaleString()}
      </Text>
      <Text style={styles.sub}>
        {live
          ? `Weather fetched ${describeAge ? describeAge(generatedAt) : stamp} · on-device forecast`
          : cached
            ? `Cached ${describeAge ? describeAge(generatedAt) : stamp} · works with no signal`
            : `Bundled ${stamp} · runs fully offline`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: theme.pad, paddingTop: 8, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: theme.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  island: { color: theme.water, fontSize: 15, fontWeight: '600', marginTop: 4 },
  sub: { color: theme.textDim, fontSize: 11, marginTop: 3 },
});
