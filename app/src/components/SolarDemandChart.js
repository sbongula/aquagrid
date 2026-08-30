import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Polyline, Line, Rect, Text as SvgText } from 'react-native-svg';
import Card from './Card';
import { theme } from '../theme';

const H = 170;

const xAt = (i, n, w) => (i / (n - 1)) * w;
const yAt = (v, min, max, h) => h - ((v - min) / (max - min || 1)) * h;

/**
 * Next 24 hours: solar as a filled area, predicted demand as a line, and a
 * dashed rule at the pump-draw threshold. That rule is what makes the whole
 * strategy legible at a glance - solar above the line is free water.
 */
export default function SolarDemandChart({ steps, plant }) {
  const { width } = useWindowDimensions();
  const w = width - 2 * theme.pad - 2 * theme.pad;
  const data = steps.slice(0, 24);
  const n = data.length;

  const solarMax = Math.max(plant.desal_pump_kw * 1.15, ...data.map((d) => d.solarKw));
  const demandMax = Math.max(...data.map((d) => d.demandL)) * 1.1;

  const solarPts = data.map((d, i) => [xAt(i, n, w), yAt(d.solarKw, 0, solarMax, H)]);
  const area =
    `M ${solarPts[0][0]},${H} ` +
    solarPts.map(([x, y]) => `L ${x},${y}`).join(' ') +
    ` L ${solarPts[n - 1][0]},${H} Z`;

  const demandPts = data
    .map((d, i) => `${xAt(i, n, w)},${yAt(d.demandL, 0, demandMax, H)}`)
    .join(' ');

  const thresholdY = yAt(plant.desal_pump_kw, 0, solarMax, H);

  // Rain drawn as bars hanging from the top: free water arriving, which is why
  // the scheduler sometimes holds the pump even when the tank is low.
  const rainMax = Math.max(0.5, ...data.map((d) => d.rainMm || 0));
  const barW = Math.max(3, (w / n) * 0.55);

  return (
    <Card title="NEXT 24 HOURS">
      <Svg width={w} height={H + 22}>
        <Path d={area} fill={theme.solar} fillOpacity={0.25} stroke={theme.solar} strokeWidth={2} />
        <Polyline points={demandPts} fill="none" stroke={theme.water} strokeWidth={2} />
        <Line x1={0} y1={thresholdY} x2={w} y2={thresholdY}
              stroke={theme.text} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 4" />
        <SvgText x={2} y={thresholdY - 5} fill={theme.text} opacity={0.7} fontSize="10" fontWeight="700">
          {plant.desal_pump_kw} kW pump draw
        </SvgText>
        {data.map((d, i) =>
          d.rainMm > 0 ? (
            <Rect key={`r${i}`} x={xAt(i, n, w) - barW / 2} y={0}
                  width={barW} height={(d.rainMm / rainMax) * 34}
                  fill={theme.water} fillOpacity={0.5} rx={1.5} />
          ) : null,
        )}
        {data.map((d, i) =>
          i % 6 === 0 ? (
            <SvgText key={i} x={xAt(i, n, w)} y={H + 16} fill={theme.textDim} fontSize="10" textAnchor="middle">
              {d.time.slice(11, 13)}:00
            </SvgText>
          ) : null,
        )}
      </Svg>
      <View style={styles.legend}>
        <Key color={theme.solar} label={`Solar output (peak ${Math.max(...data.map((d) => d.solarKw)).toFixed(0)} kW)`} />
        <Key color={theme.water} label="Predicted demand" />
        {data.some((d) => d.rainMm > 0) && (
          <Key color={theme.water} label={`Rain (${data.reduce((a, d) => a + d.rainMm, 0).toFixed(1)} mm)`} />
        )}
      </View>
      <Text style={styles.note}>
        Solar above the dashed line runs the pump for free. Below it, every pump hour burns diesel.
      </Text>
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
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  keyText: { color: theme.textDim, fontSize: 11 },
  note: { color: theme.textDim, fontSize: 11, lineHeight: 16, marginTop: 8, fontStyle: 'italic' },
});
