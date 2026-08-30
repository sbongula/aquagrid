/**
 * AquaGrid pump scheduler.
 *
 * Pure JavaScript, no React imports, so it can be unit-tested with plain `node`.
 * Decides hour by hour whether to run the desalination pump, using the demand
 * forecast produced by ml/train_model.py and a 12-hour lookahead over the solar
 * forecast.
 */

export const CO2_KG_PER_DIESEL_L = 2.68;
export const USD_PER_DIESEL_L = 1.6; // island-delivered diesel; stated in the README

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Constants derived from the plant block of forecast.json. */
export function derive(plant) {
  return {
    pumpKw: plant.desal_pump_kw,
    outLph: plant.desal_output_lph,
    cap: plant.tank_capacity_l,
    floorL: (plant.tank_capacity_l * plant.reserve_floor_pct) / 100,
    targetL: (plant.tank_capacity_l * plant.tank_target_pct) / 100,
  };
}

export function emptyTotals() {
  return {
    dieselL: 0,
    pumpHours: 0,
    solarPumpHours: 0,
    hybridPumpHours: 0,
    dieselPumpHours: 0,
    shortageHours: 0,
    waterDeliveredL: 0,
    co2Kg: 0,
    costUsd: 0,
  };
}

/**
 * Apply a decision to the tank and accumulate the totals.
 * Shared by the smart scheduler and both baselines so the comparison is honest —
 * identical physics, only the decision rule differs.
 */
export function settleHour(h, tankBefore, action, source, reason, plant, totals) {
  const { pumpKw, outLph, cap } = derive(plant);
  const demandL = h.predicted_demand_lph;
  const solarKw = h.solar_kw;

  const pumpedL = action === 'pump' ? outLph : 0;
  const dieselKwh = action === 'pump' ? Math.max(0, pumpKw - solarKw) : 0;
  const dieselL = dieselKwh * plant.diesel_l_per_kwh;
  const tankAfter = clamp(tankBefore + pumpedL - demandL, 0, cap);

  totals.dieselL += dieselL;
  totals.waterDeliveredL += pumpedL;
  if (action === 'pump') {
    totals.pumpHours += 1;
    if (source === 'solar') totals.solarPumpHours += 1;
    else if (source === 'hybrid') totals.hybridPumpHours += 1;
    else if (source === 'diesel') totals.dieselPumpHours += 1;
  }
  if (tankAfter <= 0) totals.shortageHours += 1;

  return {
    time: h.time,
    hour: h.hour,
    solarKw,
    demandL,
    action,
    source,
    pumpedL,
    tankL: tankAfter,
    tankPct: (tankAfter / cap) * 100,
    dieselL,
    reason,
  };
}

export function finaliseTotals(totals) {
  totals.co2Kg = totals.dieselL * CO2_KG_PER_DIESEL_L;
  totals.costUsd = totals.dieselL * USD_PER_DIESEL_L;
  return totals;
}

/**
 * The AquaGrid strategy. Rules are evaluated in strict priority order;
 * the first match wins.
 */
export function runSchedule(hourly, plant, { lookaheadHours = 12 } = {}) {
  const { pumpKw, outLph, floorL, targetL } = derive(plant);
  const totals = emptyTotals();
  const steps = [];
  let tank = plant.initial_tank_l;

  for (let i = 0; i < hourly.length; i++) {
    const h = hourly[i];
    const tankBefore = tank;
    const solarKw = h.solar_kw;

    // Lookahead: do we breach the reserve floor within the next 12 hours if we
    // only ever pump on full solar? This is what lets Rule 3 spend a little
    // diesel now to avoid spending a lot tonight.
    const horizon = hourly.slice(i, i + lookaheadHours);
    const projDemand = horizon.reduce((a, x) => a + x.predicted_demand_lph, 0);
    const projSolarHours = horizon.filter((x) => x.solar_kw >= pumpKw).length;
    const projSupply = projSolarHours * outLph;
    const willBreach = tankBefore + projSupply - projDemand < floorL;

    let action, source, reason;

    if (tankBefore < floorL) {
      // RULE 1 — EMERGENCY
      action = 'pump';
      source = solarKw >= pumpKw ? 'solar' : solarKw >= 0.25 * pumpKw ? 'hybrid' : 'diesel';
      reason = `Below ${plant.reserve_floor_pct}% reserve floor — emergency top-up regardless of cost`;
    } else if (solarKw >= pumpKw && tankBefore < targetL) {
      // RULE 2 — FREE SOLAR
      action = 'pump';
      source = 'solar';
      reason = `Solar output ${solarKw.toFixed(1)} kW covers the full ${pumpKw} kW pump draw — free water`;
    } else if (willBreach && solarKw >= 0.5 * pumpKw && tankBefore < targetL) {
      // RULE 3 — PRE-EMPTIVE HYBRID
      action = 'pump';
      source = 'hybrid';
      reason = `Shortfall forecast within ${lookaheadHours}h — topping up on ${solarKw.toFixed(1)} kW of partial solar now to avoid a full-diesel run tonight`;
    } else if (willBreach && tankBefore < floorL * 1.4) {
      // RULE 4 — RELUCTANT DIESEL
      action = 'pump';
      source = 'diesel';
      reason = 'Shortfall forecast and no usable solar — running on diesel';
    } else {
      // RULE 5 — HOLD
      action = 'off';
      source = 'none';
      reason =
        tankBefore >= targetL
          ? 'Tank near target — holding'
          : 'Solar below pump draw and reserves healthy — waiting for sun';
    }

    const step = settleHour(h, tankBefore, action, source, reason, plant, totals);
    steps.push(step);
    tank = step.tankL;
  }

  return { steps, totals: finaliseTotals(totals) };
}
