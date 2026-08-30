// Dark, because operator tooling is dark and it films better on a phone screen.
export const theme = {
  bg: '#0B1220',
  surface: '#131C2E',
  border: '#1F2C44',
  text: '#E6EDF7',
  textDim: '#8C9BB5',
  solar: '#F5B942',
  water: '#38BDF8',
  good: '#34D399',
  warn: '#FBBF24',
  bad: '#F87171',
  radius: 16,
  pad: 16,
};

/** Colour for a scheduler step, by power source. */
export const sourceColor = (source) =>
  ({ solar: theme.good, hybrid: theme.warn, diesel: theme.bad }[source] || theme.border);

export const sourceLabel = (step) => {
  if (step.action !== 'pump') return 'HOLDING';
  return { solar: 'PUMPING — ON SOLAR', hybrid: 'PUMPING — PARTIAL SOLAR', diesel: 'PUMPING — ON DIESEL' }[step.source];
};
