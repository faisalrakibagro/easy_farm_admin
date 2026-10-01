import { Banknote } from 'lucide-react';
import type { AccountingPaymentAccount } from '@/types';
import { fmt, VOUCHER_STYLES, VOUCHER_ICON, PA_ICON, type LedgerRow, type LedgerResponse } from './shared';
import { localeFor } from '@/lib/languages';
import { fmtNum } from '@/lib/format';

interface LedgerTableProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  isLoading: boolean;
  rows: LedgerRow[];
  data: LedgerResponse | undefined;
  totals: { debit: number; credit: number; balance: number } | undefined;
  paymentAccounts: { payment_accounts: AccountingPaymentAccount[] } | undefined;
  dateFrom: string;
  dateTo: string;
  page: number;
  setPage: (updater: (p: number) => number) => void;
}

export default function LedgerTable({ t, isLoading, rows, data, totals, paymentAccounts, dateFrom, dateTo, page, setPage }: LedgerTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Mobile card view */}
      <div className="block sm:hidden divide-y divide-slate-100">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400">{t('entries.no_transactions')}</div>
        ) : rows.map((row, idx) => {
          const isDebit  = row.debit  > 0;
          const isCredit = row.credit > 0;
          const style    = VOUCHER_STYLES[row.voucher_type] ?? 'bg-slate-100 text-slate-600';
          const icon     = VOUCHER_ICON[row.voucher_type];
          return (
            <div
              key={row.sort_key + '_mob_' + idx}
              className={`p-4 ${isDebit ? 'border-s-2 border-s-red-200' : 'border-s-2 border-s-green-200'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800 truncate" title={row.description}>{row.description}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(row.date + 'T00:00:00').toLocaleDateString(localeFor(), { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
                  {icon}
                  {t(`entries.voucher_types.${row.voucher_type}`, { defaultValue: row.voucher_type })}
                </span>
              </div>
              {row.payment_via && (
                <div className="flex items-center gap-1 mb-2">
                  {paymentAccounts?.payment_accounts.find(p => p.name === row.payment_via)
                    ? PA_ICON[paymentAccounts.payment_accounts.find(p => p.name === row.payment_via)!.type]
                    : <Banknote size={10} />}
                  <span className="text-xs text-blue-500 font-medium">{row.payment_via}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                <div>
                  <p className="text-slate-400 mb-0.5">{t('entries.col.account_party')}</p>
                  <p className="text-slate-600 truncate" title={row.account}>{row.account}</p>
                </div>
                <div>
                  <p className="text-red-400 mb-0.5">{t('entries.col.debit_dr')}</p>
                  <p className="font-mono font-semibold">
                    {isDebit ? <span className="text-red-600">{fmt(row.debit)}</span> : <span className="text-slate-200">—</span>}
                  </p>
                </div>
                <div>
                  <p className="text-green-500 mb-0.5">{t('entries.col.credit_cr')}</p>
                  <p className="font-mono font-semibold">
                    {isCredit ? <span className="text-green-600">{fmt(row.credit)}</span> : <span className="text-slate-200">—</span>}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-start px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{t('entries.col.date')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('entries.col.type')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('entries.col.description_via')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600 hidden md:table-cell">{t('entries.col.account_party')}</th>
              <th className="text-end px-4 py-3 font-medium text-red-600">{t('entries.col.debit_dr')}</th>
              <th className="text-end px-4 py-3 font-medium text-green-600">{t('entries.col.credit_cr')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('entries.col.balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{t('entries.no_transactions')}</td></tr>
            ) : rows.map((row, idx) => {
              const isDebit  = row.debit  > 0;
              const isCredit = row.credit > 0;
              const style    = VOUCHER_STYLES[row.voucher_type] ?? 'bg-slate-100 text-slate-600';
              const icon     = VOUCHER_ICON[row.voucher_type];
              return (
                <tr
                  key={row.sort_key + '_' + idx}
                  className={`hover:bg-slate-50 ${isDebit ? 'border-s-2 border-s-red-200' : 'border-s-2 border-s-green-200'}`}
                >
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {new Date(row.date + 'T00:00:00').toLocaleDateString(localeFor(), { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
                      {icon}
                      {t(`entries.voucher_types.${row.voucher_type}`, { defaultValue: row.voucher_type })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[240px]">
                    <span className="block truncate text-sm" title={row.description}>{row.description}</span>
                    {row.payment_via && (
                      <span className="flex items-center gap-1 mt-0.5">
                        {paymentAccounts?.payment_accounts.find(p => p.name === row.payment_via)
                          ? PA_ICON[paymentAccounts.payment_accounts.find(p => p.name === row.payment_via)!.type]
                          : <Banknote size={10} />}
                        <span className="text-xs text-blue-500 font-medium truncate">{row.payment_via}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell max-w-[160px] truncate" title={row.account}>
                    {row.account}
                  </td>
                  <td className="px-4 py-3 text-end font-mono">
                    {isDebit ? <span className="text-red-600 font-semibold">{fmt(row.debit)}</span> : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-4 py-3 text-end font-mono">
                    {isCredit ? <span className="text-green-600 font-semibold">{fmt(row.credit)}</span> : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-4 py-3 text-end font-mono">
                    <span className={`font-bold text-sm ${row.balance >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                      {row.balance < 0 ? '\u200E-' : ''}{fmt(row.balance)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && totals && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-slate-600 text-sm">
                  {t('entries.transactions_count', { count: data?.total ?? 0 })}
                  {(dateFrom || dateTo) && (
                    <span className="ms-2 text-xs font-normal text-slate-400">
                      {dateFrom && `${t('common:from')} ${dateFrom}`} {dateTo && `${t('common:to')} ${dateTo}`}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-end text-red-600 font-mono">{fmt(totals.debit)}</td>
                <td className="px-4 py-3 text-end text-green-600 font-mono">{fmt(totals.credit)}</td>
                <td className={`px-4 py-3 text-end font-mono ${totals.balance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {totals.balance < 0 ? '\u200E-' : ''}{fmt(totals.balance)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {(data?.total ?? 0) > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {t('common:pagination.page_of', { current: fmtNum(data?.current_page), total: fmtNum(data?.last_page) })} &middot; {fmtNum(data?.total)} {t('entries.entries_count')}
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">{t('common:btn.prev')}</button>
            <button disabled={page >= (data?.last_page ?? 1)} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">{t('common:btn.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
