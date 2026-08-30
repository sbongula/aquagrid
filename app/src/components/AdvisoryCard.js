import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { theme } from '../theme';

/**
 * The only part of the system that talks to the village rather than the plant.
 * Scheduling supply is half the problem; the cheapest litre of diesel is the one
 * nobody needed because the laundry ran at noon.
 */
export default function AdvisoryCard({ text, live, windows, rationing }) {
  return (
    <Card
      title="PUBLIC WATER NOTICE"
      right={<Text style={[styles.badge, { color: live ? theme.good : theme.textDim }]}>
        {live ? 'AI drafted' : 'on-device'}
      </Text>}>
      <Text style={styles.body}>{text}</Text>

      {windows.length > 0 && (
        <View style={styles.windows}>
          {windows.map((w) => (
            <View key={w.from} style={styles.chip}>
              <Text style={styles.chipTime}>{w.from}–{w.to}</Text>
              <Text style={styles.chipMeta}>{(w.litres / 1000).toFixed(0)} m³ free</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.ration}>
        <View style={styles.rationRow}>
          <Text style={styles.rationLabel}>Available per person per day</Text>
          <Text style={[styles.rationValue, { color: rationing.aboveWho ? theme.good : theme.bad }]}>
            {rationing.availableLpd.toFixed(1)} L
          </Text>
        </View>
        <View style={styles.scale}>
          <View style={[styles.scaleFill, {
            width: `${Math.min(100, (rationing.availableLpd / (rationing.whoMinLpd * 2)) * 100)}%`,
            backgroundColor: rationing.aboveWho ? theme.good : theme.bad,
          }]} />
          <View style={[styles.whoMark, { left: '50%' }]} />
        </View>
        <Text style={styles.rationNote}>
          Marker is the WHO minimum of {rationing.whoMinLpd} L per person per day for drinking,
          cooking and basic hygiene. {rationing.required ? 'Rationing notice warranted.' : 'No rationing required.'}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  body: { color: theme.text, fontSize: 14, lineHeight: 21 },
  windows: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1, borderColor: theme.good, borderRadius: 9,
    paddingHorizontal: 11, paddingVertical: 7, backgroundColor: 'rgba(52,211,153,0.08)',
  },
  chipTime: { color: theme.good, fontSize: 13, fontWeight: '700' },
  chipMeta: { color: theme.textDim, fontSize: 10, marginTop: 1 },
  ration: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  rationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rationLabel: { color: theme.textDim, fontSize: 12 },
  rationValue: { fontSize: 20, fontWeight: '800' },
  scale: {
    height: 10, backgroundColor: theme.bg, borderRadius: 5, marginTop: 8,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden', justifyContent: 'center',
  },
  scaleFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  whoMark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: theme.text },
  rationNote: { color: theme.textDim, fontSize: 10, lineHeight: 15, marginTop: 8 },
});
