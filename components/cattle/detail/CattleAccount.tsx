'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown } from 'lucide-react';
import api from '@/lib/api';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { localeFor } from '@/lib/languages';

interface Line { type: string; amount: number }
interface Account {
  status: string; origin: string; from: string | null; to: string; days: number | null;
  costs: Line[]; incomes: Line[];
  sale: { date: string; price: number; buyer: string | null } | null;
  totals: {
    cost: number; income: number; net: number; capital: number; running_cost: number; earned: number;
    operating_net: number; cost_per_day: number | null; income_per_day: number | null; recovered_pct: number | null;
  };
  exit: { status: 'dead' | 'transferred'; date: string | null; full_loss: number } | null;
  market_value: number | null; if_sold_today: number | null;
  monthly: { month: string; cost: number; income: number }[];
}

const date = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const month = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(localeFor(), { month: 'short', year: 'numeric' });

/**
 * One animal's whole account from the day it came to the day it left (or
 * today): what it cost — buying it and keeping it — what it brought in, and
 * the gap between them. Month by month too.
 */
export default function CattleAccount({ cattleId }: { cattleId: number }) {
  const { t } = useTranslation('cattle');
  const { data: a, isLoading } = useQuery<Account>({
    queryKey: ['cattle-ledger', cattleId, 'account'],
    queryFn: async () => (await api.get(`/farm/cattle/${cattleId}/account`)).data,
  });

  if (isLoading || !a) return <div className="bg-white rounded-xl border border-slate-200 p-5 h-48 animate-pulse" />;

  const typeName = (type: string) => t(`detail.entry_type.${type}`, { defaultValue: type });
  const signed = (v: number) => (v >= 0 ? 'text-green-700' : 'text-red-600');
  const gapLabel = (v: number) => (v >= 0 ? t('account.profit') : t('account.loss'));

  const lines = (title: string, list: Line[], total: number, bar: string) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-sm font-semibold text-slate-800">{fmtMoney(total)}</span>
      </div>
      {list.length === 0 ? <p className="text-sm text-slate-400">{t('account.none')}</p> : (
        <ul className="space-y-2">
          {list.map(l => (
            <li key={l.type}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600">{typeName(l.type)}</span>
                <span className="font-medium text-slate-800">{fmtMoney(l.amount)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${total > 0 ? Math.max(2, (l.amount / total) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Each month's gap, and the gap so far.
  const months = a.monthly.reduce<{ month: string; cost: number; income: number; gap: number; sofar: number }[]>((acc, m) => {
    const gap = m.income - m.cost;
    return [...acc, { ...m, gap, sofar: (acc.at(-1)?.sofar ?? 0) + gap }];
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        {t('account.period', { from: date(a.from), to: date(a.to) })}{a.days ? ` · ${t('account.days', { n: fmtNum(a.days) })}` : ''}
      </p>

      {/* The three totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('account.total_cost')}</p>
          <p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-800 mt-1">{fmtMoney(a.totals.cost)}</p>
        </div>
        <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t('account.total_income')}</p>
          <p className="amount-fit [--amount-max:1.25rem] font-bold text-blue-700 mt-1">{fmtMoney(a.totals.income)}</p>
        </div>
        <div className={`@container min-w-0 rounded-xl border p-4 ${a.totals.net >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs ${signed(a.totals.net)}`}>{t('account.gap')} · {gapLabel(a.totals.net)}</p>
          <p className={`font-bold mt-1 flex items-center gap-2 ${signed(a.totals.net)}`}>
            {a.totals.net >= 0 ? <TrendingUp size={20} className="shrink-0" /> : <TrendingDown size={20} className="shrink-0" />}
            <span className="amount-fit [--amount-max:1.25rem] min-w-0">{fmtMoney(Math.abs(a.totals.net))}</span>
          </p>
          {a.status === 'active' && a.totals.net < 0 && <p className="text-xs text-slate-500 mt-1">{t('account.gap_hint_active')}</p>}
        </div>
      </div>

      {/* Buying it versus keeping it */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [a.origin === 'farm_born' ? t('account.birth_value') : t('account.capital'), fmtMoney(a.totals.capital), ''],
          [t('account.running_cost'), fmtMoney(a.totals.running_cost), a.totals.cost_per_day !== null ? t('account.per_day', { v: fmtMoney(a.totals.cost_per_day) }) : ''],
          [t('account.earned'), fmtMoney(a.totals.earned), a.totals.income_per_day !== null ? t('account.per_day', { v: fmtMoney(a.totals.income_per_day) }) : ''],
          [t('account.operating_net'), fmtMoney(a.totals.operating_net), gapLabel(a.totals.operating_net)],
        ].map(([label, value, sub], i) => (
          <div key={label} className="@container min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`amount-fit [--amount-max:1rem] font-bold mt-0.5 ${i === 3 ? signed(a.totals.operating_net) : 'text-slate-800'}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400">{sub}</p>}
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-600 space-y-1">
        {a.totals.recovered_pct !== null && <p>{t('account.recovered', { pct: fmtPct(a.totals.recovered_pct, 1) })}</p>}
        {a.status === 'active' && (a.if_sold_today !== null
          ? <p>{t('account.if_sold_today', { market: fmtMoney(a.market_value), result: `${gapLabel(a.if_sold_today)} ${fmtMoney(Math.abs(a.if_sold_today))}` })}</p>
          : <p className="text-slate-400">{t('account.no_market_value')}</p>)}
        {a.exit && <p className="text-red-700">{t(`account.exit_${a.exit.status}`, { date: date(a.exit.date), loss: fmtMoney(a.exit.full_loss) })}</p>}
        {a.sale && <p>{t('account.sold_on', { date: date(a.sale.date), price: fmtMoney(a.sale.price), buyer: a.sale.buyer ?? '—' })}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {lines(t('account.costs'), a.costs, a.totals.cost, 'bg-red-300')}
        {lines(t('account.incomes'), a.incomes, a.totals.income, 'bg-green-400')}
      </div>

      {/* Month by month */}
      {a.monthly.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('account.monthly')}</h3>
          {/* Phones: one line per month */}
          <ul className="sm:hidden divide-y divide-slate-100">
            {months.map(m => (
              <li key={m.month} className="py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-slate-700">{month(m.month)}</span>
                  <span className={`text-end font-medium ${signed(m.sofar)}`}>
                    <span className="text-xs font-normal text-slate-400">{t('account.running_gap')} </span>{fmtMoney(m.sofar)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {t('account.cost')} {fmtMoney(m.cost)} · {t('account.income')} {fmtMoney(m.income)} · {t('account.month_gap')} <span className={signed(m.gap)}>{fmtMoney(m.gap)}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[460px]">
              <thead><tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="py-2 font-medium text-start">{t('account.month')}</th>
                <th className="py-2 font-medium text-end">{t('account.cost')}</th>
                <th className="py-2 font-medium text-end">{t('account.income')}</th>
                <th className="py-2 font-medium text-end">{t('account.month_gap')}</th>
                <th className="py-2 font-medium text-end">{t('account.running_gap')}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {months.map(m => (
                  <tr key={m.month}>
                    <td className="py-2 text-slate-700">{month(m.month)}</td>
                    <td className="py-2 text-end text-slate-600">{fmtMoney(m.cost)}</td>
                    <td className="py-2 text-end text-slate-600">{fmtMoney(m.income)}</td>
                    <td className={`py-2 text-end ${signed(m.gap)}`}>{fmtMoney(m.gap)}</td>
                    <td className={`py-2 text-end font-medium ${signed(m.sofar)}`}>{fmtMoney(m.sofar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
