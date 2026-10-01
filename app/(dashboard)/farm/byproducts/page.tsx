'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ClipboardList, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import type { ByproductSummary } from '@/types';
import { money, todayStr } from '@/components/breeding/shared';
import ByproductSaleModal from '@/components/byproducts/ByproductSaleModal';
import { qtyLabel } from '@/components/byproducts/shared';
import { fmtNum } from '@/lib/format';
import PageTitle from '@/components/ui/PageTitle';
import { localDateStr } from '@/lib/dates';

const daysAgo = (n: number) => localDateStr(new Date(Date.now() - n * 86400000));

/** "20 বস্তা + 3 ট্রলি" — quantities that were sold / used in different units. */
const perUnit = (rows: { unit: string | null; quantity: number }[]) =>
  rows.length ? rows.map(r => qtyLabel(r.quantity, r.unit)).join(' + ') : '—';

export default function ByproductsOverviewPage() {
  const { t } = useTranslation('byproducts');
  const { hasPermission } = useAuth();
  const [range, setRange] = useState<{ from: string; to: string }>({ from: daysAgo(29), to: todayStr() });
  const [saleFor, setSaleFor] = useState<number | null | undefined>(undefined);

  const { data, isLoading } = useQuery<ByproductSummary>({
    queryKey: ['byproducts', 'summary', range],
    queryFn: async () => (await api.get('/farm/byproducts/summary', { params: { date_from: range.from, date_to: range.to } })).data,
  });

  const monthStart = todayStr().slice(0, 8) + '01';
  const yearStart = todayStr().slice(0, 5) + '01-01';

  const tiles = data ? [
    { label: t('overview.revenue'), value: money(data.totals.revenue) },
    { label: t('overview.farm_revenue'), value: money(data.totals.farm_revenue) },
    { label: t('overview.animal_revenue'), value: money(data.totals.animal_revenue) },
    { label: t('overview.due'), value: money(data.totals.due) },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={t('title')} subtitle={t('subtitle')} />
        <div className="flex flex-wrap gap-2">
          <Link href="/farm/byproducts/records" className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg">
            <ClipboardList size={15} /> {t('btn.enter_records')}
          </Link>
          {hasPermission('farm.byproducts.create') && (
            <button onClick={() => setSaleFor(null)} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <TrendingUp size={15} /> {t('btn.add_sale')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
          {[
            [t('overview.last_30'), daysAgo(29)],
            [t('overview.this_month'), monthStart],
            [t('overview.this_year'), yearStart],
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
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
          : tiles.map(tile => (
            <div key={tile.label} className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{tile.label}</p>
              <p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-800 mt-1">{tile.value}</p>
            </div>
          ))}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.products.filter(p => p.is_active || p.sales_count > 0).map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800">{p.name}</h3>
                    <p className="text-xs text-slate-400">
                      <span className={`inline-block px-1.5 py-0.5 rounded me-1 ${p.tracking === 'per_animal' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                        {t('tracking.' + p.tracking)}
                      </span>
                      {p.animal_types.map(a => a.name).join(', ')}
                    </p>
                  </div>
                  {hasPermission('farm.byproducts.create') && (
                    <button onClick={() => setSaleFor(p.id)} className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                      {t('btn.add_sale')}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">{t('overview.revenue')}</p><p className="font-semibold text-slate-800">{money(p.revenue)}</p>
                    {p.due > 0 && <p className="text-xs text-red-600">{t('field.due_amount')} {money(p.due)}</p>}</div>
                  <div><p className="text-xs text-slate-400">{t('overview.sold')}</p><p className="font-medium text-slate-700">{perUnit(p.sold)}</p></div>
                  <div><p className="text-xs text-slate-400">{t('overview.used')}</p><p className="font-medium text-slate-700">{perUnit(p.used)}</p></div>
                  {p.tracking === 'per_animal' ? (
                    <div><p className="text-xs text-slate-400">{t('overview.produced')} / {t('overview.stock')}</p>
                      <p className="font-medium text-slate-700">{qtyLabel(p.produced, p.unit?.symbol)} / <span className={(p.stock ?? 0) < 0 ? 'text-amber-700' : ''}>{qtyLabel(p.stock, p.unit?.symbol)}</span></p></div>
                  ) : <div />}
                </div>

                {Object.keys(p.used_by_type).length > 0 && (
                  <p className="text-xs text-slate-500">
                    {Object.entries(p.used_by_type).map(([type, q]) => `${t('usage_type.' + type)} ${qtyLabel(q)}`).join(' · ')}
                  </p>
                )}

                {p.tracking === 'per_animal' && (
                  p.animals.length === 0 ? <p className="text-xs text-slate-400">{t('overview.no_data')}</p> : (
                    <table className="w-full text-sm">
                      <thead><tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                        <th className="py-1.5 font-medium">{t('col.animal')}</th>
                        <th className="py-1.5 font-medium text-end">{t('col.quantity')}</th>
                        <th className="py-1.5 font-medium text-end">{t('col.income')}</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {p.animals.slice(0, 8).map(a => (
                          <tr key={a.cattle_id}>
                            <td className="py-1.5"><Link href={`/farm/cattle/${a.cattle_id}`} className="text-slate-800 hover:text-blue-600">{a.tag_number}{a.name ? ` — ${a.name}` : ''}</Link></td>
                            <td className="py-1.5 text-end text-slate-600">{qtyLabel(a.quantity, p.unit?.symbol)}</td>
                            <td className="py-1.5 text-end font-medium text-slate-800">{money(a.income)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
                {p.tracking === 'per_animal' && p.unit && <p className="text-xs text-slate-400">{t('hint.stock_unit', { unit: p.unit.symbol })}</p>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('overview.customers_title')}</h3>
            {data.customers.length === 0 ? <p className="text-sm text-slate-400">{t('overview.no_data')}</p> : (
              <ul className="divide-y divide-slate-50 text-sm">
                {data.customers.map(c => (
                  // Phones: the name on its own line, the figures under it.
                  <li key={c.customer_id} className="py-2 sm:py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <Link href={`/customers/${c.customer_id}`} className="basis-full sm:basis-0 sm:flex-1 min-w-0 truncate text-slate-800 hover:text-blue-600">{c.name}</Link>
                    <span className="text-xs text-slate-500">{fmtNum(c.count)}×</span>
                    <span className="font-medium text-slate-800">{money(c.amount)}</span>
                    {c.due > 0 && <span className="text-xs text-red-600">{t('field.due_amount')} {money(c.due)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {saleFor !== undefined && <ByproductSaleModal productId={saleFor ?? undefined} onClose={() => setSaleFor(undefined)} />}
    </div>
  );
}
