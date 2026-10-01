'use client';

import { useTranslation } from 'react-i18next';
import { CalendarRange, CalendarDays } from 'lucide-react';
import { localeFor } from '@/lib/languages';

/** Categories that are a running monthly cost by default — mirrors Expense::MONTHLY_CATEGORIES on the API. */
export const MONTHLY_CATEGORIES = ['electricity', 'water', 'rent'];
/** Utility bills arrive after the month they cover. */
const BILLED_AFTER = ['electricity', 'water'];

export const isMonthlyByDefault = (category: string) => MONTHLY_CATEGORIES.includes(category);

/**
 * "Monthly cost" checkbox. Monthly = shared over the whole month's herd by the
 * days each animal was there; otherwise only the animals on the farm that day
 * share it. The line under it says exactly which period, and follows the
 * category and date as they change.
 */
export default function RecurringToggle({ checked, onChange, category, date }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  category: string;
  date: string;
}) {
  const { t, i18n } = useTranslation('finance');
  const d = date ? new Date(date + 'T00:00:00') : new Date();
  const month = new Date(d.getFullYear(), d.getMonth() - (BILLED_AFTER.includes(category) ? 1 : 0), 1);
  const locale = localeFor(i18n.language);
  const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const dayLabel = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${checked ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-slate-50/60'}`}>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
        <input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={checked} onChange={e => onChange(e.target.checked)} />
        {checked ? <CalendarRange size={15} className="text-indigo-500" /> : <CalendarDays size={15} className="text-slate-500" />}
        {t('expenses.recurring.label')}
      </label>
      <p className="text-xs text-slate-500 mt-1 ms-6">
        {checked ? t('expenses.recurring.monthly_hint', { month: monthLabel }) : t('expenses.recurring.one_day_hint', { date: dayLabel })}
      </p>
    </div>
  );
}
