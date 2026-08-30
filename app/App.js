import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar, StyleSheet, Platform } from 'react-native';

import forecast from './assets/forecast.json';
import { theme } from './src/theme';
import { runSchedule, warmUpTank } from './src/logic/scheduler';
import { fixedTimerSchedule, reactiveSchedule } from './src/logic/baselines';
import { simulateSensor, detectLeak } from './src/logic/leak';
import { buildContext, getBriefing, templateBriefing, askOperator } from './src/lib/ai';
import { searchPlaces, buildLocationForecast } from './src/lib/geo';

import Header from './src/components/Header';
import TankGauge from './src/components/TankGauge';
import DecisionCard from './src/components/DecisionCard';
import BriefingCard from './src/components/BriefingCard';
import SolarDemandChart from './src/components/SolarDemandChart';
import PumpTimeline from './src/components/PumpTimeline';
import SavingsCard from './src/components/SavingsCard';
import LeakPanel from './src/components/LeakPanel';
import ModelCard from './src/components/ModelCard';
import AskPanel from './src/components/AskPanel';
import LocationPicker from './src/components/LocationPicker';

// Hour of the 48-hour horizon the operator is standing in. Held in state so the
// demo can scrub forward if needed; index 0 is the start of the forecast.
const NOW_INDEX = 0;
const LEAK_START_HOUR = 14;

export default function App() {
  const [leakInjected, setLeakInjected] = useState(false);

  // null = the island bundled at build time, which needs no network at all.
  // Anything else was resolved at runtime from a location the operator picked.
  const [custom, setCustom] = useState(null);

  const active = custom || forecast;
  const { hourly, island, weather_source: weatherSource } = active;

  // Start the horizon where yesterday actually left the tank, not at a seeded
  // constant - otherwise every island opens at the same percentage.
  const plant = useMemo(
    () => ({ ...active.plant, initial_tank_l: warmUpTank(active.warmup, active.plant) }),
    [active],
  );
  const { model, validation_curve: curve, demand_model: demandModel } = forecast;

  // All scheduling is synchronous. Only the LLM call is async - never mix them.
  const { smart, timer, reactive } = useMemo(
    () => ({
      smart: runSchedule(hourly, plant),
      timer: fixedTimerSchedule(hourly, plant),
      reactive: reactiveSchedule(hourly, plant),
    }),
    [hourly, plant],
  );

  const leak = useMemo(() => {
    const sensor = simulateSensor(smart.steps, {
      leakStartHour: leakInjected ? LEAK_START_HOUR : null,
    });
    return detectLeak(smart.steps, sensor);
  }, [smart, leakInjected]);

  const step = smart.steps[NOW_INDEX];

  const hoursOfSupply = useMemo(() => {
    let level = step.tankL;
    for (let i = NOW_INDEX; i < smart.steps.length; i++) {
      level -= smart.steps[i].demandL;
      if (level <= 0) return i - NOW_INDEX;
    }
    return Infinity;
  }, [smart, step]);

  const ctx = useMemo(
    () => buildContext({ island: island.name, step, index: NOW_INDEX, smart, timer, leak, hourly }),
    [island, step, smart, timer, leak, hourly],
  );

  // Briefing: render the on-device template immediately, then upgrade in place
  // if a Groq key is present and the network answers within 6 seconds.
  const [briefing, setBriefing] = useState({ text: templateBriefing(ctx, smart, NOW_INDEX), live: false });
  useEffect(() => {
    let cancelled = false;
    setBriefing((b) => ({ ...b, text: templateBriefing(ctx, smart, NOW_INDEX) }));
    getBriefing(ctx, smart, NOW_INDEX).then((r) => {
      if (!cancelled) setBriefing(r);
    });
    return () => { cancelled = true; };
  }, [ctx, smart]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header
          island={island}
          weatherSource={weatherSource}
          generatedAt={custom ? custom.fetched_at : forecast.generated_at}
          live={custom !== null}
        />
        <LocationPicker
          island={island}
          isCustom={custom !== null}
          search={searchPlaces}
          onReset={() => setCustom(null)}
          onSelect={async (place) => setCustom(await buildLocationForecast(place, forecast.plant, demandModel))}
        />
        <TankGauge step={step} plant={plant} hoursOfSupply={hoursOfSupply} />
        <DecisionCard step={step} />
        <BriefingCard text={briefing.text} live={briefing.live} loading={false} />
        <AskPanel ctx={ctx} ask={askOperator} live={briefing.live} />
        <SolarDemandChart steps={smart.steps} plant={plant} />
        <PumpTimeline steps={smart.steps} />
        <SavingsCard smart={smart} timer={timer} reactive={reactive} />
        <LeakPanel leak={leak} injected={leakInjected} onToggle={() => setLeakInjected((v) => !v)} />
        <ModelCard model={model} curve={curve} />

        <View style={styles.foot}>
          <Text style={styles.footText}>
            Demand forecast by RandomForest trained offline · scheduling, leak detection and
            charts computed on-device · no server, no connectivity required.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  scroll: { paddingBottom: 40 },
  foot: { paddingHorizontal: theme.pad, paddingTop: 4 },
  footText: { color: theme.textDim, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
