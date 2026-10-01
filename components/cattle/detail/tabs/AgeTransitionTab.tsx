'use client';

import { useTranslation } from 'react-i18next';
import type { QueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AgeTransitionHistory } from '@/types';
import { AGE_CATEGORY_COLORS } from './types';
import type { CattleDetail } from './types';
import { localeFor } from '@/lib/languages';

interface AgeTransitionData {
  history: AgeTransitionHistory[];
  current_category: string;
  current_category_id?: number;
  initial_age_category_id?: number;
  initial_age_category_name?: string;
  mature_age_category_id?: number;
  mature_age_category_name?: string;
}

interface AgeTransitionTabProps {
  cattle: CattleDetail;
  hasPermission: (permission: string) => boolean;
  ageTransitionData: AgeTransitionData | undefined;
  ageTransitionLoading: boolean;
  id: string;
  qc: QueryClient;
}

export default function AgeTransitionTab({
  cattle, hasPermission, ageTransitionData, ageTransitionLoading, id, qc,
}: AgeTransitionTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <div className="bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3">
          <p className="text-xs text-cyan-600 font-medium">{t('detail.current_age_category')}</p>
          <p className="text-2xl font-bold text-cyan-700 capitalize">{ageTransitionData?.current_category ?? '—'}</p>
        </div>
        {cattle.status === 'active' && hasPermission('farm.cattle.edit') && ageTransitionData?.initial_age_category_id && ageTransitionData?.mature_age_category_id && (
          <div className="flex gap-2">
            {ageTransitionData?.current_category_id === ageTransitionData?.mature_age_category_id ? (
              <button onClick={async () => {
                const notes = prompt(t('detail.btn.set_immature') + '?');
                await api.post(`/farm/cattle/${id}/age-category`, { age_category_id: ageTransitionData.initial_age_category_id, notes });
                qc.invalidateQueries({ queryKey: ['cattle-age-transition', id] });
                qc.invalidateQueries({ queryKey: ['cattle', id] });
              }} className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                {t('detail.btn.set_immature')} ({ageTransitionData.initial_age_category_name})
              </button>
            ) : (
              <button onClick={async () => {
                const notes = prompt(t('detail.btn.set_adult') + '?');
                await api.post(`/farm/cattle/${id}/age-category`, { age_category_id: ageTransitionData.mature_age_category_id, notes });
                qc.invalidateQueries({ queryKey: ['cattle-age-transition', id] });
                qc.invalidateQueries({ queryKey: ['cattle', id] });
              }} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                {t('detail.btn.set_adult')} ({ageTransitionData.mature_age_category_name})
              </button>
            )}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">{t('detail.transition_history')}</h3>
        </div>
        {/* Mobile card view */}
        <div className="sm:hidden divide-y divide-slate-100">
          {ageTransitionLoading ? (
            [1,2,3].map(i => (
              <div key={i} className="p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))
          ) : (ageTransitionData?.history ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('detail.no_transition_history')}</div>
          ) : (
            (ageTransitionData?.history ?? []).map(h => (
              <div key={h.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGE_CATEGORY_COLORS[h.from_category ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{h.from_category}</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGE_CATEGORY_COLORS[h.to_category ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{h.to_category}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{new Date(h.transition_date).toLocaleDateString(localeFor())}</p>
                  </div>
                  <p className="text-xs text-slate-500 capitalize shrink-0">{h.transition_reason.replace('_', ' ')}</p>
                </div>
                {(h.notes || h.triggered_by?.name) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                    {h.triggered_by?.name && <><div className="text-slate-500">{t('detail.col.shed_transfer.triggered_by')}</div><div className="font-medium text-end text-slate-600">{h.triggered_by.name}</div></>}
                    {h.notes && <><div className="text-slate-500">{t('detail.col.shed_transfer.notes')}</div><div className="font-medium text-end text-slate-500 truncate">{h.notes}</div></>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.shed_transfer.date')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.shed_transfer.from')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.shed_transfer.to')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.shed_transfer.reason')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.shed_transfer.notes')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.shed_transfer.triggered_by')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ageTransitionLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : (ageTransitionData?.history ?? []).map(h => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{new Date(h.transition_date).toLocaleDateString(localeFor())}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGE_CATEGORY_COLORS[h.from_category ?? ''] ?? ''}`}>{h.from_category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGE_CATEGORY_COLORS[h.to_category ?? ''] ?? ''}`}>{h.to_category}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs capitalize">{h.transition_reason.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{h.notes || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{h.triggered_by?.name ?? '—'}</td>
                </tr>
              ))}
              {!ageTransitionLoading && (ageTransitionData?.history ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">{t('detail.no_transition_history')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
