/**
 * Comparison strategies, run over the identical forecast and the identical
 * physics - same rain harvesting, same battery, same tank - so the savings
 * number in SavingsCard reflects the decision rule and nothing else.
 */

import { derive, emptyTotals, settleHour, finaliseTotals, initialState } from './scheduler.js';

function classify(solarKw, socKwh, pumpKw) {
  const fromSolar = Math.min(solarKw, pumpKw);
  const fromBattery = Math.min(pumpKw - fromSolar, socKwh, pumpKw);
  const fromDiesel = pumpKw - fromSolar - fromBattery;
  if (fromDiesel > 0.001) return fromDiesel / pumpKw > 0.5 ? 'diesel' : 'hybrid';
  if (fromBattery > 0.001) return fromSolar > fromBattery ? 'hybrid' : 'battery';
  return 'solar';
}

function run(hourly, plant, decide) {
  const { pumpKw } = derive(plant);
  const totals = emptyTotals();
  const state = initialState(plant);
  const steps = [];

  for (const h of hourly) {
    const { action, reason } = decide(h, state, plant);
    const source = action === 'pump' ? classify(h.solar_kw, state.socKwh, pumpKw) : 'none';
    steps.push(settleHour(h, state, action, source, reason, plant, totals));
  }
  return { steps, totals: finaliseTotals(totals) };
}

/**
 * How these plants are actually run today: a wall timer set to off-peak grid
 * hours. On a solar island that is exactly backwards - 01:00-05:00 has no sun,
 * so those hours run on diesel and on whatever the battery happens to hold.
 */
export function fixedTimerSchedule(hourly, plant) {
  const { cap } = derive(plant);
  return run(hourly, plant, (h, state) => {
    const onTimer = h.hour >= 1 && h.hour <= 4;
    const full = state.tankL >= cap - plant.desal_output_lph * 0.5;
    return onTimer && !full
      ? { action: 'pump', reason: 'Fixed timer window 01:00-05:00 — runs regardless of sun, rain or tank level' }
      : { action: 'off', reason: 'Outside the timer window — pump idle' };
  });
}

/**
 * Slightly smarter naive control: top up whenever the tank drops below 80%.
 * Responds to the tank but is blind to the solar and rainfall forecast, so it
 * pumps at night as readily as at noon and makes water it is about to spill.
 */
export function reactiveSchedule(hourly, plant) {
  const { cap } = derive(plant);
  const threshold = cap * 0.8;
  return run(hourly, plant, (h, state) =>
    state.tankL < threshold
      ? { action: 'pump', reason: 'Tank below 80% — top up now, forecast ignored' }
      : { action: 'off', reason: 'Tank above 80% — idle' },
  );
}
