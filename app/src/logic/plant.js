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
    // unchanged: diesel_l_per_kwh, reserve_floor_pct, tank_target_pct
    scale_factor: k,
  };
}
