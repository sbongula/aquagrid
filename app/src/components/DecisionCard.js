import { View, Text, StyleSheet } from 'react-native';
import { theme, sourceColor, sourceLabel } from '../theme';

/**
 * The single most important element on screen: what the plant is doing right
 * now, and the one-line reason the scheduler gives for it.
 */
export default function DecisionCard({ step }) {
  const color = step.action === 'pump' ? sourceColor(step.source) : theme.textDim;

  return (
    <View style={[styles.card, { borderColor: color }]}>
      <View style={styles.row}>
        <Text style={styles.now}>NOW · {step.time.slice(11, 16)}</Text>
        <Text style={styles.solar}>{step.solarKw.toFixed(1)} kW solar</Text>
      </View>
      <Text style={[styles.action, { color }]}>{sourceLabel(step)}</Text>
      <Text style={styles.reason}>{step.reason}</Text>
      <View style={styles.footRow}>
        <Foot label="Demand" value={`${Math.round(step.demandL)} L/h`} />
        <Foot label="Producing" value={step.pumpedL ? `${step.pumpedL.toLocaleString()} L/h` : '—'} />
        <Foot label="Diesel" value={step.dieselL > 0.05 ? `${step.dieselL.toFixed(1)} L/h` : 'none'}
              color={step.dieselL > 0.05 ? theme.bad : theme.good} />
      </View>
    </View>
  );
}

function Foot({ label, value, color }) {
  return (
    <View>
      <Text style={styles.footLabel}>{label}</Text>
      <Text style={[styles.footValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderWidth: 2, borderRadius: theme.radius,
    padding: theme.pad, marginHorizontal: theme.pad, marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  now: { color: theme.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  solar: { color: theme.solar, fontSize: 12, fontWeight: '700' },
  action: { fontSize: 24, fontWeight: '800', marginTop: 10, letterSpacing: -0.4 },
  reason: { color: theme.text, fontSize: 14, lineHeight: 20, marginTop: 8, opacity: 0.9 },
  footRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border,
  },
  footLabel: { color: theme.textDim, fontSize: 10, letterSpacing: 0.6 },
  footValue: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
});
