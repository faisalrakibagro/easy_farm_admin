'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Baby, Flame, Milk, PieChart } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import type { BreedingSummary, BreedingUpcomingRow, DairySummary, ProfitCenter, ProfitCenterReport } from '@/types';
import { DaysLeft, money, todayStr } from '@/components/breeding/shared';
import { localDateStr } from '@/lib/dates';
import { fmtDate, fmtNum } from '@/lib/format';

const daysAgo = (n: number) => localDateStr(new Date(Date.now() - n * 86400000));
const CENTERS: ProfitCenter[] = ['fattening', 'breeding', 'dairy'];

function UpcomingList({ rows, empty }: { rows: BreedingUpcomingRow[]; empty: string }) {
  if (!rows.length) return <p className="text-xs text-slate-400">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-50 text-sm">
      {rows.slice(0, 5).map(r => (
        <li key={`${r.female.id}-${r.date}`} className="py-1.5 flex items-center gap-2">
          <Link href={`/farm/cattle/${r.female.id}`} className="flex-1 min-w-0 truncate text-slate-800 hover:text-blue-600">
            {r.female.tag_number}{r.female.name ? ` — ${r.female.name}` : ''}
          </Link>
          <span className="text-xs text-slate-400">{fmtDate(r.date)}</span>
          <DaysLeft days={r.days_left} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Dashboard widgets for the breeding, dairy and profit-center modules (plan
 * phase 4). Each block shows only for roles that can see its module.
 */
export default function HerdWidgets() {
  const { t } = useTranslation('dashboard');
  const { hasPermission } = useAuth();
  const canDairy = hasPermission('farm.dairy.view');
  const canBreeding = hasPermission('farm.breeding.view');
  const canReports = hasPermission('farm.reports.view');

  const { data: dairy } = useQuery<DairySummary>({
    queryKey: ['dairy', 'summary', 'dashboard'],
    queryFn: async () => (await api.get('/farm/dairy/summary', { params: { date_from: daysAgo(6), date_to: todayStr() } })).data,
    enabled: canDairy,
  });
  const { data: breeding } = useQuery<BreedingSummary>({
    queryKey: ['breeding', 'summary', 'dashboard'],
    queryFn: async () => (await api.get('/farm/breeding/summary')).data,
    enabled: canBreeding,
  });
  const { data: centers } = useQuery<ProfitCenterReport>({
    queryKey: ['profit-centers', 'dashboard'],
    queryFn: async () => (await api.get('/farm/reports/profit-centers')).data,
    enabled: canReports,
  });

  if (!canDairy && !canBreeding && !canReports) return null;

  const todayMilk = dairy?.daily.find(d => d.date === todayStr())?.produced ?? 0;
  const days = dairy?.daily.length ?? 0;
  const weekAvg = days ? dairy!.daily.reduce((s, d) => s + d.produced, 0) / days : 0;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('herd.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {canDairy && (
          <Link href="/farm/dairy" className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-3 text-slate-700"><Milk size={16} className="text-sky-600" /><h3 className="text-sm font-semibold">{t('herd.milk')}</h3></div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="@container min-w-0"><p className="text-xs text-slate-400">{t('herd.today_milk')}</p><p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-800">{fmtNum(todayMilk)} {t('dairy:field.kg')}</p></div>
              <div className="@container min-w-0"><p className="text-xs text-slate-400">{t('herd.week_avg')}</p><p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-800">{fmtNum(weekAvg, 1)} {t('dairy:field.kg')}</p></div>
              <div className="min-w-0"><p className="text-xs text-slate-400">{t('herd.in_milk')}</p><p className="font-semibold text-slate-700">{dairy ? fmtNum(dairy.totals.in_milk) : '—'}</p></div>
              <div className="min-w-0"><p className="text-xs text-slate-400">{t('herd.week_revenue')}</p><p className="font-semibold text-slate-700 [overflow-wrap:anywhere]">{money(dairy?.totals.revenue ?? 0)}</p></div>
            </div>
          </Link>
        )}

        {canBreeding && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Baby size={16} className="text-pink-600" />
              <Link href="/farm/breeding" className="text-sm font-semibold hover:text-blue-600">{t('herd.deliveries')}</Link>
              <span className="ms-auto text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-700">{t('herd.pregnant', { count: fmtNum(breeding?.counts.pregnant ?? 0) })}</span>
            </div>
            <UpcomingList rows={breeding?.upcoming.deliveries ?? []} empty={t('herd.none')} />
          </div>
        )}

        {canBreeding && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Flame size={16} className="text-orange-500" />
              <Link href="/farm/breeding/heats" className="text-sm font-semibold hover:text-blue-600">{t('herd.heats')}</Link>
            </div>
            <UpcomingList rows={breeding?.upcoming.heats ?? []} empty={t('herd.none')} />
            {(breeding?.upcoming.dry_off.length ?? 0) > 0 && (
              <p className="text-xs text-amber-700">{t('herd.dry_off_due', { count: fmtNum(breeding!.upcoming.dry_off.length) })}</p>
            )}
          </div>
        )}

        {canReports && (
          <Link href="/farm/reports/profit-centers" className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow md:col-span-2 xl:col-span-3">
            <div className="flex items-center gap-2 mb-3 text-slate-700"><PieChart size={16} className="text-indigo-600" /><h3 className="text-sm font-semibold">{t('herd.profit_centers')}</h3></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[...CENTERS.map(c => ({ key: c, value: centers?.centers[c].profit })), { key: 'total', value: centers?.total.profit }].map(x => (
                <div key={x.key} className="@container min-w-0">
                  <p className="text-xs text-slate-400">{t('herd.center.' + x.key)}</p>
                  <p className={`amount-fit [--amount-max:1.125rem] font-bold ${(x.value ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {x.value === undefined ? '—' : `${x.value < 0 ? '−' : ''}${money(Math.abs(x.value))}`}
                  </p>
                </div>
              ))}
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
