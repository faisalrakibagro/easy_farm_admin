'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import { useAuth } from '@/contexts/AuthContext';
import { Partner, PartnerTransaction, AccountingPaymentAccount } from '@/types';
import { ArrowLeft, Phone, Mail, TrendingUp, User, Plus, Check, Pencil, Camera } from 'lucide-react';
import { useRouteId } from '@/lib/hooks';
import { savedMsg, failedMsg } from '@/lib/feedback';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import Modal from '@/components/ui/Modal';
import LoadError from '@/components/ui/LoadError';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtMoney } from '@/lib/format';

const TX_FORM = 'partner-tx';
const EDIT_TX_FORM = 'partner-tx-edit';
const PARTNER_FORM = 'partner-edit';
const TX_KNOWN = ['type', 'amount', 'transaction_date', 'payment_account_id', 'notes'];
const PARTNER_KNOWN = ['photo', 'name', 'phone', 'email', 'share_percentage', 'status', 'notes'];
/** Transaction types where money leaves the account. */
const OUTFLOW: string[] = ['withdrawal', 'profit_share'];

const TX_TYPE_COLORS: Record<PartnerTransaction['type'], string> = {
  investment:   'bg-blue-100 text-blue-700',
  withdrawal:   'bg-red-100 text-red-700',
  profit_share: 'bg-green-100 text-green-700',
  adjustment:   'bg-orange-100 text-orange-700',
};

interface PartnerData {
  partner: Partner;
  transactions: PartnerTransaction[];
  summary: { total_invested: number; total_withdrawn: number; total_adjusted: number; net_investment: number };
}

const EDIT_TX_EMPTY = {
  type: 'investment' as PartnerTransaction['type'],
  amount: '', transaction_date: '',
  payment_account_id: '', notes: '',
};

export default function PartnerDetailPage() {
  const { t } = useTranslation('finance');
  const id = useRouteId();
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const canEdit = hasPermission('partners.edit');
  const isSuperAdmin = hasRole('Super Admin');

  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState({
    type: 'investment' as PartnerTransaction['type'],
    amount: '', transaction_date: localDateStr(),
    payment_account_id: '', notes: '',
  });
  const [txError, setTxError] = useState('');
  const [txFieldErrors, setTxFieldErrors] = useState<Record<string, string>>({});
  const [txSnap, setTxSnap] = useState('');

  const [editingTx, setEditingTx] = useState<PartnerTransaction | null>(null);
  const [editTxForm, setEditTxForm] = useState({ ...EDIT_TX_EMPTY });
  const [editTxError, setEditTxError] = useState('');
  const [editTxErrors, setEditTxErrors] = useState<Record<string, string>>({});
  const [editTxSnap, setEditTxSnap] = useState('');

  const [showEditPartner, setShowEditPartner] = useState(false);
  const [editPartnerForm, setEditPartnerForm] = useState({
    name: '', phone: '', email: '', share_percentage: '',
    status: 'active' as 'active' | 'inactive', notes: '',
    photo: null as File | null,
  });
  const [editPartnerPreview, setEditPartnerPreview] = useState<string | null>(null);
  const [editPartnerError, setEditPartnerError] = useState('');
  const [partnerErrors, setPartnerErrors] = useState<Record<string, string>>({});
  const [partnerSnap, setPartnerSnap] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery<PartnerData>({
    queryKey: ['partner-detail', id],
    queryFn: async () => (await api.get(`/partners/${id}/transactions`)).data,
    enabled: !!id && id !== '0',
  });

  const { data: payAccounts } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const txMutation = useMutation({
    mutationFn: (d: typeof txForm) => api.post(`/partners/${id}/transactions`, d),
    onSuccess: (res) => {
      invalidateMoney(qc, [['partner-detail', id], ['partners']]);
      setShowTxModal(false);
      setTxForm({ type: 'investment', amount: '', transaction_date: localDateStr(), payment_account_id: '', notes: '' });
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setTxFieldErrors(fields);
      if (!Object.keys(fields).length) setTxError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const updateTxMutation = useMutation({
    mutationFn: ({ txId, d }: { txId: number; d: typeof EDIT_TX_EMPTY }) =>
      api.patch(`/partners/${id}/transactions/${txId}`, d),
    onSuccess: (res) => {
      invalidateMoney(qc, [['partner-detail', id], ['partners']]);
      setEditingTx(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setEditTxErrors(fields);
      if (!Object.keys(fields).length) setEditTxError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const updatePartnerMutation = useMutation({
    mutationFn: (form: typeof editPartnerForm) => {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('phone', form.phone);
      fd.append('email', form.email);
      fd.append('share_percentage', form.share_percentage);
      fd.append('status', form.status);
      fd.append('notes', form.notes);
      if (form.photo) fd.append('photo', form.photo);
      fd.append('_method', 'PUT');
      return api.post(`/partners/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      invalidateMoney(qc, [['partner-detail', id], ['partners']]);
      setShowEditPartner(false);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setPartnerErrors(fields);
      if (!Object.keys(fields).length) setEditPartnerError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const openEditPartner = (p: Partner) => {
    const next = {
      name: p.name,
      phone: p.phone ?? '',
      email: p.email ?? '',
      share_percentage: p.share_percentage,
      status: p.status,
      notes: p.notes ?? '',
      photo: null,
    };
    setEditPartnerForm(next);
    setPartnerSnap(JSON.stringify(next));
    setEditPartnerPreview(null);
    setEditPartnerError('');
    setPartnerErrors({});
    setShowEditPartner(true);
  };

  const openTx = () => { setTxSnap(JSON.stringify(txForm)); setTxFieldErrors({}); setTxError(''); setShowTxModal(true); };
  const closeTx = () => { setShowTxModal(false); setTxFieldErrors({}); setTxError(''); };
  const openEditTx = (tx: PartnerTransaction) => {
    const next = {
      type:               tx.type,
      amount:             tx.amount,
      transaction_date:   tx.transaction_date.toString().split('T')[0],
      payment_account_id: tx.payment_account_id?.toString() ?? '',
      notes:              tx.notes ?? '',
    };
    setEditingTx(tx);
    setEditTxForm(next);
    setEditTxSnap(JSON.stringify(next));
    setEditTxError('');
    setEditTxErrors({});
  };
  const setTx = (key: 'amount' | 'transaction_date' | 'payment_account_id' | 'notes', value: string) => {
    setTxForm(f => ({ ...f, [key]: value }));
    if (txFieldErrors[key]) setTxFieldErrors(p => ({ ...p, [key]: '' }));
  };
  const setEditTx = (key: 'amount' | 'transaction_date' | 'payment_account_id' | 'notes', value: string) => {
    setEditTxForm(f => ({ ...f, [key]: value }));
    if (editTxErrors[key]) setEditTxErrors(p => ({ ...p, [key]: '' }));
  };
  const setPartner = (key: 'name' | 'phone' | 'email' | 'share_percentage' | 'notes', value: string) => {
    setEditPartnerForm(f => ({ ...f, [key]: value }));
    if (partnerErrors[key]) setPartnerErrors(p => ({ ...p, [key]: '' }));
  };
  useScrollToError(txFieldErrors, txError);
  useScrollToError(editTxErrors, editTxError);
  useScrollToError(partnerErrors, editPartnerError);

  if (isLoading) return <div className="flex items-center justify-center h-48 text-slate-400">{t('common:ui.loading')}</div>;
  if (!data) return isError ? <LoadError onRetry={() => refetch()} retrying={isFetching} /> : null;

  const { partner, transactions, summary } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 min-w-0 max-w-full">
          <button onClick={() => router.back()} aria-label={t('ui.back')}
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
          </button>
          <h1 className="min-w-0 break-words text-xl font-bold text-slate-800">{partner.name}</h1>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${partner.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {partner.status === 'active' ? t('partners.status.active') : t('partners.status.inactive')}
        </span>
      </div>

      <div className="@container grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-4 [&>*]:min-w-0">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 relative">
          {isSuperAdmin && (
            <button
              onClick={() => openEditPartner(partner)}
              className="absolute top-3 end-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title={t('common:ui.edit')}
              aria-label={t('common:ui.edit')}
            >
              <Pencil size={14} />
            </button>
          )}
          <div className="flex items-center gap-4 mb-4">
            {partner.photo_url
              ? <img src={partner.photo_url} alt={partner.name} loading="lazy" className="w-16 h-16 rounded-full object-cover" />
              : <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center"><User size={24} className="text-slate-400" /></div>
            }
            <div>
              <h2 className="font-semibold text-slate-800">{partner.name}</h2>
              {parseFloat(partner.share_percentage) > 0 && (
                <p className="text-xs text-slate-400 flex items-center gap-1"><TrendingUp size={11} /> {parseFloat(partner.share_percentage)}% {t('partners.detail.profit_share_label')}</p>
              )}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {partner.phone && <div className="flex items-center gap-2 text-slate-600"><Phone size={13} />{partner.phone}</div>}
            {partner.email && <div className="flex items-center gap-2 text-slate-600"><Mail size={13} />{partner.email}</div>}
            {partner.join_date && <div className="text-xs text-slate-400">{t('partners.detail.joined')} {new Date(partner.join_date).toLocaleDateString(localeFor())}</div>}
          </div>
          {partner.notes && <p className="mt-3 text-xs text-slate-400 border-t border-slate-100 pt-3">{partner.notes}</p>}
        </div>

        {/* Summary */}
        <div className="md:col-span-full grid grid-cols-2 gap-4">
          <div className="@container min-w-0 bg-blue-50 rounded-xl border border-blue-100 p-4">
            <p className="text-xs text-slate-500 mb-1">{t('partners.detail.total_invested')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-blue-600">{fmtMoney(summary.total_invested)}</p>
          </div>
          <div className="@container min-w-0 bg-red-50 rounded-xl border border-red-100 p-4">
            <p className="text-xs text-slate-500 mb-1">{t('partners.detail.total_withdrawn')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-red-600">{fmtMoney(summary.total_withdrawn)}</p>
          </div>
          <div className="@container min-w-0 bg-orange-50 rounded-xl border border-orange-100 p-4">
            <p className="text-xs text-slate-500 mb-1">{t('partners.detail.adjustments')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-orange-600">{fmtMoney(summary.total_adjusted)}</p>
          </div>
          <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">{t('partners.detail.net_investment')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-700">{fmtMoney(summary.net_investment)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={openTx}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={15} /> {t('partners.detail.btn.add_transaction')}
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">{t('partners.detail.transaction_history')}</h3>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden divide-y divide-slate-100">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('partners.detail.no_transactions')}</div>
          ) : transactions.map(tx => {
            const txColor = TX_TYPE_COLORS[tx.type];
            const isOutflow = tx.type === 'withdrawal' || tx.type === 'profit_share';
            return (
              <div key={tx.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${txColor}`}>{t(`partners.detail.types.${tx.type}`)}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(tx.transaction_date).toLocaleDateString(localeFor())}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <p className={`font-semibold text-sm ${isOutflow ? 'text-red-600' : 'text-blue-600'}`}>
                      {isOutflow ? '- ' : '+ '}{fmtMoney(parseFloat(tx.amount))}
                    </p>
                    {canEdit && (
                      <button
                        onClick={() => openEditTx(tx)}
                        aria-label={t('common:ui.edit_transaction')}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 ms-1"
                        title={t('common:ui.edit_transaction')}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                  <div className="text-slate-500">{t('partner_detail_ext.col_account')}</div>
                  <div className="font-medium text-end text-slate-700">
                    {tx.payment_account ? tx.payment_account.name : <span className="text-slate-400 font-normal">—</span>}
                  </div>
                  {tx.notes && (
                    <>
                      <div className="text-slate-500">{t('partners.detail.col.notes')}</div>
                      <div className="font-medium text-end text-slate-500 truncate">{tx.notes}</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('partners.detail.col.date')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('partners.detail.col.type')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('partners.detail.col.amount')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('partner_detail_ext.col_account')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('partners.detail.col.notes')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('partners.detail.no_transactions')}</td></tr>
              ) : transactions.map(tx => {
                const txColor = TX_TYPE_COLORS[tx.type];
                const isOutflow = tx.type === 'withdrawal' || tx.type === 'profit_share';
                return (
                  <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{new Date(tx.transaction_date).toLocaleDateString(localeFor())}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${txColor}`}>{t(`partners.detail.types.${tx.type}`)}</span>
                    </td>
                    <td className={`px-4 py-3 text-end font-semibold ${isOutflow ? 'text-red-600' : 'text-blue-600'}`}>
                      {isOutflow ? '- ' : '+ '}{fmtMoney(parseFloat(tx.amount))}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                      {tx.payment_account ? tx.payment_account.name : <span className="text-slate-400 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{tx.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canEdit && (
                          <button
                            onClick={() => openEditTx(tx)}
                            aria-label={t('common:ui.edit_transaction')}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"
                            title={t('common:ui.edit_transaction')}
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <Modal open={showTxModal} onClose={closeTx} dirty={JSON.stringify(txForm) !== txSnap} size="md"
        title={t('partners.detail.modal_add_title')}
        footer={<>
          <button type="button" onClick={closeTx} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={TX_FORM} disabled={txMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('partners.detail.btn.save_changes')}
          </button>
        </>}>
        <form id={TX_FORM} noValidate className="px-4 sm:px-6 py-5 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            const errs: Record<string, string> = {};
            if (!txForm.amount || parseFloat(txForm.amount) <= 0) errs.amount = t('common:form.v.amount_positive');
            if (!txForm.transaction_date) errs.transaction_date = t('common:form.v.date_required');
            if (!txForm.payment_account_id) errs.payment_account_id = t('common:form.v.account_required');
            setTxFieldErrors(errs);
            setTxError('');
            if (Object.keys(errs).length) return;
            txMutation.mutate(txForm);
          }}>
          <FormAlert message={txError} extra={otherErrors(txFieldErrors, TX_KNOWN)} />
          <Field name="type" label={t('partner_detail_ext.field_type')} required>
            <select id={fieldId('type')} value={txForm.type} onChange={e => setTxForm(f => ({ ...f, type: e.target.value as typeof f.type }))}
              className={fieldClass()}>
              <option value="investment">{t('partners.detail.types.investment')}</option>
              <option value="withdrawal">{t('partners.detail.types.withdrawal')}</option>
              <option value="profit_share">{t('partners.detail.types.profit_share')}</option>
              <option value="adjustment">{t('partners.detail.types.adjustment')}</option>
            </select>
          </Field>
          <FormRow>
            <Field name="amount" label={t('partner_detail_ext.field_amount')} required error={txFieldErrors.amount}>
              <NumberInput id={fieldId('amount')} value={txForm.amount} prefix="৳" placeholder="0" data-autofocus error={txFieldErrors.amount}
                onChange={v => setTx('amount', v)} />
            </Field>
            <Field name="transaction_date" label={t('partner_detail_ext.field_date')} required error={txFieldErrors.transaction_date}>
              <input id={fieldId('transaction_date')} type="date" value={txForm.transaction_date} onChange={e => setTx('transaction_date', e.target.value)}
                className={fieldClass(txFieldErrors.transaction_date)} />
            </Field>
          </FormRow>
          <Field name="payment_account_id" label={t('partners.detail.field.payment_account')} required error={txFieldErrors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={payAccounts?.payment_accounts}
              amount={OUTFLOW.includes(txForm.type) ? txForm.amount : undefined}
              value={txForm.payment_account_id} onChange={v => setTx('payment_account_id', v)} error={txFieldErrors.payment_account_id}
              placeholder={t('partners.detail.field.select_account')} label={t('partners.detail.field.payment_account')} />
          </Field>
          <Field name="notes" label={t('partner_detail_ext.field_notes')} error={txFieldErrors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={txForm.notes} onChange={e => setTx('notes', e.target.value)}
              className={fieldClass(txFieldErrors.notes)} />
          </Field>
        </form>
      </Modal>

      {/* Edit Partner Modal */}
      <Modal open={showEditPartner} onClose={() => setShowEditPartner(false)} dirty={JSON.stringify(editPartnerForm) !== partnerSnap || !!editPartnerForm.photo}
        title={t('partners.detail.modal_edit_partner_title')}
        footer={<>
          <button type="button" onClick={() => setShowEditPartner(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={PARTNER_FORM} disabled={updatePartnerMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('partners.detail.btn.save_changes')}
          </button>
        </>}>
        <form id={PARTNER_FORM} noValidate className="px-4 sm:px-6 py-5 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            setEditPartnerError('');
            const errs: Record<string, string> = {};
            if (!editPartnerForm.name.trim()) errs.name = t('common:form.v.required');
            setPartnerErrors(errs);
            if (Object.keys(errs).length) return;
            updatePartnerMutation.mutate(editPartnerForm);
          }}>
          <FormAlert message={editPartnerError} extra={otherErrors(partnerErrors, PARTNER_KNOWN)} />

          {/* Photo */}
          <div data-field="photo" data-field-error={partnerErrors.photo ? 'true' : undefined} className="flex items-center gap-4">
            <div className="relative shrink-0">
              {editPartnerPreview
                ? <img src={editPartnerPreview} alt="" className="w-16 h-16 rounded-full object-cover" />
                : partner.photo_url
                  ? <img src={partner.photo_url} alt={partner.name} loading="lazy" className="w-16 h-16 rounded-full object-cover" />
                  : <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center"><User size={24} className="text-slate-400" /></div>
              }
              <button type="button" onClick={() => photoInputRef.current?.click()} aria-label={t('partners.detail.field.photo')}
                className="absolute -bottom-1 -end-1 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700">
                <Camera size={14} className="text-white" />
              </button>
            </div>
            <div className="text-xs text-slate-400">
              <p className="font-medium text-slate-600 mb-0.5">{t('partners.detail.field.photo')}</p>
              <p>{t('partners.detail.field.photo_hint')}</p>
              {partnerErrors.photo && <p role="alert" className="text-red-600 mt-1">{partnerErrors.photo}</p>}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0] ?? null;
                setEditPartnerForm(f => ({ ...f, photo: file }));
                setEditPartnerPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </div>

          <Field name="name" label={t('partners.form.name')} required error={partnerErrors.name}>
            <input id={fieldId('name')} type="text" dir="auto" value={editPartnerForm.name} onChange={e => setPartner('name', e.target.value)}
              className={fieldClass(partnerErrors.name)} />
          </Field>

          <FormRow>
            <Field name="phone" label={t('partners.form.phone')} error={partnerErrors.phone}>
              <input id={fieldId('phone')} type="tel" inputMode="tel" dir="ltr" value={editPartnerForm.phone} onChange={e => setPartner('phone', e.target.value)}
                className={fieldClass(partnerErrors.phone)} />
            </Field>
            <Field name="email" label={t('partners.form.email')} error={partnerErrors.email}>
              <input id={fieldId('email')} type="email" dir="ltr" value={editPartnerForm.email} onChange={e => setPartner('email', e.target.value)}
                className={fieldClass(partnerErrors.email)} />
            </Field>
            <Field name="share_percentage" label={t('partners.form.share_percentage')} error={partnerErrors.share_percentage}>
              <NumberInput id={fieldId('share_percentage')} value={editPartnerForm.share_percentage} suffix="%" error={partnerErrors.share_percentage}
                onChange={v => setPartner('share_percentage', v)} />
            </Field>
            <Field name="status" label={t('partners.form.status')} error={partnerErrors.status}>
              <select id={fieldId('status')} value={editPartnerForm.status}
                onChange={e => setEditPartnerForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                className={fieldClass(partnerErrors.status)}>
                <option value="active">{t('partners.status.active')}</option>
                <option value="inactive">{t('partners.status.inactive')}</option>
              </select>
            </Field>
          </FormRow>

          <Field name="notes" label={t('partners.form.notes')} error={partnerErrors.notes}>
            <textarea id={fieldId('notes')} rows={3} dir="auto" value={editPartnerForm.notes} onChange={e => setPartner('notes', e.target.value)}
              className={fieldClass(partnerErrors.notes)} />
          </Field>
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal open={!!editingTx} onClose={() => setEditingTx(null)} dirty={JSON.stringify(editTxForm) !== editTxSnap} size="md"
        title={t('partners.detail.modal_edit_title')}
        footer={<>
          <button type="button" onClick={() => setEditingTx(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={EDIT_TX_FORM} disabled={updateTxMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('partners.detail.btn.save_changes')}
          </button>
        </>}>
        <form id={EDIT_TX_FORM} noValidate className="px-4 sm:px-6 py-5 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (!editingTx) return;
            setEditTxError('');
            const errs: Record<string, string> = {};
            if (!editTxForm.amount || parseFloat(editTxForm.amount) <= 0) errs.amount = t('common:form.v.amount_positive');
            if (!editTxForm.transaction_date) errs.transaction_date = t('common:form.v.date_required');
            setEditTxErrors(errs);
            if (Object.keys(errs).length) return;
            updateTxMutation.mutate({ txId: editingTx.id, d: editTxForm });
          }}>
          <FormAlert message={editTxError} extra={otherErrors(editTxErrors, TX_KNOWN)} />
          <Field name="type" label={t('partner_detail_ext.field_type')} required>
            <select id={fieldId('type')} value={editTxForm.type} onChange={e => setEditTxForm(f => ({ ...f, type: e.target.value as PartnerTransaction['type'] }))}
              className={fieldClass()}>
              <option value="investment">{t('partners.detail.types.investment')}</option>
              <option value="withdrawal">{t('partners.detail.types.withdrawal')}</option>
              <option value="profit_share">{t('partners.detail.types.profit_share')}</option>
              <option value="adjustment">{t('partners.detail.types.adjustment')}</option>
            </select>
          </Field>
          <FormRow>
            <Field name="amount" label={t('partner_detail_ext.field_amount')} required error={editTxErrors.amount}>
              <NumberInput id={fieldId('amount')} value={editTxForm.amount} prefix="৳" error={editTxErrors.amount}
                onChange={v => setEditTx('amount', v)} />
            </Field>
            <Field name="transaction_date" label={t('partner_detail_ext.field_date')} required error={editTxErrors.transaction_date}>
              <input id={fieldId('transaction_date')} type="date" value={editTxForm.transaction_date} onChange={e => setEditTx('transaction_date', e.target.value)}
                className={fieldClass(editTxErrors.transaction_date)} />
            </Field>
          </FormRow>
          <Field name="payment_account_id" label={t('partners.detail.field.payment_account')} error={editTxErrors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={payAccounts?.payment_accounts}
              value={editTxForm.payment_account_id} onChange={v => setEditTx('payment_account_id', v)} error={editTxErrors.payment_account_id}
              placeholder={t('partners.detail.field.select_account')} label={t('partners.detail.field.payment_account')} />
          </Field>
          <Field name="notes" label={t('partner_detail_ext.field_notes')} error={editTxErrors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={editTxForm.notes} onChange={e => setEditTx('notes', e.target.value)}
              className={fieldClass(editTxErrors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
