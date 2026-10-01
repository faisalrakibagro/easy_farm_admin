'use client';

import { useTranslation } from 'react-i18next';
import { Syringe } from 'lucide-react';
import type { VaccineSchedule } from '@/types';
import { VACCINE_STATUS_COLOR } from './types';
import type { CattleDetail } from './types';
import { localeFor } from '@/lib/languages';
import { fmtNum, fmtMoney } from '@/lib/format';

interface VaccinesTabProps {
  cattle: CattleDetail;
  hasPermission: (permission: string) => boolean;
  resetVaxModal: () => void;
  setShowVaccineModal: (v: boolean) => void;
  vaccineLoading: boolean;
  vaccineData: { data: VaccineSchedule[] } | undefined;
}

function vaccineQty(v: VaccineSchedule): { qty: number; unit: string; cost: number } {
  const usages = v.medicine_usages ?? [];
  const qty    = usages.reduce((s, u) => s + parseFloat(u.quantity_used), 0);
  const cost   = usages.reduce((s, u) => s + parseFloat(u.total_cost), 0);
  const unit   = usages[0]?.unit ?? '';
  return { qty, unit, cost };
}

export default function VaccinesTab({
  cattle, hasPermission, resetVaxModal, setShowVaccineModal,
  vaccineLoading, vaccineData,
}: VaccinesTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <>
      {cattle.status === 'active' && hasPermission('farm.health.create') && (
        <div className="flex justify-end mb-3">
          <button onClick={() => { resetVaxModal(); setShowVaccineModal(true); }}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Syringe size={14} /> {t('detail.modal.vaccine.add_btn')}
          </button>
        </div>
      )}
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Mobile card view */}
      <div className="sm:hidden divide-y divide-slate-100">
        {vaccineLoading ? (
          [1,2,3].map(i => (
            <div key={i} className="p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))
        ) : (vaccineData?.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('detail.no_vaccine_records')}</div>
        ) : (
          (vaccineData?.data ?? []).map(v => {
            const { qty, unit, cost } = vaccineQty(v);
            return (
              <div key={v.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{v.vaccine_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{v.vaccine_type}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VACCINE_STATUS_COLOR[v.status] ?? 'bg-slate-50 text-slate-600'}`}>
                      {v.status}
                    </span>
                    {cost > 0 && <span className="text-sm font-semibold text-cyan-700">{fmtMoney(cost)}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                  <div className="text-slate-500">{t('detail.col.vaccine.scheduled')}</div>
                  <div className="font-medium text-end text-slate-600">{new Date(v.scheduled_date).toLocaleDateString(localeFor())}</div>
                  <div className="text-slate-500">{t('detail.col.vaccine.administered')}</div>
                  <div className="font-medium text-end text-slate-600">{v.administered_date ? new Date(v.administered_date).toLocaleDateString(localeFor()) : '—'}</div>
                  <div className="text-slate-500">{t('detail.col.vaccine.quantity')}</div>
                  <div className="font-medium text-end text-slate-600">{qty > 0 ? `${fmtNum(qty, 2)} ${unit}` : '—'}</div>
                  <div className="text-slate-500">{t('detail.col.vaccine.next_due')}</div>
                  <div className="font-medium text-end text-slate-600">{v.next_due_date ? new Date(v.next_due_date).toLocaleDateString(localeFor()) : '—'}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.vaccine')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.type')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.scheduled')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.administered')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.quantity')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.cost')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.status')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.vaccine.next_due')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vaccineLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : (vaccineData?.data ?? []).map(v => {
              const { qty, unit, cost } = vaccineQty(v);
              return (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{v.vaccine_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{v.vaccine_type}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(v.scheduled_date).toLocaleDateString(localeFor())}</td>
                  <td className="px-4 py-3 text-slate-500">{v.administered_date ? new Date(v.administered_date).toLocaleDateString(localeFor()) : '—'}</td>
                  <td className="px-4 py-3 text-end text-slate-600">
                    {qty > 0 ? `${fmtNum(qty, 2)} ${unit}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-end font-medium text-cyan-700">
                    {cost > 0 ? fmtMoney(cost) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VACCINE_STATUS_COLOR[v.status] ?? 'bg-slate-50 text-slate-600'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{v.next_due_date ? new Date(v.next_due_date).toLocaleDateString(localeFor()) : '—'}</td>
                </tr>
              );
            })}
            {!vaccineLoading && (vaccineData?.data ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">{t('detail.no_vaccine_records')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
