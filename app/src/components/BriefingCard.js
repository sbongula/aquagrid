import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Card from './Card';
import { useTheme, useStyles } from '../theme';
import { MODEL_LABEL } from '../lib/ai';

export default function BriefingCard({ text, loading, live }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <Card
      title="OPERATOR BRIEFING"
      right={
        <Text style={[styles.badge, { color: live ? theme.good : theme.textDim }]}>
          {live ? `AI · ${MODEL_LABEL}` : 'on-device'}
        </Text>
      }>
      {loading ? (
        <View style={styles.loadRow}>
          <ActivityIndicator color={theme.water} />
          <Text style={styles.loadText}>Writing shift briefing…</Text>
        </View>
      ) : (
        <Text style={styles.body}>{text}</Text>
      )}
    </Card>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  body: { color: theme.text, fontSize: 14, lineHeight: 22 },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadText: { color: theme.textDim, fontSize: 13 },
});
