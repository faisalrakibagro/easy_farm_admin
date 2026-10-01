'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY as STORAGE_KEY } from './theme-script';

export type ThemeMode = 'light' | 'dark';

const EVENT = 'farm-theme-change';

function current(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private mode / blocked storage: the choice just isn't remembered.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The saved choice, else the operating system's setting. */
export function storedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage blocked: fall back to the system setting
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** The active theme; re-renders when it is toggled anywhere in the app. */
export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, current, () => 'light');
}
