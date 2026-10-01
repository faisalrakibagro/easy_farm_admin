'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, TrendingUp, TrendingDown, BookMarked, Scale, Plus, PenLine,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { AccountingPaymentAccount } from '@/types';
import LedgerTable from '@/components/accounting/entries/LedgerTable';
import ManualEntriesTable from '@/components/accounting/entries/ManualEntriesTable';
import NewEntryModal from '@/components/accounting/entries/NewEntryModal';
import LoadError from '@/components/ui/LoadError';
import { fmt, ENTRY_DEFAULT, type Account, type LedgerResponse, type ManualEntry, type ManualEntriesResponse } from '@/components/accounting/entries/shared';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GeneralLedgerPage() {
  const { t } = useTranslation(['finance', 'common']);
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const canManage = hasPermission('accounting.manage');
  const isSuperAdmin = hasRole('Super Admin');

  // Tab
  const [activeTab, setActiveTab] = useState<'ledger' | 'manual'>('ledger');

  // Ledger filters
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [paymentId, setPaymentId]   = useState('');
  const [voucherType, setVoucherType] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');

  // Manual entries state
  const [manualPage, setManualPage] = useState(1);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ ...ENTRY_DEFAULT });
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManualEntry | null>(null);

  // ── Queries ──

  const { data: paymentAccounts } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const { data: accountsData } = useQuery<{ accounts: Account[] }>({
    queryKey: ['accounting-accounts'],
    queryFn: async () => (await api.get('/accounting/accounts')).data,
  });

  const { data, isLoading, isError, isFetching, refetch } = useQuery<LedgerResponse>({
    queryKey: ['general-ledger', page, search, paymentId, voucherType, dateFrom, dateTo],
    queryFn: async () =>
      (await api.get('/accounting/general-ledger', {
        params: {
          page, per_page: 25,
          search: search || undefined,
          payment_account_id: paymentId || undefined,
          voucher_type: voucherType || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      })).data,
  });

  const { data: manualData, isLoading: manualLoading, isError: manualError, isFetching: manualFetching, refetch: refetchManual } = useQuery<ManualEntriesResponse>({
    queryKey: ['accounting-entries-manual', manualPage],
    queryFn: async () =>
      (await api.get('/accounting/entries', {
        params: { is_auto: 0, page: manualPage, per_page: 20 },
      })).data,
    enabled: activeTab === 'manual',
  });

  // ── Mutations ──

  const deleteEntryMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/accounting/entries/${id}`),
    onSuccess: (res) => {
      invalidateMoney(qc, [['accounting-entries-manual'], ['accounting-accounts']]);
      setDeleteTarget(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? trashedMsg());
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? failedMsg());
    },
  });

  // ── Validation ──

  function validateEntry(): boolean {
    const e: Record<string, string> = {};
    if (!entryForm.account_id) e.account_id = t('common:form.v.required');
    const amt = parseFloat(entryForm.amount);
    if (!entryForm.amount || isNaN(amt) || amt <= 0) e.amount = t('common:form.v.amount_positive');
    if (!entryForm.entry_date) e.entry_date = t('common:form.v.date_required');
    if (!entryForm.description.trim()) e.description = t('common:form.v.required');
    if (entryForm.description.length > 500) e.description = t('common:form.v.max_chars', { max: 500 });
    setEntryErrors(e);
    return !Object.keys(e).length;
  }

  async function submitEntry(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validateEntry()) return;
    setIsSavingEntry(true);
    try {
      await api.post('/accounting/entries', {
        account_id: entryForm.account_id,
        amount: entryForm.amount,
        entry_date: entryForm.entry_date,
        description: entryForm.description,
        source_type: entryForm.source_type || undefined,
        payment_account_id: entryForm.payment_account_id || undefined,
      });
      invalidateMoney(qc, [['accounting-entries-manual'], ['accounting-accounts']]);
      setShowEntryModal(false);
      setEntryForm({ ...ENTRY_DEFAULT });
      setEntryErrors({});
      toast.success(savedMsg());
    } catch (err) {
      const ex = err as { response?: { data?: { message?: string } } };
      setEntryErrors({ _global: ex.response?.data?.message ?? t('common:error.failed_save') });
      toast.error(ex.response?.data?.message ?? failedMsg());
    } finally {
      setIsSavingEntry(false);
    }
  }

  // ── Derived ──

  const rows    = data?.data ?? [];
  const totals  = data?.totals;
  const balance = totals ? totals.balance : 0;
  const accounts = accountsData?.accounts ?? [];
  const manualEntries = manualData?.data ?? [];

  const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? `#${id}`;
  const paName = (id: number | null) => paymentAccounts?.payment_accounts.find(p => p.id === id)?.name ?? null;
  const paType = (id: number | null) => paymentAccounts?.payment_accounts.find(p => p.id === id)?.type ?? 'cash';

  const inputCls = (field: string) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      entryErrors[field] ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
    }`;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Tab switcher ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'ledger' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookMarked size={14} /> {t('entries.ledger_tab')}
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <PenLine size={14} /> {t('entries.manual_tab')}
          </button>
        </div>

        {activeTab === 'manual' && canManage && (
          <button
            onClick={() => { setEntryForm({ ...ENTRY_DEFAULT }); setEntryErrors({}); setShowEntryModal(true); }}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center"
          >
            <Plus size={16} /> {t('entries.new_entry_btn')}
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          GENERAL LEDGER TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingDown size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{t('entries.total_debit')}</p>
                <p className="text-lg font-bold text-red-600">{fmt(totals?.debit ?? 0)}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp size={18} className="text-green-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{t('entries.total_credit')}</p>
                <p className="text-lg font-bold text-green-600">{fmt(totals?.credit ?? 0)}</p>
              </div>
            </div>
            <div className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${balance >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${balance >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                <BookMarked size={18} className={balance >= 0 ? 'text-blue-500' : 'text-red-500'} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{t('entries.net_balance')}</p>
                <p className={`text-lg font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {balance >= 0 ? '' : '\u200E-'}{fmt(balance)}
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[180px] relative">
                <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
                  enterKeyHint="search"
                  placeholder={t('entries.search_placeholder_enter')}
                  className="w-full ps-8 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={paymentId}
                onChange={e => { setPaymentId(e.target.value); setPage(1); }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('entries.filter.all_payment_accounts')}</option>
                {paymentAccounts?.payment_accounts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={voucherType}
                onChange={e => { setVoucherType(e.target.value); setPage(1); }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('entries.filter.all_types')}</option>
                <option value="receipt">{t('entries.voucher_filter.receipt')}</option>
                <option value="payment">{t('entries.voucher_filter.payment')}</option>
                <option value="contra">{t('entries.voucher_filter.contra')}</option>
                <option value="supplier_payment">{t('entries.voucher_filter.supplier_payment')}</option>
                <option value="adjustment">{t('entries.voucher_filter.adjustment')}</option>
                <option value="investment">{t('entries.voucher_filter.investment')}</option>
                <option value="withdrawal">{t('entries.voucher_filter.withdrawal')}</option>
                <option value="profit_share">{t('entries.voucher_filter.profit_share')}</option>
                <option value="cattle_sale">{t('entries.voucher_filter.cattle_sale')}</option>
                <option value="expense">{t('entries.voucher_filter.expense')}</option>
                <option value="feed_purchase">{t('entries.voucher_filter.feed_purchase')}</option>
                <option value="medicine_purchase">{t('entries.voucher_filter.medicine_purchase')}</option>
                <option value="daily_labour">{t('entries.voucher_filter.daily_labour')}</option>
                <option value="treatment">{t('entries.voucher_filter.treatment')}</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 text-sm">{t('common:to')}</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {(search || paymentId || voucherType || dateFrom || dateTo) && (
                <button
                  onClick={() => { setSearch(''); setSearchInput(''); setPaymentId(''); setVoucherType(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  {t('entries.btn.clear_filters')}
                </button>
              )}
              <div className="flex-1" />
              {data && <span className="text-xs text-slate-400">{t('entries.transactions_count', { count: data.total })}</span>}
            </div>
          </div>

          {isError && !data ? (
            <LoadError onRetry={() => refetch()} retrying={isFetching} className="bg-white rounded-xl border border-slate-200" />
          ) : (
            <LedgerTable
              t={t}
              isLoading={isLoading}
              rows={rows}
              data={data}
              totals={totals}
              paymentAccounts={paymentAccounts}
              dateFrom={dateFrom}
              dateTo={dateTo}
              page={page}
              setPage={setPage}
            />
          )}

          {/* Legend */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="font-medium text-slate-600">{t('entries.legend.title')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {t('entries.legend.debit')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> {t('entries.legend.credit')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> {t('entries.legend.balance')}</span>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MANUAL JOURNAL ENTRIES TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            <Scale size={13} className="inline me-1.5 text-amber-500" />
            {t('entries.hint')}
          </div>

          {manualError && !manualData ? (
            <LoadError onRetry={() => refetchManual()} retrying={manualFetching} className="bg-white rounded-xl border border-slate-200" />
          ) : (
            <ManualEntriesTable
              t={t}
              isLoading={manualLoading}
              manualEntries={manualEntries}
              manualData={manualData}
              manualPage={manualPage}
              setManualPage={setManualPage}
              isSuperAdmin={isSuperAdmin}
              accountName={accountName}
              paName={paName}
              paType={paType}
              setDeleteTarget={setDeleteTarget}
            />
          )}

          <ConfirmDialog
            open={!!deleteTarget}
            title={t('entries_ext.confirm_delete_title')}
            message={t('entries_ext.confirm_delete_message')}
            confirmLabel={t('entries_ext.confirm_delete_label')}
            loading={deleteEntryMutation.isPending}
            onConfirm={() => deleteTarget && deleteEntryMutation.mutate(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
          />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          NEW MANUAL ENTRY MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showEntryModal && (
        <NewEntryModal
          t={t}
          entryForm={entryForm}
          setEntryForm={setEntryForm}
          entryErrors={entryErrors}
          setEntryErrors={setEntryErrors}
          accounts={accounts}
          paymentAccounts={paymentAccounts}
          isSavingEntry={isSavingEntry}
          inputCls={inputCls}
          onSubmit={submitEntry}
          onClose={() => setShowEntryModal(false)}
        />
      )}
    </div>
  );
}
