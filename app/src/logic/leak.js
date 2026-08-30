/**
 * Leak detection by residual analysis against the demand forecast.
 *
 * This is the payoff for having a trained model at all: we know what the tank
 * level *should* do each hour, so an unexplained extra drop is evidence of a
 * loss the schedule cannot account for — a burst pipe, a stuck valve, theft.
 * A fixed level threshold would not catch this until the tank was already low.
 */

/** Box-Muller, seeded, so the demo is reproducible across reloads. */
function gaussian(seedRef) {
  const rand = () => {
    seedRef.s = (seedRef.s * 1664525 + 1013904223) % 4294967296;
    return seedRef.s / 4294967296;
  };
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * What a real float sensor would report: the scheduler's modelled tank level,
 * minus cumulative leak once leakStartHour passes, plus measurement noise.
 */
export function simulateSensor(steps, { leakStartHour = null, leakRateLph = 450, noiseStd = 120, seed = 1337 } = {}) {
  const seedRef = { s: seed };
  return steps.map((s, i) => {
    const leakHours = leakStartHour === null ? 0 : Math.max(0, i - leakStartHour + 1);
    const lost = leakHours * leakRateLph;
    return Math.max(0, s.tankL - lost + gaussian(seedRef) * noiseStd);
  });
}

function std(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/**
 * expectedDrop = demand - pumped - harvested   (what the forecast says should happen)
 * actualDrop   = sensor[i-1] - sensor[i]   (what the sensor says did happen)
 * residual     = actualDrop - expectedDrop (positive = losing water we cannot explain)
 *
 * Alert when the z-score of the residual exceeds zThreshold for `window`
 * consecutive hours.
 */
export function detectLeak(steps, sensorLevels, { window = 3, zThreshold = 3.0, noiseStd = 120 } = {}) {
  const residual = new Array(steps.length).fill(0);
  for (let i = 1; i < steps.length; i++) {
    // Rainwater is free inflow the forecast knows about, so it belongs in the
            // expectation. Omitting it would read every shower as a negative leak.
    const expectedDrop = steps[i].demandL - steps[i].pumpedL - (steps[i].harvestL || 0)
      + (steps[i].spilledL || 0);
    const actualDrop = sensorLevels[i - 1] - sensorLevels[i];
    residual[i] = actualDrop - expectedDrop;
  }

  // Calibrate sigma on the first 12 hours, treated as a known-good baseline.
  const baseline = residual.slice(1, 13);
  let sigma = std(baseline);
  if (!isFinite(sigma) || sigma < 1e-6) sigma = noiseStd * Math.SQRT2;

  const z = residual.map((r) => r / sigma);

  let run = 0;
  for (let i = 1; i < z.length; i++) {
    if (z[i] > zThreshold) {
      run += 1;
      if (run >= window) {
        const startIdx = i - run + 1;
        const flagged = residual.slice(startIdx, steps.length);
        const rate = flagged.reduce((a, b) => a + b, 0) / flagged.length;
        const maxZ = Math.max(...z.slice(startIdx));
        return {
          alert: true,
          startedAtIndex: startIdx,
          startedAtTime: steps[startIdx].time,
          estimatedRateLph: Math.round(rate),
          totalLostL: Math.round(rate * flagged.length),
          confidence: Math.min(0.99, maxZ / (zThreshold * 2)),
          residual,
          z,
          message:
            `Tank losing ${Math.round(rate)} L/h more than forecast since ` +
            `${steps[startIdx].time.slice(11, 16)}. Probable leak on the north line.`,
        };
      }
    } else {
      run = 0;
    }
  }

  return { alert: false, residual, z };
}
