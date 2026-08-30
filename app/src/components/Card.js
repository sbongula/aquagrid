import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

/** Shared card chrome. Every panel down the screen uses this. */
export default function Card({ title, right, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {(title || right) && (
        <View style={styles.head}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.pad,
    marginHorizontal: theme.pad,
    marginBottom: 12,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: theme.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
});
