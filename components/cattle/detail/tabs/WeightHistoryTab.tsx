'use client';

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CattleWeight } from '@/types';
import type { CattleDetail } from './types';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtNum } from '@/lib/format';

interface WeightForm { weight_date: string; weight: string; notes: string }

interface WeightHistoryTabProps {
  cattle: CattleDetail;
  hasPermission: (permission: string) => boolean;
  weightsLoading: boolean;
  weights: CattleWeight[];
  setWeightForm: React.Dispatch<React.SetStateAction<WeightForm>>;
  setWeightError: (v: string) => void;
  setWeightModalFeedRatio: (v: string) => void;
  setShowWeightModal: (v: boolean) => void;
}

export default function WeightHistoryTab({
  cattle, hasPermission, weightsLoading, weights,
  setWeightForm, setWeightError, setWeightModalFeedRatio, setShowWeightModal,
}: WeightHistoryTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <>
      {cattle.status === 'active' && hasPermission('farm.cattle.edit') && (
        <div className="flex justify-end mb-3">
          <button onClick={() => { setWeightForm({ weight_date: localDateStr(), weight: '', notes: '' }); setWeightError(''); setWeightModalFeedRatio(''); setShowWeightModal(true); }}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={14} /> {t('detail.btn.record_weight')}
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Mobile card view */}
        <div className="sm:hidden divide-y divide-slate-100">
          {weightsLoading ? (
            [1,2,3].map(i => (
              <div key={i} className="p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))
          ) : weights.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('detail.no_weight_records')}</div>
          ) : (
            weights.map(w => (
              <div key={w.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-sm text-slate-800">{new Date(w.weight_date).toLocaleDateString(localeFor())}</p>
                  <p className="text-lg font-bold text-slate-800">{fmtNum(w.weight, 1)} {t('unit.kg')}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                  <div className="text-slate-500">{t('detail.col.weight.gain_kg')}</div>
                  <div className={`font-medium text-end ${w.weight_gain != null ? (parseFloat(w.weight_gain) >= 0 ? 'text-green-600' : 'text-red-500') : 'text-slate-400'}`}>
                    {w.weight_gain != null ? `${parseFloat(w.weight_gain) >= 0 ? '\u200E+' : ''}${fmtNum(w.weight_gain, 2)}` : '—'}
                  </div>
                  <div className="text-slate-500">{t('detail.col.weight.daily_gain')}</div>
                  <div className="font-medium text-end text-slate-600">{w.daily_gain != null ? `${fmtNum(w.daily_gain, 3)} ${t('unit.kg_per_day')}` : '—'}</div>
                  <div className="text-slate-500">{t('detail.col.weight.days')}</div>
                  <div className="font-medium text-end text-slate-600">{w.days_since_last != null ? fmtNum(w.days_since_last) : '—'}</div>
                  {w.notes && <><div className="text-slate-500">{t('detail.col.weight.notes')}</div><div className="font-medium text-end text-slate-500 truncate">{w.notes}</div></>}
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
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.weight.date')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.weight.weight_kg')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.weight.gain_kg')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.weight.daily_gain')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.weight.days')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.weight.notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weightsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : weights.map(w => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{new Date(w.weight_date).toLocaleDateString(localeFor())}</td>
                  <td className="px-4 py-3 text-end font-medium text-slate-800">{fmtNum(w.weight, 1)}</td>
                  <td className="px-4 py-3 text-end">
                    {w.weight_gain != null ? (
                      <span className={parseFloat(w.weight_gain) >= 0 ? 'text-green-600' : 'text-red-500'}>
                        {parseFloat(w.weight_gain) >= 0 ? '\u200E+' : ''}{fmtNum(w.weight_gain, 2)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-end text-slate-500">
                    {w.daily_gain != null ? `${fmtNum(w.daily_gain, 3)} ${t('unit.kg_per_day')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-end text-slate-400">{w.days_since_last != null ? fmtNum(w.days_since_last) : '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{w.notes || ''}</td>
                </tr>
              ))}
              {!weightsLoading && weights.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">{t('detail.no_weight_records')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
