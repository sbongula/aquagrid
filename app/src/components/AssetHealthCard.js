import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import Card from './Card';
import { useTheme, useStyles } from '../theme';

/**
 * Two slow failures, both found the same way as the leak: compare what the
 * plant does against what the forecast says it should. A threshold alarm sees
 * neither of these until they have been costing fuel for months.
 */
export default function AssetHealthCard({ soiling, fouling, dirty, onToggleDirty }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <Card title="ASSET HEALTH">
      <Section
        title="Solar array"
        alert={soiling.alert}
        message={soiling.message}
        stats={
          soiling.alert
            ? [
                ['Shortfall', `${soiling.shortfallPct.toFixed(0)}%`],
                ['Energy lost', `${soiling.lostKwh.toFixed(0)} kWh`],
                ['Sampled', `${soiling.hours} h`],
              ]
            : null
        }
      />

      {fouling && (
        <>
          <View style={styles.divider} />
          <Section
            title="RO membranes"
            alert={fouling.daysToThreshold < 90}
            message={fouling.message}
            stats={[
              ['Now', `${fouling.latest.toFixed(2)} kWh/m³`],
              ['Design', `${fouling.design.toFixed(2)}`],
              ['Clean in', `${Math.round(fouling.daysToThreshold)} d`],
            ]}
          />
          <FoulingChart fouling={fouling} />
        </>
      )}

      <Pressable
        onPress={onToggleDirty}
        style={({ pressed }) => [
          styles.btn,
          { borderColor: dirty ? theme.good : theme.warn, opacity: pressed ? 0.6 : 1 },
        ]}>
        <Text style={[styles.btnText, { color: dirty ? theme.good : theme.warn }]}>
          {dirty ? 'Wash the panels' : 'Simulate dirty panels'}
        </Text>
      </Pressable>
    </Card>
  );
}

function Section({ title, alert, message, stats }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const color = alert ? theme.warn : theme.good;
  return (
    <View>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.badge, { color }]}>{alert ? 'ATTENTION' : 'HEALTHY'}</Text>
      </View>
      <Text style={styles.msg}>{message}</Text>
      {stats && (
        <View style={styles.stats}>
          {stats.map(([l, v]) => (
            <View key={l}>
              <Text style={styles.statLabel}>{l}</Text>
              <Text style={styles.statValue}>{v}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function FoulingChart({ fouling }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const w = width - 4 * theme.pad;
  const h = 70;
  const all = [...fouling.actual, fouling.threshold];
  const min = Math.min(...all) * 0.995;
  const max = Math.max(...all) * 1.005;
  const y = (v) => h - ((v - min) / (max - min || 1)) * h;
  const pts = (arr) => arr.map((v, i) => `${(i / (arr.length - 1)) * w},${y(v)}`).join(' ');

  return (
    <View style={{ marginTop: 10 }}>
      <Svg width={w} height={h + 4}>
        <Line x1={0} y1={y(fouling.threshold)} x2={w} y2={y(fouling.threshold)}
              stroke={theme.bad} strokeWidth={1} strokeDasharray="4 4" />
        <Polyline points={pts(fouling.actual)} fill="none" stroke={theme.textDim} strokeWidth={1.5} strokeOpacity={0.6} />
        <Polyline points={pts(fouling.fit)} fill="none" stroke={theme.warn} strokeWidth={2} />
      </Svg>
      <Text style={styles.axis}>
        90 days of daily readings · amber is the fitted trend · dashed red is the clean threshold
      </Text>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  title: { color: theme.text, fontSize: 14, fontWeight: '700', flex: 1 },
  badge: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  msg: { color: theme.textDim, fontSize: 12, lineHeight: 18, marginTop: 7 },
  stats: { flexDirection: 'row', gap: 26, marginTop: 10 },
  statLabel: { color: theme.textDim, fontSize: 9, letterSpacing: 0.5 },
  statValue: { color: theme.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 16 },
  axis: { color: theme.textDim, fontSize: 10, marginTop: 4, lineHeight: 14 },
  btn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  btnText: { fontSize: 13, fontWeight: '700' },
});
