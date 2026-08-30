import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import Svg, { Polyline, Text as SvgText } from 'react-native-svg';
import Card from './Card';
import { theme } from '../theme';

const PRETTY = {
  hour: 'Hour of day',
  is_tourist_season: 'Tourist season',
  is_weekend: 'Weekend',
  day_of_week: 'Day of week',
  temp_c: 'Temperature',
};

export default function ModelCard({ model, curve }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(...model.feature_importances.map((f) => f.importance));

  return (
    <>
      <Card title="THE FORECASTING MODEL">
        <View style={styles.metrics}>
          <Metric value={`${model.mae_lph}`} unit="L/h" label="MAE" />
          <Metric value={`${model.r2}`} unit="" label="R²" />
          <Metric value={`${model.improvement_over_naive_pct.toFixed(0)}%`} unit="" label="vs naive mean" hero />
        </View>

        <Text style={styles.desc}>
          {model.model}, trained on {model.train_rows.toLocaleString()} hours and tested on the
          {' '}{model.test_rows.toLocaleString()} that came after — a chronological split, so it is
          evaluated on the future, never on shuffled rows.
        </Text>

        <Text style={styles.sub}>FEATURE IMPORTANCE</Text>
        {model.feature_importances.map((f) => (
          <View key={f.feature} style={styles.fRow}>
            <Text style={styles.fName}>{PRETTY[f.feature] || f.feature}</Text>
            <View style={styles.fTrack}>
              <View style={[styles.fFill, { width: `${(f.importance / max) * 100}%` }]} />
            </View>
            <Text style={styles.fVal}>{f.importance.toFixed(3)}</Text>
          </View>
        ))}

        <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={styles.linkText}>View predicted vs. actual →</Text>
        </Pressable>
      </Card>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <ScrollView>
              <Text style={styles.sheetTitle}>Predicted vs. actual demand</Text>
              <Text style={styles.sheetSub}>
                72 consecutive held-out hours the model never saw during training.
              </Text>
              <ValidationChart curve={curve} />
              <View style={styles.legend}>
                <Key color={theme.textDim} label="Actual" />
                <Key color={theme.water} label="Predicted" />
              </View>
              <Text style={styles.sheetSub}>
                Mean absolute error {model.mae_lph} L/h against a mean demand near 940 L/h.
                Predicting the training average instead would miss by {model.naive_baseline_mae_lph} L/h.
              </Text>
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ValidationChart({ curve }) {
  const { width } = useWindowDimensions();
  const w = width - 2 * theme.pad - 2 * theme.pad;
  const h = 190;
  const all = [...curve.actual, ...curve.predicted];
  const min = Math.min(...all) * 0.9;
  const max = Math.max(...all) * 1.05;
  const pts = (arr) =>
    arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ');

  return (
    <Svg width={w} height={h + 18} style={{ marginVertical: 12 }}>
      <Polyline points={pts(curve.actual)} fill="none" stroke={theme.textDim} strokeWidth={3} strokeOpacity={0.55} />
      <Polyline points={pts(curve.predicted)} fill="none" stroke={theme.water} strokeWidth={1.8} />
      <SvgText x={0} y={h + 14} fill={theme.textDim} fontSize="10">hour 0</SvgText>
      <SvgText x={w} y={h + 14} fill={theme.textDim} fontSize="10" textAnchor="end">hour 72</SvgText>
    </Svg>
  );
}

function Metric({ value, unit, label, hero }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.mValue, hero && { color: theme.good }]}>
        {value}<Text style={styles.mUnit}>{unit ? ` ${unit}` : ''}</Text>
      </Text>
      <Text style={styles.mLabel}>{label}</Text>
    </View>
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
  metrics: { flexDirection: 'row', marginBottom: 12 },
  mValue: { color: theme.text, fontSize: 24, fontWeight: '800' },
  mUnit: { fontSize: 12, fontWeight: '600', color: theme.textDim },
  mLabel: { color: theme.textDim, fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
  desc: { color: theme.textDim, fontSize: 12, lineHeight: 18 },
  sub: { color: theme.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  fRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  fName: { color: theme.text, fontSize: 12, width: 112 },
  fTrack: { flex: 1, height: 8, backgroundColor: theme.bg, borderRadius: 4, overflow: 'hidden' },
  fFill: { height: 8, backgroundColor: theme.water, borderRadius: 4 },
  fVal: { color: theme.textDim, fontSize: 11, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  link: { marginTop: 14 },
  linkText: { color: theme.water, fontSize: 13, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '82%',
  },
  sheetTitle: { color: theme.text, fontSize: 19, fontWeight: '800' },
  sheetSub: { color: theme.textDim, fontSize: 12, lineHeight: 18, marginTop: 6 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  keyText: { color: theme.textDim, fontSize: 11 },
  close: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  closeText: { color: theme.water, fontSize: 15, fontWeight: '700' },
});
