import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar, StyleSheet, Platform } from 'react-native';

import forecast from './assets/forecast.json';
import { ThemeProvider, useTheme, useStyles, useThemeMode } from './src/theme';
import { runSchedule, warmUpTank } from './src/logic/scheduler';
import { fixedTimerSchedule, reactiveSchedule } from './src/logic/baselines';
import { simulateSensor, detectLeak } from './src/logic/leak';
import { fuelOutlook } from './src/logic/fuel';
import { simulateArrayMeter, detectSoiling, projectFouling } from './src/logic/assets';
import { freeSolarWindows, rationingOutlook, templateAdvisory } from './src/logic/advisory';
import {
  buildContext, getBriefing, templateBriefing, askOperator, getAdvisory,
} from './src/lib/ai';
import { searchPlaces, buildLocationForecast, refreshBundled, currentPlace } from './src/lib/geo';
import { saveLocation, loadLastLocation, clearLocation, describeAge } from './src/lib/store';

import Header from './src/components/Header';
import LocationPicker from './src/components/LocationPicker';
import StormBanner from './src/components/StormBanner';
import TankGauge from './src/components/TankGauge';
import DecisionCard from './src/components/DecisionCard';
import BriefingCard from './src/components/BriefingCard';
import AskPanel from './src/components/AskPanel';
import SolarDemandChart from './src/components/SolarDemandChart';
import PumpTimeline from './src/components/PumpTimeline';
import BatteryCard from './src/components/BatteryCard';
import WaterSourcesCard from './src/components/WaterSourcesCard';
import SavingsCard from './src/components/SavingsCard';
import FuelCard from './src/components/FuelCard';
import LeakPanel from './src/components/LeakPanel';
import AssetHealthCard from './src/components/AssetHealthCard';
import AdvisoryCard from './src/components/AdvisoryCard';
import ModelCard from './src/components/ModelCard';

// Hour of the horizon the operator is standing in.
const NOW_INDEX = 0;
const LEAK_START_HOUR = 14;
const SIMULATED_CYCLONE_KMH = 118;

function Dashboard() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  // Demo switches. Each one flips a real input and everything downstream
  // recomputes - none of them fake an outcome.
  const [leakInjected, setLeakInjected] = useState(false);
  const [stormMode, setStormMode] = useState(false);
  const [dirtyPanels, setDirtyPanels] = useState(true);

  // null = the island bundled at build time, which needs no network at all.
  const [custom, setCustom] = useState(null);
  // Where the currently-shown weather came from, so the UI can be honest about
  // its age rather than implying everything is live.
  const [freshness, setFreshness] = useState({ kind: 'bundled', at: null });

  // On launch: restore the island the operator was last looking at from the
  // offline cache, then try to refresh its weather. Both steps are optional -
  // failure at either leaves the bundled island showing, which always works.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remembered = await loadLastLocation();
      if (!cancelled && remembered) {
        setCustom(remembered.forecast);
        setFreshness({ kind: 'cached', at: remembered.cachedAt });
      }

      const target = remembered?.place ?? null;
      const fresh = target
        ? await buildLocationForecast(target, forecast.plant, forecast.demand_model).catch(() => null)
        : await refreshBundled(forecast);

      if (cancelled || !fresh) return;
      if (target) {
        setCustom(fresh);
        saveLocation(target, fresh);
      } else {
        setCustom(fresh);
      }
      setFreshness({ kind: 'live', at: new Date().toISOString() });
    })();
    return () => { cancelled = true; };
  }, []);

  const selectPlace = async (place) => {
    const fc = await buildLocationForecast(place, forecast.plant, demandModel);
    setCustom(fc);
    setFreshness({ kind: 'live', at: new Date().toISOString() });
    saveLocation(place, fc);
    return fc;
  };

  const active = custom || forecast;
  const { hourly, island, weather_source: weatherSource } = active;
  const { model, validation_curve: curve, demand_model: demandModel, maintenance } = forecast;

  // Start the horizon where yesterday actually left the tank.
  const plant = useMemo(
    () => ({ ...active.plant, initial_tank_l: warmUpTank(active.warmup, active.plant) }),
    [active],
  );

  // All scheduling is synchronous. Only the LLM calls are async.
  const { smart, timer, reactive } = useMemo(
    () => ({
      smart: runSchedule(hourly, plant, {
        stormOverride: stormMode,
        simulatedWindKmh: SIMULATED_CYCLONE_KMH,
      }),
      timer: fixedTimerSchedule(hourly, plant),
      reactive: reactiveSchedule(hourly, plant),
    }),
    [hourly, plant, stormMode],
  );

  const leak = useMemo(() => {
    const sensor = simulateSensor(smart.steps, {
      leakStartHour: leakInjected ? LEAK_START_HOUR : null,
    });
    return detectLeak(smart.steps, sensor);
  }, [smart, leakInjected]);

  const soiling = useMemo(
    () => detectSoiling(smart.steps, simulateArrayMeter(smart.steps, {
      soilingLoss: dirtyPanels ? 0.12 : 0.01,
    })),
    [smart, dirtyPanels],
  );

  const fouling = useMemo(() => projectFouling(maintenance), [maintenance]);

  const fuel = useMemo(() => fuelOutlook(smart.totals, plant, hourly.length), [smart, plant, hourly]);
  const fuelBaselines = useMemo(
    () => [
      { name: 'Fixed timer', outlook: fuelOutlook(timer.totals, plant, hourly.length) },
      { name: 'Reactive', outlook: fuelOutlook(reactive.totals, plant, hourly.length) },
    ].filter((b) => b.outlook),
    [timer, reactive, plant, hourly],
  );

  const windows = useMemo(() => freeSolarWindows(smart.steps, plant, { hours: 48 }), [smart, plant]);
  const rationing = useMemo(
    () => rationingOutlook(smart.steps, plant, island.population),
    [smart, plant, island],
  );

  const step = smart.steps[NOW_INDEX];

  const hoursOfSupply = useMemo(() => {
    let level = step.tankL;
    for (let i = NOW_INDEX; i < smart.steps.length; i++) {
      level -= smart.steps[i].demandL - smart.steps[i].harvestL;
      if (level <= 0) return i - NOW_INDEX;
    }
    return Infinity;
  }, [smart, step]);

  const ctx = useMemo(
    () => buildContext({ island: island.name, step, index: NOW_INDEX, smart, timer, leak, hourly }),
    [island, step, smart, timer, leak, hourly],
  );

  // Operator briefing: render the on-device template immediately, upgrade in
  // place if a key is present and the network answers within 6 seconds.
  const [briefing, setBriefing] = useState({ text: templateBriefing(ctx, smart, NOW_INDEX), live: false });
  useEffect(() => {
    let cancelled = false;
    setBriefing({ text: templateBriefing(ctx, smart, NOW_INDEX), live: false });
    getBriefing(ctx, smart, NOW_INDEX).then((r) => !cancelled && setBriefing(r));
    return () => { cancelled = true; };
  }, [ctx, smart]);

  // Public notice, same two-path pattern but written for residents.
  const [advisory, setAdvisory] = useState({ text: templateAdvisory(windows, rationing), live: false });
  useEffect(() => {
    let cancelled = false;
    const fallback = templateAdvisory(windows, rationing);
    setAdvisory({ text: fallback, live: false });
    getAdvisory(
      { island: island.name, windows, rationing, tankPct: Math.round(step.tankPct) },
      fallback,
    ).then((r) => !cancelled && setAdvisory(r));
    return () => { cancelled = true; };
  }, [windows, rationing, island, step]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header
          island={island}
          weatherSource={weatherSource}
          generatedAt={freshness.at || (custom ? custom.fetched_at : forecast.generated_at)}
          live={freshness.kind === 'live'}
          freshness={freshness}
          describeAge={describeAge}
        />
        <LocationPicker
          island={island}
          isCustom={custom !== null}
          search={searchPlaces}
          onReset={() => { setCustom(null); setFreshness({ kind: 'bundled', at: null }); clearLocation(); }}
          onSelect={selectPlace}
          onUseGps={async () => selectPlace(await currentPlace())}
          freshness={freshness}
        />

        {step.stormComing && <StormBanner step={step} windKmh={SIMULATED_CYCLONE_KMH} />}

        <TankGauge step={step} plant={plant} hoursOfSupply={hoursOfSupply} />
        <DecisionCard step={step} />
        <BriefingCard text={briefing.text} live={briefing.live} loading={false} />
        <AskPanel ctx={ctx} ask={askOperator} live={briefing.live} />

        <SolarDemandChart steps={smart.steps} plant={plant} />
        <PumpTimeline steps={smart.steps} />
        <BatteryCard steps={smart.steps} plant={plant} totals={smart.totals} />
        <WaterSourcesCard totals={smart.totals} steps={smart.steps} plant={plant} />

        <SavingsCard smart={smart} timer={timer} reactive={reactive} />
        <FuelCard outlook={fuel} baselines={fuelBaselines} />

        <LeakPanel leak={leak} injected={leakInjected} onToggle={() => setLeakInjected((v) => !v)} />
        <AssetHealthCard
          soiling={soiling}
          fouling={fouling}
          dirty={dirtyPanels}
          onToggleDirty={() => setDirtyPanels((v) => !v)}
        />

        <AdvisoryCard
          text={advisory.text}
          live={advisory.live}
          windows={windows}
          rationing={rationing}
        />
        <ModelCard model={model} curve={curve} />

        <DemoBar stormMode={stormMode} onToggleStorm={() => setStormMode((v) => !v)} />

        <View style={styles.foot}>
          <Text style={styles.footText}>
            Demand forecast by RandomForest trained offline · scheduling, rainwater harvesting,
            battery dispatch, leak and asset-health detection all computed on-device · no server,
            no connectivity required.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DemoBar({ stormMode, onToggleStorm }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.demoBar}>
      <Text style={styles.demoLabel}>DEMO CONTROLS</Text>
      <Text style={styles.demoText}>
        Every switch changes a real input — the schedule, the alerts and the numbers all recompute.
      </Text>
      <Text
        onPress={onToggleStorm}
        style={[styles.demoBtn, { borderColor: stormMode ? theme.good : theme.bad,
                                  color: stormMode ? theme.good : theme.bad }]}>
        {stormMode ? 'Stand down from storm alert' : `Simulate cyclone (${SIMULATED_CYCLONE_KMH} km/h)`}
      </Text>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  scroll: { paddingBottom: 40 },
  foot: { paddingHorizontal: theme.pad, paddingTop: 12 },
  footText: { color: theme.textDim, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  demoBar: {
    marginHorizontal: theme.pad, marginBottom: 4, padding: theme.pad,
    borderRadius: theme.radius, borderWidth: 1, borderColor: theme.border,
    borderStyle: 'dashed',
  },
  demoLabel: { color: theme.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  demoText: { color: theme.textDim, fontSize: 11, lineHeight: 16, marginTop: 6 },
  demoBtn: {
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, textAlign: 'center',
    marginTop: 12, fontSize: 13, fontWeight: '700', overflow: 'hidden',
  },
});

/**
 * The provider sits above everything that reads the palette, so App itself
 * cannot consume it - hence the split into Dashboard.
 */
export default function App() {
  return (
    <ThemeProvider initialPref="auto">
      <Dashboard />
    </ThemeProvider>
  );
}
