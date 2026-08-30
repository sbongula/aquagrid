import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { theme } from '../theme';

/**
 * Burning too much diesel and running out of diesel are different failures.
 * SavingsCard answers the first. This answers the second, which on an island is
 * the one that actually stops the water.
 */
export default function FuelCard({ outlook, baselines }) {
  if (!outlook) return null;
  const bad = outlook.willRunDry;
  const color = bad ? theme.bad : theme.good;

  return (
    <Card title="DIESEL INVENTORY">
      <View style={styles.row}>
        <View>
          <Text style={[styles.big, { color }]}>
            {outlook.stockL.toLocaleString()}<Text style={styles.unit}> L</Text>
          </Text>
          <Text style={styles.dim}>
            {outlook.stockPct.toFixed(0)}% of the {outlook.capacityL.toLocaleString()} L day tank
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.stat}>{outlook.daysToBarge} days</Text>
          <Text style={styles.dim}>until the next barge</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, outlook.stockPct)}%`, backgroundColor: color }]} />
      </View>

      <Text style={[styles.msg, bad && { color: theme.bad }]}>{outlook.message}</Text>

      {baselines?.length > 0 && (
        <View style={styles.compare}>
          <Text style={styles.compareHead}>SAME FUEL, DIFFERENT SCHEDULER</Text>
          {baselines.map((b) => (
            <View key={b.name} style={styles.cmpRow}>
              <View style={[styles.dot, { backgroundColor: b.outlook.willRunDry ? theme.bad : theme.good }]} />
              <Text style={styles.cmpName}>{b.name}</Text>
              <Text style={[styles.cmpVal, { color: b.outlook.willRunDry ? theme.bad : theme.good }]}>
                {b.outlook.daysToEmpty === Infinity
                  ? 'never runs dry'
                  : `${b.outlook.daysToEmpty.toFixed(1)} days of fuel`}
              </Text>
            </View>
          ))}
          <Text style={styles.note}>
            The barge does not come early because you ran out. A scheduler that saves fuel is the
            difference between having water until resupply and not.
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  big: { fontSize: 30, fontWeight: '800' },
  unit: { color: theme.textDim, fontSize: 14, fontWeight: '600' },
  stat: { color: theme.text, fontSize: 17, fontWeight: '700' },
  dim: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  track: {
    height: 10, backgroundColor: theme.bg, borderRadius: 5, marginTop: 12,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  msg: { color: theme.text, fontSize: 13, lineHeight: 19, marginTop: 12 },
  compare: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  compareHead: { color: theme.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cmpName: { color: theme.text, fontSize: 13, flex: 1 },
  cmpVal: { fontSize: 12, fontWeight: '700' },
  note: { color: theme.textDim, fontSize: 10, lineHeight: 15, marginTop: 10, fontStyle: 'italic' },
});
