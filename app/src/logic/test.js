import fs from 'node:fs';
import { runSchedule, warmUpTank } from './scheduler.js';
import { fixedTimerSchedule, reactiveSchedule } from './baselines.js';
import { simulateSensor, detectLeak } from './leak.js';

const f = JSON.parse(fs.readFileSync(new URL('../../assets/forecast.json', import.meta.url)));
const { hourly } = f;
const plant = { ...f.plant, initial_tank_l: warmUpTank(f.warmup, f.plant) };
console.log(`Warm-up over ${f.warmup.length}h of yesterday's weather -> tank starts at ` +
  `${((plant.initial_tank_l / plant.tank_capacity_l) * 100).toFixed(1)}% ` +
  `(seed was ${((f.plant.initial_tank_l / f.plant.tank_capacity_l) * 100).toFixed(0)}%)\n`);

const smart = runSchedule(hourly, plant);
const timer = fixedTimerSchedule(hourly, plant);
const react = reactiveSchedule(hourly, plant);

const row = (n, r) =>
  `${n.padEnd(12)} diesel ${r.totals.dieselL.toFixed(1).padStart(7)} L  $${r.totals.costUsd.toFixed(0).padStart(5)}  ` +
  `CO2 ${r.totals.co2Kg.toFixed(0).padStart(5)} kg  pump ${String(r.totals.pumpHours).padStart(2)}h ` +
  `(solar ${r.totals.solarPumpHours} / hybrid ${r.totals.hybridPumpHours} / diesel ${r.totals.dieselPumpHours})  ` +
  `shortage ${r.totals.shortageHours}h`;

console.log(row('AquaGrid', smart));
console.log(row('FixedTimer', timer));
console.log(row('Reactive', react));

const saved = 100 * (1 - smart.totals.dieselL / timer.totals.dieselL);
console.log(`\nSaved vs fixed timer: ${saved.toFixed(1)}%`);

const minTank = Math.min(...smart.steps.map((s) => s.tankPct));
console.log(`Min tank: ${minTank.toFixed(1)}%   rules fired:`,
  [...new Set(smart.steps.map((s) => s.source))].join(','));

console.log('\nFirst 24h timeline:');
console.log(smart.steps.slice(0, 24).map((s) =>
  `${s.time.slice(11, 13)} ${s.action === 'pump' ? s.source[0].toUpperCase() : '.'}`).join(' '));

// Leak detection
const clean = detectLeak(smart.steps, simulateSensor(smart.steps, { leakStartHour: null }));
const burst = detectLeak(smart.steps, simulateSensor(smart.steps, { leakStartHour: 14 }));
console.log(`\nNo-leak run  -> alert=${clean.alert}`);
console.log(`Burst at h14 -> alert=${burst.alert} idx=${burst.startedAtIndex} rate=${burst.estimatedRateLph} L/h conf=${burst.confidence?.toFixed(2)}`);
console.log(burst.message);

// The exported lookup table must reproduce the Python model it came from.
const { predictDemandLph } = await import('./demand.js');
const tableErr = hourly.map((h) => {
  const d = new Date(h.time);
  return Math.abs(
    predictDemandLph(f.demand_model, {
      hour: d.getHours(), dayOfWeek: (d.getDay() + 6) % 7,
      month: d.getMonth() + 1, tempC: h.temp_c, population: 1200,
    }) - h.predicted_demand_lph,
  );
});
const meanTableErr = tableErr.reduce((a, b) => a + b, 0) / tableErr.length;
console.log(`\nDemand table vs Python model: mean |err| ${meanTableErr.toFixed(2)} L/h ` +
  `(model's own MAE is ${f.model.mae_lph} L/h)`);

const ok = smart.totals.shortageHours === 0 && meanTableErr < f.model.mae_lph / 4 && !clean.alert && burst.alert && burst.startedAtIndex <= 17 && saved > 0;
console.log(`\n${ok ? 'PASS' : 'FAIL'} — definition of done checks`);
process.exit(ok ? 0 : 1);
