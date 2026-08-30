/**
 * Asset health: the same residual idea as leak detection, pointed at the two
 * things on a desalination plant that degrade slowly rather than fail loudly.
 *
 * A leak is a step change. These are trends. Both are invisible to a threshold
 * alarm and obvious once you compare what the plant does against what the
 * forecast says it should.
 */

function gaussian(seedRef) {
  const rand = () => {
    seedRef.s = (seedRef.s * 1664525 + 1013904223) % 4294967296;
    return seedRef.s / 4294967296;
  };
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * What the array's power meter would report: the irradiance-derived prediction,
 * less whatever dust, salt spray or shading is taking off the top, plus noise.
 */
export function simulateArrayMeter(steps, { soilingLoss = 0.12, noiseKw = 0.6, seed = 991 } = {}) {
  const seedRef = { s: seed };
  return steps.map((s) =>
    Math.max(0, s.solarKw * (1 - soilingLoss) + (s.solarKw > 1 ? gaussian(seedRef) * noiseKw : 0)),
  );
}

/**
 * Compare metered output against what the irradiance forecast predicts. Only
 * daylight hours carry information - at night both are zero and the ratio is
 * meaningless.
 */
export function detectSoiling(steps, metered, { minKw = 5, minHours = 6, threshold = 0.06 } = {}) {
  const pairs = steps
    .map((s, i) => ({ predicted: s.solarKw, actual: metered[i], time: s.time }))
    .filter((p) => p.predicted >= minKw);

  if (pairs.length < minHours) return { alert: false, reason: 'not enough daylight hours yet' };

  const predSum = pairs.reduce((a, p) => a + p.predicted, 0);
  const actSum = pairs.reduce((a, p) => a + p.actual, 0);
  const shortfall = 1 - actSum / predSum;

  // Energy the island has already paid for in panels but is not collecting.
  const lostKwh = predSum - actSum;

  if (shortfall < threshold) {
    return {
      alert: false,
      shortfallPct: shortfall * 100,
      hours: pairs.length,
      message: `Array within ${(shortfall * 100).toFixed(1)}% of predicted output — panels are clean.`,
    };
  }

  return {
    alert: true,
    shortfallPct: shortfall * 100,
    hours: pairs.length,
    lostKwh,
    message:
      `Array producing ${(shortfall * 100).toFixed(0)}% below irradiance across ` +
      `${pairs.length} daylight hours — ${lostKwh.toFixed(0)} kWh not collected. ` +
      'Salt spray or dust: panels need washing.',
  };
}

/**
 * Membrane fouling. Specific energy - kWh per cubic metre of fresh water - is
 * the standard health metric for a reverse-osmosis train, and it rises as the
 * membranes foul because the pump must push harder for the same flow. Fit the
 * trend, project the date it crosses the clean-in-place threshold.
 */
export function projectFouling(maintenance) {
  if (!maintenance?.daily?.length) return null;
  const pts = maintenance.daily;
  const n = pts.length;

  // Ordinary least squares on day index.
  const xs = pts.map((_, i) => i);
  const ys = pts.map((p) => p.specific_energy_kwh_m3);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope =
    xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) /
    (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  const intercept = my - slope * mx;

  const latest = ys[n - 1];
  const design = maintenance.design_kwh_m3;
  const threshold = maintenance.clean_threshold_kwh_m3;
  const degradedPct = ((latest - design) / design) * 100;

  const daysToThreshold =
    slope > 1e-6 ? Math.max(0, (threshold - (intercept + slope * (n - 1))) / slope) : Infinity;

  return {
    latest,
    design,
    threshold,
    slopePerDay: slope,
    degradedPct,
    daysToThreshold,
    fit: xs.map((x) => intercept + slope * x),
    actual: ys,
    message:
      daysToThreshold === Infinity
        ? `Specific energy steady at ${latest.toFixed(2)} kWh/m³ — no fouling trend.`
        : `Specific energy up ${degradedPct.toFixed(1)}% from design over ${n} days ` +
          `(${design.toFixed(2)} → ${latest.toFixed(2)} kWh/m³). At this rate the ` +
          `clean-in-place threshold of ${threshold.toFixed(2)} is reached in ` +
          `${Math.round(daysToThreshold)} days — schedule the membrane clean now, ` +
          'not after it starts costing diesel.',
  };
}
