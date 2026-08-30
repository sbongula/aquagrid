import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { useTheme, useStyles } from '../theme';

/**
 * Tank level as a large fill bar, with tick marks at the reserve floor and the
 * top-up target. No SVG needed - nested Views are enough and cannot break.
 */
export default function TankGauge({ step, plant, hoursOfSupply }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const pct = step.tankPct;
  const floorPct = plant.reserve_floor_pct;
  const targetPct = plant.tank_target_pct;

  const fillColor = pct < floorPct ? theme.bad : pct < floorPct * 1.4 ? theme.warn : theme.water;

  return (
    <Card title="TANK LEVEL">
      <View style={styles.topRow}>
        <Text style={[styles.pct, { color: fillColor }]}>{pct.toFixed(0)}%</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.litres}>
            {Math.round(step.tankL).toLocaleString()} / {plant.tank_capacity_l.toLocaleString()} L
          </Text>
          <Text style={styles.supply}>
            {hoursOfSupply === Infinity ? '48h+' : `${hoursOfSupply.toFixed(0)}h`} of supply at forecast demand
          </Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: fillColor }]} />
        <View style={[styles.tick, { left: `${floorPct}%`, backgroundColor: theme.bad }]} />
        <View style={[styles.tick, { left: `${targetPct}%`, backgroundColor: theme.good }]} />
      </View>

      <View style={styles.labels}>
        <Text style={[styles.tickLabel, { color: theme.bad }]}>{floorPct}% reserve floor</Text>
        <Text style={[styles.tickLabel, { color: theme.good }]}>{targetPct}% target</Text>
      </View>
    </Card>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  pct: { fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  litres: { color: theme.text, fontSize: 14, fontWeight: '600' },
  supply: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  track: {
    height: 26, backgroundColor: theme.bg, borderRadius: 8,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden', justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, opacity: 0.9 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tickLabel: { fontSize: 10, fontWeight: '600' },
});
