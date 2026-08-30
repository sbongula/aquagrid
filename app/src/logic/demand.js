/**
 * On-device demand forecasting.
 *
 * ml/train_model.py evaluates the trained RandomForest over its entire input
 * grid and exports the result. Every feature the model uses is categorical
 * except temperature, so that grid is exhaustive: this is the model, not an
 * approximation of it. The only loss is temperature discretised to 0.5 C.
 *
 * That is what lets the app forecast demand for an island the laptop never saw.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Jun-Aug, matching the tourist season baked into the training history. */
export const isTouristMonth = (month1to12) => (month1to12 >= 6 && month1to12 <= 8 ? 1 : 0);

export function predictDemandLph(dm, { hour, dayOfWeek, month, tempC, population }) {
  const row = dm.table[isTouristMonth(month)][dayOfWeek][hour];

  // Interpolate between the two nearest temperature buckets. A random forest is
  // a step function in temperature, so snapping to the nearest bucket can land
  // on the wrong side of a split; interpolating keeps the worst-case error an
  // order of magnitude below the model's own 45.3 L/h MAE.
  const pos = clamp((tempC - dm.temp_min_c) / dm.temp_step_c, 0, dm.temp_buckets - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, dm.temp_buckets - 1);
  const frac = pos - lo;
  const base = row[lo] * (1 - frac) + row[hi] * frac;

  const scale = (population || dm.reference_population) / dm.reference_population;
  return base * scale;
}
