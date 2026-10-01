'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { FarmDashboardCharts, AccountingPaymentAccount } from '@/types';
import Link from '@/components/ui/AppLink';
import HerdWidgets from '@/components/dashboard/HerdWidgets';
import { AreaChart, CHART, DonutChart, IncomeCostChart, SERIES, Sparkline, taka } from '@/components/dashboard/charts';
import { formatBalance, balanceToneClass } from '@/lib/paymentAccountBalance';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight,
  Beef, DollarSign, Package, Pill, Syringe, Weight,
  TrendingUp, TrendingDown, Receipt,
  Wallet, Banknote, Building2, Smartphone, Milk, PieChart, BarChart3, Sparkles, Trophy, Zap,
} from 'lucide-react';
import MilkEntryModal from '@/components/dairy/MilkEntryModal';
import { farmDashboardQuery } from '@/lib/farmQueries';
import { QUICK_ACTION_DEFS } from '@/lib/quickActions';
import LoadError from '@/components/ui/LoadError';
import { localeFor } from '@/lib/languages';
import { fmtMoney, fmtPct } from '@/lib/format';

const PA_TYPE_ICON: Record<string, React.ElementType> = {
  cash: Banknote, bank: Building2, mfs: Smartphone,
};

// Everyday jobs, each shown only to roles that may do it. `modal` opens in place.

const TONES: Record<string, string> = {
  blue:    'from-sky-500 to-blue-600 shadow-blue-500/25',
  green:   'from-emerald-500 to-teal-600 shadow-emerald-500/25',
  amber:   'from-amber-400 to-orange-500 shadow-amber-500/25',
  red:     'from-rose-500 to-red-600 shadow-rose-500/25',
  purple:  'from-violet-500 to-purple-600 shadow-violet-500/25',
  cyan:    'from-cyan-500 to-sky-600 shadow-cyan-500/25',
};

function Section({ title, icon: Icon, children, action }: { title: string; icon?: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
          {Icon && <Icon size={15} className="text-slate-400" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-900/[0.03] ${className}`}>{children}</div>;
}

function StatCard({ title, value, sub, icon: Icon, color = 'blue', valueClass = 'text-slate-800' }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; valueClass?: string;
}) {
  return (
    <Card className="@container min-w-0 p-3.5 sm:p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm font-medium text-slate-500">{title}</span>
        <div className={`grid place-items-center w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-br text-white shadow-lg ${TONES[color] ?? TONES.blue}`}>
          <Icon size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
        </div>
      </div>
      <p className={`amount-fit font-bold tracking-tight ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </Card>
  );
}

/** KPI with a change against last month and a six-month sparkline. */
function KpiCard({ title, value, delta, deltaGood, spark, color, icon: Icon, tone, sub }: {
  title: string; value: string; delta?: number | null; deltaGood?: boolean; spark?: number[];
  color: string; icon: React.ElementType; tone: string; sub?: React.ReactNode;
}) {
  return (
    <Card className="@container min-w-0 p-3.5 sm:p-5 overflow-hidden relative hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1.5 amount-fit font-bold tracking-tight text-slate-800">{value}</p>
        </div>
        <div className={`grid place-items-center w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-br text-white shadow-lg ${TONES[tone]}`}>
          <Icon size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
        </div>
      </div>
      {/* Two cards share a phone row, so the sparkline drops under the change badge there. */}
      <div className="mt-2 flex flex-wrap sm:flex-nowrap items-end justify-between gap-x-3 gap-y-1.5 min-h-9">
        <div className="text-xs">
          {delta !== undefined && delta !== null && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${deltaGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {fmtPct(Math.abs(delta), 0)}
            </span>
          )}
          {sub}
        </div>
        {spark && <div className="w-full sm:w-28 shrink-0"><Sparkline values={spark} color={color} /></div>}
      </div>
    </Card>
  );
}

function pctChange(now: number, before: number): number | null {
  if (!before) return null;
  const pct = ((now - before) / Math.abs(before)) * 100;
  return Math.abs(pct) > 999 ? null : pct;
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const lang = i18n.language;
  const { user, hasRole, hasPermission } = useAuth();
  const [now] = useState(() => new Date());
  const [showMilkEntry, setShowMilkEntry] = useState(false);

  // Super Admin always sees everything; others follow role permissions
  const isSuperAdmin = hasRole('Super Admin');
  const can = (perm: string) => isSuperAdmin || hasPermission(perm);

  const showQuickAccess     = can('dashboard-sections.quick-access');
  const showAnimals         = can('dashboard-sections.animals');
  const showFinancials      = can('dashboard-sections.financials');
  const showExpenses        = can('dashboard-sections.expenses');
  const showTodaysCosts     = can('dashboard-sections.todays-costs');
  const showTopCattle       = can('dashboard-sections.top-cattle');
  const showVaccines        = can('dashboard-sections.vaccines');
  const showAlerts          = can('dashboard-sections.alerts');
  const showProjectedProfit = can('dashboard-sections.projected-profit');
  const showMilk            = can('farm.dairy.view');
  // Account balances are accounting data, not farm data, so they follow the
  // accounting permission rather than a dashboard-section one. A role that
  // cannot open the Cash & Bank page must not see the same figures here.
  const showCashPosition    = can('accounting.view');

  // Shared with the header's alert bell (one cache entry).
  const { data, isLoading, isFetching, refetch } = useQuery(farmDashboardQuery);

  // Chart series (6-month money, 30-day cost split and milk, herd make-up).
  const { data: charts } = useQuery<FarmDashboardCharts>({
    queryKey: ['farm-dashboard-charts'],
    queryFn: async () => (await api.get('/farm/dashboard/charts')).data,
    staleTime: 5 * 60 * 1000,
  });

  // Cash position comes straight from the existing payment-accounts endpoint —
  // the same one the Cash & Bank page uses, balance already computed server-side.
  // Kept as its own query (rather than added to /farm/dashboard) so the figure is
  // live: the dashboard payload is cached 10 minutes, which is too stale for money
  // that someone just moved. `enabled` keeps it from firing for users whose role
  // cannot see accounting at all.
  const { data: paData, isLoading: paLoading } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
    enabled: showCashPosition,
    staleTime: 60 * 1000,
  });

  const cashAccounts = (paData?.payment_accounts ?? []).filter(pa => pa.is_active);
  const totalCash    = cashAccounts.reduce((sum, pa) => sum + (pa.balance ?? 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 sm:h-40 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // The request failed (the query is always enabled): say so and offer a retry
  // instead of leaving the landing page blank.
  if (!data) {
    return (
      <Card>
        <LoadError onRetry={() => refetch()} retrying={isFetching} />
      </Card>
    );
  }

  const { cattle, stock, today_costs, financials, alerts, top_expensive_cattle } = data;

  // ── Chart data ────────────────────────────────────────────────────────
  const locale = localeFor(lang);
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: 'short' });
  const monthly = charts?.monthly ?? [];
  const thisMonth = monthly[monthly.length - 1];
  const lastMonth = monthly[monthly.length - 2];
  const milkDaily = charts?.milk_daily ?? [];
  const milkTotal = milkDaily.reduce((s, d) => s + d.kg, 0);
  const milkDays = milkDaily.filter(d => d.kg > 0).length;
  const milkPeak = Math.max(0, ...milkDaily.map(d => d.kg));

  const costSplit = (() => {
    const rows = charts?.cost_split ?? [];
    const top = rows.slice(0, 5).map((r, i) => ({ key: r.type, label: t(`cost_type.${r.type}`, { defaultValue: r.type }), value: r.amount, color: SERIES[i] }));
    const rest = rows.slice(5).reduce((s, r) => s + r.amount, 0);
    return rest > 0 ? [...top, { key: 'other', label: t('cost_type.other'), value: rest, color: CHART.other }] : top;
  })();

  const centerColor: Record<string, string> = { fattening: CHART.c3, breeding: CHART.c4, dairy: CHART.c2 };
  const herdSlices = Object.entries(charts?.herd.by_center ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ key: k, label: t(`herd.center.${k}`), value: v, color: centerColor[k] ?? CHART.other }));

  const hour = now.getHours();
  const greeting = t(hour < 12 ? 'hero.morning' : hour < 17 ? 'hero.afternoon' : hour < 20 ? 'hero.evening' : 'hero.night');
  const num = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 1 });

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* Compact on phones (no subtitle) so the numbers start higher up. */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl px-4 py-3.5 sm:p-6 lg:p-8 text-white bg-gradient-to-br from-[#0b3b33] via-[#0f2a44] to-[#1b1f4b] shadow-xl shadow-slate-900/10">
        <div className="pointer-events-none absolute -top-24 -end-16 w-80 h-80 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 start-1/3 w-96 h-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs sm:text-sm text-[#a7f3d0]"><Sparkles size={15} className="w-3.5 h-3.5 sm:w-[15px] sm:h-[15px]" />{greeting}</p>
            <h1 className="mt-0.5 sm:mt-1 text-xl sm:text-2xl lg:text-3xl font-bold truncate">{user?.name}</h1>
            <p className="hidden sm:block mt-1 text-sm text-[#cbd5e1]">{t('hero.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      {showQuickAccess && QUICK_ACTION_DEFS.some(a => can(a.perm)) && (
        <Card className="p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3"><Zap size={15} className="text-amber-500" />{t('quick_actions.title')}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {QUICK_ACTION_DEFS.filter(a => can(a.perm)).map(({ key, href, modal, icon: Icon, tone }) => {
              const inner = (
                <>
                  <span className={`grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br text-white shadow-lg ${tone} group-hover:scale-110 transition-transform`}>
                    <Icon size={19} />
                  </span>
                  <span className="text-xs font-medium leading-tight text-slate-600 group-hover:text-slate-900">{t(`quick_actions.${key}`)}</span>
                </>
              );
              const cls = 'group flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 hover:shadow-md px-2 py-3.5 text-center transition-all';
              return modal
                ? <button key={key} type="button" onClick={() => setShowMilkEntry(true)} className={cls}>{inner}</button>
                : <Link key={key} href={href!} className={cls}>{inner}</Link>;
            })}
          </div>
        </Card>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      {(showAnimals || showFinancials) && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {showAnimals && (
            <KpiCard
              title={t('stat.active_animals')} value={num(cattle.active)} icon={Beef} tone="amber" color={CHART.c3}
              sub={<span className="text-slate-400">{(charts?.herd.by_species ?? []).map(s => `${s.name} ${num(s.count)}`).join(' · ') || t('stat.active_sub')}</span>}
            />
          )}
          {showFinancials && thisMonth && (
            <>
              <KpiCard
                title={t('kpi.month_income')} value={taka(thisMonth.income, lang)} icon={TrendingUp} tone="green" color={CHART.c1}
                delta={pctChange(thisMonth.income, lastMonth?.income ?? 0)} deltaGood={(thisMonth.income - (lastMonth?.income ?? 0)) >= 0}
                spark={monthly.map(m => m.income)}
              />
              <KpiCard
                title={t('kpi.month_cost')} value={taka(thisMonth.cost, lang)} icon={Receipt} tone="red" color={CHART.c5}
                delta={pctChange(thisMonth.cost, lastMonth?.cost ?? 0)} deltaGood={(thisMonth.cost - (lastMonth?.cost ?? 0)) <= 0}
                spark={monthly.map(m => m.cost)}
              />
              <KpiCard
                title={t(thisMonth.profit >= 0 ? 'kpi.month_profit' : 'kpi.month_loss')} value={taka(thisMonth.profit, lang)} icon={thisMonth.profit >= 0 ? ArrowUpRight : ArrowDownRight}
                tone={thisMonth.profit >= 0 ? 'blue' : 'red'} color={CHART.c2}
                delta={pctChange(thisMonth.profit, lastMonth?.profit ?? 0)} deltaGood={(thisMonth.profit - (lastMonth?.profit ?? 0)) >= 0}
                spark={monthly.map(m => m.profit)}
                sub={<span className="text-slate-400">{t('kpi.month_profit_sub')}</span>}
              />
            </>
          )}
        </div>
      )}

      {/* ── Money charts ─────────────────────────────────────────────────── */}
      {(showFinancials || showExpenses) && charts && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {showFinancials && (
            <Card className="p-5 xl:col-span-2">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-slate-800"><BarChart3 size={17} className="text-emerald-500" />{t('charts.income_vs_cost')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t('charts.last_6_months')}</p>
                </div>
                <Link href="/farm/reports/profit-centers" className="text-xs font-medium text-emerald-600 hover:underline">{t('charts.details')}</Link>
              </div>
              <IncomeCostChart
                data={monthly.map(m => ({ label: monthLabel(m.month), income: m.income, cost: m.cost, profit: m.profit }))}
                lang={lang}
                labels={{ income: t('charts.income'), cost: t('charts.cost'), profit: t('charts.profit') }}
              />
            </Card>
          )}
          {showExpenses && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800"><PieChart size={17} className="text-violet-500" />{t('charts.cost_split')}</h3>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">{t('charts.last_30_days')}</p>
              {costSplit.length === 0
                ? <p className="py-12 text-center text-sm text-slate-400">{t('charts.no_data')}</p>
                : <DonutChart data={costSplit} lang={lang} centerLabel={t('charts.total_cost')} />}
            </Card>
          )}
        </div>
      )}

      {/* ── Milk and herd charts ─────────────────────────────────────────── */}
      {((showMilk && milkDays > 0) || showAnimals) && charts && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {showMilk && milkDays > 0 && (
            <Card className="p-5 xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-slate-800"><Milk size={17} className="text-sky-500" />{t('charts.milk_trend')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t('charts.last_30_days')}</p>
                </div>
                <div className="flex gap-5 text-end">
                  <div><p className="text-[0.7rem] text-slate-400">{t('charts.total')}</p><p className="font-semibold text-slate-800">{num(milkTotal)} {t('dairy:field.kg')}</p></div>
                  <div><p className="text-[0.7rem] text-slate-400">{t('charts.daily_avg')}</p><p className="font-semibold text-slate-800">{num(milkDays ? milkTotal / milkDays : 0)} {t('dairy:field.kg')}</p></div>
                  <div><p className="text-[0.7rem] text-slate-400">{t('charts.peak')}</p><p className="font-semibold text-slate-800">{num(milkPeak)} {t('dairy:field.kg')}</p></div>
                </div>
              </div>
              <AreaChart
                data={milkDaily.map(d => ({ label: new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }), value: d.kg }))}
                lang={lang} unit={t('dairy:field.kg')} color={CHART.c2}
              />
            </Card>
          )}
          {showAnimals && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800"><Beef size={17} className="text-amber-500" />{t('charts.herd')}</h3>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">{t('charts.herd_sub')}</p>
              {herdSlices.length === 0
                ? <p className="py-12 text-center text-sm text-slate-400">{t('charts.no_data')}</p>
                : <DonutChart data={herdSlices} lang={lang} centerLabel={t('charts.active')} format="count" />}
              {(charts.herd.by_species.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {charts.herd.by_species.map(s => (
                    <span key={s.name} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{s.name} <b className="text-slate-800">{num(s.count)}</b></span>
                  ))}
                  {cattle.sold > 0 && <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs text-sky-700">{t('stat.sold_animals')} <b>{num(cattle.sold)}</b></span>}
                  {cattle.dead > 0 && <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs text-rose-700">{t('stat.dead_animals')} <b>{num(cattle.dead)}</b></span>}
                  {cattle.transferred > 0 && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{t('stat.transferred', { count: cattle.transferred })}</span>}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Breeding, dairy and profit centers (plan phase 4) */}
      <HerdWidgets />

      {/* Cash & Bank position */}
      {showCashPosition && (
        <Section title={t('section.cash_position')} icon={Wallet}>
          {paLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-28 animate-pulse" />
              ))}
            </div>
          ) : cashAccounts.length === 0 ? (
            <Card className="p-6 text-center text-sm text-slate-400">{t('stat.no_accounts')}</Card>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Link
                href="/accounting/payment-accounts"
                className="@container min-w-0 relative overflow-hidden rounded-2xl p-3.5 sm:p-5 text-white bg-gradient-to-br from-[#10b981] to-[#0f766e] shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 transition-all"
              >
                <div className="pointer-events-none absolute -end-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                  <span className="text-xs sm:text-sm font-medium text-[#d1fae5]">{t('stat.total_cash')}</span>
                  <Wallet size={18} className="shrink-0 text-[#d1fae5]" />
                </div>
                <p className="amount-fit font-bold">{formatBalance(totalCash)}</p>
                <p className="text-xs text-[#d1fae5] mt-1">{t('stat.total_cash_sub', { count: cashAccounts.length })}</p>
              </Link>

              {cashAccounts.map(pa => {
                const Icon = PA_TYPE_ICON[pa.type] ?? Banknote;
                const bal  = pa.balance ?? 0;
                return (
                  <Link
                    key={pa.id}
                    href={`/accounting/payment-accounts/${pa.id}`}
                    className="@container min-w-0 bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                      <span className="text-xs sm:text-sm font-medium text-slate-500 truncate" title={pa.name}>{pa.name}</span>
                      <div className="grid place-items-center w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/25">
                        <Icon size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      </div>
                    </div>
                    <p className={`amount-fit font-bold ${balanceToneClass(bal)}`}>{formatBalance(bal)}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {pa.type === 'bank' && pa.bank_name ? pa.bank_name
                        : pa.type === 'mfs' && pa.mfs_provider ? pa.mfs_provider
                        : t(`payment_accounts.types.${pa.type}`, { ns: 'finance' })}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* Financial Stats */}
      {showFinancials && (
        <Section title={t('section.financials')} icon={DollarSign}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard title={t('stat.total_investment')} value={fmtMoney(financials.total_investment)} icon={DollarSign} color="purple" />
            <StatCard
              title={t('stat.actual_profit')}
              value={`${financials.actual_profit < 0 ? '−' : ''}${fmtMoney(Math.abs(financials.actual_profit))}`}
              icon={financials.actual_profit >= 0 ? ArrowUpRight : ArrowDownRight}
              color={financials.actual_profit >= 0 ? 'green' : 'red'}
              sub={financials.actual_profit >= 0 ? t('stat.net_profit') : t('stat.net_loss')}
            />
            {showProjectedProfit && (
              <StatCard
                title={t((financials.projected_profit ?? 0) >= 0 ? 'stat.projected_profit' : 'stat.projected_loss')}
                value={`${(financials.projected_profit ?? 0) < 0 ? '−' : ''}${fmtMoney(Math.abs(financials.projected_profit ?? 0))}`}
                icon={financials.projected_profit >= 0 ? TrendingUp : TrendingDown}
                color={financials.projected_profit >= 0 ? 'green' : 'red'}
                valueClass={(financials.projected_profit ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'}
                sub={t('stat.projected_sub')}
              />
            )}
            <StatCard title={t('stat.feed_stock_value')} value={fmtMoney(stock.feed_value)} icon={Package} color="amber" />
          </div>
        </Section>
      )}

      {/* Today's costs — one line; four cards were mostly ৳0 */}
      {showTodaysCosts && (
        <Card className="px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
          <span className="flex items-center gap-2 font-semibold text-slate-700"><Activity size={15} className="text-emerald-500" />{t('section.todays_costs')}</span>
          <b className="text-slate-800">{fmtMoney(today_costs.total)}</b>
          <span className="text-slate-500">{t('stat.feed_cost')} {fmtMoney(today_costs.feed)}</span>
          <span className="text-slate-500">{t('stat.medicine_cost')} {fmtMoney(today_costs.medicine)}</span>
          <span className="text-slate-500">{t('stat.labour_cost')} {fmtMoney(today_costs.labour)}</span>
        </Card>
      )}

      {/* Top cattle, vaccines and alerts */}
      {((showTopCattle && top_expensive_cattle && top_expensive_cattle.length > 0) || showVaccines || showAlerts) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {showTopCattle && top_expensive_cattle && top_expensive_cattle.length > 0 && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 mb-4"><Trophy size={16} className="text-amber-500" />{t('section.top_expensive')}</h3>
              <div className="space-y-2.5">
                {top_expensive_cattle.map((item, i) => {
                  const max = Number(top_expensive_cattle[0].total_cost) || 1;
                  return (
                    <div key={item.cattle_id}>
                      <div className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`grid place-items-center w-6 h-6 shrink-0 rounded-lg text-[0.7rem] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                          <span className="font-medium text-slate-700 truncate">{item.cattle?.tag_number ?? `#${item.cattle_id}`}</span>
                          {item.cattle?.name && <span className="text-slate-400 text-xs truncate">{item.cattle.name}</span>}
                        </div>
                        <span className="font-semibold text-slate-800 tabular-nums">{fmtMoney(Number(item.total_cost))}</span>
                      </div>
                      <div className="mt-1 ms-8 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${(Number(item.total_cost) / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {showVaccines && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 mb-4"><Syringe size={16} className="text-sky-500" />{t('section.upcoming_vaccines')}</h3>
              {alerts.upcoming_vaccines.length === 0 ? (
                <p className="text-sm text-slate-400">{t('alert.no_vaccines')}</p>
              ) : (
                <div className="space-y-2">
                  {alerts.upcoming_vaccines.slice(0, 5).map(v => (
                    <div key={v.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-700 truncate">{v.cattle?.tag_number} — {v.vaccine_name}</span>
                      <span className="shrink-0 rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{new Date(v.scheduled_date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {showAlerts && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 mb-4"><AlertTriangle size={16} className="text-amber-500" />{t('section.alerts')}</h3>
              <div className="space-y-2">
                {alerts.weight_check_due > 0 && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                    <Weight size={15} className="text-amber-500 shrink-0" />
                    <span className="text-amber-800">{t('alert.weight_check', { count: alerts.weight_check_due })}</span>
                  </div>
                )}
                {alerts.low_feed_stock.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl bg-red-50 px-3 py-2 text-sm">
                    <Package size={15} className="text-red-400 shrink-0" />
                    <span className="text-red-700">{t('alert.low_feed', { name: f.name })}</span>
                  </div>
                ))}
                {alerts.low_medicine_stock.map(m => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-xl bg-red-50 px-3 py-2 text-sm">
                    <Pill size={15} className="text-red-400 shrink-0" />
                    <span className="text-red-700">{t('alert.low_medicine', { name: m.name, qty: m.remaining_quantity, unit: m.unit?.symbol })}</span>
                  </div>
                ))}
                {alerts.expiring_medicines.map(m => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    <span className="text-amber-800">{t('alert.expiring', { name: m.name, date: m.expiry_date ? new Date(m.expiry_date).toLocaleDateString(locale) : '' })}</span>
                  </div>
                ))}
                {alerts.weight_check_due === 0 && alerts.low_feed_stock.length === 0 && alerts.low_medicine_stock.length === 0 && alerts.expiring_medicines.length === 0 && (
                  <p className="text-sm text-slate-400">{t('alert.no_alerts')}</p>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {showMilkEntry && <MilkEntryModal onClose={() => setShowMilkEntry(false)} />}
    </div>
  );
}
