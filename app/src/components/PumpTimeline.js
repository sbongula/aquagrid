import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Card from './Card';
import { theme, sourceColor } from '../theme';

/** 24 bars, one per hour. Tap a bar to read that hour's reason. */
export default function PumpTimeline({ steps }) {
  const data = steps.slice(0, 24);
  const [sel, setSel] = useState(null);
  const shown = sel === null ? null : data[sel];

  return (
    <Card title="PUMP SCHEDULE · NEXT 24H">
      <View style={styles.bars}>
        {data.map((s, i) => (
          <Pressable key={i} onPress={() => setSel(i === sel ? null : i)} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                { backgroundColor: s.action === 'pump' ? sourceColor(s.source) : theme.border },
                sel === i && styles.barSel,
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.axis}>
        {[0, 6, 12, 18].map((h) => (
          <Text key={h} style={styles.axisText}>{data[h]?.time.slice(11, 16)}</Text>
        ))}
      </View>

      <View style={styles.legend}>
        <Key color={theme.good} label="Solar" />
        <Key color={theme.warn} label="Partial solar" />
        <Key color={theme.bad} label="Diesel" />
        <Key color={theme.border} label="Idle" />
      </View>

      <View style={styles.detail}>
        {shown ? (
          <>
            <Text style={styles.detailHead}>
              {shown.time.slice(11, 16)} · {shown.action === 'pump' ? shown.source.toUpperCase() : 'IDLE'} ·
              {' '}tank {shown.tankPct.toFixed(0)}%
            </Text>
            <Text style={styles.detailText}>{shown.reason}</Text>
          </>
        ) : (
          <Text style={styles.detailText}>Tap any hour to see why the scheduler chose it.</Text>
        )}
      </View>
    </Card>
  );
}

function Key({ color, label }) {
  return (
    <View style={styles.keyRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.keyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', gap: 2 },
  barSlot: { flex: 1 },
  bar: { height: 46, borderRadius: 3 },
  barSel: { borderWidth: 2, borderColor: theme.text },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { color: theme.textDim, fontSize: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  keyText: { color: theme.textDim, fontSize: 11 },
  detail: {
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, minHeight: 54,
  },
  detailHead: { color: theme.text, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  detailText: { color: theme.textDim, fontSize: 12, lineHeight: 17 },
});
