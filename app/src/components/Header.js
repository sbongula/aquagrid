import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, useStyles, useThemeMode } from '../theme';

export default function Header({ island, weatherSource, generatedAt, live: isLive, freshness, describeAge }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const { pref, setPref, resolved } = useThemeMode();

  // auto -> light -> dark -> auto. Auto follows the clock, so the plant reads
  // light in daylight and dark at night without anyone touching it.
  const cyclePref = () => setPref(pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto');
  const prefIcon = pref === 'auto' ? (resolved === 'light' ? '◐' : '◑') : pref === 'light' ? '☀' : '☾';
  const prefLabel = pref === 'auto' ? 'Auto' : pref === 'light' ? 'Light' : 'Dark';
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
        <View style={styles.headRight}>
          <View style={[styles.pill, { borderColor: pillColor }]}>
            <View style={[styles.dot, { backgroundColor: pillColor }]} />
            <Text style={[styles.pillText, { color: pillColor }]}>{pill}</Text>
          </View>
          <Pressable
            onPress={cyclePref}
            hitSlop={10}
            accessibilityLabel={`Theme: ${prefLabel}. Tap to change.`}
            style={({ pressed }) => [styles.themeBtn, { opacity: pressed ? 0.55 : 1 }]}>
            <Text style={styles.themeIcon}>{prefIcon}</Text>
          </Pressable>
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

const makeStyles = (theme) => StyleSheet.create({
  wrap: { paddingHorizontal: theme.pad, paddingTop: 8, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: theme.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeBtn: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 999,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  themeIcon: { color: theme.textDim, fontSize: 14, lineHeight: 18 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  island: { color: theme.water, fontSize: 15, fontWeight: '600', marginTop: 4 },
  sub: { color: theme.textDim, fontSize: 11, marginTop: 3 },
});
