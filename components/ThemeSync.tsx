'use client';

import { useEffect } from 'react';
import { setTheme, storedTheme } from '@/lib/theme';

/**
 * Re-applies the saved theme once the app is running. The <head> script sets
 * it before the first paint, but when React has to rebuild the page after a
 * hydration mismatch (e.g. the Bengali login page) it resets <html>'s class
 * and the dark theme would be lost until the next reload.
 */
export default function ThemeSync() {
  useEffect(() => {
    setTheme(storedTheme());
  }, []);
  return null;
}
