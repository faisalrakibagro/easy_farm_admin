'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ClipboardList, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import type { AnimalType, DairySummary } from '@/types';
import { money, todayStr } from '@/components/breeding/shared';
import MilkBars from '@/components/dairy/MilkBars';
import MilkSaleModal from '@/components/dairy/MilkSaleModal';
import PageTitle from '@/components/ui/PageTitle';
import { localDateStr } from '@/lib/dates';
import { fmtDate, fmtNum } from '@/lib/format';

const daysAgo = (n: number) => localDateStr(new Date(Date.now() - n * 86400000));

export default function DairyOverviewPage() {
  const { t } = useTranslation('dairy');
  const { hasPermission } = useAuth();
  const [range, setRange] = useState<{ from: string; to: string }>({ from: daysAgo(29), to: todayStr() });
  const [typeId, setTypeId] = useState('');
  const [showSale, setShowSale] = useState(false);

  const { data: types } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
  });

  const { data, isLoading } = useQuery<DairySummary>({
    queryKey: ['dairy', 'summary', range, typeId],
    queryFn: async () => (await api.get('/farm/dairy/summary', {
      params: { date_from: range.from, date_to: range.to, animal_type_id: typeId || undefined },
    })).data,
  });

  const kg = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${fmtNum(v)} ${t('field.kg')}`);
  const monthStart = todayStr().slice(0, 8) + '01';

  const tiles = data ? [
    { label: t('overview.produced'), value: kg(data.totals.produced_kg) },
    { label: t('overview.sold'), value: kg(data.totals.sold_kg) },
    { label: t('overview.revenue'), value: money(data.totals.revenue) },
    { label: t('overview.avg_price'), value: data.totals.avg_price !== null ? money(data.totals.avg_price) : '—' },
    { label: t('overview.in_milk'), value: fmtNum(data.totals.in_milk) },
    { label: t('overview.avg_per_cow'), value: kg(data.totals.avg_per_cow_day) },
    { label: t('overview.used'), value: kg(data.totals.used_kg) },
    { label: t('overview.due'), value: money(data.totals.due) },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={t('title')} subtitle={t('subtitle')} />
        <div className="flex flex-wrap gap-2">
          <Link href="/farm/dairy/milk" className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg">
            <ClipboardList size={15} /> {t('btn.enter_milk')}
          </Link>
          {hasPermission('farm.dairy.create') && (
            <button onClick={() => setShowSale(true)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <TrendingUp size={15} /> {t('btn.add_sale')}
            </button>
          )}
        </div>
      </div>

      {/* Filters: one row above the charts */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          {[
            [t('overview.last_7'), daysAgo(6)],
            [t('overview.last_30'), daysAgo(29)],
            [t('overview.this_month'), monthStart],
          ].map(([label, from]) => (
            <button key={label} onClick={() => setRange({ from, to: todayStr() })}
              className={`px-3 py-1.5 font-medium ${range.from === from && range.to === todayStr() ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="date" value={range.from} max={range.to} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
        <span className="text-slate-400">–</span>
        <input type="date" value={range.to} max={todayStr()} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
        <select value={typeId} onChange={e => setTypeId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">{t('field.all_types')}</option>
          {(types ?? []).filter(tp => tp.is_milking).map(tp => <option key={tp.id} value={String(tp.id)}>{tp.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
          : tiles.map(tile => (
            <div key={tile.label} className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{tile.label}</p>
              <p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-800 mt-1">{tile.value}</p>
            </div>
          ))}
      </div>

      {data && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">{t('overview.daily_title')} — {t('overview.produced')} ({t('field.kg')})</h3>
            {data.daily.length === 0 ? <p className="text-sm text-slate-400">{t('overview.no_data')}</p> : (
              <>
                <MilkBars data={data.daily.map(d => ({ date: d.date, value: d.produced }))} />
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-500">{t('col.date')} · {t('overview.produced')} · {t('overview.sold')} · {t('overview.used')}</summary>
                  <table className="w-full mt-2">
                    <tbody className="divide-y divide-slate-50">
                      {data.daily.map(d => (
                        <tr key={d.date}><td className="py-1 text-slate-500">{fmtDate(d.date)}</td><td className="py-1 text-end">{fmtNum(d.produced)}</td><td className="py-1 text-end">{fmtNum(d.sold)}</td><td className="py-1 text-end">{fmtNum(d.used)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-sm">
              <div><p className="text-xs text-slate-400">{t('overview.saleable')}</p><p className="font-medium text-slate-700">{kg(data.totals.saleable_kg)}</p></div>
              <div><p className="text-xs text-slate-400">{t('overview.withheld')}</p><p className="font-medium text-slate-700">{kg(data.totals.withheld_kg)}</p></div>
              <div><p className="text-xs text-slate-400">{t('overview.used')}</p><p className="font-medium text-slate-700">{kg(data.totals.used_kg)}</p></div>
              <div><p className="text-xs text-slate-400">{t('overview.balance')}</p><p className={`font-medium ${Math.abs(data.totals.balance_kg) > 0.01 ? 'text-amber-700' : 'text-slate-700'}`}>{kg(data.totals.balance_kg)}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('overview.animals_title')}</h3>
              {data.animals.length === 0 ? <p className="text-sm text-slate-400">{t('overview.no_data')}</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 font-medium">{t('col.animal')}</th>
                    <th className="py-2 font-medium text-end">{t('col.total_kg')}</th>
                    <th className="py-2 font-medium text-end">{t('overview.per_day')}</th>
                    <th className="py-2 font-medium text-end">{t('overview.income')}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.animals.map(a => (
                      <tr key={a.cattle_id}>
                        <td className="py-1.5"><Link href={`/farm/cattle/${a.cattle_id}`} className="text-slate-800 hover:text-blue-600">{a.tag_number}{a.name ? ` — ${a.name}` : ''}</Link></td>
                        <td className="py-1.5 text-end text-slate-600">{fmtNum(a.kg)}</td>
                        <td className="py-1.5 text-end font-medium text-slate-800">{fmtNum(a.avg_per_day)}</td>
                        <td className="py-1.5 text-end text-slate-600">{money(a.income)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('overview.sale_types_title')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {(['wholesale', 'retail'] as const).map(st => (
                    <div key={st}>
                      <p className="text-xs text-slate-400">{t('sale_type.' + st)}</p>
                      <p className="font-semibold text-slate-800">{money(data.sale_types[st].amount)}</p>
                      <p className="text-xs text-slate-500">{kg(data.sale_types[st].kg)} · {data.sale_types[st].avg !== null ? `${money(data.sale_types[st].avg)}/${t('field.kg')}` : '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('overview.customers_title')}</h3>
                {data.customers.length === 0 ? <p className="text-sm text-slate-400">{t('overview.no_data')}</p> : (
                  <ul className="divide-y divide-slate-50 text-sm">
                    {data.customers.map(c => (
                      // Phones: the name on its own line, the figures under it.
                      <li key={c.customer_id} className="py-2 sm:py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <Link href={`/customers/${c.customer_id}`} className="basis-full sm:basis-0 sm:flex-1 min-w-0 truncate text-slate-800 hover:text-blue-600">{c.name}</Link>
                        <span className="text-xs text-slate-500">{kg(c.kg)}</span>
                        <span className="font-medium text-slate-800">{money(c.amount)}</span>
                        {c.due > 0 && <span className="text-xs text-red-600">{t('field.due_amount')} {money(c.due)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {data.withdrawal.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 p-5">
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2"><AlertTriangle size={15} /> {t('overview.withdrawal_title')}</h3>
                  <ul className="text-sm space-y-1">
                    {data.withdrawal.map(w => (
                      <li key={w.cattle_id}><Link href={`/farm/cattle/${w.cattle_id}`} className="text-slate-800 hover:text-blue-600">{w.tag_number}{w.name ? ` — ${w.name}` : ''}</Link>
                        <span className="text-xs text-red-600"> · {t('hint.withdrawal', { date: fmtDate(w.until) })}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showSale && <MilkSaleModal onClose={() => setShowSale(false)} />}
    </div>
  );
}
