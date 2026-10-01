'use client';

import { useTranslation } from 'react-i18next';
import type { MilkSession } from '@/types';

export const MILK_SESSIONS: MilkSession[] = ['morning', 'noon', 'evening'];

/** Sessions kept in the day's order, once each. */
export const orderSessions = (list: readonly string[] | null | undefined): MilkSession[] =>
  MILK_SESSIONS.filter(s => (list ?? []).includes(s));

/** An old milkings-per-day count as sessions (1 → morning, 2 → morning + evening, 3 → all). */
export const sessionsForTimes = (times: number | null | undefined): MilkSession[] =>
  times === 1 ? ['morning'] : times === 3 ? ['morning', 'noon', 'evening'] : ['morning', 'evening'];

/**
 * The sessions an animal may be milked in, as checkboxes. A session ticked
 * here can still be left empty on a day (not milked that time).
 *
 * With `inherited`, the field belongs to one animal: none ticked means it
 * follows its type (shown as the hint), and "same as its type" clears it.
 */
export default function MilkingSessionsPicker({ id, value, onChange, inherited, error }: {
  id?: string;
  value: MilkSession[];
  onChange: (v: MilkSession[]) => void;
  inherited?: MilkSession[];
  error?: string;
}) {
  const { t } = useTranslation('dairy');
  const following = inherited !== undefined && value.length === 0;
  const shown = following ? inherited : value;

  const toggle = (s: MilkSession) => {
    const next = shown.includes(s) ? shown.filter(x => x !== s) : [...shown, s];
    // At least one session stays ticked (an animal follows its type through
    // "same as its type" instead; one not milked at all is dried off).
    if (next.length === 0) return;
    onChange(orderSessions(next));
  };

  return (
    <div id={id} className="space-y-2">
      <div role="group" className={`grid grid-cols-3 gap-2 ${error ? 'rounded-lg ring-1 ring-red-300' : ''}`}>
        {MILK_SESSIONS.map(s => (
          <label key={s} className={`flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm cursor-pointer select-none ${
            shown.includes(s)
              ? (following ? 'border-slate-300 bg-slate-50 text-slate-500' : 'border-blue-400 bg-blue-50 text-blue-800')
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={shown.includes(s)} onChange={() => toggle(s)} />
            {t(`session.${s}`)}
          </label>
        ))}
      </div>
      {inherited !== undefined && (
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={following}
            onChange={e => onChange(e.target.checked ? [] : orderSessions(inherited))} />
          {t('sessions.follow_type', { sessions: inherited.map(s => t(`session.${s}`)).join(', ') })}
        </label>
      )}
    </div>
  );
}
