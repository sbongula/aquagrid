import { View, Text, Pressable, StyleSheet } from 'react-native';
import Card from './Card';
import { useTheme, useStyles } from '../theme';

export default function LeakPanel({ leak, injected, onToggle }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <Card title="LEAK DETECTION">
      {leak.alert ? (
        <View style={[styles.box, { borderColor: theme.bad, backgroundColor: 'rgba(248,113,113,0.08)' }]}>
          <Text style={styles.alertHead}>⚠  ANOMALY DETECTED</Text>
          <Text style={styles.alertMsg}>{leak.message}</Text>
          <View style={styles.stats}>
            <Stat label="Rate" value={`${leak.estimatedRateLph} L/h`} />
            <Stat label="Since" value={leak.startedAtTime.slice(11, 16)} />
            <Stat label="Lost" value={`${leak.totalLostL.toLocaleString()} L`} />
            <Stat label="Confidence" value={`${(leak.confidence * 100).toFixed(0)}%`} />
          </View>
        </View>
      ) : (
        <View style={[styles.box, { borderColor: theme.good, backgroundColor: 'rgba(52,211,153,0.07)' }]}>
          <Text style={[styles.alertHead, { color: theme.good }]}>✓  NO ANOMALIES DETECTED</Text>
          <Text style={styles.okMsg}>
            Measured tank level is tracking the forecast within sensor noise.
          </Text>
        </View>
      )}

      <Text style={styles.explain}>
        Residual analysis, not a level threshold: each hour we compare the drop the sensor
        reports against the drop the demand model predicted. Three consecutive hours beyond
        3σ raises the alarm — long before the tank itself looks low.
      </Text>

      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.btn, { borderColor: injected ? theme.good : theme.bad, opacity: pressed ? 0.6 : 1 }]}>
        <Text style={[styles.btnText, { color: injected ? theme.good : theme.bad }]}>
          {injected ? 'Repair pipe' : 'Simulate burst pipe'}
        </Text>
      </Pressable>
    </Card>
  );
}

function Stat({ label, value }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 14 },
  alertHead: { color: theme.bad, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  alertMsg: { color: theme.text, fontSize: 14, lineHeight: 20, marginTop: 8 },
  okMsg: { color: theme.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  stat: { alignItems: 'flex-start' },
  statLabel: { color: theme.textDim, fontSize: 9, letterSpacing: 0.6 },
  statValue: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  explain: { color: theme.textDim, fontSize: 11, lineHeight: 16, marginTop: 12 },
  btn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  btnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
});
