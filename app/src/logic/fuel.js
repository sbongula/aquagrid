/**
 * Diesel inventory against the barge schedule.
 *
 * Burning too much fuel and running out of fuel are different failures. The
 * savings card answers the first. This answers the second, which on an island
 * is the one that actually stops the water: the barge comes every few weeks and
 * there is no forecourt to drive to.
 */

export function fuelOutlook(totals, plant, horizonHours) {
  const stockL = plant.diesel_stock_l;
  if (stockL == null) return null;

  const perDay = (totals.dieselL / horizonHours) * 24;
  const daysToEmpty = perDay > 0.01 ? stockL / perDay : Infinity;
  const daysToBarge = Math.max(0, plant.barge_interval_days - plant.days_since_last_barge);
  const shortfallDays = daysToBarge - daysToEmpty;

  return {
    stockL,
    capacityL: plant.diesel_tank_l,
    stockPct: (stockL / plant.diesel_tank_l) * 100,
    burnPerDayL: perDay,
    daysToEmpty,
    daysToBarge,
    // Positive means the tank runs dry before the next delivery.
    shortfallDays,
    willRunDry: shortfallDays > 0,
    litresNeeded: Math.max(0, shortfallDays * perDay),
    message: (() => {
      if (perDay <= 0.01) return 'No diesel burn forecast — the barge will arrive before any is needed.';
      if (shortfallDays > 0) {
        return (
          `At ${perDay.toFixed(0)} L/day the fuel tank runs dry in ${daysToEmpty.toFixed(1)} days — ` +
          `${shortfallDays.toFixed(1)} days before the next barge. ` +
          `${Math.ceil(shortfallDays * perDay).toLocaleString()} L short.`
        );
      }
      return (
        `${stockL.toLocaleString()} L in the tank, burning ${perDay.toFixed(0)} L/day. ` +
        `That lasts ${daysToEmpty.toFixed(0)} days against ${daysToBarge} until the next barge.`
      );
    })(),
  };
}
