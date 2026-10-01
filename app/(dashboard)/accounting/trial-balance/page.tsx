'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { TrendingUp, TrendingDown, Scale, Package, Users, Wrench } from 'lucide-react';
import { accountName } from '@/lib/accountNames';
import { localDateStr } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';

interface TrialRow  { code: string; name: string; amount: number; translations?: Record<string, Record<string, string>> | null }
interface EquityRow { name: string; amount: number; side: 'credit' | 'debit' }
interface AssetRow  { name: string; category: string; book_value: number }
interface TrialBalance {
  income_rows: TrialRow[]; expense_rows: TrialRow[]; equity_rows: EquityRow[];
  asset_rows: AssetRow[]; total_fixed_assets: number;
  total_income: number; total_expense: number; net_profit: number; livestock_value: number;
  date_from: string | null; date_to: string | null;
}

const today       = localDateStr();
const firstOfYear = `${new Date().getFullYear()}-01-01`;

const fmt = (n: number) => fmtMoney(n);

export default function TrialBalancePage() {
  const { t } = useTranslation(['finance', 'common']);
  const [dateFrom, setDateFrom] = useState(firstOfYear);
  const [dateTo, setDateTo]     = useState(today);

  const { data, isLoading, isError } = useQuery<TrialBalance>({
    queryKey: ['accounting-trial-balance', dateFrom, dateTo],
    queryFn: async () =>
      (await api.get('/accounting/trial-balance', { params: { date_from: dateFrom, date_to: dateTo } })).data,
  });

  const incomeRows  = data?.income_rows  ?? [];
  const expenseRows = data?.expense_rows ?? [];
  const equityRows  = data?.equity_rows  ?? [];
  const assetRows   = data?.asset_rows   ?? [];

  // Pad the shorter list so both columns have the same row count
  const maxRows = Math.max(incomeRows.length, expenseRows.length);
  const netPositive = (data?.net_profit ?? 0) >= 0;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
        {t('finance:trial_balance_ext.load_error')}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('common:from')}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('common:to')}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* KPI strip */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="@container min-w-0 bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs text-green-600 font-medium mb-1">{t('trial_balance.total_income')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-green-700">{fmt(data.total_income)}</p>
          </div>
          <div className="@container min-w-0 bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs text-red-600 font-medium mb-1">{t('trial_balance.total_expense')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-red-700">{fmt(data.total_expense)}</p>
          </div>
          <div className={`@container min-w-0 border rounded-xl p-4 ${netPositive ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
            <p className={`text-xs font-medium mb-1 ${netPositive ? 'text-blue-600' : 'text-orange-600'}`}>
              {netPositive ? t('trial_balance.net_profit') : t('trial_balance.net_loss')}
            </p>
            <p className={`amount-fit [--amount-max:1.25rem] font-bold ${netPositive ? 'text-blue-700' : 'text-orange-700'}`}>
              {fmt(Math.abs(data.net_profit))}
            </p>
          </div>
          <div className="@container min-w-0 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
              <Package size={11} /> {t('trial_balance.livestock_value')}
            </p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-700">{fmt(data.livestock_value)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t('trial_balance.livestock_note')}</p>
          </div>
        </div>
      )}

      {/* Two-column trial balance table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Scale size={18} className="text-slate-500" />
          <div>
            <h2 className="font-semibold text-slate-800">{t('trial_balance.title')}</h2>
            {dateFrom && dateTo && (
              <p className="text-xs text-slate-400 mt-0.5">{t('finance:trial_balance_ext.period_label')} {dateFrom} {t('common:to')} {dateTo}</p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-0">
        <div className="min-w-[600px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* Income side */}
              <th className="text-start px-4 py-3 font-medium text-green-700 border-e border-slate-200 w-1/2" colSpan={2}>
                <span className="flex items-center gap-1.5"><TrendingUp size={14} /> {t('trial_balance.col.income')}</span>
              </th>
              {/* Expense side */}
              <th className="text-start px-4 py-3 font-medium text-red-700 w-1/2" colSpan={2}>
                <span className="flex items-center gap-1.5"><TrendingDown size={14} /> {t('trial_balance.col.expenses')}</span>
              </th>
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="text-start px-4 py-2 font-medium">{t('trial_balance.col.category')}</th>
              <th className="text-end px-4 py-2 font-medium border-e border-slate-200">{t('trial_balance.col.amount')}</th>
              <th className="text-start px-4 py-2 font-medium">{t('trial_balance.col.category')}</th>
              <th className="text-end px-4 py-2 font-medium">{t('trial_balance.col.amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-32" /></td>
                    <td className="px-4 py-3 border-e border-slate-100"><div className="h-4 bg-slate-100 rounded animate-pulse w-20 ms-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-32" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-20 ms-auto" /></td>
                  </tr>
                ))
              : maxRows === 0
                ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">
                      {t('trial_balance.no_transactions')}
                    </td>
                  </tr>
                )
                : Array.from({ length: maxRows }).map((_, i) => {
                    const inc = incomeRows[i];
                    const exp = expenseRows[i];
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        {/* Income cell */}
                        <td className="px-4 py-3 text-slate-700">
                          {inc ? (
                            <span className="flex items-center gap-1.5">
                              {inc.code !== '—' && <span className="font-mono text-xs text-slate-400">{inc.code}</span>}
                              {accountName(inc, t)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-end font-medium text-green-700 border-e border-slate-100">
                          {inc ? fmt(inc.amount) : null}
                        </td>
                        {/* Expense cell */}
                        <td className="px-4 py-3 text-slate-700">
                          {exp ? (
                            <span className="flex items-center gap-1.5">
                              {exp.code !== '—' && <span className="font-mono text-xs text-slate-400">{exp.code}</span>}
                              {accountName(exp, t)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-end font-medium text-red-700">
                          {exp ? fmt(exp.amount) : null}
                        </td>
                      </tr>
                    );
                  })
            }
          </tbody>

          {!isLoading && maxRows > 0 && (
            <tfoot>
              {/* Totals */}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-4 py-3 text-slate-700">{t('trial_balance.total_income')}</td>
                <td className="px-4 py-3 text-end text-green-700 border-e border-slate-200">
                  {fmt(data?.total_income ?? 0)}
                </td>
                <td className="px-4 py-3 text-slate-700">{t('trial_balance.total_expense')}</td>
                <td className="px-4 py-3 text-end text-red-700">
                  {fmt(data?.total_expense ?? 0)}
                </td>
              </tr>

              {/* Net profit / loss */}
              <tr className={`border-t border-slate-200 ${netPositive ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <td colSpan={2} className={`px-4 py-3 font-semibold border-e border-slate-200 ${netPositive ? 'text-blue-700' : 'text-orange-700'}`}>
                  {netPositive ? t('trial_balance.net_profit') : t('trial_balance.net_loss')}
                </td>
                <td colSpan={2} className={`px-4 py-3 text-end font-bold text-lg ${netPositive ? 'text-blue-700' : 'text-orange-700'}`}>
                  {fmt(Math.abs(data?.net_profit ?? 0))}
                </td>
              </tr>

              {/* Livestock stock value note */}
              <tr className="border-t border-slate-100 bg-slate-50 text-slate-500 text-xs">
                <td colSpan={2} className="px-4 py-2.5 border-e border-slate-200">
                  {t('trial_balance.livestock_stock_value')} <span className="text-slate-400">{t('trial_balance.livestock_note_detail')}</span>
                </td>
                <td colSpan={2} className="px-4 py-2.5 text-end font-semibold text-slate-600">
                  {fmt(data?.livestock_value ?? 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
        </div>
      </div>

      {/* Partner Equity section */}
      {!isLoading && equityRows.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-100 flex items-center gap-2 bg-purple-50">
            <Users size={18} className="text-purple-500" />
            <div>
              <h2 className="font-semibold text-purple-800">{t('finance:trial_balance_ext.partner_equity_title')}</h2>
              <p className="text-xs text-purple-400 mt-0.5">{t('finance:trial_balance_ext.partner_equity_subtitle')}</p>
            </div>
          </div>
          <div className="overflow-x-auto -mx-0">
          <div className="min-w-[400px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-purple-50 border-b border-purple-100 text-xs text-purple-600">
                <th className="text-start px-4 py-2 font-medium">{t('finance:trial_balance_ext.col_description')}</th>
                <th className="text-end px-4 py-2 font-medium">{t('finance:trial_balance_ext.col_amount')}</th>
                <th className="text-start px-4 py-2 font-medium">{t('finance:trial_balance_ext.col_type')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {equityRows.map((row, i) => (
                <tr key={i} className="hover:bg-purple-50">
                  <td className="px-4 py-3 text-slate-700">{row.name}</td>
                  <td className={`px-4 py-3 text-end font-medium ${row.side === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.side === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {row.side === 'credit' ? t('finance:trial_balance_ext.equity_in') : t('finance:trial_balance_ext.equity_out')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </div>
        </div>
      )}

      {/* Fixed Assets section */}
      {!isLoading && assetRows.length > 0 && (
        <div className="bg-white rounded-xl border border-teal-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-teal-100 flex items-center justify-between bg-teal-50">
            <div className="flex items-center gap-2">
              <Wrench size={18} className="text-teal-500" />
              <div>
                <h2 className="font-semibold text-teal-800">{t('finance:trial_balance_ext.fixed_assets_title')}</h2>
                <p className="text-xs text-teal-400 mt-0.5">{t('finance:trial_balance_ext.fixed_assets_subtitle')}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-teal-700">{fmt(data?.total_fixed_assets ?? 0)}</span>
          </div>
          <div className="overflow-x-auto -mx-0">
          <div className="min-w-[400px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-50 border-b border-teal-100 text-xs text-teal-600">
                <th className="text-start px-4 py-2 font-medium">{t('finance:trial_balance_ext.col_asset_name')}</th>
                <th className="text-start px-4 py-2 font-medium">{t('finance:trial_balance_ext.col_category')}</th>
                <th className="text-end px-4 py-2 font-medium">{t('finance:trial_balance_ext.col_book_value')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50">
              {assetRows.map((row, i) => (
                <tr key={i} className="hover:bg-teal-50">
                  <td className="px-4 py-3 text-slate-700 font-medium">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium capitalize">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-semibold text-teal-700">{fmt(row.book_value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-teal-200 bg-teal-50 font-bold">
                <td colSpan={2} className="px-4 py-3 text-teal-800">{t('finance:trial_balance_ext.total_fixed_assets')}</td>
                <td className="px-4 py-3 text-end text-teal-700">{fmt(data?.total_fixed_assets ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
