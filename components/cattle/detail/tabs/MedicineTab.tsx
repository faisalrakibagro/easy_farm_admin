'use client';

import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';
import type { CattleDetail, MedUsage } from './types';
import { localeFor } from '@/lib/languages';
import { fmtMoney, fmtNum } from '@/lib/format';

interface MedicineTabProps {
  cattle: CattleDetail;
  hasPermission: (permission: string) => boolean;
  resetMedModal: () => void;
  setShowMedModal: (v: boolean) => void;
  medicineLoading: boolean;
  medicineError: boolean;
  medicineData: { data: MedUsage[] } | undefined;
}

export default function MedicineTab({
  cattle, hasPermission, resetMedModal, setShowMedModal,
  medicineLoading, medicineError, medicineData,
}: MedicineTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <>
      {cattle.status === 'active' && hasPermission('farm.medicine.create') && (
        <div className="flex justify-end mb-3">
          <button onClick={() => { resetMedModal(); setShowMedModal(true); }}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <FlaskConical size={14} /> {t('detail.modal.medicine.add_btn')}
          </button>
        </div>
      )}
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Mobile card view */}
      <div className="sm:hidden divide-y divide-slate-100">
        {medicineLoading ? (
          [1,2,3].map(i => (
            <div key={i} className="p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))
        ) : medicineError ? (
          <div className="p-8 text-center text-red-400 text-sm">{t('common:ui.load_failed_refresh')}</div>
        ) : (medicineData?.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('detail.no_medicine_usage')}</div>
        ) : (
          (medicineData?.data ?? []).map(m => (
            <div key={m.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{m.medicine ? m.medicine.name : `#${m.medicine_id}`}</p>
                  <p className="text-xs text-slate-500">{new Date(m.usage_date).toLocaleDateString(localeFor())}</p>
                </div>
                <p className="font-semibold text-sm text-blue-700 shrink-0">{fmtMoney(m.total_cost)}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                <div className="text-slate-500">{t('detail.col.medicine.quantity')}</div>
                <div className="font-medium text-end text-slate-600">{fmtNum(m.quantity_used)} {m.unit}</div>
                <div className="text-slate-500">{t('tooltip.next_date')}</div>
                <div className="font-medium text-end text-slate-600">{m.next_due_date ? new Date(m.next_due_date).toLocaleDateString(localeFor()) : '—'}</div>
                {m.notes && <><div className="text-slate-500">{t('detail.col.medicine.notes')}</div><div className="font-medium text-end text-slate-500 truncate">{m.notes}</div></>}
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
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.medicine.date')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.medicine.medicine')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.medicine.quantity')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.medicine.cost')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('tooltip.next_date')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.medicine.notes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {medicineLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : medicineError ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-red-400 text-sm">{t('common:ui.load_failed_refresh')}</td></tr>
            ) : (medicineData?.data ?? []).map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{new Date(m.usage_date).toLocaleDateString(localeFor())}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{m.medicine ? m.medicine.name : `#${m.medicine_id}`}</td>
                <td className="px-4 py-3 text-end text-slate-600">{fmtNum(m.quantity_used)} {m.unit}</td>
                <td className="px-4 py-3 text-end font-medium text-blue-700">{fmtMoney(m.total_cost)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{m.next_due_date ? new Date(m.next_due_date).toLocaleDateString(localeFor()) : '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{m.notes || '—'}</td>
              </tr>
            ))}
            {!medicineLoading && !medicineError && (medicineData?.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">{t('detail.no_medicine_usage')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
