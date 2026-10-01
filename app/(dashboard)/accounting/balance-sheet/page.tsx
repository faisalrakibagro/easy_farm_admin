'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import Link from '@/components/ui/AppLink';
import { Building2, Banknote, Smartphone, Package, AlertCircle, Users, TrendingUp, UserCheck } from 'lucide-react';
import { localDateStr } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';

const today = localDateStr();
const fmt   = (n: number) => fmtMoney(Math.abs(n));

interface AccountRow    { id: number; name: string; type: string; balance: number }
interface SupplierDue   { id: number; name: string; due: number }
interface SupplierPrepaid { id: number; name: string; amount: number }
interface CustomerBal   { id: number; name: string; balance: number }
interface PartnerEq     { id: number; name: string; equity: number }
interface BS {
  as_of: string;
  assets: {
    current: {
      cash_and_bank:          AccountRow[];
      total_cash:             number;
      accounts_receivable:    CustomerBal[];
      total_receivables:      number;
      medicine_inventory:     number;
      feed_inventory:         number;
      supplier_prepaid:       SupplierPrepaid[];
      total_supplier_prepaid: number;
    };
    fixed: {
      livestock_value:  number;
      equipment_list:   { id: number; name: string; category: string; purchase_price: number; book_value: number }[];
      total_equipment:  number;
    };
    total: number;
  };
  liabilities: {
    accounts_payable: SupplierDue[];
    total_payables:   number;
    total:            number;
  };
  equity: {
    partner_equity:       PartnerEq[];
    total_partner_equity: number;
    retained_earnings:    number;
    total:                number;
  };
  balance_check: number;
}

const PA_ICON: Record<string, React.ReactNode> = {
  cash: <Banknote size={14} />,
  bank: <Building2 size={14} />,
  mfs:  <Smartphone size={14} />,
};

export default function BalanceSheetPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [asOf, setAsOf] = useState(today);

  const { data, isLoading, isError } = useQuery<BS>({
    queryKey: ['balance-sheet', asOf],
    queryFn:  async () =>
      (await api.get('/accounting/balance-sheet', { params: { as_of: asOf } })).data,
  });

  const balanced = Math.abs(data?.balance_check ?? 0) < 0.01;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('bs.title', 'Balance Sheet')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('bs.subtitle', 'Assets = Liabilities + Equity')}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('bs.as_of', 'As of Date')}</label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
          {t('common:error.failed_load')}
        </div>
      )}

      {/* Balance indicator */}
      {!isLoading && data && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${balanced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <AlertCircle size={16} />
          {balanced
            ? t('bs.balanced', 'Balance sheet is balanced ✓')
            : t('bs.unbalanced_by', { amount: fmtMoney(Math.abs(data.balance_check)) })
          }
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 [&>*]:min-w-0">

        {/* ── ASSETS ──────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <span className="font-bold text-blue-800 text-sm">{t('bs.assets', 'ASSETS')}</span>
            </div>

            {/* Current Assets */}
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-2">{t('bs.current_assets', 'Current Assets')}</p>
              <div className="space-y-1">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                  : (data?.assets.current.cash_and_bank ?? []).map(pa => (
                      <div key={pa.id} className="flex justify-between items-center py-1.5 text-sm">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className="text-slate-400">{PA_ICON[pa.type]}</span>
                          {pa.name}
                          {pa.balance < 0 && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">{t('common:ui.overdraft')}</span>
                          )}
                        </span>
                        <span className={`font-medium ${pa.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {pa.balance < 0 ? '−' : ''}{fmt(pa.balance)}
                        </span>
                      </div>
                    ))
                }
                {/* Accounts Receivable */}
                {!isLoading && (data?.assets.current.total_receivables ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between items-center pt-2 pb-0.5 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <UserCheck size={12} />
                        {t('bs.accounts_receivable')}
                      </span>
                    </div>
                    {(data?.assets.current.accounts_receivable ?? []).map(c => (
                      <div key={c.id} className="flex justify-between items-center py-1 text-sm ps-4">
                        <Link href={`/customers/${c.id}`} className="text-slate-600 hover:text-blue-600 hover:underline truncate max-w-[180px]">
                          {c.name}
                        </Link>
                        <span className="font-medium text-orange-700">{fmt(c.balance)}</span>
                      </div>
                    ))}
                  </>
                )}
                {!isLoading && (data?.assets.current.medicine_inventory ?? 0) > 0 && (
                  <div className="flex justify-between items-center py-1.5 text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <Package size={14} className="text-slate-400" />
                      {t('bs.medicine_inventory', 'Medicine Inventory')}
                    </span>
                    <span className="font-medium text-slate-800">{fmt(data!.assets.current.medicine_inventory)}</span>
                  </div>
                )}
                {!isLoading && (data?.assets.current.feed_inventory ?? 0) > 0 && (
                  <div className="flex justify-between items-center py-1.5 text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <Package size={14} className="text-slate-400" />
                      {t('bs.feed_inventory', 'Feed Inventory')}
                    </span>
                    <span className="font-medium text-slate-800">{fmt(data!.assets.current.feed_inventory)}</span>
                  </div>
                )}
                {!isLoading && (data?.assets.current.total_supplier_prepaid ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between items-center pt-2 pb-0.5 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <UserCheck size={12} />
                        {t('bs.supplier_prepaid')}
                      </span>
                    </div>
                    {(data?.assets.current.supplier_prepaid ?? []).map(s => (
                      <div key={s.id} className="flex justify-between items-center py-1 text-sm ps-4">
                        <span className="text-slate-600 truncate max-w-[180px]">{s.name}</span>
                        <span className="font-medium text-blue-700">{fmt(s.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <SubTotal label={t('bs.total_current', 'Total Current Assets')}
                value={(data?.assets.current.total_cash ?? 0)
                     + (data?.assets.current.total_receivables ?? 0)
                     + (data?.assets.current.medicine_inventory ?? 0)
                     + (data?.assets.current.feed_inventory ?? 0)
                     + (data?.assets.current.total_supplier_prepaid ?? 0)}
                loading={isLoading} />
            </div>

            {/* Fixed Assets */}
            <div className="px-4 py-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-2">{t('bs.fixed_assets', 'Fixed Assets')}</p>

              {/* Livestock */}
              <div className="flex justify-between items-center py-1.5 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Package size={14} className="text-slate-400" />
                  {t('bs.livestock', 'Livestock (at cost)')}
                </span>
                {isLoading
                  ? <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                  : <span className="font-medium text-slate-800">{fmt(data?.assets.fixed.livestock_value ?? 0)}</span>
                }
              </div>

              {/* Equipment / Furniture / Electronics */}
              {!isLoading && (data?.assets.fixed.total_equipment ?? 0) > 0 && (
                <>
                  <div className="flex justify-between items-center py-1 text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <Package size={14} className="text-slate-400" />
                      {t('bs.equipment', 'Equipment & Furniture (book value)')}
                    </span>
                    <span className="font-medium text-slate-800">{fmt(data?.assets.fixed.total_equipment ?? 0)}</span>
                  </div>
                  {(data?.assets.fixed.equipment_list ?? []).map(eq => (
                    <div key={eq.id} className="flex justify-between items-center py-1 text-xs ps-4 text-slate-500">
                      <span className="truncate max-w-[200px]">{eq.name} <span className="text-slate-400">({t(`category.${eq.category}`, { ns: 'assets', defaultValue: eq.category })})</span></span>
                      <span>{fmt(eq.book_value)}</span>
                    </div>
                  ))}
                </>
              )}

              <SubTotal
                label={t('bs.total_fixed', 'Total Fixed Assets')}
                value={(data?.assets.fixed.livestock_value ?? 0) + (data?.assets.fixed.total_equipment ?? 0)}
                loading={isLoading}
              />
            </div>

            {/* Total Assets */}
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-200 flex justify-between items-center">
              <span className="font-bold text-blue-800 text-sm">{t('bs.total_assets', 'TOTAL ASSETS')}</span>
              {isLoading
                ? <div className="h-6 w-28 bg-blue-100 rounded animate-pulse" />
                : <span className="font-bold text-lg text-blue-900">{fmt(data?.assets.total ?? 0)}</span>
              }
            </div>
          </div>
        </div>

        {/* ── LIABILITIES + EQUITY ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Liabilities */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-100">
              <span className="font-bold text-red-800 text-sm">{t('bs.liabilities', 'LIABILITIES')}</span>
            </div>
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-2">{t('bs.accounts_payable', 'Accounts Payable (Suppliers)')}</p>
              <div className="space-y-1">
                {isLoading
                  ? Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)
                  : (data?.liabilities.accounts_payable ?? []).length === 0
                    ? <p className="text-xs text-slate-400 py-2">{t('bs.no_payables', 'No outstanding payables')}</p>
                    : (data?.liabilities.accounts_payable ?? []).map(s => (
                        <div key={s.id} className="flex justify-between items-center py-1.5 text-sm">
                          <span className="text-slate-600">{s.name}</span>
                          <span className="font-medium text-red-700">{fmt(s.due)}</span>
                        </div>
                      ))
                }
              </div>
              <SubTotal label={t('bs.total_payables', 'Total Payables')} value={data?.liabilities.total ?? 0} loading={isLoading} color="red" />
            </div>
          </div>

          {/* Equity */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
              <span className="font-bold text-purple-800 text-sm">{t('bs.equity', 'EQUITY')}</span>
            </div>
            <div className="px-4 py-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-2">{t('bs.partner_equity', "Partners' Capital")}</p>
              <div className="space-y-1">
                {isLoading
                  ? Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)
                  : (data?.equity.partner_equity ?? []).map(p => (
                      <div key={p.id} className="flex justify-between items-center py-1.5 text-sm">
                        <span className="flex items-center gap-2 text-slate-600">
                          <Users size={14} className="text-slate-400" />
                          {p.name}
                        </span>
                        <span className={`font-medium ${p.equity >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{fmt(p.equity)}</span>
                      </div>
                    ))
                }
              </div>

              <div className="flex justify-between items-center py-1.5 text-sm border-t border-slate-100 mt-1">
                <span className="flex items-center gap-2 text-slate-600">
                  <TrendingUp size={14} className="text-slate-400" />
                  {t('bs.retained_earnings', 'Retained Earnings')}
                </span>
                {isLoading
                  ? <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                  : <span className={`font-medium ${(data?.equity.retained_earnings ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {(data?.equity.retained_earnings ?? 0) < 0 ? '−' : ''}{fmt(data?.equity.retained_earnings ?? 0)}
                    </span>
                }
              </div>
              <SubTotal label={t('bs.total_equity', 'Total Equity')} value={data?.equity.total ?? 0} loading={isLoading} color="purple" />
            </div>

            {/* Total L + E */}
            <div className="px-4 py-3 bg-purple-50 border-t border-purple-200 flex justify-between items-center">
              <span className="font-bold text-purple-800 text-sm">{t('bs.total_le', 'TOTAL LIABILITIES + EQUITY')}</span>
              {isLoading
                ? <div className="h-6 w-28 bg-purple-100 rounded animate-pulse" />
                : <span className="font-bold text-lg text-purple-900">
                    {fmt((data?.liabilities.total ?? 0) + (data?.equity.total ?? 0))}
                  </span>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubTotal({ label, value, loading, color = 'blue' }: {
  label: string; value: number; loading: boolean; color?: string;
}) {
  const cls: Record<string, string> = {
    blue:   'bg-blue-50   text-blue-700',
    red:    'bg-red-50    text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className={`-mx-4 px-4 py-2 mt-1 flex justify-between text-xs font-semibold ${cls[color]}`}>
      <span>{label}</span>
      {loading
        ? <div className="h-3 w-20 bg-current opacity-20 rounded animate-pulse" />
        : <span>{fmt(value)}</span>
      }
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex justify-between py-1.5 animate-pulse">
      <div className="h-4 bg-slate-100 rounded w-32" />
      <div className="h-4 bg-slate-100 rounded w-20" />
    </div>
  );
}
