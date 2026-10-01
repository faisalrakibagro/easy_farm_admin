'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import DateRangeFilter, { EMPTY_DATE_RANGE, type DateRange } from '@/components/ui/DateRangeFilter';
import { fmtMoney, fmtNum } from '@/lib/format';
import { localeFor } from '@/lib/languages';
import type { MilkSession } from '@/types';

interface MilkDay {
  date: string; morning: number; noon: number; evening: number;
  total_kg: number; saleable_kg: number; sold_kg: number; amount: number; rate: number | null;
}
interface MilkDaySale {
  id: number; sale_date: string; sale_type: 'wholesale' | 'retail'; buyer: string | null;
  period_from: string; period_to: string; rate: number; kg: number; amount: number;
}
interface MilkDays {
  date_from: string; date_to: string; days: MilkDay[]; sales: MilkDaySale[];
  totals: { total_kg: number; saleable_kg: number; sold_kg: number; amount: number };
}

const SESSIONS: MilkSession[] = ['morning', 'noon', 'evening'];
const day = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(localeFor(), opts);

/**
 * One animal's milk day by day — each session's kg — and what it sold for:
 * of each sale covering the day, the part that was this animal's milk, at the
 * sale's rate. Last 30 days unless a range is picked.
 */
export default function MilkDaysSection({ cattleId }: { cattleId: number }) {
  const { t } = useTranslation('dairy');
  const [range, setRange] = useState<DateRange>({ ...EMPTY_DATE_RANGE });

  const { data, isLoading } = useQuery<MilkDays>({
    queryKey: ['cattle-dairy-history', cattleId, 'days', range.date_from, range.date_to],
    queryFn: async () => (await api.get(`/farm/cattle/${cattleId}/milk-days`, {
      params: { date_from: range.date_from || undefined, date_to: range.date_to || undefined },
    })).data,
  });

  const kg = (v: number) => (v > 0 ? fmtNum(v) : '—');
  const sessionCells = (d: MilkDay) => SESSIONS.filter(s => d[s] > 0).map(s => `${t('session.' + s)} ${fmtNum(d[s])}`).join(' · ');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">{t('days.title')}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{t('days.hint')}</p>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />

      {isLoading || !data ? <div className="h-40 bg-slate-50 rounded-lg animate-pulse" /> : (
        <>
          <p className="text-xs text-slate-500">{day(data.date_from, { day: 'numeric', month: 'short', year: 'numeric' })} – {day(data.date_to, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              [t('days.total'), `${fmtNum(data.totals.total_kg)} ${t('field.kg')}`],
              [t('days.saleable'), `${fmtNum(data.totals.saleable_kg)} ${t('field.kg')}`],
              [t('days.sold'), `${fmtNum(data.totals.sold_kg)} ${t('field.kg')}`],
              [t('days.income'), fmtMoney(data.totals.amount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-base font-bold text-slate-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {data.days.length === 0 ? <p className="text-sm text-slate-400">{t('overview.no_data')}</p> : (
            <>
              {/* Phones: a card per day */}
              <ul className="sm:hidden divide-y divide-slate-100">
                {data.days.map(d => (
                  <li key={d.date} className="py-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-slate-800">{day(d.date)}</span>
                      <span className="font-semibold text-slate-800">{fmtNum(d.total_kg)} {t('field.kg')}</span>
                    </div>
                    <p className="text-xs text-slate-500">{sessionCells(d)}</p>
                    {d.sold_kg > 0 && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        {t('days.sold_line', { kg: fmtNum(d.sold_kg), rate: fmtMoney(d.rate), amount: fmtMoney(d.amount) })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {/* Larger screens: the table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead><tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 font-medium text-start">{t('col.date')}</th>
                    {SESSIONS.map(s => <th key={s} className="py-2 font-medium text-end">{t('session.' + s)}</th>)}
                    <th className="py-2 font-medium text-end">{t('days.total')}</th>
                    <th className="py-2 font-medium text-end">{t('days.sold')}</th>
                    <th className="py-2 font-medium text-end">{t('days.rate')}</th>
                    <th className="py-2 font-medium text-end">{t('days.income')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.days.map(d => (
                      <tr key={d.date}>
                        <td className="py-2 text-slate-700">{day(d.date)}</td>
                        {SESSIONS.map(s => <td key={s} className="py-2 text-end text-slate-600">{kg(d[s])}</td>)}
                        <td className="py-2 text-end font-medium text-slate-800">{fmtNum(d.total_kg)}</td>
                        <td className="py-2 text-end text-slate-600">{kg(d.sold_kg)}</td>
                        <td className="py-2 text-end text-slate-600">{d.rate !== null ? fmtMoney(d.rate) : '—'}</td>
                        <td className="py-2 text-end font-medium text-green-700">{d.amount > 0 ? fmtMoney(d.amount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {data.sales.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">{t('days.sales_title')}</h4>
              <ul className="divide-y divide-slate-100 text-sm">
                {data.sales.map(s => (
                  <li key={s.id} className="py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="text-slate-700">
                      {day(s.sale_date)} · {t('sale_type.' + s.sale_type)}{s.buyer ? ` · ${s.buyer}` : ''}
                      <span className="text-xs text-slate-400"> ({day(s.period_from)} – {day(s.period_to)})</span>
                    </span>
                    <span className="text-slate-600">
                      {t('days.sale_line', { kg: fmtNum(s.kg), rate: fmtMoney(s.rate) })} = <b className="text-green-700">{fmtMoney(s.amount)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
