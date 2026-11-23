// Minimal: near-monochrome surfaces, one electric-violet accent, a tiny lime highlight.
// Content carries the screen; colour is used only where it means something.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { kv } from './kv';

export type Palette = {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  primary: string;
  primaryDark: string;
  accent: string;
  accentInk: string;
  danger: string;
  dangerDark: string;
  warn: string;
  warnBg: string;
};

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#F7F7F4',
    card: '#FFFFFF',
    ink: '#111114',
    muted: '#76767F',
    line: '#E4E4E0',
    primary: '#7C5CFF',
    primaryDark: '#5A3FD9',
    accent: '#C6FF3D',
    accentInk: '#111114',
    danger: '#F0445F',
    dangerDark: '#C92F48',
    warn: '#A15C07',
    warnBg: '#FDF2DC',
  },
  dark: {
    bg: '#0B0B0F',
    card: '#17171D',
    ink: '#F4F4F6',
    muted: '#8D8D98',
    line: '#2A2A32',
    primary: '#8F75FF',
    primaryDark: '#6A50E6',
    accent: '#C6FF3D',
    accentInk: '#111114',
    danger: '#FF5C77',
    dangerDark: '#D63C57',
    warn: '#F5B83D',
    warnBg: '#2E2410',
  },
};

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 };
export const space = (n: number) => n * 4;
export const font = { heavy: '800' as const, bold: '600' as const };

type Mode = 'light' | 'dark';
type ThemeValue = { mode: Mode; colors: Palette; toggle: () => void };

const THEME_KEY = 'qp_theme_v1';
const ThemeContext = createContext<ThemeValue>({ mode: 'light', colors: palettes.light, toggle: () => { } });

/** Follows the system scheme until the user picks one; the pick is saved on device. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [choice, setChoice] = useState<Mode | null>(null);

  useEffect(() => {
    kv.getItem(THEME_KEY)
      .then((v) => { if (v === 'light' || v === 'dark') setChoice(v); })
      .catch(() => { });
  }, []);

  const mode = choice ?? system;
  const toggle = useCallback(() => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setChoice(next);
    void kv.setItem(THEME_KEY, next).catch(() => { });
  }, [mode]);

  // Web: paint the page itself too, so overscroll and wide margins match the app.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.style.backgroundColor = palettes[mode].bg;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const value = useMemo(() => ({ mode, colors: palettes[mode], toggle }), [mode, toggle]);
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export const useTheme = () => useContext(ThemeContext);
