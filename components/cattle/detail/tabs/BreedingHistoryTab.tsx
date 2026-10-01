'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Baby, Flame, HeartHandshake, Stethoscope } from 'lucide-react';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import type { BreedingHistory, BreedingRecord } from '@/types';
import { StatusBadge, animalLabel, money } from '@/components/breeding/shared';
import { fmtDate, fmtNum } from '@/lib/format';
import ServiceModal from '@/components/breeding/ServiceModal';
import HeatModal from '@/components/breeding/HeatModal';
import BirthModal from '@/components/breeding/BirthModal';
import PregnancyCheckModal from '@/components/breeding/PregnancyCheckModal';

interface BreedingHistoryTabProps {
  cattleId: number;
  canCreate: boolean;
}

/** A female's heats, services with their pregnancy checks, and deliveries. */
export default function BreedingHistoryTab({ cattleId, canCreate }: BreedingHistoryTabProps) {
  const { t } = useTranslation('breeding');
  const { t: tc } = useTranslation('cattle');
  const [modal, setModal] = useState<'heat' | 'service' | 'birth' | { check: BreedingRecord } | null>(null);

  const { data, isLoading } = useQuery<BreedingHistory>({
    queryKey: ['cattle-breeding-history', cattleId],
    queryFn: async () => (await api.get(`/farm/cattle/${cattleId}/breeding-history`)).data,
  });

  if (isLoading || !data) {
    return <div className="bg-white rounded-xl border border-slate-200 p-5 h-48 animate-pulse" />;
  }

  const open = data.open_service;

  return (
    <div className="space-y-4">
      {/* Current state + quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">{tc('breeding.reproductive_status_label')}</p>
            <p className="font-medium text-slate-800">{data.reproductive_status ? tc('breeding.reproductive_status.' + data.reproductive_status) : tc('breeding.not_set')}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">{t('history.next_heat')}</p>
            <p className="font-medium text-slate-800">{fmtDate(data.next_heat_expected) || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">{t('history.open_service')}</p>
            {open ? (
              <p className="font-medium text-slate-800">
                {fmtDate(open.service_date)} · <StatusBadge status={open.status} />
                {open.status === 'pregnant' && open.expected_delivery_date && (
                  <span className="block text-xs text-slate-500">{t('hint.expected_delivery', { date: fmtDate(open.expected_delivery_date) })}</span>
                )}
              </p>
            ) : <p className="font-medium text-slate-400">—</p>}
          </div>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setModal('heat')} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Flame size={13} /> {t('btn.heat')}</button>
            {!open || open.status === 'pending' ? (
              <button onClick={() => setModal('service')} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"><HeartHandshake size={13} /> {t('btn.service')}</button>
            ) : null}
            {open && (
              <button onClick={() => setModal({ check: open })} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"><Stethoscope size={13} /> {t('btn.check')}</button>
            )}
            <button onClick={() => setModal('birth')} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50"><Baby size={13} /> {t('btn.birth')}</button>
          </div>
        )}
      </div>

      {/* Services */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('history.services')} ({fmtNum(data.counts.services)})</h3>
        {data.services.length === 0 ? <p className="text-sm text-slate-400">{t('history.no_services')}</p> : (
          <ul className="divide-y divide-slate-100">
            {data.services.map(s => (
              <li key={s.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-slate-800">{fmtDate(s.service_date)}</span>
                  <span className="text-slate-600">
                    {s.method === 'ai' ? `${t('method.ai')} · ${s.semen_straw?.bull_name ?? '—'}` : `${t('method.natural')} · ${s.sire ? animalLabel(s.sire) : '—'}`}
                  </span>
                  <span className="text-xs text-slate-400">#{fmtNum(s.attempt_no)} · {money(s.total_cost)}</span>
                  <StatusBadge status={s.status} />
                </div>
                {(s.pregnancy_checks ?? []).map(c => (
                  <p key={c.id} className="text-xs text-slate-500 mt-1 ps-3 border-s-2 border-slate-100">
                    {t('history.checks')}: {fmtDate(c.check_date)} · {t('check_method.' + c.method)} · {t('result.' + c.result)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Births */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('history.births')} ({fmtNum(data.counts.births)})</h3>
        {data.births.length === 0 ? <p className="text-sm text-slate-400">{t('history.no_births')}</p> : (
          <ul className="divide-y divide-slate-100">
            {data.births.map(b => (
              <li key={b.id} className="py-2.5 text-sm space-y-1.5">
                <p className="text-slate-700">
                  <span className="font-medium">{fmtDate(b.birth_date)}</span> · {t('delivery_type.' + b.delivery_type)}
                  {b.born_dead > 0 && <span className="text-xs text-red-600"> · {t('field.dead')}: {fmtNum(b.born_dead)}</span>}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(b.calves ?? []).map(c => (
                    <Link key={c.id} href={`/farm/cattle/${c.id}`}
                      className={`text-xs px-2 py-1 rounded-lg border ${c.gender === 'female' ? 'border-pink-200 bg-pink-50 text-pink-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>
                      {c.tag_number} · {tc('gender.' + c.gender)}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Heats */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('history.heats')}</h3>
        {data.heats.length === 0 ? <p className="text-sm text-slate-400">{t('history.no_heats')}</p> : (
          <ul className="divide-y divide-slate-100">
            {data.heats.map(h => (
              <li key={h.id} className="py-2 text-sm flex flex-wrap gap-x-3">
                <span className="font-medium text-slate-800">{fmtDate(h.detected_on)}</span>
                {h.signs && <span className="text-slate-500">{h.signs}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal === 'heat' && <HeatModal onClose={() => setModal(null)} initialFemaleId={cattleId} />}
      {modal === 'service' && <ServiceModal onClose={() => setModal(null)} initialFemaleId={cattleId} />}
      {modal === 'birth' && <BirthModal onClose={() => setModal(null)} initialDamId={cattleId} />}
      {modal && typeof modal === 'object' && <PregnancyCheckModal service={modal.check} onClose={() => setModal(null)} />}
    </div>
  );
}
