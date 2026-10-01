'use client';

import { useTranslation } from 'react-i18next';
import { fmtMoney } from '@/lib/format';

/**
 * The two answers a farmer asks of a period, side by side and never mixed:
 * did the farm make money (profit & loss — what was earned less what was used
 * up), and how much cash actually came in and went out of the accounts.
 */
export default function ProfitVsCash({ profit, cashIn, cashOut, loading }: { profit: number; cashIn: number; cashOut: number; loading?: boolean }) {
  const { t } = useTranslation('finance');
  const net = cashIn - cashOut;
  const tone = (v: number) => (v >= 0 ? 'text-green-700' : 'text-red-600');
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`;

  const box = (title: string, value: string, color: string, note: string, extra?: string) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      {loading ? <div className="h-7 w-32 bg-slate-100 rounded animate-pulse mt-1" /> : <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>}
      {extra && !loading && <p className="text-xs text-slate-500 mt-0.5">{extra}</p>}
      <p className="text-xs text-slate-400 mt-1">{note}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {box(t('summary.profit_vs_cash.profit'), signed(profit), tone(profit), t('summary.profit_vs_cash.profit_note'))}
      {box(t('summary.profit_vs_cash.cash'), signed(net), tone(net), t('summary.profit_vs_cash.cash_note'),
        t('summary.profit_vs_cash.cash_split', { in: fmtMoney(cashIn), out: fmtMoney(cashOut) }))}
    </div>
  );
}
