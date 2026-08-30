/**
 * Two palettes and the machinery to switch between them.
 *
 * Operator tooling is conventionally dark, and dark films better on a phone at
 * night. But this plant is a solar plant: an operator standing at the tank at
 * midday is looking at the screen in full tropical sun, where a dark UI is the
 * wrong answer. So the app follows the clock.
 *
 * Modes: 'auto' follows local time, 'light' and 'dark' pin it.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const shared = { radius: 16, pad: 16 };

export const palettes = {
  dark: {
    ...shared,
    mode: 'dark',
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
    // Tinted fills read differently on each ground, so they are tokens too.
    goodFill: 'rgba(52,211,153,0.08)',
    badFill: 'rgba(248,113,113,0.09)',
    scrim: 'rgba(0,0,0,0.8)',
  },
  light: {
    ...shared,
    mode: 'light',
    bg: '#EEF3F6',
    surface: '#FFFFFF',
    border: '#D2E0E8',
    text: '#0B1E29',
    // Accents are darkened rather than reused: the dark palette's amber and
    // cyan fail contrast on white.
    textDim: '#57727F',
    solar: '#B06E02',
    water: '#0C6D8C',
    good: '#12805A',
    warn: '#8A6104',
    bad: '#B93A31',
    goodFill: 'rgba(18,128,90,0.09)',
    badFill: 'rgba(185,58,49,0.09)',
    scrim: 'rgba(11,30,41,0.55)',
  },
};

/** Daylight at the device's own clock. */
export function isDaytime(date = new Date()) {
  const h = date.getHours();
  return h >= 7 && h < 19;
}

export const resolveMode = (pref) => (pref === 'auto' ? (isDaytime() ? 'light' : 'dark') : pref);

const ThemeContext = createContext({
  theme: palettes.dark,
  pref: 'auto',
  setPref: () => {},
  resolved: 'dark',
});

export function ThemeProvider({ children, initialPref = 'auto' }) {
  const [pref, setPref] = useState(initialPref);
  const [resolved, setResolved] = useState(() => resolveMode(initialPref));

  // On auto, re-check periodically so the app crosses over at dawn and dusk
  // without needing to be reopened.
  useEffect(() => {
    setResolved(resolveMode(pref));
    if (pref !== 'auto') return undefined;
    const id = setInterval(() => setResolved(resolveMode('auto')), 60000);
    return () => clearInterval(id);
  }, [pref]);

  const value = useMemo(
    () => ({ theme: palettes[resolved], pref, setPref, resolved }),
    [resolved, pref],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext).theme;
export const useThemeMode = () => useContext(ThemeContext);

/** Memoised stylesheet, rebuilt only when the palette actually changes. */
export function useStyles(factory) {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

/** Colour for a scheduler step, by power source. */
export const sourceColor = (source, theme) =>
  ({ solar: theme.good, battery: theme.water, hybrid: theme.warn, diesel: theme.bad }[source] ||
    theme.border);

export const sourceLabel = (step) => {
  if (step.action !== 'pump') return 'HOLDING';
  return {
    solar: 'PUMPING — ON SOLAR',
    battery: 'PUMPING — ON STORED SOLAR',
    hybrid: 'PUMPING — PARTIAL SOLAR',
    diesel: 'PUMPING — ON DIESEL',
  }[step.source];
};
