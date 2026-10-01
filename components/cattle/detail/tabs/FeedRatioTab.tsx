'use client';

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CattleFeedRatioHistory } from '@/types';
import type { CattleDetail } from './types';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import { fmtPct } from '@/lib/format';

interface RatioForm { feed_ratio: string; effective_date: string; notes: string }

interface FeedRatioTabProps {
  cattle: CattleDetail;
  hasPermission: (permission: string) => boolean;
  ratioHistoryData: { history: CattleFeedRatioHistory[]; current_ratio: string } | undefined;
  ratioLoading: boolean;
  setRatioForm: React.Dispatch<React.SetStateAction<RatioForm>>;
  setRatioError: (v: string) => void;
  setShowRatioModal: (v: boolean) => void;
}

export default function FeedRatioTab({
  cattle, hasPermission, ratioHistoryData, ratioLoading,
  setRatioForm, setRatioError, setShowRatioModal,
}: FeedRatioTabProps) {
  const { t } = useTranslation('cattle');

  return (
    <>
      {/* বর্তমান অনুপাত + বাটন */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-4">
          <p className="text-xs text-amber-600 font-medium mb-0.5">{t('detail.current_feed_ratio')}</p>
          <p className="text-3xl font-bold text-amber-700">{fmtPct(ratioHistoryData?.current_ratio ?? cattle.feed_ratio, 1)}</p>
          <p className="text-xs text-amber-500 mt-0.5">{parseFloat(cattle.feed_ratio) === 0 ? t('detail.auto_allocated') : t('detail.fixed_override')}</p>
        </div>
        {cattle.status === 'active' && hasPermission('farm.cattle.edit') && (
          <button onClick={() => { setRatioForm({ feed_ratio: cattle.feed_ratio, effective_date: localDateStr(), notes: '' }); setRatioError(''); setShowRatioModal(true); }}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={14} /> {t('detail.btn.change_ratio')}
          </button>
        )}
      </div>

      {/* ইতিহাস টেবিল */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t('detail.feed_ratio_history')}</h3>
          {!ratioLoading && (ratioHistoryData?.history ?? []).length > 0 && (
            <span className="text-xs text-slate-400">{t('detail.feed_ratio_table.change_count', { count: (ratioHistoryData?.history ?? []).length })}</span>
          )}
        </div>
        {/* Mobile card view */}
        <div className="sm:hidden divide-y divide-slate-100">
          {ratioLoading ? (
            [1,2,3].map(i => (
              <div key={i} className="p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            ))
          ) : (ratioHistoryData?.history ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('detail.no_ratio_history')}</div>
          ) : (() => {
            const sorted = [...(ratioHistoryData?.history ?? [])].sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
            const oldest = sorted[sorted.length - 1];
            const initialRow = oldest?.previous_ratio != null ? { date: cattle.created_at, ratio: parseFloat(oldest.previous_ratio) } : null;
            return (
              <>
                {sorted.map((h, idx) => {
                  const curr = parseFloat(h.feed_ratio);
                  const prev = h.previous_ratio != null ? parseFloat(h.previous_ratio) : null;
                  const diff = prev != null ? curr - prev : null;
                  return (
                    <div key={h.id} className={`p-4 hover:bg-slate-50 ${idx === 0 ? 'bg-amber-50/40' : ''}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div>
                          <p className="font-semibold text-sm text-slate-700">
                            {new Date(h.effective_date).toLocaleDateString(localeFor(), { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          {idx === 0 && <span className="inline-block mt-0.5 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t('detail.feed_ratio_table.current_badge')}</span>}
                        </div>
                        <div className="text-end">
                          <span className="text-xl font-bold text-amber-700">{fmtPct(curr, 1)}</span>
                          {diff != null && (
                            <div>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diff > 0 ? 'bg-green-100 text-green-700' : diff < 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                {diff > 0 ? '\u200E+' : ''}{fmtPct(diff, 1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {initialRow && (
                  <div className="p-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-700">
                          {new Date(initialRow.date).toLocaleDateString(localeFor(), { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <span className="inline-block mt-0.5 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{t('detail.feed_ratio_table.first_badge')}</span>
                      </div>
                      <span className="text-xl font-bold text-amber-700">{fmtPct(initialRow.ratio, 1)}</span>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 font-medium text-slate-500 w-8">#</th>
                <th className="text-start px-4 py-3 font-medium text-slate-500">{t('detail.feed_ratio_table.set_date_col')}</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500">{t('detail.feed_ratio_table.ratio_col')}</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500">{t('detail.feed_ratio_table.change_col')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ratioLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : (() => {
                const sorted = [...(ratioHistoryData?.history ?? [])].sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
                const oldest = sorted[sorted.length - 1];
                const initialRow = oldest?.previous_ratio != null ? { date: cattle.created_at, ratio: parseFloat(oldest.previous_ratio) } : null;
                const totalRows = sorted.length + (initialRow ? 1 : 0);
                return (
                  <>
                    {sorted.map((h, idx) => {
                      const curr = parseFloat(h.feed_ratio);
                      const prev = h.previous_ratio != null ? parseFloat(h.previous_ratio) : null;
                      const diff = prev != null ? curr - prev : null;
                      return (
                        <tr key={h.id} className={`hover:bg-slate-50 ${idx === 0 ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-700">
                              {new Date(h.effective_date).toLocaleDateString(localeFor(), { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            {idx === 0 && (
                              <span className="inline-block mt-0.5 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t('detail.feed_ratio_table.current_badge')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-lg font-bold text-amber-700">{fmtPct(curr, 1)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {diff != null ? (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diff > 0 ? 'bg-green-100 text-green-700' : diff < 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                {diff > 0 ? '\u200E+' : ''}{fmtPct(diff, 1)}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {initialRow && (
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-400 text-xs">{totalRows}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">
                            {new Date(initialRow.date).toLocaleDateString(localeFor(), { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          <span className="inline-block mt-0.5 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{t('detail.feed_ratio_table.first_badge')}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold text-amber-700">{fmtPct(initialRow.ratio, 1)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-slate-300 text-xs">—</span>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
              {!ratioLoading && (ratioHistoryData?.history ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-sm">{t('detail.no_ratio_history')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
