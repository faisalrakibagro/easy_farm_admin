'use client';

import { useTranslation } from 'react-i18next';
import type { CattleHealthStatus } from '@/types';

interface HealthStatusSelectProps {
  value: CattleHealthStatus;
  onChange: (v: CattleHealthStatus) => void;
  className?: string;
}

const OPTIONS: { value: CattleHealthStatus; tone: string }[] = [
  { value: 'sick',       tone: 'border-amber-500 bg-amber-50 text-amber-800' },
  { value: 'critical',   tone: 'border-red-500 bg-red-50 text-red-700' },
  { value: 'recovering', tone: 'border-sky-500 bg-sky-50 text-sky-700' },
  { value: 'healthy',    tone: 'border-green-500 bg-green-50 text-green-700' },
];

/** The animal's condition after treatment — four big buttons (2 × 2 on a phone). */
export default function HealthStatusSelect({ value, onChange, className = '' }: HealthStatusSelectProps) {
  const { t } = useTranslation(['health', 'common']);

  return (
    <div role="radiogroup" className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${className}`}>
      {OPTIONS.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`px-2 py-2.5 sm:py-2 rounded-lg border-2 text-sm font-medium transition-colors ${value === o.value ? o.tone : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
          {t(`treatments.health_status_options.${o.value}`)}
        </button>
      ))}
    </div>
  );
}
