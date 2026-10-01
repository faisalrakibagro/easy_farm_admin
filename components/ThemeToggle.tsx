'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setTheme, useTheme } from '@/lib/theme';

/** Sun / moon button that switches the whole panel between light and dark. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const { t } = useTranslation('layout');
  const isDark = theme === 'dark';
  const label = isDark ? t('theme.to_light', { defaultValue: 'Light mode' }) : t('theme.to_dark', { defaultValue: 'Dark mode' });

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={label}
      aria-label={label}
      // The server always renders light; the saved theme is only known in the browser.
      suppressHydrationWarning
      className={`relative grid place-items-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors overflow-hidden ${className}`}
    >
      <Sun size={17} suppressHydrationWarning className={`absolute transition-all duration-300 ${isDark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100 text-amber-500'}`} />
      <Moon size={16} suppressHydrationWarning className={`absolute transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100 text-sky-300' : 'opacity-0 rotate-90 scale-50'}`} />
    </button>
  );
}
