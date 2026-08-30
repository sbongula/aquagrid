import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Card from './Card';
import { useTheme, useStyles } from '../theme';

/**
 * Why this exists, for anyone who scrolls to the bottom. Collapsed by default -
 * the operator does not need it, but a judge usually wants it.
 */
export default function AboutCard() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);

  return (
    <Card title="ABOUT AQUAGRID">
      <Text style={styles.lead}>
        Tuvalu runs on rain. When the rain stops it runs on desalination, and desalination runs on
        diesel that arrives by barge. AquaGrid schedules that against the weather instead of a
        clock.
      </Text>

      {open && (
        <View style={styles.more}>
          <Text style={styles.p}>
            In 2011 a drought left Funafuti with days of fresh water remaining and a state of
            emergency declared. The vulnerability was never that the plant was too small — it was
            that nobody could see far enough ahead to act early.
          </Text>
          <Text style={styles.p}>
            The hard parts are already solved on most islands. The panels are on the roof, the tank
            is in the ground, the plant works, and the forecast is free. What is missing is the thin
            layer that looks at tomorrow and decides what to do tonight. That layer is software, and
            software is the cheapest thing you can add to an island.
          </Text>
          <Text style={styles.p}>
            So this asks nobody to buy anything. It takes equipment an island already has and
            schedules it against a forecast — the difference between making water when it is free
            and making it when it is expensive.
          </Text>
          <Text style={styles.p}>
            It had to work with no signal. An app that needs a server to decide whether to run a
            pump fails exactly when an island is cut off, which is exactly when it matters. Put this
            phone in airplane mode and nothing here stops working.
          </Text>
          <Text style={styles.caveat}>
            It is a scheduler built in a hackathon, on synthetic demand history and simulated
            sensors, and the README says so wherever it applies. The idea underneath — one forecast
            shared by the pump, the tank and the fuel log — needs no new hardware to be true.
          </Text>
        </View>
      )}

      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8}>
        <Text style={styles.toggle}>{open ? 'Show less' : 'Why we built this →'}</Text>
      </Pressable>

      <Text style={styles.credit}>
        Rishik · Neekin · Srihan · Ednit · Gowtham{'\n'}
        DreamHacks 2026 · Track 2 — AI, Automation & Logic
      </Text>
    </Card>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  lead: { color: theme.text, fontSize: 14, lineHeight: 21 },
  more: { marginTop: 12, gap: 11 },
  p: { color: theme.textDim, fontSize: 13, lineHeight: 19 },
  caveat: {
    color: theme.textDim, fontSize: 12, lineHeight: 18, fontStyle: 'italic',
    borderLeftWidth: 2, borderLeftColor: theme.water, paddingLeft: 11,
  },
  toggle: { color: theme.water, fontSize: 13, fontWeight: '700', marginTop: 12 },
  credit: {
    color: theme.textDim, fontSize: 10, marginTop: 14, paddingTop: 11,
    borderTopWidth: 1, borderTopColor: theme.border, lineHeight: 15,
  },
});
