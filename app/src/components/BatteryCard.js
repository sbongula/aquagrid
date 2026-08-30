import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import Card from './Card';
import { theme } from '../theme';

/**
 * State of charge across the horizon. The battery is what lets midday surplus
 * run the pump into the 18:00-20:00 demand peak instead of being curtailed.
 */
export default function BatteryCard({ steps, plant, totals }) {
  const { width } = useWindowDimensions();
  const w = width - 4 * theme.pad;
  const h = 90;
  const data = steps.slice(0, 24);
  const cap = plant.battery_kwh || 1;

  const pts = data
    .map((s, i) => `${(i / (data.length - 1)) * w},${h - (s.socKwh / cap) * h}`)
    .join(' ');

  const now = steps[0];

  return (
    <Card title="BATTERY">
      <View style={styles.row}>
        <View>
          <Text style={styles.big}>
            {now.socKwh.toFixed(0)}<Text style={styles.unit}> / {cap.toFixed(0)} kWh</Text>
          </Text>
          <Text style={styles.dim}>{now.socPct.toFixed(0)}% charged</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.stat}>{totals.batteryKwh.toFixed(0)} kWh</Text>
          <Text style={styles.dim}>discharged to the pump</Text>
        </View>
      </View>

      <Svg width={w} height={h + 6} style={{ marginTop: 12 }}>
        <Line x1={0} y1={h} x2={w} y2={h} stroke={theme.border} strokeWidth={1} />
        <Polyline points={pts} fill="none" stroke={theme.water} strokeWidth={2} />
      </Svg>
      <Text style={styles.axis}>next 24 h — state of charge</Text>

      <View style={styles.foot}>
        <Foot label="Solar to pump" value={`${totals.solarKwh.toFixed(0)} kWh`} color={theme.good} />
        <Foot label="From battery" value={`${totals.batteryKwh.toFixed(0)} kWh`} color={theme.water} />
        <Foot label="Curtailed" value={`${totals.curtailedKwh.toFixed(0)} kWh`} color={theme.textDim} />
      </View>
      {totals.curtailedKwh > 1 && (
        <Text style={styles.note}>
          Curtailed energy is sun that arrived with the battery already full and the pump already
          running — the ceiling on what a bigger battery could buy.
        </Text>
      )}
    </Card>
  );
}

function Foot({ label, value, color }) {
  return (
    <View>
      <Text style={styles.footLabel}>{label}</Text>
      <Text style={[styles.footValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  big: { color: theme.water, fontSize: 30, fontWeight: '800' },
  unit: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  stat: { color: theme.text, fontSize: 17, fontWeight: '700' },
  dim: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  axis: { color: theme.textDim, fontSize: 10, marginTop: 2 },
  foot: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border,
  },
  footLabel: { color: theme.textDim, fontSize: 10, letterSpacing: 0.5 },
  footValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  note: { color: theme.textDim, fontSize: 10, lineHeight: 15, marginTop: 10, fontStyle: 'italic' },
});
