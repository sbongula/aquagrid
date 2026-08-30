/**
 * AquaGrid pump scheduler.
 *
 * Pure JavaScript, no React imports, so it can be unit-tested with plain `node`.
 * Decides hour by hour whether to run the desalination pump, using the demand
 * forecast produced by ml/train_model.py, a 12-hour lookahead over the solar and
 * rainfall forecast, a battery, and the storm outlook.
 *
 * Physics lives in settleHour() and is shared with the baseline strategies in
 * baselines.js, so the savings comparison differs only in the decision rule.
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
    battKwh: plant.battery_kwh || 0,
    battRt: plant.battery_round_trip || 0.9,
    catchment: (plant.roof_catchment_m2 || 0) * (plant.runoff_coeff || 0),
    stormKmh: plant.storm_wind_kmh || Infinity,
  };
}

/** Litres of rainwater captured this hour. 1 mm over 1 m² is 1 litre. */
export const harvestFrom = (rainMm, plant) => (rainMm || 0) * derive(plant).catchment;

export function emptyTotals() {
  return {
    dieselL: 0,
    pumpHours: 0,
    solarPumpHours: 0,
    batteryPumpHours: 0,
    hybridPumpHours: 0,
    dieselPumpHours: 0,
    shortageHours: 0,
    waterDeliveredL: 0,
    harvestedL: 0,
    spilledL: 0,
    solarKwh: 0,
    batteryKwh: 0,
    curtailedKwh: 0,
    co2Kg: 0,
    costUsd: 0,
  };
}

/**
 * Apply a decision to the tank, the battery and the fuel stock, and accumulate
 * the totals. Every strategy runs through this, so they face identical physics.
 */
export function settleHour(h, state, action, source, reason, plant, totals, extra = {}) {
  const { pumpKw, outLph, cap, battKwh, battRt } = derive(plant);
  const demandL = h.predicted_demand_lph;
  const solarKw = h.solar_kw;
  const harvestL = harvestFrom(h.rain_mm, plant);

  // --- energy ---------------------------------------------------------------
  const need = action === 'pump' ? pumpKw : 0;
  const fromSolar = Math.min(solarKw, need);
  let deficit = need - fromSolar;

  // Discharge the battery before burning anything. Rate is capped at the pump
  // draw, which is the only load it ever serves.
  const fromBattery = Math.min(deficit, state.socKwh, pumpKw);
  deficit -= fromBattery;

  const fromDiesel = deficit;
  const dieselL = fromDiesel * plant.diesel_l_per_kwh;

  // Surplus solar charges the battery; whatever will not fit is curtailed.
  const surplusKw = Math.max(0, solarKw - need);
  const room = Math.max(0, battKwh - (state.socKwh - fromBattery));
  const charged = Math.min(surplusKw * battRt, room);
  const curtailedKwh = Math.max(0, surplusKw - charged / battRt);

  state.socKwh = clamp(state.socKwh - fromBattery + charged, 0, battKwh);
  state.dieselStockL = Math.max(0, state.dieselStockL - dieselL);

  // --- water ----------------------------------------------------------------
  const pumpedL = action === 'pump' ? outLph : 0;
  const raw = state.tankL + pumpedL + harvestL - demandL;
  const tankAfter = clamp(raw, 0, cap);
  const spilledL = Math.max(0, raw - cap);

  totals.dieselL += dieselL;
  totals.waterDeliveredL += pumpedL;
  totals.harvestedL += harvestL;
  totals.spilledL += spilledL;
  totals.solarKwh += fromSolar;
  totals.batteryKwh += fromBattery;
  totals.curtailedKwh += curtailedKwh;
  if (action === 'pump') {
    totals.pumpHours += 1;
    if (source === 'solar') totals.solarPumpHours += 1;
    else if (source === 'battery') totals.batteryPumpHours += 1;
    else if (source === 'hybrid') totals.hybridPumpHours += 1;
    else if (source === 'diesel') totals.dieselPumpHours += 1;
  }
  if (tankAfter <= 0) totals.shortageHours += 1;

  const step = {
    time: h.time,
    hour: h.hour,
    solarKw,
    rainMm: h.rain_mm || 0,
    windKmh: h.wind_kmh || 0,
    demandL,
    action,
    source,
    pumpedL,
    harvestL,
    spilledL,
    tankL: tankAfter,
    tankPct: (tankAfter / cap) * 100,
    socKwh: state.socKwh,
    socPct: battKwh ? (state.socKwh / battKwh) * 100 : 0,
    fromSolarKw: fromSolar,
    fromBatteryKw: fromBattery,
    fromDieselKw: fromDiesel,
    dieselL,
    dieselStockL: state.dieselStockL,
    reason,
    ...extra,
  };

  state.tankL = tankAfter;
  return step;
}

export function finaliseTotals(totals) {
  totals.co2Kg = totals.dieselL * CO2_KG_PER_DIESEL_L;
  totals.costUsd = totals.dieselL * USD_PER_DIESEL_L;
  return totals;
}

export function initialState(plant) {
  return {
    tankL: plant.initial_tank_l,
    socKwh: 0,
    dieselStockL: plant.diesel_stock_l ?? Infinity,
  };
}

/** Which power actually did the work this hour. */
function classifySource(fromSolar, fromBattery, fromDiesel, need) {
  if (fromDiesel > 0.001) return fromDiesel / need > 0.5 ? 'diesel' : 'hybrid';
  if (fromBattery > 0.001) return fromSolar > fromBattery ? 'hybrid' : 'battery';
  return 'solar';
}

/**
 * The AquaGrid strategy. Rules are evaluated in strict priority order;
 * the first match wins.
 */
export function runSchedule(hourly, plant, { lookaheadHours = 12, stormOverride = false } = {}) {
  const { pumpKw, outLph, cap, floorL, targetL, catchment, stormKmh } = derive(plant);
  const totals = emptyTotals();
  const state = initialState(plant);
  const steps = [];

  for (let i = 0; i < hourly.length; i++) {
    const h = hourly[i];
    const tankBefore = state.tankL;
    const solarKw = h.solar_kw;

    const horizon = hourly.slice(i, i + lookaheadHours);
    const projDemand = horizon.reduce((a, x) => a + x.predicted_demand_lph, 0);
    const projSolarHours = horizon.filter((x) => x.solar_kw >= pumpKw).length;
    const projRainL = horizon.reduce((a, x) => a + (x.rain_mm || 0), 0) * catchment;
    const projSupply = projSolarHours * outLph + projRainL;
    const willBreach = tankBefore + projSupply - projDemand < floorL;

    // A cyclone in the outlook changes the objective entirely: after it lands
    // the array is down, the barge is not coming, and the only water the island
    // has is what is already in the tank.
    const stormWind = Math.max(...hourly.slice(i, i + 24).map((x) => x.wind_kmh || 0));
    const stormComing = stormOverride || stormWind >= stormKmh;

    // Rain that arrives soon is free water we do not have to make.
    const rainSoonL = hourly.slice(i, i + 6).reduce((a, x) => a + (x.rain_mm || 0), 0) * catchment;
    const demandSoonL = hourly.slice(i, i + 6).reduce((a, x) => a + x.predicted_demand_lph, 0);

    let action, source, reason;

    if (stormComing && tankBefore < cap * 0.98) {
      // RULE 0 — STORM PREPARATION
      action = 'pump';
      reason =
        `Cyclone-force wind (${stormWind.toFixed(0)} km/h) forecast within 24h — ` +
        'filling to 100% now. After it lands the array is down and the barge is not coming.';
    } else if (tankBefore < floorL) {
      // RULE 1 — EMERGENCY
      action = 'pump';
      reason = `Below ${plant.reserve_floor_pct}% reserve floor — emergency top-up regardless of cost`;
    } else if (rainSoonL > demandSoonL && tankBefore > floorL * 1.3 && solarKw < pumpKw) {
      // RULE 2 — RAIN HOLD
      action = 'off';
      source = 'none';
      reason =
        `${(rainSoonL / 1000).toFixed(1)} m³ of rain forecast in the next 6h against ` +
        `${(demandSoonL / 1000).toFixed(1)} m³ of demand — holding, the tank fills for free`;
    } else if (solarKw >= pumpKw && tankBefore < targetL) {
      // RULE 3 — FREE SOLAR
      action = 'pump';
      reason = `Solar output ${solarKw.toFixed(1)} kW covers the full ${pumpKw} kW pump draw — free water`;
    } else if (willBreach && state.socKwh >= pumpKw && tankBefore < targetL) {
      // RULE 4 — STORED SOLAR
      action = 'pump';
      reason =
        `Shortfall forecast within ${lookaheadHours}h — running on ${state.socKwh.toFixed(0)} kWh ` +
        'of solar stored earlier today, so no diesel is needed';
    } else if (willBreach && solarKw >= 0.5 * pumpKw && tankBefore < targetL) {
      // RULE 5 — PRE-EMPTIVE HYBRID
      action = 'pump';
      reason =
        `Shortfall forecast within ${lookaheadHours}h — topping up on ${solarKw.toFixed(1)} kW ` +
        'of partial solar now to avoid a full-diesel run tonight';
    } else if (willBreach && tankBefore < floorL * 1.4) {
      // RULE 6 — RELUCTANT DIESEL
      action = 'pump';
      reason = 'Shortfall forecast, no sun and an empty battery — running on diesel';
    } else {
      // RULE 7 — HOLD
      action = 'off';
      source = 'none';
      reason =
        tankBefore >= targetL
          ? 'Tank near target — holding'
          : 'Solar below pump draw and reserves healthy — waiting for sun';
    }

    if (action === 'pump') {
      const fromSolar = Math.min(solarKw, pumpKw);
      const fromBattery = Math.min(pumpKw - fromSolar, state.socKwh, pumpKw);
      source = classifySource(fromSolar, fromBattery, pumpKw - fromSolar - fromBattery, pumpKw);
    }

    steps.push(settleHour(h, state, action, source, reason, plant, totals, { stormComing }));
  }

  return { steps, totals: finaliseTotals(totals) };
}

/**
 * Replay the 24 hours before the horizon to derive the tank level the operator
 * actually starts at. Without this every location opens at exactly the seeded
 * percentage, which makes the largest number on screen look like a constant
 * rather than a consequence of that island's weather.
 */
export function warmUpTank(warmup, plant) {
  if (!warmup || !warmup.length) return plant.initial_tank_l;
  const { steps } = runSchedule(warmup, plant);
  return steps[steps.length - 1].tankL;
}
