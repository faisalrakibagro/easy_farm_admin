'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate, fmtNum } from '@/lib/format';

/**
 * Single-series bar chart of kg per day. One hue (the title names the series,
 * so no legend), thin bars with a rounded top on a shared baseline, a 2px gap
 * between bars, and a readout per bar with a hit target wider than the bar
 * itself: shown on mouse hover, and on a tap (phones have no hover), where it
 * stays until another bar is tapped. Days flagged `muted` (e.g. milk withheld
 * for medicine) are drawn lighter and say so in the readout.
 */
export default function MilkBars({ data, unit, height = 140, mutedLabel }: {
  data: { date: string; value: number; muted?: boolean }[];
  /** Unit after each value; defaults to kg in the interface language. */
  unit?: string;
  height?: number;
  mutedLabel?: string;
}) {
  const { t } = useTranslation('common');
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  const u = unit ?? t('dairy:field.kg');

  if (data.length === 0) return null;

  const shown = hover ?? picked;
  const current = shown !== null ? data[shown] ?? null : null;

  return (
    <div className="space-y-1.5">
      <div className="h-5 text-xs text-slate-600">
        {current
          ? <span><span className="font-semibold text-slate-800">{fmtNum(current.value)} {u}</span> · {fmtDate(current.date)}{current.muted && mutedLabel ? ` · ${mutedLabel}` : ''}</span>
          : <span className="text-slate-400">{t('ui.max_value', { value: `${fmtNum(max)} ${u}` })}</span>}
      </div>
      <div className="relative flex items-end gap-[2px] border-b border-slate-200" style={{ height }} onPointerLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 h-full flex items-end cursor-pointer"
            onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(i); }}
            onClick={() => setPicked(p => (p === i ? null : i))}>
            <div
              className={`w-full rounded-t-[4px] transition-opacity ${d.muted ? 'bg-sky-200' : 'bg-sky-500'} ${current && shown !== i ? 'opacity-60' : ''}`}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{fmtDate(data[0].date)}</span>
        <span>{fmtDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
