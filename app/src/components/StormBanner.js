import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useStyles } from '../theme';

/**
 * A cyclone changes the objective from "spend the least fuel" to "have the most
 * water when the power goes out". Loud enough that it cannot be missed.
 */
export default function StormBanner({ step, windKmh }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.head}>⛈  STORM PREPARATION ACTIVE</Text>
      <Text style={styles.body}>
        Sustained winds of {windKmh.toFixed(0)} km/h forecast within 24 hours. The scheduler has
        overridden its fuel-saving rules and is filling the tank to 100%.
      </Text>
      <Text style={styles.sub}>
        After landfall the array is down, the pump may be offline, and the resupply barge will not
        sail. Whatever is in the tank is what the island has.
      </Text>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: theme.bad, borderWidth: 1.5, borderRadius: theme.radius,
    padding: theme.pad, marginHorizontal: theme.pad, marginBottom: 12,
  },
  head: { color: theme.bad, fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
  body: { color: theme.text, fontSize: 14, lineHeight: 20, marginTop: 8 },
  sub: { color: theme.textDim, fontSize: 12, lineHeight: 17, marginTop: 8 },
});
