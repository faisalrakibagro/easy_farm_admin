'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import api from '@/lib/api';
import type { AnimalType, ProfitCenter, ProfitCenterReport } from '@/types';
import { money, todayStr } from '@/components/breeding/shared';
import PageTitle from '@/components/ui/PageTitle';
import LoadError from '@/components/ui/LoadError';
import { localDateStr } from '@/lib/dates';

const CENTERS: ProfitCenter[] = ['fattening', 'breeding', 'dairy'];

// Row labels stay in view while a phone scrolls the numbers sideways.
const STICKY = 'sticky start-0 z-10';

const monthsAgoStart = (n: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return localDateStr(d).slice(0, 8) + '01';
};

/** "৳12,000" in green, "−৳3,000" in red. */
function Signed({ value, bold = false }: { value: number; bold?: boolean }) {
  return (
    <span className={`${bold ? 'font-semibold' : ''} ${value > 0 ? 'text-green-700' : value < 0 ? 'text-red-600' : 'text-slate-500'}`}>
      {value < 0 ? '−' : ''}{money(Math.abs(value))}
    </span>
  );
}

/** Label + amount rows of one center's income or cost breakdown. */
function Lines({ lines, label }: { lines: Record<string, number>; label: (k: string) => string }) {
  const entries = Object.entries(lines).filter(([, v]) => v !== 0);
  if (!entries.length) return <p className="text-xs text-slate-400">—</p>;
  return (
    <ul className="space-y-0.5">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-3 text-xs">
          <span className="text-slate-500">{label(k)}</span>
          <span className="text-slate-700">{money(v)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProfitCentersPage() {
  const { t } = useTranslation('reports');
  const [range, setRange] = useState({ from: monthsAgoStart(0), to: todayStr() });
  const [typeId, setTypeId] = useState('');

  const { data: types } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
  });
  const { data, isLoading, isError, isFetching, refetch } = useQuery<ProfitCenterReport>({
    queryKey: ['profit-centers', range, typeId],
    queryFn: async () => (await api.get('/farm/reports/profit-centers', {
      params: { date_from: range.from, date_to: range.to, animal_type_id: typeId || undefined },
    })).data,
  });

  const lineLabel = (k: string) => t('line.' + k, { defaultValue: t('common:expense_category.' + k, { defaultValue: k.replace(/_/g, ' ') }) });
  const yearStart = todayStr().slice(0, 5) + '01-01';
  const columns: { key: string; label: string }[] = [
    ...CENTERS.map(c => ({ key: c, label: t('center.' + c) })),
    ...(data?.general ? [{ key: 'general', label: t('center.general') }] : []),
    { key: 'total', label: t('center.total') },
  ];

  // One value per column for a summary row.
  const cell = (row: 'income' | 'running_cost' | 'cost_of_sold' | 'profit', key: string): number | null => {
    if (!data) return null;
    if (key === 'total') return data.total[row];
    if (key === 'general') {
      if (!data.general) return null;
      return row === 'income' ? data.general.income : row === 'running_cost' ? data.general.cost : row === 'profit' ? data.general.profit : 0;
    }
    return data.centers[key as ProfitCenter][row];
  };

  return (
    <div className="space-y-5">
      <PageTitle title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          {[
            [t('field.this_month'), monthsAgoStart(0)],
            [t('field.last_3'), monthsAgoStart(2)],
            [t('field.this_year'), yearStart],
          ].map(([label, from]) => (
            <button key={label} onClick={() => setRange({ from, to: todayStr() })}
              className={`px-3 py-1.5 font-medium ${range.from === from && range.to === todayStr() ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="date" value={range.from} max={range.to} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
          aria-label={t('common:date_filter.date_from')} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
        <span className="text-slate-400">–</span>
        <input type="date" value={range.to} max={todayStr()} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
          aria-label={t('common:date_filter.date_to')} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
        <select value={typeId} onChange={e => setTypeId(e.target.value)} aria-label={t('field.animal_type')} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">{t('field.all_types')}</option>
          {(types ?? []).map(tp => <option key={tp.id} value={String(tp.id)}>{tp.name}</option>)}
        </select>
      </div>

      {/* Headline: profit per center */}
      {isError && !data ? (
        <LoadError onRetry={() => refetch()} retrying={isFetching} className="bg-white rounded-xl border border-slate-200" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading || !data ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
            : [...CENTERS.map(c => ({ label: t('center.' + c), value: data.centers[c].profit })), { label: t('center.total'), value: data.total.profit }].map(tile => (
              <div key={tile.label} className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">{tile.label} · {t('row.profit')}</p>
                <p className="amount-fit [--amount-max:1.25rem] mt-1"><Signed value={tile.value} bold /></p>
              </div>
            ))}
        </div>
      )}

      {data && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className={`${STICKY} bg-slate-50 px-4 py-3 text-start font-medium`} />
                  {columns.map(c => <th key={c.key} className={`px-4 py-3 text-end font-medium ${c.key === 'total' ? 'text-slate-800' : ''}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(['income', 'running_cost', 'cost_of_sold'] as const).map(row => (
                  <tr key={row}>
                    <td className={`${STICKY} bg-white px-4 py-2.5 text-slate-600`}>{t('row.' + row)}</td>
                    {columns.map(c => {
                      const v = cell(row, c.key);
                      return <td key={c.key} className={`px-4 py-2.5 text-end ${c.key === 'total' ? 'font-medium text-slate-800' : 'text-slate-700'}`}>{v === null ? '—' : money(v)}</td>;
                    })}
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className={`${STICKY} bg-slate-50 px-4 py-3 font-semibold text-slate-700`}>{t('row.profit')}</td>
                  {columns.map(c => {
                    const v = cell('profit', c.key);
                    return <td key={c.key} className="px-4 py-3 text-end">{v === null ? '—' : <Signed value={v} bold />}</td>;
                  })}
                </tr>
                <tr>
                  <td className={`${STICKY} bg-white px-4 py-2 text-xs text-slate-500`}>{t('row.capital_added')}</td>
                  {columns.map(c => (
                    <td key={c.key} className="px-4 py-2 text-end text-xs text-slate-500">
                      {CENTERS.includes(c.key as ProfitCenter) ? money(data.centers[c.key as ProfitCenter].capital_added) : ''}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={`${STICKY} bg-white px-4 py-2 text-xs text-slate-500`}>{t('row.animals_sold')} / {t('row.active_animals')}</td>
                  {columns.map(c => (
                    <td key={c.key} className="px-4 py-2 text-end text-xs text-slate-500">
                      {CENTERS.includes(c.key as ProfitCenter) ? `${data.centers[c.key as ProfitCenter].animals_sold} / ${data.centers[c.key as ProfitCenter].active_animals}` : ''}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Breakdown per center */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {CENTERS.map(c => (
              <div key={c} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">{t('center.' + c)} · {t('details')}</h3>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">{t('row.income')}</p>
                  <Lines lines={data.centers[c].income_lines} label={lineLabel} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">{t('row.running_cost')}</p>
                  <Lines lines={data.centers[c].cost_lines} label={lineLabel} />
                </div>
              </div>
            ))}
            {data.general && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">{t('center.general')} · {t('details')}</h3>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">{t('row.income')}</p>
                  <Lines lines={data.general.income_lines} label={lineLabel} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">{t('row.cost')}</p>
                  <Lines lines={data.general.cost_lines} label={lineLabel} />
                </div>
              </div>
            )}
          </div>

          {data.months.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('months_title')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead><tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                    <th className={`${STICKY} bg-white py-2 pe-3 font-medium text-start`}>{t('month')}</th>
                    {CENTERS.map(c => <th key={c} className="py-2 font-medium text-end">{t('center.' + c)}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.months.map(m => (
                      <tr key={m.month}>
                        <td className={`${STICKY} bg-white py-1.5 pe-3 text-slate-600`}>{m.month}</td>
                        {CENTERS.map(c => <td key={c} className="py-1.5 text-end"><Signed value={m[c]} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-xs text-slate-500">
            {(['method', 'calf_value', 'general', ...(typeId ? ['type_filter'] : [])] as string[]).map(k => (
              <p key={k} className="flex gap-2"><Info size={13} className="flex-shrink-0 mt-0.5 text-slate-400" /> {t('hint.' + k)}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
