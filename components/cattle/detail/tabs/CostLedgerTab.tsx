'use client';

import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { CattleLedgerEntry } from '@/types';
import { ENTRY_TYPE_COLOR } from './types';
import { fmtDate, fmtMoney } from '@/lib/format';
import { ledgerText } from '@/lib/activityText';

interface CostLedgerTabProps {
  ledgerData: { entries: { data: CattleLedgerEntry[]; last_page: number; total: number }; total_cost: number; breakdown: Record<string, number> } | undefined;
  ledgerLoading: boolean;
  ledgerPage: number;
  setLedgerPage: React.Dispatch<React.SetStateAction<number>>;
}

export default function CostLedgerTab({
  ledgerData, ledgerLoading, ledgerPage, setLedgerPage,
}: CostLedgerTabProps) {
  const { t } = useTranslation(['cattle', 'activity']);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {ledgerData && (
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 me-2">{t('common:total')}: {fmtMoney(ledgerData.total_cost)}</span>
          {Object.entries(ledgerData.breakdown).map(([type, amount]) => (
            <span key={type} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTRY_TYPE_COLOR[type] ?? 'bg-slate-50 text-slate-600'}`}>
              {t(`detail.entry_type.${type}`, { defaultValue: type })}: {fmtMoney(amount)}
            </span>
          ))}
        </div>
      )}
      {/* Mobile card view */}
      <div className="sm:hidden divide-y divide-slate-100">
        {ledgerLoading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))
        ) : !ledgerData?.entries?.data?.length ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t('detail.no_ledger_entries')}</div>
        ) : (
          ledgerData.entries.data.map(entry => (
            <div key={entry.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ENTRY_TYPE_COLOR[entry.entry_type] ?? 'bg-slate-50 text-slate-600'}`}>
                      {t(`detail.entry_type.${entry.entry_type}`, { defaultValue: entry.entry_type })}
                    </span>
                    <p className="text-xs text-slate-500">{fmtDate(entry.entry_date)}</p>
                  </div>
                  <p className="text-sm text-slate-600 truncate">{ledgerText(entry, t)}</p>
                </div>
                <div className="shrink-0 text-end">
                  <span className="flex items-center gap-1 font-medium text-slate-800">
                    {parseFloat(entry.amount) >= 0 ? <TrendingUp size={12} className="text-red-400" /> : <TrendingDown size={12} className="text-green-400" />}
                    {fmtMoney(Math.abs(parseFloat(entry.amount)))}
                  </span>
                </div>
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
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.costs.date')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.costs.type')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('detail.col.costs.description')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('detail.col.costs.amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledgerLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : ledgerData?.entries?.data?.map(entry => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(entry.entry_date)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTRY_TYPE_COLOR[entry.entry_type] ?? 'bg-slate-50 text-slate-600'}`}>
                    {t(`detail.entry_type.${entry.entry_type}`, { defaultValue: entry.entry_type })}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{ledgerText(entry, t)}</td>
                <td className="px-4 py-3 text-end font-medium text-slate-800">
                  <span className="flex items-center justify-end gap-1">
                    {parseFloat(entry.amount) >= 0 ? <TrendingUp size={12} className="text-red-400" /> : <TrendingDown size={12} className="text-green-400" />}
                    {fmtMoney(Math.abs(parseFloat(entry.amount)))}
                  </span>
                </td>
              </tr>
            ))}
            {!ledgerLoading && !ledgerData?.entries?.data?.length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">{t('detail.no_ledger_entries')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(ledgerData?.entries?.total ?? 0) > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <span className="text-slate-500">{t('common:pagination.page_of', { current: ledgerPage, total: ledgerData?.entries?.last_page ?? 1 })} &bull; {t('common:pagination.total_count', { count: ledgerData?.entries?.total ?? 0 })}</span>
          <div className="flex gap-2">
            <button disabled={ledgerPage <= 1} onClick={() => setLedgerPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
            <button disabled={ledgerPage >= (ledgerData?.entries?.last_page ?? 1)} onClick={() => setLedgerPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
