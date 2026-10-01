'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Baby, Flame, HeartHandshake, Stethoscope, Milk, TestTube } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import type { AnimalType, BreedingUpcomingRow } from '@/types';
import { DaysLeft, animalLabel } from '@/components/breeding/shared';
import ServiceModal from '@/components/breeding/ServiceModal';
import HeatModal from '@/components/breeding/HeatModal';
import BirthModal from '@/components/breeding/BirthModal';
import PregnancyCheckModal from '@/components/breeding/PregnancyCheckModal';
import PageTitle from '@/components/ui/PageTitle';
import { breedingSummaryQuery } from '@/lib/farmQueries';
import { fmtDate, fmtNum, fmtPct } from '@/lib/format';

type Modal =
  | { kind: 'service'; femaleId?: number }
  | { kind: 'heat' }
  | { kind: 'birth'; damId?: number; serviceId?: number }
  | { kind: 'check'; row: BreedingUpcomingRow }
  | null;

function UpcomingList({ title, icon, rows, action, canCreate }: {
  title: string; icon: React.ReactNode; rows: BreedingUpcomingRow[]; canCreate: boolean;
  action?: (row: BreedingUpcomingRow) => React.ReactNode;
}) {
  const { t } = useTranslation('breeding');
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">{icon} {title}
        <span className="ms-auto text-xs font-normal text-slate-400">{fmtNum(rows.length)}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{t('overview.nothing')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <li key={`${r.female.id}-${i}`} className="py-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/farm/cattle/${r.female.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 truncate block">
                  {animalLabel(r.female)}
                </Link>
                <p className="text-xs text-slate-400">{fmtDate(r.date)} · <DaysLeft days={r.days_left} /></p>
              </div>
              {canCreate && action?.(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BreedingOverviewPage() {
  const { t } = useTranslation('breeding');
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('farm.breeding.create');
  const [typeId, setTypeId] = useState('');
  const [modal, setModal] = useState<Modal>(null);

  const { data: types } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
  });

  const { data, isLoading } = useQuery(breedingSummaryQuery(typeId));

  const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : fmtPct(v));

  const cards = data ? [
    { label: t('overview.pregnant'), value: fmtNum(data.counts.pregnant), cls: 'text-pink-600' },
    { label: t('overview.inseminated'), value: fmtNum(data.counts.inseminated), cls: 'text-amber-600' },
    { label: t('overview.open_breeders'), value: fmtNum(data.counts.open_breeders), cls: 'text-slate-700' },
    { label: t('overview.semen_remaining'), value: fmtNum(data.counts.semen_remaining), cls: 'text-sky-600' },
  ] : [];

  const actionBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap">{label}</button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={t('title')} subtitle={t('subtitle')} />
        <div className="flex flex-wrap gap-2">
          <select value={typeId} onChange={e => setTypeId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{t('field.all_types')}</option>
            {(types ?? []).map(tp => <option key={tp.id} value={String(tp.id)}>{tp.name}</option>)}
          </select>
          {canCreate && (
            <>
              <button onClick={() => setModal({ kind: 'heat' })} className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg">
                <Flame size={15} /> {t('btn.heat')}
              </button>
              <button onClick={() => setModal({ kind: 'service' })} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg">
                <HeartHandshake size={15} /> {t('btn.service')}
              </button>
              <button onClick={() => setModal({ kind: 'birth' })} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
                <Baby size={15} /> {t('btn.birth')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
          : cards.map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.cls}`}>{c.value}</p>
            </div>
          ))}
      </div>

      {data && (
        <>
          {/* Upcoming */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UpcomingList title={t('overview.upcoming_deliveries')} icon={<Baby size={15} className="text-green-600" />} rows={data.upcoming.deliveries} canCreate={canCreate}
              action={r => actionBtn(t('btn.birth'), () => setModal({ kind: 'birth', damId: r.female.id, serviceId: r.service_id }))} />
            <UpcomingList title={t('overview.checks_due')} icon={<Stethoscope size={15} className="text-amber-600" />} rows={data.upcoming.pregnancy_checks} canCreate={canCreate}
              action={r => actionBtn(t('btn.check'), () => setModal({ kind: 'check', row: r }))} />
            <UpcomingList title={t('overview.expected_heats')} icon={<Flame size={15} className="text-orange-500" />} rows={data.upcoming.heats} canCreate={canCreate}
              action={r => actionBtn(t('btn.service'), () => setModal({ kind: 'service', femaleId: r.female.id }))} />
            <UpcomingList title={t('overview.dry_off')} icon={<Milk size={15} className="text-sky-600" />} rows={data.upcoming.dry_off} canCreate={canCreate} />
          </div>

          {/* KPIs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold text-slate-700">{t('overview.kpi_title')}</h3>
              <span className="text-xs text-slate-400">{t('overview.period', { from: fmtDate(data.period.from), to: fmtDate(data.period.to) })}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                [t('overview.services'), `${fmtNum(data.kpi.services)} (${t('method.ai')} ${fmtNum(data.kpi.ai_services)} · ${t('method.natural')} ${fmtNum(data.kpi.natural_services)})`],
                [t('overview.conception_rate'), pct(data.kpi.conception_rate)],
                [t('overview.ai_rate'), pct(data.kpi.ai_conception_rate)],
                [t('overview.natural_rate'), pct(data.kpi.natural_conception_rate)],
                [t('overview.services_per_conception'), data.kpi.services_per_conception != null ? fmtNum(data.kpi.services_per_conception) : '—'],
                [t('overview.births'), fmtNum(data.kpi.births)],
                [t('overview.calves'), `${fmtNum(data.kpi.calves_alive)} / ${fmtNum(data.kpi.calves_dead)}`],
                [t('overview.calving_interval'), data.kpi.avg_calving_interval ? t('overview.days', { count: fmtNum(data.kpi.avg_calving_interval) }) : '—'],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-base font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sire / semen performance */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><TestTube size={15} className="text-slate-400" /> {t('overview.sires_title')}</h3>
            {data.sires.length === 0 ? (
              <p className="text-sm text-slate-400">{t('overview.no_data')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                      <th className="py-2 pe-3 font-medium">{t('col.sire')}</th>
                      <th className="py-2 pe-3 font-medium">{t('field.method')}</th>
                      <th className="py-2 pe-3 font-medium text-end">{t('overview.services')}</th>
                      <th className="py-2 font-medium text-end">{t('overview.conception_rate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.sires.map((s, i) => (
                      <tr key={i}>
                        <td className="py-2 pe-3 text-slate-700">{s.label}</td>
                        <td className="py-2 pe-3 text-slate-500">{s.method === 'ai' ? t('method.ai') : t('method.natural')}</td>
                        <td className="py-2 pe-3 text-end text-slate-700">{fmtNum(s.services)}</td>
                        <td className="py-2 text-end font-medium text-slate-800">{pct(s.conception_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {modal?.kind === 'service' && <ServiceModal onClose={() => setModal(null)} initialFemaleId={modal.femaleId} />}
      {modal?.kind === 'heat' && <HeatModal onClose={() => setModal(null)} />}
      {modal?.kind === 'birth' && <BirthModal onClose={() => setModal(null)} initialDamId={modal.damId} initialServiceId={modal.serviceId} />}
      {modal?.kind === 'check' && (
        <PregnancyCheckModal onClose={() => setModal(null)}
          service={{ id: modal.row.service_id!, service_date: modal.row.service_date ?? '', female: { ...modal.row.female, animal_type_id: null, reproductive_status: null } }} />
      )}
    </div>
  );
}
