'use client';

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { Treatment } from '@/types';
import type { CattleDetail } from './types';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

interface TreatmentsTabProps {
  cattle: CattleDetail;
  hasPermission: (permission: string) => boolean;
  openTreatmentModal: () => void;
  treatmentLoading: boolean;
  treatmentData: { data: Treatment[] } | undefined;
}

export default function TreatmentsTab({
  cattle, hasPermission, openTreatmentModal, treatmentLoading, treatmentData,
}: TreatmentsTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <>
      {cattle.status === 'active' && hasPermission('farm.health.create') && (
        <div className="flex justify-end mb-3">
          <button onClick={openTreatmentModal}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={14} /> {t('detail.modal.treatment.add_btn')}
          </button>
        </div>
      )}
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Mobile card view */}
      <div className="sm:hidden divide-y divide-slate-100">
        {treatmentLoading ? (
          [1,2,3].map(i => (
            <div key={i} className="p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))
        ) : (treatmentData?.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('detail.no_treatment_records')}</div>
        ) : (
          (treatmentData?.data ?? []).map(tr => (
            <div key={tr.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm text-slate-800 truncate max-w-[180px]">{tr.diagnosis || '—'}</p>
                  <p className="text-xs text-slate-500">{new Date(tr.treatment_date).toLocaleDateString(localeFor())}{tr.doctor_name ? ` · ${tr.doctor_name}` : ''}</p>
                </div>
                <p className="font-semibold text-sm text-orange-700 shrink-0">{fmtMoney(tr.total_cost)}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                <div className="text-slate-500">{t('detail.col.treatment.vet_fee')}</div>
                <div className="font-medium text-end text-slate-600">{fmtMoney(tr.vet_fee)}</div>
                <div className="text-slate-500">{t('detail.col.treatment.med_cost')}</div>
                <div className="font-medium text-end text-slate-600">{fmtMoney(tr.medicine_cost)}</div>
                <div className="text-slate-500">{t('detail.col.treatment.follow_up')}</div>
                <div className="font-medium text-end text-slate-600">{tr.follow_up_date ? new Date(tr.follow_up_date).toLocaleDateString(localeFor()) : '—'}</div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.treatment.date')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.treatment.doctor')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.treatment.diagnosis')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.treatment.vet_fee')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.treatment.med_cost')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.treatment.total')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.treatment.follow_up')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {treatmentLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : (treatmentData?.data ?? []).map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{new Date(t.treatment_date).toLocaleDateString(localeFor())}</td>
                <td className="px-4 py-3 text-slate-700">{t.doctor_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs max-w-[200px] truncate">{t.diagnosis || '—'}</td>
                <td className="px-4 py-3 text-end text-slate-600">{fmtMoney(t.vet_fee)}</td>
                <td className="px-4 py-3 text-end text-slate-600">{fmtMoney(t.medicine_cost)}</td>
                <td className="px-4 py-3 text-end font-medium text-orange-700">{fmtMoney(t.total_cost)}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{t.follow_up_date ? new Date(t.follow_up_date).toLocaleDateString(localeFor()) : '—'}</td>
              </tr>
            ))}
            {!treatmentLoading && (treatmentData?.data ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">{t('detail.no_treatment_records')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
