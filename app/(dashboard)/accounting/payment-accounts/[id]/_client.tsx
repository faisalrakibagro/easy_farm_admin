'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Link from '@/components/ui/AppLink';
import api from '@/lib/api';
import {
  ArrowLeft,
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { AccountingPaymentAccount } from '@/types';
import { useRouteId } from '@/lib/hooks';
import { PAYMENT_ACCOUNT_TYPE, PaymentAccountTypeLabel } from '@/components/accounting/PaymentAccountType';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import LoadError from '@/components/ui/LoadError';

interface LedgerRow {
  date: string;
  voucher_type: string;
  description: string;
  account: string;
  payment_via: string | null;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerData {
  data: LedgerRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  totals: { debit: number; credit: number; balance: number };
}

const VOUCHER_COLORS: Record<string, string> = {
  cattle_sale:       'bg-emerald-100 text-emerald-700',
  investment:        'bg-blue-100 text-blue-700',
  receipt:           'bg-teal-100 text-teal-700',
  expense:           'bg-red-100 text-red-700',
  feed_purchase:     'bg-orange-100 text-orange-700',
  medicine_purchase: 'bg-pink-100 text-pink-700',
  daily_labour:      'bg-yellow-100 text-yellow-700',
  supplier_payment:  'bg-rose-100 text-rose-700',
  withdrawal:        'bg-purple-100 text-purple-700',
  profit_share:      'bg-indigo-100 text-indigo-700',
  contra:            'bg-slate-100 text-slate-600',
  payment:           'bg-red-100 text-red-700',
  adjustment:        'bg-amber-100 text-amber-700',
  cattle_purchase:   'bg-orange-100 text-orange-700',
};

function fmt(n: number) {
  return fmtMoney(Math.abs(n));
}

export default function PaymentAccountLedgerPage() {
  const { t } = useTranslation(['finance', 'common']);
  const accountId = useRouteId();

  const [page, setPage]         = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  // Fetch the account details
  const { data: accountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });
  const account = accountsData?.payment_accounts.find(a => String(a.id) === accountId);

  // Fetch ledger for this account
  const { data: ledger, isLoading, isError, isFetching, refetch } = useQuery<LedgerData>({
    queryKey: ['payment-account-ledger', accountId, page, dateFrom, dateTo],
    queryFn: async () =>
      (await api.get('/accounting/general-ledger', {
        params: {
          payment_account_id: accountId,
          per_page: 25,
          page,
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo   && { date_to:   dateTo   }),
        },
      })).data,
    enabled: !!accountId && accountId !== '0',
  });

  function clearFilters() { setDateFrom(''); setDateTo(''); setPage(1); }

  const bal = account?.balance ?? 0;
  const meta = account ? PAYMENT_ACCOUNT_TYPE[account.type] : null;

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/accounting/payment-accounts"
          aria-label={t('ui.back')}
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft size={18} className="rtl:-scale-x-100" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {meta && (
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${meta.color}`}>
                <PaymentAccountTypeLabel type={account!.type} />
              </span>
            )}
            <h1 className="text-lg font-semibold text-slate-800 truncate">
              {account?.name ?? t('payment_accounts.ledger_title')}
            </h1>
            {account?.is_default && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {t('payment_accounts.default')}
              </span>
            )}
          </div>
          {account?.type === 'bank' && account.bank_name && (
            <p className="text-xs text-slate-500 mt-0.5 ms-0.5">
              {account.bank_name}{account.account_number ? ` · ${account.account_number}` : ''}
            </p>
          )}
          {account?.type === 'mfs' && account.mfs_provider && (
            <p className="text-xs text-slate-500 mt-0.5 ms-0.5">
              {account.mfs_provider}{account.account_number ? ` · ${account.account_number}` : ''}
            </p>
          )}
        </div>
        {account && (
          <div className="basis-full sm:basis-auto text-start sm:text-end flex-shrink-0">
            <p className="text-xs text-slate-400">{t('payment_accounts.current_balance')}</p>
            <p className={`text-xl font-bold ${bal >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
              {fmt(bal)}
              {bal < 0 && <span className="text-xs font-normal ms-1 text-red-500">{t('payment_accounts.deficit')}</span>}
            </p>
            <p className="text-xs text-slate-400">
              {t('payment_accounts.opening')} {fmtMoney(parseFloat(account.opening_balance))}
            </p>
          </div>
        )}
      </div>

      {/* Summary totals */}
      {ledger && !isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">{t('payment_accounts.ledger_total_in')}</p>
            <p className="text-xl font-bold text-emerald-600">{fmt(ledger.totals.credit)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">{t('payment_accounts.ledger_total_out')}</p>
            <p className="text-xl font-bold text-red-500">{fmt(ledger.totals.debit)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">{t('payment_accounts.ledger_net')}</p>
            <p className={`text-xl font-bold ${ledger.totals.balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
              {fmt(ledger.totals.balance)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('common:from')}</label>
            <input
              type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('common:to')}</label>
            <input
              type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg"
            >
              {t('entries.btn.clear_filters')}
            </button>
          )}
        </div>
      </div>

      {/* Ledger table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : isError && !ledger ? (
          <LoadError onRetry={() => refetch()} retrying={isFetching} />
        ) : !ledger || ledger.data.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {t('payment_accounts.ledger_empty')}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-slate-100">
              {ledger.data.map((row, idx) => {
                const voucherColor = VOUCHER_COLORS[row.voucher_type] ?? 'bg-slate-100 text-slate-600';
                return (
                  <div key={idx} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-800 leading-tight">{row.description}</p>
                        {row.account && (
                          <p className="text-xs text-slate-400 mt-0.5">{row.account}</p>
                        )}
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${voucherColor}`}>
                        {row.credit > 0
                          ? <ArrowDownLeft size={10} />
                          : <ArrowUpRight size={10} />}
                        {t(`entries.voucher_types.${row.voucher_type}`, { defaultValue: row.voucher_type })}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                      <div className="text-slate-500">{t('entries.col.date')}</div>
                      <div className="font-medium text-end text-slate-600">{fmtDate(row.date, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      {row.debit > 0 && (
                        <>
                          <div className="text-slate-500">{t('entries.col.debit_dr')}</div>
                          <div className="font-medium text-end text-red-500">{fmt(row.debit)}</div>
                        </>
                      )}
                      {row.credit > 0 && (
                        <>
                          <div className="text-slate-500">{t('entries.col.credit_cr')}</div>
                          <div className="font-medium text-end text-emerald-600">{fmt(row.credit)}</div>
                        </>
                      )}
                      <div className="text-slate-500">{t('entries.col.balance')}</div>
                      <div className={`font-semibold text-end ${row.balance >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                        {fmt(row.balance)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Mobile totals footer */}
              <div className="p-4 bg-slate-50 border-t-2 border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2">
                  {t('entries.transactions_count', { count: ledger.total })}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-slate-500">{t('entries.col.debit_dr')}</div>
                  <div className="font-bold text-end text-red-500">{fmt(ledger.totals.debit)}</div>
                  <div className="text-slate-500">{t('entries.col.credit_cr')}</div>
                  <div className="font-bold text-end text-emerald-600">{fmt(ledger.totals.credit)}</div>
                  <div className="text-slate-500">{t('entries.col.balance')}</div>
                  <div className={`font-bold text-end ${ledger.totals.balance >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                    {fmt(ledger.totals.balance)}
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-start text-xs font-medium text-slate-500 w-28">{t('entries.col.date')}</th>
                    <th className="px-5 py-3 text-start text-xs font-medium text-slate-500">{t('entries.col.description_via')}</th>
                    <th className="px-5 py-3 text-start text-xs font-medium text-slate-500 w-36 hidden md:table-cell">{t('entries.col.type')}</th>
                    <th className="px-5 py-3 text-end text-xs font-medium text-red-500 w-32">{t('entries.col.debit_dr')}</th>
                    <th className="px-5 py-3 text-end text-xs font-medium text-emerald-600 w-32">{t('entries.col.credit_cr')}</th>
                    <th className="px-5 py-3 text-end text-xs font-medium text-slate-500 w-32">{t('entries.col.balance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(row.date, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-5 py-3">
                        <p className="text-slate-700 leading-tight">{row.description}</p>
                        {row.account && (
                          <p className="text-xs text-slate-400 mt-0.5">{row.account}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${VOUCHER_COLORS[row.voucher_type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {row.credit > 0
                            ? <ArrowDownLeft size={10} />
                            : <ArrowUpRight size={10} />}
                          {t(`entries.voucher_types.${row.voucher_type}`, { defaultValue: row.voucher_type })}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-end">
                        {row.debit > 0
                          ? <span className="text-red-500 font-medium">{fmt(row.debit)}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-end">
                        {row.credit > 0
                          ? <span className="text-emerald-600 font-medium">{fmt(row.credit)}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-end">
                        <span className={`font-semibold ${row.balance >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                          {fmt(row.balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals footer */}
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-slate-600">
                      {t('entries.transactions_count', { count: ledger.total })}
                    </td>
                    <td className="px-5 py-3 text-end text-sm font-bold text-red-500">
                      {fmt(ledger.totals.debit)}
                    </td>
                    <td className="px-5 py-3 text-end text-sm font-bold text-emerald-600">
                      {fmt(ledger.totals.credit)}
                    </td>
                    <td className="px-5 py-3 text-end text-sm font-bold text-slate-700">
                      {fmt(ledger.totals.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {ledger.total > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  {t('common:pagination.page_of', { current: fmtNum(ledger.current_page), total: fmtNum(ledger.last_page) })} &bull; {t('common:pagination.total_count', { count: fmtNum(ledger.total) })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} /> {t('common:btn.prev')}
                  </button>
                  <button
                    disabled={page >= ledger.last_page}
                    onClick={() => setPage(p => p + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('common:btn.next')} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 px-1">
        <span className="font-medium text-slate-600">{t('entries.legend.title')}</span>
        <span className="flex items-center gap-1"><ArrowUpRight size={12} className="text-red-400" /> {t('entries.legend.debit')}</span>
        <span className="flex items-center gap-1"><ArrowDownLeft size={12} className="text-emerald-500" /> {t('entries.legend.credit')}</span>
        <span>{t('entries.legend.balance')}</span>
      </div>
    </div>
  );
}
