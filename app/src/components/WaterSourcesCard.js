import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { useTheme, useStyles } from '../theme';

/**
 * Where the island's water actually comes from over the horizon. On Tuvalu this
 * is the headline: rain is the primary source and desalination is the backup,
 * which is the opposite of how the plant is usually described.
 */
export default function WaterSourcesCard({ totals, steps, plant }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const rain = totals.harvestedL;
  const desal = totals.waterDeliveredL;
  const total = rain + desal || 1;
  const rainPct = (rain / total) * 100;

  const rainHours = steps.filter((s) => s.rainMm > 0).length;
  const totalMm = steps.reduce((a, s) => a + s.rainMm, 0);

  return (
    <Card title="WHERE THE WATER CAME FROM">
      <View style={styles.bar}>
        <View style={[styles.seg, { flex: Math.max(rain, 1), backgroundColor: theme.water }]} />
        <View style={[styles.seg, { flex: Math.max(desal, 1), backgroundColor: theme.solar }]} />
      </View>

      <View style={styles.rows}>
        <Row color={theme.water} label="Rainwater harvested"
             value={`${(rain / 1000).toFixed(1)} m³`} pct={rainPct} />
        <Row color={theme.solar} label="Desalinated"
             value={`${(desal / 1000).toFixed(1)} m³`} pct={100 - rainPct} />
      </View>

      <Text style={styles.note}>
        {totalMm.toFixed(1)} mm of rain over {rainHours} h across{' '}
        {plant.roof_catchment_m2.toLocaleString()} m² of catchment at{' '}
        {(plant.runoff_coeff * 100).toFixed(0)}% runoff.
        {totals.spilledL > 100
          ? ` ${(totals.spilledL / 1000).toFixed(1)} m³ overflowed a full tank.`
          : ' Nothing overflowed.'}
      </Text>
      <Text style={styles.note}>
        Every litre of rain is a litre the plant did not have to make, which is why the scheduler
        holds the pump when a shower is in the forecast.
      </Text>
    </Card>
  );
}

function Row({ color, label, value, pct }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.pct}>{pct.toFixed(0)}%</Text>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  seg: { height: 14 },
  rows: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { color: theme.text, fontSize: 13, flex: 1 },
  value: { color: theme.text, fontSize: 13, fontWeight: '700' },
  pct: { color: theme.textDim, fontSize: 12, width: 42, textAlign: 'right' },
  note: { color: theme.textDim, fontSize: 11, lineHeight: 16, marginTop: 10 },
});
