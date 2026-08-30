/**
 * Demand-side advisory.
 *
 * The cheapest litre of diesel is the one you never burn, and the cheapest way
 * to not burn it is to move demand into the hours when the sun is already
 * running the pump. Everything else in this app schedules supply; this is the
 * one piece that talks to the village instead of the plant.
 */

/** WHO minimum for drinking, cooking and basic hygiene. */
export const WHO_MIN_LPD = 15;

/**
 * Runs of consecutive hours where the pump is already running on sun or on
 * stored sun. These are the hours when an extra litre of village demand costs
 * the island nothing, which is the whole point of telling anyone about them.
 */
export function freeSolarWindows(steps, plant, { hours = 24, minRun = 1 } = {}) {
  const windows = [];
  let start = null;

  const slice = steps.slice(0, hours);
  slice.forEach((s, i) => {
    const free = s.action === 'pump' && (s.source === 'solar' || s.source === 'battery');
    if (free && start === null) start = i;
    if ((!free || i === slice.length - 1) && start !== null) {
      const end = free ? i : i - 1;
      if (end - start + 1 >= minRun) windows.push({ startIdx: start, endIdx: end });
      start = null;
    }
  });

  return windows.map((w) => ({
    ...w,
    from: slice[w.startIdx].time.slice(11, 16),
    to: `${String((Number(slice[w.endIdx].time.slice(11, 13)) + 1) % 24).padStart(2, '0')}:00`,
    kwh: slice.slice(w.startIdx, w.endIdx + 1).reduce((a, s) => a + s.fromSolarKw + s.fromBatteryKw, 0),
    litres: slice.slice(w.startIdx, w.endIdx + 1).reduce((a, s) => a + s.pumpedL, 0),
  }));
}

/**
 * Supply per person per day over the horizon, against the WHO floor. When the
 * plant cannot meet demand this is the number that decides whether a public
 * rationing notice is needed - and what it should say.
 */
export function rationingOutlook(steps, plant, population) {
  const hours = steps.length;
  const days = hours / 24;

  const demandL = steps.reduce((a, s) => a + s.demandL, 0);
  const suppliedL = steps.reduce((a, s) => a + s.pumpedL + s.harvestL, 0);
  const startL = steps[0].tankL - steps[0].pumpedL - steps[0].harvestL + steps[0].demandL;
  const availableL = startL + suppliedL;

  const demandLpd = demandL / days / population;
  const availableLpd = Math.min(availableL, demandL) / days / population;
  const shortageHours = steps.filter((s) => s.tankL <= 0).length;

  const required = shortageHours > 0 || availableLpd < demandLpd * 0.95;

  return {
    population,
    demandLpd,
    availableLpd,
    whoMinLpd: WHO_MIN_LPD,
    aboveWho: availableLpd >= WHO_MIN_LPD,
    shortageHours,
    required,
    message: required
      ? `Supply covers ${availableLpd.toFixed(1)} L per person per day against ` +
        `${demandLpd.toFixed(1)} L of demand. That is ` +
        `${availableLpd >= WHO_MIN_LPD ? 'still above' : 'BELOW'} the WHO minimum of ` +
        `${WHO_MIN_LPD} L. A public notice is warranted.`
      : `${availableLpd.toFixed(1)} L per person per day available — ` +
        `${(availableLpd / WHO_MIN_LPD).toFixed(1)}× the WHO minimum of ${WHO_MIN_LPD} L. ` +
        'No rationing required.',
  };
}

/** Plain-language guidance for the village, computed with no LLM involved. */
export function templateAdvisory(windows, rationing) {
  if (!windows.length) {
    return (
      'No full-solar window in the next 24 hours, so every litre made tonight costs diesel. ' +
      `Defer laundry and irrigation where you can. ${rationing.availableLpd.toFixed(0)} L per ` +
      'person per day remains available.'
    );
  }
  const w = windows[0];
  const rest = windows.slice(1).map((x) => `${x.from}–${x.to}`).join(' and ');
  return (
    `Run laundry and irrigation between ${w.from} and ${w.to} — that is the free-solar window, ` +
    `when the pump is already running on ${w.kwh.toFixed(0)} kWh of sun. ` +
    (rest ? `A second window opens ${rest}. ` : '') +
    'Water used outside those hours comes out of the tank, and the tank is refilled on diesel.'
  );
}
