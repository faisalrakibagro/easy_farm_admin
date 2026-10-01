'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ActiveSwitch } from '@/components/ui/ActiveSwitch';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import { useAuth } from '@/contexts/AuthContext';
import { Customer, CustomerLedgerEntry, AccountingPaymentAccount } from '@/types';
import { ArrowLeft, Phone, Mail, MapPin, User, Check, Plus, Camera, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRouteId } from '@/lib/hooks';
import { localeFor } from '@/lib/languages';
import { savedMsg, failedMsg } from '@/lib/feedback';
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
import { fmtNum, fmtMoney } from '@/lib/format';

const PAY_FORM = 'customer-payment';
const EDIT_FORM = 'customer-edit';
const PAY_KNOWN = ['type', 'amount', 'payment_date', 'payment_account_id', 'notes'];
const EDIT_KNOWN = ['photo', 'name', 'phone', 'email', 'address', 'notes'];

interface LedgerData {
  customer: Customer;
  transactions: CustomerLedgerEntry[];
  summary: { opening_balance: number; total_sales: number; total_received: number; balance: number };
}

export default function CustomerDetailPage() {
  const { t } = useTranslation('finance');
  const id = useRouteId();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  /* ── Payment modal ─────────────────────────────────────────────────────── */
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    type: 'payment' as 'payment' | 'adjustment',
    amount: '',
    payment_date: localDateStr(),
    payment_account_id: '',
    notes: '',
  });
  const [payError, setPayError] = useState('');
  const [payFieldErrors, setPayFieldErrors] = useState<Record<string, string>>({});
  const [paySnap, setPaySnap] = useState('');

  /* ── Edit customer modal ───────────────────────────────────────────────── */
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', phone: '', email: '', address: '', notes: '',
    photo: null as File | null,
  });
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editError, setEditError] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSnap, setEditSnap] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* ── Queries ───────────────────────────────────────────────────────────── */
  const { data, isLoading, isError, isFetching, refetch } = useQuery<LedgerData>({
    queryKey: ['customer-ledger', id],
    queryFn: async () => (await api.get(`/customers/${id}/ledger`)).data,
    enabled: !!id && id !== '0',
  });

  const { data: payAccounts } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  /* ── Mutations ─────────────────────────────────────────────────────────── */
  const payMutation = useMutation({
    mutationFn: (d: typeof payForm) => api.post(`/customers/${id}/payments`, d),
    onSuccess: (res) => {
      invalidateMoney(qc, [['customer-ledger', id], ['customers'], ['customers-all']]);
      setShowPayModal(false);
      setPayForm({ type: 'payment', amount: '', payment_date: localDateStr(), payment_account_id: '', notes: '' });
      setPayFieldErrors({});
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setPayFieldErrors(fields);
      if (!Object.keys(fields).length) setPayError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  // Once it has money on record it is never deleted: made inactive instead.
  const activeMutation = useMutation({
    mutationFn: (active: boolean) => {
      const fd = new FormData();
      fd.append('is_active', active ? '1' : '0');
      fd.append('_method', 'PUT');
      return api.post(`/customers/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      invalidateMoney(qc, [['customer-ledger', id], ['customers'], ['customers-all']]);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => toast.error(apiFieldErrors(e, failedMsg()).message),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (form: typeof editForm) => {
      const fd = new FormData();
      fd.append('name', form.name);
      if (form.phone) fd.append('phone', form.phone);
      if (form.email) fd.append('email', form.email);
      if (form.address) fd.append('address', form.address);
      if (form.notes) fd.append('notes', form.notes);
      if (form.photo) fd.append('photo', form.photo);
      fd.append('_method', 'PUT');
      return api.post(`/customers/${id}`, fd);
    },
    onSuccess: (res) => {
      invalidateMoney(qc, [['customer-ledger', id], ['customers'], ['customers-all']]);
      setShowEditCustomer(false);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setEditErrors(fields);
      if (!Object.keys(fields).length) setEditError(message);
    },
  });

  const openEditCustomer = (c: Customer) => {
    const next = { name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', notes: c.notes ?? '', photo: null };
    setEditForm(next);
    setEditSnap(JSON.stringify(next));
    setEditPhotoPreview(null);
    setEditError('');
    setEditErrors({});
    setShowEditCustomer(true);
  };

  const openPay = () => { setPaySnap(JSON.stringify(payForm)); setPayFieldErrors({}); setPayError(''); setShowPayModal(true); };
  const closePay = () => { setShowPayModal(false); setPayFieldErrors({}); setPayError(''); };
  const setPay = (key: 'amount' | 'payment_date' | 'payment_account_id' | 'notes', value: string) => {
    setPayForm(f => ({ ...f, [key]: value }));
    if (payFieldErrors[key]) setPayFieldErrors(p => ({ ...p, [key]: '' }));
  };
  const setEdit = (key: 'name' | 'phone' | 'email' | 'address' | 'notes', value: string) => {
    setEditForm(f => ({ ...f, [key]: value }));
    if (editErrors[key]) setEditErrors(p => ({ ...p, [key]: '' }));
  };
  useScrollToError(payFieldErrors, payError);
  useScrollToError(editErrors, editError);

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (isLoading) return <div className="flex items-center justify-center h-48 text-slate-400">{t('common:ui.loading')}</div>;
  if (!data) return isError ? <LoadError onRetry={() => refetch()} retrying={isFetching} /> : null;

  const { customer, transactions, summary } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 min-w-0 max-w-full">
          <button onClick={() => router.back()} aria-label={t('ui.back')}
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} className="rtl:-scale-x-100" />
          </button>
          <h1 className="min-w-0 break-words text-xl font-bold text-slate-800">{customer.name}</h1>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${summary.balance > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
          {summary.balance > 0 ? t('customer_detail.status_due', { amount: fmtNum(summary.balance, 2) }) : t('customer_detail.status_settled')}
        </span>
        {isSuperAdmin
          ? <span className="ms-auto flex items-center gap-2"><ActiveSwitch active={customer.is_active} pending={activeMutation.isPending} onChange={v => activeMutation.mutate(v)} /></span>
          : !customer.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{t('active_switch.inactive')}</span>}
      </div>

      <div className="@container grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-4 [&>*]:min-w-0">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 relative">
          {isSuperAdmin && (
            <button onClick={() => openEditCustomer(customer)}
              className="absolute top-3 end-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title={t('common:ui.edit')} aria-label={t('common:ui.edit')}>
              <Pencil size={14} />
            </button>
          )}
          <div className="flex items-center gap-4 mb-4">
            {customer.photo_url
              ? <img src={customer.photo_url} alt={customer.name} loading="lazy" className="w-16 h-16 rounded-full object-cover" />
              : <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center"><User size={24} className="text-blue-400" /></div>
            }
            <div>
              <h2 className="font-semibold text-slate-800">{customer.name}</h2>
              <p className="text-xs text-slate-400">{t('customers.title')}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {customer.phone && <div className="flex items-center gap-2 text-slate-600"><Phone size={13} />{customer.phone}</div>}
            {customer.email && <div className="flex items-center gap-2 text-slate-600"><Mail size={13} />{customer.email}</div>}
            {customer.address && <div className="flex items-start gap-2 text-slate-600"><MapPin size={13} className="mt-0.5" />{customer.address}</div>}
          </div>
          {customer.notes && <p className="mt-3 text-xs text-slate-400 border-t border-slate-100 pt-3">{customer.notes}</p>}
        </div>

        {/* Summary Cards */}
        <div className="@lg:col-span-full grid grid-cols-1 @lg:grid-cols-3 gap-4">
          <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">{t('customer_detail.summary.opening_balance')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-slate-700">{fmtMoney(summary.opening_balance)}</p>
          </div>
          <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">{t('customer_detail.summary.total_sales')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-red-600">{fmtMoney(summary.total_sales)}</p>
          </div>
          <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">{t('customer_detail.summary.total_received')}</p>
            <p className="amount-fit [--amount-max:1.25rem] font-bold text-green-600">{fmtMoney(summary.total_received)}</p>
          </div>
          <div className={`@container min-w-0 col-span-full rounded-xl border p-4 ${summary.balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-xs text-slate-500 mb-1">{t('customer_detail.summary.outstanding_balance')}</p>
            <p className={`amount-fit font-bold ${summary.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {fmtMoney(summary.balance)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {summary.balance > 0 ? t('customer_detail.summary.hint_due') : summary.balance < 0 ? t('customer_detail.summary.hint_overpaid') : t('customer_detail.summary.hint_settled')}
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex gap-3">
        <button onClick={openPay}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={15} /> {t('customer_detail.btn_record_payment')}
        </button>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">{t('customer_detail.ledger_title')}</h3>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden divide-y divide-slate-100">
          {summary.opening_balance > 0 && (
            <div className="p-4 bg-slate-50">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-sm text-slate-700">{t('customer_detail.opening_balance_row')}</p>
                <p className="font-semibold text-sm text-orange-600">{fmtMoney(summary.opening_balance)}</p>
              </div>
              <p className="text-xs text-slate-400">—</p>
            </div>
          )}
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('customer_detail.no_transactions')}</div>
          ) : transactions.map((tx, i) => (
            <div key={i} className={`p-4 hover:bg-slate-50 ${tx.type === 'sale' ? 'bg-red-50/30' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tx.type === 'sale' && (
                      <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-medium">{t('customer_detail.tx_type.sale')}</span>
                    )}
                    {tx.type === 'sale_payment' && (
                      <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-medium">{t('customer_detail.tx_type.sale_payment')}</span>
                    )}
                    <p className="text-sm text-slate-700">{tx.description}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(tx.date).toLocaleDateString(localeFor())}</p>
                </div>
                <p className={`font-semibold text-sm shrink-0 ${tx.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {fmtMoney(tx.balance)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                <div className="text-slate-500">{t('customer_detail.col.debit')}</div>
                <div className="font-medium text-end text-red-600">{tx.debit > 0 ? fmtMoney(tx.debit) : '—'}</div>
                <div className="text-slate-500">{t('customer_detail.col.credit')}</div>
                <div className="font-medium text-end text-green-600">{tx.credit > 0 ? fmtMoney(tx.credit) : '—'}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('customer_detail.col.date')}</th>
                <th className="text-start px-4 py-3 font-medium text-slate-600">{t('customer_detail.col.description')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('customer_detail.col.debit')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('customer_detail.col.credit')}</th>
                <th className="text-end px-4 py-3 font-medium text-slate-600">{t('customer_detail.col.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.opening_balance > 0 && (
                <tr className="border-b border-slate-100 bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-400 text-xs">—</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{t('customer_detail.opening_balance_row')}</td>
                  <td className="px-4 py-2.5 text-end text-slate-600">{fmtMoney(summary.opening_balance)}</td>
                  <td className="px-4 py-2.5 text-end">—</td>
                  <td className="px-4 py-2.5 text-end font-medium text-orange-600">{fmtMoney(summary.opening_balance)}</td>
                </tr>
              )}
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">{t('customer_detail.no_transactions')}</td></tr>
              ) : transactions.map((tx, i) => (
                <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${tx.type === 'sale' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-500 text-sm">{new Date(tx.date).toLocaleDateString(localeFor())}</td>
                  <td className="px-4 py-2.5 text-slate-700 text-sm">
                    {tx.type === 'sale' && (
                      <span className="inline-block text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5 me-1.5 font-medium">{t('customer_detail.tx_type.sale')}</span>
                    )}
                    {tx.type === 'sale_payment' && (
                      <span className="inline-block text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 me-1.5 font-medium">{t('customer_detail.tx_type.sale_payment')}</span>
                    )}
                    {tx.description}
                  </td>
                  <td className="px-4 py-2.5 text-end text-red-600 text-sm">{tx.debit > 0 ? fmtMoney(tx.debit) : '—'}</td>
                  <td className="px-4 py-2.5 text-end text-green-600 text-sm">{tx.credit > 0 ? fmtMoney(tx.credit) : '—'}</td>
                  <td className={`px-4 py-2.5 text-end font-medium text-sm ${tx.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {fmtMoney(tx.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Payment / Adjustment Modal ─────────────────────────────────────── */}
      <Modal open={showPayModal} onClose={closePay} dirty={JSON.stringify(payForm) !== paySnap} size="md"
        title={t('customer_detail.payment_modal.title')}
        footer={<>
          <button type="button" onClick={closePay} className={btnSecondary}>{t('customer_detail.payment_modal.btn_cancel')}</button>
          <button type="submit" form={PAY_FORM} disabled={payMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('customer_detail.payment_modal.btn_save')}
          </button>
        </>}>
        <form id={PAY_FORM} noValidate className="px-4 sm:px-6 py-5 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            const errs: Record<string, string> = {};
            if (!payForm.amount || parseFloat(payForm.amount) <= 0) errs.amount = t('customer_detail.payment_modal.error_amount');
            if (!payForm.payment_date) errs.payment_date = t('common:form.v.date_required');
            if (payForm.type === 'payment' && !payForm.payment_account_id) errs.payment_account_id = t('customer_detail.payment_modal.error_account');
            setPayFieldErrors(errs);
            setPayError('');
            if (Object.keys(errs).length) return;
            payMutation.mutate(payForm);
          }}>
          <FormAlert message={payError} extra={otherErrors(payFieldErrors, PAY_KNOWN)} />

          <Field name="type" label={t('customer_detail.payment_modal.field_type')} required>
            <select id={fieldId('type')} value={payForm.type}
              onChange={e => {
                setPayForm(f => ({ ...f, type: e.target.value as typeof f.type, payment_account_id: '' }));
                setPayFieldErrors({});
              }}
              className={fieldClass()}>
              <option value="payment">{t('customer_detail.payment_modal.type_payment')}</option>
              <option value="adjustment">{t('customer_detail.payment_modal.type_adjustment')}</option>
            </select>
          </Field>

          <FormRow>
            <Field name="amount" label={t('customer_detail.payment_modal.field_amount')} required error={payFieldErrors.amount}>
              <NumberInput id={fieldId('amount')} value={payForm.amount} prefix="৳" placeholder="0" data-autofocus error={payFieldErrors.amount}
                onChange={v => setPay('amount', v)} />
            </Field>
            <Field name="payment_date" label={t('customer_detail.payment_modal.field_date')} required error={payFieldErrors.payment_date}>
              <input id={fieldId('payment_date')} type="date" value={payForm.payment_date} onChange={e => setPay('payment_date', e.target.value)}
                className={fieldClass(payFieldErrors.payment_date)} />
            </Field>
          </FormRow>

          {/* Payment Account (only for payment type) — money comes in, so no overdraft warning */}
          {payForm.type === 'payment' && (
            <Field name="payment_account_id" label={t('customer_detail.payment_modal.field_payment_account')} required error={payFieldErrors.payment_account_id}>
              <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={payAccounts?.payment_accounts}
                value={payForm.payment_account_id} onChange={v => setPay('payment_account_id', v)} error={payFieldErrors.payment_account_id}
                placeholder={t('customer_detail.payment_modal.select_account')} label={t('customer_detail.payment_modal.field_payment_account')} />
            </Field>
          )}

          <Field name="notes" label={t('customer_detail.payment_modal.field_notes')} error={payFieldErrors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={payForm.notes} onChange={e => setPay('notes', e.target.value)}
              placeholder={payForm.type === 'adjustment' ? t('customer_detail.payment_modal.placeholder_adjustment_notes') : ''}
              className={fieldClass(payFieldErrors.notes)} />
          </Field>
        </form>
      </Modal>

      {/* ── Edit Customer Modal ────────────────────────────────────────────── */}
      <Modal open={showEditCustomer} onClose={() => setShowEditCustomer(false)} dirty={JSON.stringify(editForm) !== editSnap || !!editForm.photo}
        title={t('customer_detail.edit_modal.title')}
        footer={<>
          <button type="button" onClick={() => setShowEditCustomer(false)} className={btnSecondary}>{t('customer_detail.edit_modal.btn_cancel')}</button>
          <button type="submit" form={EDIT_FORM} disabled={updateCustomerMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('customer_detail.edit_modal.btn_save')}
          </button>
        </>}>
        <form id={EDIT_FORM} noValidate className="px-4 sm:px-6 py-5 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            setEditError('');
            const errs: Record<string, string> = {};
            if (!editForm.name.trim()) errs.name = t('common:form.v.required');
            setEditErrors(errs);
            if (Object.keys(errs).length) return;
            updateCustomerMutation.mutate(editForm);
          }}>
          <FormAlert message={editError} extra={otherErrors(editErrors, EDIT_KNOWN)} />

          {/* Photo */}
          <div data-field="photo" data-field-error={editErrors.photo ? 'true' : undefined} className="flex items-center gap-4">
            <div className="relative shrink-0">
              {editPhotoPreview
                ? <img src={editPhotoPreview} alt="" className="w-16 h-16 rounded-full object-cover" />
                : customer.photo_url
                  ? <img src={customer.photo_url} alt={customer.name} loading="lazy" className="w-16 h-16 rounded-full object-cover" />
                  : <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center"><User size={24} className="text-blue-400" /></div>
              }
              <button type="button" onClick={() => photoInputRef.current?.click()} aria-label={t('customer_detail.edit_modal.profile_photo')}
                className="absolute -bottom-1 -end-1 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700">
                <Camera size={14} className="text-white" />
              </button>
            </div>
            <div className="text-xs text-slate-400">
              <p className="font-medium text-slate-600 mb-0.5">{t('customer_detail.edit_modal.profile_photo')}</p>
              <p>{t('customer_detail.edit_modal.photo_hint')}</p>
              {editErrors.photo && <p role="alert" className="text-red-600 mt-1">{editErrors.photo}</p>}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0] ?? null;
                setEditForm(f => ({ ...f, photo: file }));
                setEditPhotoPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </div>

          <Field name="name" label={t('customer_detail.edit_modal.field_name')} required error={editErrors.name}>
            <input id={fieldId('name')} type="text" dir="auto" value={editForm.name} onChange={e => setEdit('name', e.target.value)}
              className={fieldClass(editErrors.name)} />
          </Field>

          <FormRow>
            <Field name="phone" label={t('customer_detail.edit_modal.field_phone')} error={editErrors.phone}>
              <input id={fieldId('phone')} type="tel" inputMode="tel" dir="ltr" value={editForm.phone} onChange={e => setEdit('phone', e.target.value)}
                className={fieldClass(editErrors.phone)} />
            </Field>
            <Field name="email" label={t('customer_detail.edit_modal.field_email')} error={editErrors.email}>
              <input id={fieldId('email')} type="email" dir="ltr" value={editForm.email} onChange={e => setEdit('email', e.target.value)}
                className={fieldClass(editErrors.email)} />
            </Field>
          </FormRow>

          <Field name="address" label={t('customer_detail.edit_modal.field_address')} error={editErrors.address}>
            <input id={fieldId('address')} type="text" dir="auto" value={editForm.address} onChange={e => setEdit('address', e.target.value)}
              className={fieldClass(editErrors.address)} />
          </Field>

          <Field name="notes" label={t('customer_detail.edit_modal.field_notes')} error={editErrors.notes}>
            <textarea id={fieldId('notes')} rows={3} dir="auto" value={editForm.notes} onChange={e => setEdit('notes', e.target.value)}
              className={fieldClass(editErrors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
