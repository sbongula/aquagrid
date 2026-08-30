import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Card from './Card';
import { useTheme, useStyles } from '../theme';
import { HAS_KEY, MODEL_LABEL } from '../lib/ai';

/**
 * Preset questions rather than a text input: a judge can interrogate the
 * scheduler in one tap, and nobody has to type on camera.
 */
const PRESETS = [
  { chip: 'Why not pump at noon?', q: 'Why did you not run the pump during the midday hours today?' },
  { chip: 'What happens tonight?', q: 'What is your plan for the next twelve hours overnight, and will the tank hold?' },
  { chip: 'Is the tank safe?', q: 'Is the water supply safe right now? How close are we to the reserve floor?' },
];

export default function AskPanel({ ctx, ask }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(null);
  const [answer, setAnswer] = useState(null);

  const run = async (p) => {
    setAsked(p.chip);
    setAnswer(null);
    setBusy(true);
    try {
      setAnswer(await ask(ctx, p.q));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="ASK THE OPERATOR"
      right={<Text style={[styles.badge, { color: HAS_KEY ? theme.good : theme.textDim }]}>
        {HAS_KEY ? MODEL_LABEL : 'no key'}
      </Text>}>
      <View style={styles.chips}>
        {PRESETS.map((p) => (
          <Pressable
            key={p.chip}
            onPress={() => run(p)}
            disabled={busy}
            style={({ pressed }) => [
              styles.chip,
              asked === p.chip && styles.chipActive,
              { opacity: pressed || busy ? 0.55 : 1 },
            ]}>
            <Text style={[styles.chipText, asked === p.chip && { color: theme.bg }]}>{p.chip}</Text>
          </Pressable>
        ))}
      </View>

      {(busy || answer) && (
        <View style={styles.answerBox}>
          {busy ? (
            <View style={styles.loadRow}>
              <ActivityIndicator color={theme.water} />
              <Text style={styles.loadText}>Thinking…</Text>
            </View>
          ) : (
            <Text style={styles.answer}>{answer}</Text>
          )}
        </View>
      )}
    </Card>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg,
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9,
  },
  chipActive: { backgroundColor: theme.water, borderColor: theme.water },
  chipText: { color: theme.text, fontSize: 12, fontWeight: '600' },
  answerBox: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border,
  },
  answer: { color: theme.text, fontSize: 14, lineHeight: 21 },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadText: { color: theme.textDim, fontSize: 13 },
});
