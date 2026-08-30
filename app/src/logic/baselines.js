/**
 * Comparison strategies, run over the identical forecast so the savings number
 * in SavingsCard is a real computation and not a hardcoded claim.
 */

import { derive, emptyTotals, settleHour, finaliseTotals } from './scheduler.js';

/**
 * How these plants are actually run today: a wall timer set to off-peak grid
 * hours. On a solar island that is exactly backwards — 01:00-05:00 has no sun,
 * so every one of those hours burns 100% diesel.
 */
export function fixedTimerSchedule(hourly, plant) {
  const { cap } = derive(plant);
  const totals = emptyTotals();
  const steps = [];
  let tank = plant.initial_tank_l;

  for (const h of hourly) {
    const onTimer = h.hour >= 1 && h.hour <= 4;
    const full = tank >= cap - plant.desal_output_lph * 0.5;
    const action = onTimer && !full ? 'pump' : 'off';
    const source = action === 'pump' ? 'diesel' : 'none';
    const reason = action === 'pump'
      ? 'Fixed timer window 01:00-05:00 — runs regardless of sun or tank level'
      : 'Outside the timer window — pump idle';

    const step = settleHour(h, tank, action, source, reason, plant, totals);
    steps.push(step);
    tank = step.tankL;
  }

  return { steps, totals: finaliseTotals(totals) };
}

/**
 * Slightly smarter naive control: top up whenever the tank drops below 80%.
 * Responds to the tank but is blind to the solar forecast, so it pumps at night
 * as readily as at noon.
 */
export function reactiveSchedule(hourly, plant) {
  const { pumpKw, cap } = derive(plant);
  const threshold = cap * 0.8;
  const totals = emptyTotals();
  const steps = [];
  let tank = plant.initial_tank_l;

  for (const h of hourly) {
    const action = tank < threshold ? 'pump' : 'off';
    const source =
      action === 'off'
        ? 'none'
        : h.solar_kw >= pumpKw
          ? 'solar'
          : h.solar_kw >= 0.25 * pumpKw
            ? 'hybrid'
            : 'diesel';
    const reason = action === 'pump'
      ? 'Tank below 80% — top up now, solar forecast ignored'
      : 'Tank above 80% — idle';

    const step = settleHour(h, tank, action, source, reason, plant, totals);
    steps.push(step);
    tank = step.tankL;
  }

  return { steps, totals: finaliseTotals(totals) };
}
