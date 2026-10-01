'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import ProfitVsCash from '@/components/accounting/ProfitVsCash';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { TrendingUp, TrendingDown, Package, Banknote, Building2, Smartphone, Users, ShoppingCart } from 'lucide-react';
import { accountName } from '@/lib/accountNames';
import { localDateStr } from '@/lib/dates';
import { fmtMoney, fmtPct } from '@/lib/format';

type Trans = Record<string, Record<string, string>> | null;
interface BreakdownRow { label: string; amount: number }
interface SummaryRow   { account: { id: number; code: string; name: string; type: string; translations?: Trans } | null; total: number }
interface PaymentRow {
  id: number; name: string; type: string; translations?: Trans;
  opening_balance: number; period_inflow: number; period_outflow: number;
  transfer_in: number; transfer_out: number; balance: number;
}
interface Summary {
  income_total: number; expense_total: number; net_profit: number; livestock_value: number;
  accounts_receivable: number; accounts_payable: number;
  partner_equity: { investments: number; withdrawals: number; net: number };
  breakdown: { income: BreakdownRow[]; expense: BreakdownRow[] };
  by_account: SummaryRow[]; payment_accounts: PaymentRow[];
  date_from: string | null; date_to: string | null;
}

const today        = localDateStr();
const firstOfMonth = localDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const PA_ICON: Record<string, React.ReactNode> = {
  cash: <Banknote size={15} />,
  bank: <Building2 size={15} />,
  mfs:  <Smartphone size={15} />,
};

const fmt = (n: number) => fmtMoney(Math.abs(n));

export default function AccountingSummaryPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo]     = useState(today);

  const { data, isLoading, isError } = useQuery<Summary>({
    queryKey: ['accounting-summary', dateFrom, dateTo],
    queryFn: async () =>
      (await api.get('/accounting/summary', { params: { date_from: dateFrom, date_to: dateTo } })).data,
  });

  const payAccounts  = data?.payment_accounts ?? [];
  const incomeBreak  = data?.breakdown?.income  ?? [];
  const expenseBreak = data?.breakdown?.expense ?? [];
  const incomeRows   = (data?.by_account ?? []).filter(r => r.account?.type === 'income');
  const expenseRows  = (data?.by_account ?? []).filter(r => r.account?.type === 'expense');


  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
        {t('summary.error')}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('common:from')}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('common:to')}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t('summary.kpi.total_income')}    value={data?.income_total   ?? 0} icon={<TrendingUp size={20} />}   color="green"                                 loading={isLoading} />
        <KpiCard label={t('summary.kpi.total_expense')}   value={data?.expense_total  ?? 0} icon={<TrendingDown size={20} />}  color="red"                                   loading={isLoading} />
        <KpiCard label={t('summary.total_cash_title')} value={payAccounts.reduce((s, a) => s + (a.balance ?? 0), 0)} icon={<Banknote size={20} />} color="teal" loading={isLoading} note={t('summary.total_cash_note')} />
        <KpiCard label={t('summary.kpi.livestock_value')} value={data?.livestock_value ?? 0} icon={<Package size={20} />}      color="slate"                                  loading={isLoading} note={t('summary.kpi.livestock_note')} />
      </div>

      {/* Profit versus cash — the same profit as the profit & loss report */}
      <ProfitVsCash loading={isLoading} profit={data?.net_profit ?? 0}
        cashIn={(data?.payment_accounts ?? []).reduce((s, a) => s + (a.period_inflow ?? 0), 0)}
        cashOut={(data?.payment_accounts ?? []).reduce((s, a) => s + (a.period_outflow ?? 0), 0)} />

      {/* AR / AP overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/customers" className="block group">
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 hover:border-orange-300 hover:bg-orange-100 transition-colors">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-orange-500" />
                <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">{t('summary.ar_title')}</span>
              </div>
              <span className="text-xs text-orange-400 group-hover:underline">{t('summary.ar_details')}</span>
            </div>
            {isLoading
              ? <div className="h-8 w-36 bg-orange-200 rounded animate-pulse" />
              : <p className="text-2xl font-bold text-orange-700">
                  {fmtMoney(data?.accounts_receivable ?? 0)}
                </p>
            }
            <p className="text-xs text-orange-500 mt-1">{t('summary.ar_description')}</p>
          </div>
        </Link>

        <Link href="/suppliers" className="block group">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 hover:border-blue-300 hover:bg-blue-100 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{t('summary.ap_title')}</span>
              </div>
              <span className="text-xs text-blue-400 group-hover:underline">{t('summary.ap_details')}</span>
            </div>
            {isLoading
              ? <div className="h-8 w-36 bg-blue-200 rounded animate-pulse" />
              : <p className="text-2xl font-bold text-blue-700">
                  {fmtMoney(data?.accounts_payable ?? 0)}
                </p>
            }
            <p className="text-xs text-blue-500 mt-1">{t('summary.ap_description')}</p>
          </div>
        </Link>
      </div>

      {/* Partner equity movements */}
      {!isLoading && data?.partner_equity && (data.partner_equity.investments > 0 || data.partner_equity.withdrawals > 0) && (
        <div className="@container rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-purple-500" />
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">{t('summary.partner_equity_title')}</span>
          </div>
          <div className="grid grid-cols-1 @sm:grid-cols-3 gap-3 text-center [&>*]:min-w-0">
            <div>
              <p className="text-xs text-purple-500 mb-1">{t('summary.partner_equity.investments')}</p>
              <p className="font-bold text-purple-800">{fmtMoney(data.partner_equity.investments)}</p>
            </div>
            <div>
              <p className="text-xs text-purple-500 mb-1">{t('summary.partner_equity.withdrawals')}</p>
              <p className="font-bold text-red-700">{fmtMoney(data.partner_equity.withdrawals)}</p>
            </div>
            <div>
              <p className="text-xs text-purple-500 mb-1">{t('summary.partner_equity.net')}</p>
              <p className={`font-bold ${data.partner_equity.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmtMoney(Math.abs(data.partner_equity.net))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment account balances */}
      {(payAccounts.length > 0 || isLoading) && (
        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">
            {t('summary.cash_bank.title')} <span className="font-normal text-slate-400">{t('summary.cash_bank.all_time')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                    <div className="h-3 bg-slate-100 rounded w-24 mb-3" /><div className="h-7 bg-slate-100 rounded w-32" />
                  </div>
                ))
              : payAccounts.map(pa => (
                  <div key={pa.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                      {PA_ICON[pa.type]}
                      <span className="font-medium">{t(`payment_accounts.types.${pa.type}`, { ns: 'finance', defaultValue: pa.type })}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-2 truncate">{pa.name}</p>
                    <p className={`text-2xl font-bold ${pa.balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {pa.balance < 0 && '−'}{fmt(pa.balance)}
                    </p>
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-400">{t('summary.cash_bank.period_in')}</p>
                        <p className="font-semibold text-green-600">+{fmt(pa.period_inflow)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">{t('summary.cash_bank.period_out')}</p>
                        <p className="font-semibold text-red-500">−{fmt(pa.period_outflow)}</p>
                      </div>
                      {(pa.transfer_in > 0 || pa.transfer_out > 0) && (
                        <>
                          <div>
                            <p className="text-slate-400">{t('summary.cash_bank.transfer_in')}</p>
                            <p className="font-medium text-slate-600">{fmt(pa.transfer_in)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">{t('summary.cash_bank.transfer_out')}</p>
                            <p className="font-medium text-slate-600">{fmt(pa.transfer_out)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
            }
          </div>
        </section>
      )}

      {/* Income / Expense breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 [&>*]:min-w-0">

        {/* Income breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-green-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-green-700">{t('summary.income_breakdown')}</span>
            {!isLoading && <span className="text-sm font-bold text-green-700">{fmt(data?.income_total ?? 0)}</span>}
          </div>
          <div className="p-4 space-y-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonBar key={i} />)
              : incomeBreak.length === 0
                ? <p className="text-xs text-slate-400 text-center py-4">{t('summary.no_income')}</p>
                : incomeBreak.map(r => (
                    <BreakdownBar key={r.label} label={r.label} amount={r.amount}
                      total={data!.income_total} color="green" />
                  ))
            }
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-red-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-700">{t('summary.expense_breakdown')}</span>
            {!isLoading && <span className="text-sm font-bold text-red-700">{fmt(data?.expense_total ?? 0)}</span>}
          </div>
          <div className="p-4 space-y-3">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonBar key={i} />)
              : expenseBreak.length === 0
                ? <p className="text-xs text-slate-400 text-center py-4">{t('summary.no_expenses')}</p>
                : expenseBreak.map(r => (
                    <BreakdownBar key={r.label} label={r.label} amount={r.amount}
                      total={data!.expense_total} color="red" />
                  ))
            }
          </div>
        </div>
      </div>

      {/* Journal entry accounts (secondary detail) */}
      {(incomeRows.length > 0 || expenseRows.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">{t('summary.journal_accounts')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 [&>*]:min-w-0">
            <AccountTable title={t('summary.income_accounts')}  rows={incomeRows}  color="green" loading={isLoading} />
            <AccountTable title={t('summary.expense_accounts')} rows={expenseRows} color="red"   loading={isLoading} />
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color, loading, note, signed }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; loading: boolean; note?: string; signed?: boolean;
}) {
  const colors: Record<string, string> = {
    green:  'bg-green-50  text-green-600  border-green-100',
    red:    'bg-red-50    text-red-600    border-red-100',
    blue:   'bg-blue-50   text-blue-600   border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    slate:  'bg-slate-50  text-slate-600  border-slate-200',
    teal:   'bg-teal-50   text-teal-600   border-teal-100',
  };
  return (
    <div className={`@container min-w-0 rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium opacity-70 min-w-0">{label}</span>
        {icon}
      </div>
      {loading
        ? <div className="h-7 w-full max-w-32 bg-current opacity-10 rounded animate-pulse" />
        : <p className="amount-fit font-bold">
            {signed && value < 0 ? '−' : ''}{fmtMoney(Math.abs(value))}
          </p>
      }
      {note && <p className="text-xs mt-1 opacity-60">{note}</p>}
    </div>
  );
}

function BreakdownBar({ label, amount, total, color }: {
  label: string; amount: number; total: number; color: 'green' | 'red';
}) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  const bar = color === 'green' ? 'bg-green-400' : 'bg-red-400';
  const txt = color === 'green' ? 'text-green-700' : 'text-red-700';
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className={`font-semibold ${txt}`}>{fmtMoney(amount)} <span className="text-slate-400 font-normal">({fmtPct(pct, 0)})</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="animate-pulse space-y-1.5">
      <div className="flex justify-between">
        <div className="h-3 bg-slate-100 rounded w-28" />
        <div className="h-3 bg-slate-100 rounded w-20" />
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full" />
    </div>
  );
}

function AccountTable({ title, rows, color, loading }: {
  title: string; rows: SummaryRow[]; color: string; loading: boolean;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const hdr = color === 'green' ? 'text-green-700 border-green-100' : 'text-red-700 border-red-100';
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-3 border-b ${hdr} font-semibold text-sm`}>{title}</div>
      <div className="overflow-x-auto">
      <div className="min-w-[320px]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-start px-4 py-2 font-medium text-slate-500 text-xs">{t('accounts.col.code')}</th>
            <th className="text-start px-4 py-2 font-medium text-slate-500 text-xs">{t('trial_balance.col.account')}</th>
            <th className="text-end px-4 py-2 font-medium text-slate-500 text-xs">{t('trial_balance.col.amount')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 3 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            : rows.length === 0
              ? <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 text-xs">{t('summary.no_entries')}</td></tr>
              : rows.map(r => (
                  <tr key={r.account?.id ?? r.total} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{r.account?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-800">{r.account ? accountName(r.account, t) : t('summary.deleted_account')}</td>
                    <td className="px-4 py-3 text-end font-medium text-slate-800">
                      {fmtMoney(r.total)}
                    </td>
                  </tr>
                ))
          }
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={2} className="px-4 py-3 font-semibold text-xs text-slate-600">{t('common:total')}</td>
              <td className="px-4 py-3 text-end font-bold text-slate-800">
                {fmtMoney(rows.reduce((s, r) => s + r.total, 0))}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      </div>
      </div>
    </div>
  );
}
