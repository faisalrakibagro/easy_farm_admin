'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { TrendingUp, TrendingDown, ArrowRightLeft, Banknote } from 'lucide-react';
import { localDateStr } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';

const today        = localDateStr();
const firstOfMonth = localDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const fmt  = (n: number) => fmtMoney(Math.abs(n));
const sign = (n: number) => (n >= 0 ? '\u200E+' : '\u200E−') + fmt(n);

interface FlowRow  { label: string; amount: number; category: string }
interface Section  { inflows: FlowRow[]; outflows: FlowRow[]; total_in: number; total_out: number; net: number }
interface CF {
  date_from: string | null;
  date_to:   string | null;
  operating:  Section;
  investing:  Section;
  financing:  Section;
  summary: {
    opening_balance: number;
    net_cash_change: number;
    closing_balance: number;
  };
}

export default function CashFlowPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo,   setDateTo]   = useState(today);

  const { data, isLoading, isError } = useQuery<CF>({
    queryKey: ['cash-flow', dateFrom, dateTo],
    queryFn:  async () =>
      (await api.get('/accounting/cash-flow', { params: { date_from: dateFrom, date_to: dateTo } })).data,
  });

  const netColor = (n: number) => n >= 0 ? 'text-green-700' : 'text-red-600';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('cf.title', 'Cash Flow Statement')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('cf.subtitle', 'Operating · Investing · Financing')}</p>
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

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label={t('cf.operating_net', 'Operating')} value={data?.operating.net  ?? 0} loading={isLoading} icon={<TrendingUp size={18} />} />
        <KpiCard label={t('cf.investing_net', 'Investing')} value={data?.investing.net  ?? 0} loading={isLoading} icon={<ArrowRightLeft size={18} />} />
        <KpiCard label={t('cf.financing_net', 'Financing')} value={data?.financing.net  ?? 0} loading={isLoading} icon={<TrendingDown size={18} />} />
      </div>

      {/* ── Operating Activities ─────────────────────────────────────────── */}
      <CashSection
        title={t('cf.operating', 'Cash from Operating Activities')}
        section={data?.operating}
        loading={isLoading}
        color="blue"
      />

      {/* ── Investing Activities ─────────────────────────────────────────── */}
      <CashSection
        title={t('cf.investing', 'Cash from Investing Activities')}
        section={data?.investing}
        loading={isLoading}
        color="orange"
      />

      {/* ── Financing Activities ─────────────────────────────────────────── */}
      <CashSection
        title={t('cf.financing', 'Cash from Financing Activities')}
        section={data?.financing}
        loading={isLoading}
        color="purple"
      />

      {/* ── Summary ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-ink border-b border-ink-line">
          <span className="font-bold text-white text-sm flex items-center gap-2">
            <Banknote size={16} />{t('cf.summary', 'Cash Position Summary')}
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          <SummaryRow label={t('cf.opening_balance', 'Opening Balance (all accounts)')} value={data?.summary.opening_balance ?? 0} loading={isLoading} />
          <SummaryRow label={t('cf.operating_net',   'Net Operating Cash')}              value={data?.operating.net ?? 0}          loading={isLoading} signed />
          <SummaryRow label={t('cf.investing_net',   'Net Investing Cash')}              value={data?.investing.net ?? 0}          loading={isLoading} signed />
          <SummaryRow label={t('cf.financing_net',   'Net Financing Cash')}              value={data?.financing.net ?? 0}          loading={isLoading} signed />
        </div>
        <div className="px-5 py-4 bg-ink flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
          <span className="font-bold text-white">{t('cf.net_change', 'Net Cash Change')}</span>
          {isLoading
            ? <div className="h-6 w-28 bg-white/20 rounded animate-pulse" />
            : <span className={`font-bold text-xl ${netColor(data?.summary.net_cash_change ?? 0)}`}>
                {sign(data?.summary.net_cash_change ?? 0)}
              </span>
          }
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, loading, icon }: { label: string; value: number; loading: boolean; icon: React.ReactNode }) {
  const pos = value >= 0;
  return (
    <div className={`rounded-xl border p-4 ${pos ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
      <div className={`flex items-center justify-between mb-2 ${pos ? 'text-green-600' : 'text-red-600'}`}>
        <span className="text-xs font-medium opacity-80">{label}</span>
        {icon}
      </div>
      {loading
        ? <div className="h-6 w-20 bg-current opacity-10 rounded animate-pulse" />
        : <p className={`text-xl font-bold ${pos ? 'text-green-800' : 'text-red-700'}`}>
            {value < 0 ? '\u200E−' : '\u200E+'}{fmtMoney(Math.abs(value))}
          </p>
      }
    </div>
  );
}

function CashSection({ title, section, loading, color }: {
  title: string; section?: Section; loading: boolean; color: string;
}) {
  const { t } = useTranslation('finance');
  const cls: Record<string, string> = {
    blue:   'bg-blue-50   text-blue-800   border-blue-100',
    orange: 'bg-orange-50 text-orange-800 border-orange-100',
    purple: 'bg-purple-50 text-purple-800 border-purple-100',
  };
  const netPos = (section?.net ?? 0) >= 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-3 border-b flex items-center justify-between ${cls[color]}`}>
        <span className="font-semibold text-sm">{title}</span>
        {!loading && (
          <span className={`font-bold text-sm ${netPos ? 'text-green-700' : 'text-red-600'}`}>
            {netPos ? '\u200E+' : '\u200E−'}{fmtMoney(Math.abs(section?.net ?? 0))}
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-40" />
                <div className="h-4 bg-slate-100 rounded w-24" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Inflows */}
            {(section?.inflows ?? []).length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-green-600 mb-1.5">{t('cf.inflows')}</p>
                {(section?.inflows ?? []).map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-1 text-sm">
                    <span className="text-slate-600">{r.label}</span>
                    <span className="font-medium text-green-700">+{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Outflows */}
            {(section?.outflows ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1.5">{t('cf.outflows')}</p>
                {(section?.outflows ?? []).map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-1 text-sm">
                    <span className="text-slate-600">{r.label}</span>
                    <span className="font-medium text-red-600">−{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {(section?.inflows ?? []).length === 0 && (section?.outflows ?? []).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-3">{t('cf.no_activity')}</p>
            )}
          </>
        )}
      </div>
      {!loading && (
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between text-xs">
          <span className="text-slate-500">{t('cf.total_in')}: <span className="font-semibold text-green-700">{fmt(section?.total_in ?? 0)}</span></span>
          <span className="text-slate-500">{t('cf.total_out')}: <span className="font-semibold text-red-600">{fmt(section?.total_out ?? 0)}</span></span>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, loading, signed }: {
  label: string; value: number; loading: boolean; signed?: boolean;
}) {
  return (
    <div className="flex justify-between items-center px-5 py-3 text-sm">
      <span className="text-slate-600">{label}</span>
      {loading
        ? <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
        : <span className={`font-semibold ${signed ? (value >= 0 ? 'text-green-700' : 'text-red-600') : 'text-slate-800'}`}>
            {signed ? (value >= 0 ? '\u200E+' : '\u200E−') : ''}{fmt(value)}
          </span>
      }
    </div>
  );
}
