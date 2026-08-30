import { useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import Card from './Card';
import { useTheme, useStyles } from '../theme';
import { HAS_KEY, MODEL_LABEL } from '../lib/ai';

/**
 * A conversation with the scheduler.
 *
 * The presets exist so a judge can interrogate it in one tap without typing on
 * camera; the input exists so they can follow up on whatever the answer was.
 * History goes to the model, so "why?" means something.
 */
const PRESETS = [
  { chip: 'Why not pump at noon?', q: 'Why did you not run the pump during the midday hours today?' },
  { chip: 'What happens tonight?', q: 'What is your plan for the next twelve hours overnight, and will the tank hold?' },
  { chip: 'Is the tank safe?', q: 'Is the water supply safe right now? How close are we to the reserve floor?' },
];

export default function AskPanel({ ctx, ask }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);

  const send = async (text) => {
    const question = text.trim();
    if (!question || busy) return;

    const history = messages;
    const userMsg = { id: nextId.current++, role: 'user', text: question };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const answer = await ask(ctx, question, history);
      setMessages((m) => [...m, { id: nextId.current++, role: 'assistant', text: answer }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="ASK THE OPERATOR"
      right={
        <View style={styles.headRight}>
          {messages.length > 0 && (
            <Pressable onPress={() => setMessages([])} hitSlop={8}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          )}
          <Text style={[styles.badge, { color: HAS_KEY ? theme.good : theme.textDim }]}>
            {HAS_KEY ? MODEL_LABEL : 'no key'}
          </Text>
        </View>
      }>

      {messages.length === 0 && (
        <Text style={styles.hint}>
          Ask anything about the schedule — or start with one of these. Follow-up questions keep
          their context.
        </Text>
      )}

      <View style={styles.chips}>
        {PRESETS.map((p) => (
          <Pressable
            key={p.chip}
            onPress={() => send(p.q)}
            disabled={busy}
            style={({ pressed }) => [styles.chip, { opacity: pressed || busy ? 0.5 : 1 }]}>
            <Text style={styles.chipText}>{p.chip}</Text>
          </Pressable>
        ))}
      </View>

      {messages.length > 0 && (
        <View style={styles.thread}>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}>
              {m.role === 'assistant' && <Text style={styles.who}>OPERATOR</Text>}
              <Text style={m.role === 'user' ? styles.userText : styles.botText}>{m.text}</Text>
            </View>
          ))}
          {busy && (
            <View style={[styles.bubble, styles.botBubble, styles.loadRow]}>
              <ActivityIndicator color={theme.water} size="small" />
              <Text style={styles.thinking}>Thinking…</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          placeholder={HAS_KEY ? 'Ask a follow-up…' : 'No AI key configured'}
          placeholderTextColor={theme.textDim}
          editable={!busy}
          returnKeyType="send"
          multiline
          style={styles.input}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={busy || !input.trim()}
          style={({ pressed }) => [
            styles.send,
            { opacity: busy || !input.trim() ? 0.35 : pressed ? 0.6 : 1 },
          ]}>
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clear: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  hint: { color: theme.textDim, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipText: { color: theme.text, fontSize: 12, fontWeight: '600' },

  thread: { marginTop: 14, gap: 8 },
  bubble: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, maxWidth: '92%' },
  userBubble: { backgroundColor: theme.water, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  botBubble: {
    backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border,
    alignSelf: 'flex-start', borderBottomLeftRadius: 4,
  },
  who: {
    color: theme.textDim, fontSize: 8.5, fontWeight: '700',
    letterSpacing: 1, marginBottom: 4,
  },
  userText: { color: theme.mode === 'dark' ? '#08131C' : '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  botText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  thinking: { color: theme.textDim, fontSize: 13 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border,
  },
  input: {
    flex: 1, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border,
    borderRadius: 10, color: theme.text, fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, maxHeight: 90,
  },
  send: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: theme.water,
    alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: theme.mode === 'dark' ? '#08131C' : '#FFFFFF', fontSize: 19, fontWeight: '800' },
});
