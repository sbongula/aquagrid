/**
 * Plant sizing for an arbitrary island.
 *
 * Everything scales linearly with population off the reference plant: tank,
 * pump draw, desalination output and panel area all move together. That keeps
 * the ratios that matter constant - specific energy per cubic metre, days of
 * storage, and how many hours of the day solar clears the pump draw - so the
 * scheduler faces the same shape of decision on a village of 1,200 as on a city
 * of 130,000, and only the weather actually differs between locations.
 *
 * Stated in the README as an assumption, because it is one.
 */

export function scalePlant(basePlant, population, referencePopulation) {
  const k = Math.max(0.05, (population || referencePopulation) / referencePopulation);
  const r = (v, dp = 0) => Number(v.toFixed(dp));

  return {
    ...basePlant,
    tank_capacity_l: Math.round(basePlant.tank_capacity_l * k),
    initial_tank_l: Math.round(basePlant.initial_tank_l * k),
    desal_pump_kw: r(basePlant.desal_pump_kw * k, 1),
    desal_output_lph: Math.round(basePlant.desal_output_lph * k),
    array_m2: Math.round(basePlant.array_m2 * k),

    // Roof catchment, battery and fuel storage all scale with the settlement
    // too - a larger island has more public roof, more panels to buffer and a
    // bigger day tank. Keeping these fixed while demand grew would make rain
    // and storage irrelevant everywhere except the reference island.
    roof_catchment_m2: Math.round((basePlant.roof_catchment_m2 || 0) * k),
    battery_kwh: r((basePlant.battery_kwh || 0) * k, 1),
    diesel_tank_l: Math.round((basePlant.diesel_tank_l || 0) * k),
    diesel_stock_l: Math.round((basePlant.diesel_stock_l || 0) * k),

    // unchanged: diesel_l_per_kwh, reserve_floor_pct, tank_target_pct,
    // runoff_coeff, battery_round_trip, barge_interval_days, storm_wind_kmh
    scale_factor: k,
  };
}
