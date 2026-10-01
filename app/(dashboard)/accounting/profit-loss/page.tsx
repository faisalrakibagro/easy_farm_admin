'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, Wheat, Syringe, Users, Wrench, HeartCrack, Trash2 } from 'lucide-react';
import { accountName } from '@/lib/accountNames';
import { localDateStr } from '@/lib/dates';
import { fmtMoney, fmtPct, fmtDate } from '@/lib/format';

const today        = localDateStr();
const firstOfYear  = localDateStr(new Date(new Date().getFullYear(), 0, 1));

const fmt  = (n: number) => fmtMoney(Math.abs(n));
const sign = (n: number) => (n >= 0 ? '\u200E+' : '\u200E−') + fmt(n);

interface AccountRow { code: string; name: string; amount: number }
interface CatRow     { category: string; amount: number }
interface LossRow    { cattle_id: number; tag_number: string; status: 'dead' | 'transferred'; date: string | null; price: number; keeping: number; full_loss: number; counted: number }
interface PL {
  date_from: string | null;
  date_to:   string | null;
  revenue: {
    cattle_sales:   number;
    journal_income: number;
    asset_disposal_gain: number;
    by_account:     AccountRow[];
    total:          number;
  };
  cogs: {
    cattle_purchases: number;
    cattle_losses:    number;
    feed_purchases:   number;
    feed_wastage:     number;
    medicine:         number;
    medicine_wastage: number;
    total:            number;
  };
  cattle_losses: LossRow[];
  gross_profit: number;
  operating_expenses: {
    labour:               number;
    salary_payments:      number;
    general_expenses:     number;
    treatment:            number;
    journal_expenses:     number;
    asset_disposal_loss:  number;
    by_account:           AccountRow[];
    by_category:          CatRow[];
    total:                number;
  };
  operating_profit: number;
  partner_movements: {
    investments: number;
    withdrawals: number;
    net:         number;
  };
  net_profit: number;
}

export default function ProfitLossPage() {
  const { t }      = useTranslation(['finance', 'common']);
  const [dateFrom, setDateFrom] = useState(firstOfYear);
  const [dateTo,   setDateTo]   = useState(today);

  const { data, isLoading, isError } = useQuery<PL>({
    queryKey: ['profit-loss', dateFrom, dateTo],
    queryFn:  async () =>
      (await api.get('/accounting/profit-loss', { params: { date_from: dateFrom, date_to: dateTo } })).data,
  });

  const netColor = (n: number) => n >= 0 ? 'text-green-700' : 'text-red-600';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('pl.title', 'Profit & Loss Statement')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('pl.subtitle', 'Income Statement — ERP Level Report')}</p>
        </div>
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
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
          {t('common:error.failed_load')}
        </div>
      )}

      {/* P&L Statement */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* ── Revenue ─────────────────────────────────────────────────────── */}
        <SectionHeader title={t('pl.revenue', 'Revenue')} color="green" icon={<TrendingUp size={16} />} />
        <div className="px-6 py-2 divide-y divide-slate-50">
          <PLRow label={t('pl.cattle_sales', 'Cattle Sales')}        value={data?.revenue.cattle_sales ?? 0}   loading={isLoading} icon={<ShoppingCart size={14} />} />
          <PLRow label={t('pl.other_income', 'Other Income (Journal)')} value={data?.revenue.journal_income ?? 0} loading={isLoading} icon={<DollarSign size={14} />} />
          {(data?.revenue.by_account ?? []).map(r => (
            <PLRow key={r.code} label={`  ${r.code} — ${accountName(r, t)}`} value={r.amount} loading={isLoading} sub />
          ))}
          {(data?.revenue.asset_disposal_gain ?? 0) > 0 && (
            <PLRow label={t('pl.asset_disposal_gain')} value={data?.revenue.asset_disposal_gain ?? 0} loading={isLoading} icon={<DollarSign size={14} />} />
          )}
        </div>
        <TotalRow label={t('pl.total_revenue', 'Total Revenue')} value={data?.revenue.total ?? 0} loading={isLoading} color="green" />

        {/* ── COGS ─────────────────────────────────────────────────────────── */}
        <SectionHeader title={t('pl.cogs', 'Cost of Goods Sold (COGS)')} color="orange" icon={<Package size={16} />} />
        <div className="px-6 py-2 divide-y divide-slate-50">
          <PLRow label={t('pl.cattle_purchases')} value={data?.cogs.cattle_purchases ?? 0} loading={isLoading} icon={<Package size={14} />} minus />
          <PLRow label={t('pl.cattle_losses')}    value={data?.cogs.cattle_losses ?? 0}    loading={isLoading} icon={<HeartCrack size={14} />} minus />
          {(data?.cattle_losses ?? []).map(l => (
            <p key={l.cattle_id} className="ps-7 py-1.5 text-xs text-slate-500">
              {t(`pl.loss_line_${l.status}`, {
                tag: l.tag_number, date: l.date ? fmtDate(l.date) : '—', full: fmtMoney(l.full_loss), price: fmtMoney(l.price), keeping: fmtMoney(l.keeping),
              })}
            </p>
          ))}
          <PLRow label={t('pl.feed_purchases')}   value={data?.cogs.feed_purchases ?? 0}   loading={isLoading} icon={<Wheat size={14} />}   minus />
          <PLRow label={t('pl.feed_wastage')}     value={data?.cogs.feed_wastage ?? 0}     loading={isLoading} icon={<Trash2 size={14} />}  minus />
          <PLRow label={t('pl.medicine')}         value={data?.cogs.medicine ?? 0}         loading={isLoading} icon={<Syringe size={14} />} minus />
          <PLRow label={t('pl.medicine_wastage')} value={data?.cogs.medicine_wastage ?? 0} loading={isLoading} icon={<Trash2 size={14} />}  minus />
        </div>
        <TotalRow label={t('pl.total_cogs', 'Total COGS')} value={data?.cogs.total ?? 0} loading={isLoading} color="orange" minus />

        {/* Gross Profit */}
        <div className="px-6 py-4 bg-blue-50 border-y border-blue-100 flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
          <span className="font-bold text-blue-800 text-sm">{t('pl.gross_profit', 'Gross Profit')}</span>
          {isLoading
            ? <div className="h-6 w-28 bg-blue-100 rounded animate-pulse" />
            : <span className={`font-bold text-lg ${netColor(data?.gross_profit ?? 0)}`}>{sign(data?.gross_profit ?? 0)}</span>
          }
        </div>

        {/* ── Operating Expenses ────────────────────────────────────────────── */}
        <SectionHeader title={t('pl.operating_expenses', 'Operating Expenses')} color="red" icon={<TrendingDown size={16} />} />
        <div className="px-6 py-2 divide-y divide-slate-50">
          <PLRow label={t('pl.labour',              'Daily Labour')}           value={data?.operating_expenses.labour ?? 0}               loading={isLoading} icon={<Users size={14} />}      minus />
          <PLRow label={t('pl.salary_payments',   'Salary Payments')}        value={data?.operating_expenses.salary_payments ?? 0}      loading={isLoading} icon={<Users size={14} />}      minus />
          <PLRow label={t('pl.general_expenses',  'General Expenses')}       value={data?.operating_expenses.general_expenses ?? 0}    loading={isLoading} icon={<Wrench size={14} />}    minus />
          <PLRow label={t('pl.treatment',         'Treatment & Vet')}        value={data?.operating_expenses.treatment ?? 0}            loading={isLoading} icon={<Syringe size={14} />}  minus />
          <PLRow label={t('pl.journal_expenses',  'Journal Expenses')}       value={data?.operating_expenses.journal_expenses ?? 0}    loading={isLoading} icon={<DollarSign size={14} />} minus />
          <PLRow label={t('pl.asset_disposal_loss','Asset Disposal Loss')}   value={data?.operating_expenses.asset_disposal_loss ?? 0} loading={isLoading} icon={<DollarSign size={14} />} minus />
          {(data?.operating_expenses.by_account ?? []).map(r => (
            <PLRow key={r.code} label={`  ${r.code} — ${accountName(r, t)}`} value={r.amount} loading={isLoading} sub minus />
          ))}
        </div>
        <TotalRow label={t('pl.total_opex', 'Total Operating Expenses')} value={data?.operating_expenses.total ?? 0} loading={isLoading} color="red" minus />

        {/* Operating Profit */}
        <div className="px-6 py-4 bg-slate-50 border-y border-slate-200 flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
          <span className="font-bold text-slate-700 text-sm">{t('pl.operating_profit', 'Operating Profit')}</span>
          {isLoading
            ? <div className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
            : <span className={`font-bold text-lg ${netColor(data?.operating_profit ?? 0)}`}>{sign(data?.operating_profit ?? 0)}</span>
          }
        </div>

        {/* ── Partner Movements ─────────────────────────────────────────────── */}
        <SectionHeader title={t('pl.partner_movements', 'Partner Movements')} color="purple" icon={<Users size={16} />} />
        <div className="px-6 py-2 divide-y divide-slate-50">
          <PLRow label={t('pl.partner_investments', 'Partner Investments')} value={data?.partner_movements.investments ?? 0} loading={isLoading} icon={<Users size={14} />} />
          <PLRow label={t('pl.partner_withdrawals', 'Partner Withdrawals')} value={data?.partner_movements.withdrawals ?? 0} loading={isLoading} icon={<Users size={14} />} minus />
        </div>

        {/* Net Profit */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-700 flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
          <span className="font-bold text-white text-base">{t('pl.net_profit', 'NET PROFIT / LOSS')}</span>
          {isLoading
            ? <div className="h-7 w-36 bg-white/20 rounded animate-pulse" />
            : <span className={`font-bold text-2xl ${(data?.net_profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {sign(data?.net_profit ?? 0)}
              </span>
          }
        </div>
      </div>

      {/* Expense breakdown by category */}
      {(data?.operating_expenses.by_category?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-sm text-slate-700">{t('pl.expense_by_category', 'Expense Breakdown by Category')}</span>
          </div>
          <div className="p-4 space-y-3">
            {(data?.operating_expenses.by_category ?? []).map(r => {
              const pct = data!.operating_expenses.total > 0
                ? Math.round((r.amount / data!.operating_expenses.total) * 100)
                : 0;
              return (
                <div key={r.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium capitalize">{t(`common:expense_category.${r.category}`, { defaultValue: r.category })}</span>
                    <span className="text-red-600 font-semibold">{fmt(r.amount)} <span className="text-slate-400">({fmtPct(pct, 0)})</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, color, icon }: { title: string; color: string; icon: React.ReactNode }) {
  const cls: Record<string, string> = {
    green:  'bg-green-50  text-green-700  border-green-100',
    red:    'bg-red-50    text-red-700    border-red-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  return (
    <div className={`px-6 py-2.5 border-y flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${cls[color]}`}>
      {icon}{title}
    </div>
  );
}

function PLRow({ label, value, loading, icon, minus, sub }: {
  label: string; value: number; loading: boolean;
  icon?: React.ReactNode; minus?: boolean; sub?: boolean;
}) {
  if (value === 0 && !loading) return null;
  return (
    <div className={`flex justify-between items-center py-2.5 ${sub ? 'ps-4' : ''}`}>
      <span className={`flex items-center gap-2 ${sub ? 'text-xs text-slate-500' : 'text-sm text-slate-700'}`}>
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </span>
      {loading
        ? <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
        : <span className={`font-semibold text-sm ${minus ? 'text-red-600' : 'text-green-700'}`}>
            {minus ? '\u200E−' : '\u200E+'}{fmt(value)}
          </span>
      }
    </div>
  );
}

function TotalRow({ label, value, loading, color, minus }: {
  label: string; value: number; loading: boolean; color: string; minus?: boolean;
}) {
  const cls: Record<string, string> = {
    green:  'bg-green-50  border-green-200  text-green-800',
    red:    'bg-red-50    border-red-200    text-red-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
  };
  return (
    <div className={`px-6 py-3 flex justify-between items-center border-y ${cls[color]}`}>
      <span className="font-semibold text-sm">{label}</span>
      {loading
        ? <div className="h-5 w-28 bg-current opacity-10 rounded animate-pulse" />
        : <span className="font-bold text-base">{minus ? '\u200E−' : ''}{fmt(value)}</span>
      }
    </div>
  );
}
