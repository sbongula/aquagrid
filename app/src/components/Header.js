import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export default function Header({ island, weatherSource, generatedAt, live: isLive }) {
  const live = weatherSource.includes('live');
  const stamp = new Date(generatedAt).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.brand}>AquaGrid</Text>
        <View style={[styles.pill, { borderColor: live ? theme.good : theme.warn }]}>
          <View style={[styles.dot, { backgroundColor: live ? theme.good : theme.warn }]} />
          <Text style={[styles.pillText, { color: live ? theme.good : theme.warn }]}>
            {live ? 'Live forecast' : 'Offline · cached'}
          </Text>
        </View>
      </View>
      <Text style={styles.island}>
        {island.name} · pop. {island.population.toLocaleString()}
      </Text>
      <Text style={styles.sub}>
        {isLive ? `Fetched ${stamp} · live` : `Forecast generated ${stamp} · runs fully offline`}
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
