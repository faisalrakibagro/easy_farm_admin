import { Trash2 } from 'lucide-react';
import { fmt, PA_ICON, type ManualEntry, type ManualEntriesResponse } from './shared';
import { localeFor } from '@/lib/languages';

interface ManualEntriesTableProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  isLoading: boolean;
  manualEntries: ManualEntry[];
  manualData: ManualEntriesResponse | undefined;
  manualPage: number;
  setManualPage: (updater: (p: number) => number) => void;
  isSuperAdmin: boolean;
  accountName: (id: number) => string;
  paName: (id: number | null) => string | null;
  paType: (id: number | null) => string;
  setDeleteTarget: (entry: ManualEntry) => void;
}

export default function ManualEntriesTable({
  t, isLoading, manualEntries, manualData, manualPage, setManualPage,
  isSuperAdmin, accountName, paName, paType, setDeleteTarget,
}: ManualEntriesTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Mobile card view */}
      <div className="block sm:hidden divide-y divide-slate-100">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
            </div>
          ))
        ) : manualEntries.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400">{t('entries.no_manual')}</div>
        ) : manualEntries.map(entry => (
          <div key={entry.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 truncate" title={entry.description}>{entry.description}</span>
                <span className="text-xs text-slate-400">
                  {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString(localeFor(), { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {isSuperAdmin && (
                <button onClick={() => setDeleteTarget(entry)} aria-label={t('common:btn.delete')} className="p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs [&>*]:min-w-0">
              <div>
                <p className="text-slate-400 mb-0.5">{t('entries.manual_col.account')}</p>
                <p className="text-slate-700 font-medium truncate">{accountName(entry.account_id)}</p>
                {entry.payment_account_id && (
                  <span className="flex items-center gap-1 mt-0.5">
                    {PA_ICON[paType(entry.payment_account_id)]}
                    <span className="text-blue-500 truncate">{paName(entry.payment_account_id)}</span>
                  </span>
                )}
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">{t('entries.manual_col.amount')}</p>
                <p className="font-mono font-semibold text-slate-800 wrap-anywhere">{fmt(parseFloat(entry.amount))}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">{t('entries.manual_col.source')}</p>
                {entry.source_type ? (
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${entry.source_type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                    {t(`entries.source_${entry.source_type}`)}
                  </span>
                ) : <span className="text-slate-300">—</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-start px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{t('entries.col.date')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('entries.manual_col.account')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('entries.col.description')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600 hidden md:table-cell">{t('entries.manual_col.source')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('entries.manual_col.amount')}</th>
              {isSuperAdmin && <th className="w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : manualEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  {t('entries.no_manual')}
                </td>
              </tr>
            ) : manualEntries.map(entry => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                  {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString(localeFor(), { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-slate-700 font-medium">
                  {accountName(entry.account_id)}
                  {entry.payment_account_id && (
                    <span className="flex items-center gap-1 mt-0.5">
                      {PA_ICON[paType(entry.payment_account_id)]}
                      <span className="text-xs text-blue-500">{paName(entry.payment_account_id)}</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-[240px]">
                  <span className="block truncate" title={entry.description}>{entry.description}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {entry.source_type ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.source_type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                      {t(`entries.source_${entry.source_type}`)}
                    </span>
                  ) : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-end font-mono font-semibold text-slate-800">
                  {fmt(parseFloat(entry.amount))}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteTarget(entry)}
                      aria-label={t('common:btn.delete')}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(manualData?.total ?? 0) > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {t('common:pagination.page_of', { current: manualData?.current_page, total: manualData?.last_page })} &bull; {t('common:pagination.total_count', { count: manualData?.total ?? 0 })}
          </span>
          <div className="flex gap-2">
            <button disabled={manualPage <= 1} onClick={() => setManualPage(p => p - 1)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">{t('common:btn.prev')}</button>
            <button disabled={manualPage >= (manualData?.last_page ?? 1)} onClick={() => setManualPage(p => p + 1)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">{t('common:btn.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
