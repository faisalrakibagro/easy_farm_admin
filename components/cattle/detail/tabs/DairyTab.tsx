'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import type { DairyHistory } from '@/types';
import { money } from '@/components/breeding/shared';
import MilkBars from '@/components/dairy/MilkBars';
import { DryOffModal, StartLactationModal } from '@/components/dairy/LactationModals';
import { fmtDate, fmtNum } from '@/lib/format';
import MilkDaysSection from '@/components/dairy/MilkDaysSection';

/** A female's milk: current lactation, last 60 days, past lactations and dairy profit. */
export default function DairyTab({ cattleId, canEdit }: { cattleId: number; canEdit: boolean }) {
  const { t } = useTranslation('dairy');
  const [modal, setModal] = useState<'start' | 'dry' | null>(null);

  const { data, isLoading } = useQuery<DairyHistory>({
    queryKey: ['cattle-dairy-history', cattleId],
    queryFn: async () => (await api.get(`/farm/cattle/${cattleId}/dairy-history`)).data,
  });

  if (isLoading || !data) return <div className="bg-white rounded-xl border border-slate-200 p-5 h-48 animate-pulse" />;

  if (!data.is_milking_type) {
    return <p className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-500">{t('history.not_milking_type')}</p>;
  }

  const active = data.active_lactation;
  const f = data.finance;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-slate-400">{t('history.active')}</p>
          {active ? (
            <p className="text-sm font-medium text-slate-800">
              #{fmtNum(active.lactation_no)} · {fmtDate(active.start_date)} · {t('history.days', { count: fmtNum(active.length_days) })} · {t('history.avg')} {fmtNum(active.avg_per_day)} {t('overview.per_day')}
            </p>
          ) : <p className="text-sm text-slate-500">{t('history.none_active')}</p>}
          {data.withdrawal_until && (
            <p className="text-xs text-red-600 flex items-center gap-1 mt-1"><AlertTriangle size={12} /> {t('hint.withdrawal', { date: fmtDate(data.withdrawal_until) })}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {active && (
            <Link href="/farm/dairy/milk" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <ClipboardList size={13} /> {t('btn.enter_milk')}
            </Link>
          )}
          {canEdit && active && (
            <button onClick={() => setModal('dry')} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">{t('btn.dry_off')}</button>
          )}
          {canEdit && !active && (
            <button onClick={() => setModal('start')} className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">{t('btn.start_lactation')}</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [t('history.total_kg'), `${fmtNum(f.total_kg)} ${t('field.kg')}`],
          [t('history.milk_income'), money(f.milk_income)],
          [t('history.running_cost'), money(f.dairy_cost)],
          [t('history.milk_profit'), money(f.milk_profit)],
        ].map(([label, value], i) => (
          <div key={label} className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`amount-fit [--amount-max:1.125rem] font-bold mt-1 ${i === 3 ? (f.milk_profit >= 0 ? 'text-green-700' : 'text-red-600') : 'text-slate-800'}`}>{value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {t('history.income_per_kg')}: {f.income_per_kg !== null ? money(f.income_per_kg) : '—'} · {t('history.cost_per_kg')}: {f.cost_per_kg !== null ? money(f.cost_per_kg) : '—'}
        {' · '}{t('history.lifetime')}: {t('history.total_cost')} {money(f.total_cost)}, {t('history.profit')} <span className={f.profit >= 0 ? 'text-green-700' : 'text-red-600'}>{money(f.profit)}</span>
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('history.last_60')} ({t('field.kg')})</h3>
        {data.daily.length === 0 ? <p className="text-sm text-slate-400">{t('overview.no_data')}</p>
          : <MilkBars data={data.daily.map(d => ({ date: d.date, value: d.kg, muted: !d.saleable }))} mutedLabel={t('overview.withheld')} height={120} />}
      </div>

      <MilkDaysSection cattleId={cattleId} />

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('history.lactations')}</h3>
        {data.lactations.length === 0 ? <p className="text-sm text-slate-400">{t('history.no_lactations')}</p> : (<>
          {/* Phones: one line per lactation */}
          <ul className="sm:hidden divide-y divide-slate-100">
            {data.lactations.map(l => (
              <li key={l.id} className="py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-slate-700">#{fmtNum(l.lactation_no)} · {fmtDate(l.start_date)}</span>
                  <span className="shrink-0 font-semibold text-slate-800">{fmtNum(l.total_kg)} {t('field.kg')}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {l.dry_off_date ? `${fmtDate(l.dry_off_date)} · ${t('end_reason.' + (l.end_reason ?? 'other'))}` : t('history.active')}
                  {' · '}{t('history.avg')} {fmtNum(l.avg_per_day)}
                  {' · '}{t('history.peak')} {l.peak_kg != null ? fmtNum(l.peak_kg) : '—'}{l.peak_date ? ` (${fmtDate(l.peak_date)})` : ''}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                <th className="py-2 font-medium">#</th>
                <th className="py-2 font-medium">{t('col.start')}</th>
                <th className="py-2 font-medium">{t('col.end')}</th>
                <th className="py-2 font-medium text-end">{t('col.total_kg')}</th>
                <th className="py-2 font-medium text-end">{t('history.avg')}</th>
                <th className="py-2 font-medium text-end">{t('history.peak')}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {data.lactations.map(l => (
                  <tr key={l.id}>
                    <td className="py-2 text-slate-700">{fmtNum(l.lactation_no)}</td>
                    <td className="py-2 text-slate-600">{fmtDate(l.start_date)}</td>
                    <td className="py-2 text-slate-600">{l.dry_off_date ? `${fmtDate(l.dry_off_date)} · ${t('end_reason.' + (l.end_reason ?? 'other'))}` : t('history.active')}</td>
                    <td className="py-2 text-end text-slate-800">{fmtNum(l.total_kg)}</td>
                    <td className="py-2 text-end text-slate-600">{fmtNum(l.avg_per_day)}</td>
                    <td className="py-2 text-end text-slate-600">{l.peak_kg != null ? fmtNum(l.peak_kg) : '—'}{l.peak_date ? <span className="text-xs text-slate-400"> · {fmtDate(l.peak_date)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
      </div>

      {modal === 'start' && <StartLactationModal onClose={() => setModal(null)} initialCattleId={cattleId} />}
      {modal === 'dry' && active && <DryOffModal lactation={active} onClose={() => setModal(null)} />}
    </div>
  );
}
