'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActiveSwitch } from '@/components/ui/ActiveSwitch';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, Check, Eye } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { AccountingPaymentAccount } from '@/types';
import TrashLink from '@/components/ui/TrashLink';
import { deleteFailedMsg, failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { PAYMENT_ACCOUNT_TYPE, PaymentAccountTypeLabel } from '@/components/accounting/PaymentAccountType';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtMoney } from '@/lib/format';
import LoadError from '@/components/ui/LoadError';

interface PAForm {
  name: string; type: 'cash' | 'bank' | 'mfs'; bank_name: string;
  account_number: string; mfs_provider: string; opening_balance: string;
  notes: string; is_default: boolean;
}

const DEFAULT: PAForm = {
  name: '', type: 'cash', bank_name: '', account_number: '',
  mfs_provider: '', opening_balance: '0', notes: '', is_default: false,
};

const MFS_PROVIDERS = ['bKash', 'Nagad', 'Rocket', 'Upay', 'SureCash', 'Other'];
const FORM_ID = 'payment-account';
const KNOWN = ['name', 'type', 'bank_name', 'account_number', 'mfs_provider', 'opening_balance', 'is_default', 'notes'];

export default function PaymentAccountsPage() {
  const { t } = useTranslation('finance');
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const canManage = hasPermission('accounting.manage');
  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.put(`/accounting/payment-accounts/${id}`, { is_active: active }),
    onSuccess: (res) => {
      invalidateMoney(qc, [['payment-accounts-trash']]);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg()),
  });
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AccountingPaymentAccount | null>(null);
  const [form, setForm] = useState<PAForm>(DEFAULT);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountingPaymentAccount | null>(null);
  const [snap, setSnap] = useState('');
  useScrollToError(errors, formError);

  const set = <K extends keyof PAForm>(key: K, value: PAForm[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const { data, isLoading, isError, isFetching, refetch } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/accounting/payment-accounts/${id}`),
    onSuccess: (res) => {
      invalidateMoney(qc, [['payment-accounts-trash']]);
      setDeleteTarget(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? trashedMsg());
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? deleteFailedMsg());
    },
  });

  function openCreate() { setEditing(null); setForm(DEFAULT); setSnap(JSON.stringify(DEFAULT)); setFormError(''); setErrors({}); setShowModal(true); }
  function openEdit(pa: AccountingPaymentAccount) {
    setEditing(pa);
    const next: PAForm = {
      name: pa.name, type: pa.type, bank_name: pa.bank_name ?? '',
      account_number: pa.account_number ?? '', mfs_provider: pa.mfs_provider ?? '',
      opening_balance: pa.opening_balance, notes: pa.notes ?? '', is_default: pa.is_default,
    };
    setForm(next);
    setSnap(JSON.stringify(next));
    setFormError(''); setErrors({}); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditing(null); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = tc('form.v.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setFormError('');
    setIsSaving(true);
    try {
      let res;
      if (editing) {
        res = await api.put(`/accounting/payment-accounts/${editing.id}`, form);
        toast.success(res.data?.message ?? savedMsg());
      } else {
        res = await api.post('/accounting/payment-accounts', form);
        toast.success(res.data?.message ?? savedMsg());
      }
      invalidateMoney(qc, [['payment-accounts-trash']]);
      closeModal();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally {
      setIsSaving(false);
    }
  }

  const accounts = data?.payment_accounts ?? [];

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        {canManage && (
          <TrashLink href="/accounting/payment-accounts/trash" grow={false} />
        )}
        {canManage && (
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={16} /> {t('payment_accounts.add')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-36 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-20" />
            </div>
          ))
        ) : isError && accounts.length === 0 ? (
          <LoadError onRetry={() => refetch()} retrying={isFetching} className="col-span-full bg-white rounded-xl border border-slate-200" />
        ) : accounts.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
            {t('payment_accounts.empty')}
          </div>
        ) : accounts.map(pa => {
          const meta = PAYMENT_ACCOUNT_TYPE[pa.type];
          const bal  = pa.balance ?? 0;
          return (
            <div key={pa.id} className={`bg-white rounded-xl border p-5 ${!pa.is_active ? 'opacity-60' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${meta.color}`}>
                    <PaymentAccountTypeLabel type={pa.type} />
                  </span>
                  {pa.is_default && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t('payment_accounts.default')}</span>
                  )}
                </div>
                <div className="flex gap-1 w-full sm:w-auto flex-wrap">
                  <Link
                    href={`/accounting/payment-accounts/${pa.id}`}
                    title={t('payment_accounts.view_ledger')}
                    aria-label={t('payment_accounts.view_ledger')}
                    className="inline-flex items-center justify-center pointer-coarse:size-10 p-1.5 rounded hover:bg-indigo-50 text-indigo-400"
                  >
                    <Eye size={13} />
                  </Link>
                  {canManage && (
                    <button onClick={() => openEdit(pa)} aria-label={tc('btn.edit')} className="p-1.5 rounded hover:bg-blue-50 text-blue-400"><Pencil size={13} /></button>
                  )}
                  {isSuperAdmin && (
                    <button onClick={() => setDeleteTarget(pa)} aria-label={tc('btn.move_to_trash')} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-slate-800 text-lg">{pa.name}</h3>
              {canManage && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ActiveSwitch active={pa.is_active} pending={activeMutation.isPending} onChange={v => activeMutation.mutate({ id: pa.id, active: v })} />
                </div>
              )}

              {pa.type === 'bank' && pa.bank_name && (
                <p className="text-xs text-slate-500 mt-0.5">{pa.bank_name}{pa.account_number ? ` · ${pa.account_number}` : ''}</p>
              )}
              {pa.type === 'mfs' && pa.mfs_provider && (
                <p className="text-xs text-slate-500 mt-0.5">{pa.mfs_provider}{pa.account_number ? ` · ${pa.account_number}` : ''}</p>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-0.5">{t('payment_accounts.current_balance')}</p>
                <p className={`text-2xl font-bold ${bal >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                  {fmtMoney(Math.abs(bal))}
                  {bal < 0 && <span className="text-sm font-normal ms-1 text-red-500">{t('payment_accounts.deficit')}</span>}
                </p>
                <p className="text-xs text-slate-400 mt-1">{t('payment_accounts.opening')} {fmtMoney(parseFloat(pa.opening_balance))}</p>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={deleteTarget?.name ? t('ui.confirm_trash_named', { name: deleteTarget.name }) : tc('confirm.trash_restorable')}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={JSON.stringify(form) !== snap} size="md"
        title={editing ? t('payment_accounts.edit_title') : t('payment_accounts.create_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {editing ? t('common:btn.update') : t('common:btn.create')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />

          <Field name="name" label={t('payment_accounts.field.name')} required error={errors.name}>
            <input id={fieldId('name')} value={form.name} dir="auto" data-autofocus onChange={e => set('name', e.target.value)} className={fieldClass(errors.name)} />
          </Field>

          {!editing && (
            <Field name="type" label={t('common:field.type')} required error={errors.type}>
              <div id={fieldId('type')} role="radiogroup" className="grid grid-cols-3 gap-2">
                {(['cash', 'bank', 'mfs'] as const).map(tp => (
                  <button key={tp} type="button" role="radio" aria-checked={form.type === tp} onClick={() => set('type', tp)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2.5 sm:py-2 rounded-lg border text-sm font-medium transition-colors ${form.type === tp ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    <PaymentAccountTypeLabel type={tp} />
                  </button>
                ))}
              </div>
            </Field>
          )}

          {form.type === 'bank' && (
            <FormRow>
              <Field name="bank_name" label={t('payment_accounts.field.bank_name')} error={errors.bank_name}>
                <input id={fieldId('bank_name')} value={form.bank_name} dir="auto" placeholder="Dutch-Bangla Bank"
                  onChange={e => set('bank_name', e.target.value)} className={fieldClass(errors.bank_name)} />
              </Field>
              <Field name="account_number" label={t('payment_accounts.field.account_number')} error={errors.account_number}>
                <input id={fieldId('account_number')} value={form.account_number} dir="ltr" inputMode="numeric"
                  onChange={e => set('account_number', e.target.value)} className={fieldClass(errors.account_number)} />
              </Field>
            </FormRow>
          )}

          {form.type === 'mfs' && (
            <FormRow>
              <Field name="mfs_provider" label={t('payment_accounts.field.mfs_provider')} error={errors.mfs_provider}>
                <select id={fieldId('mfs_provider')} value={form.mfs_provider} onChange={e => set('mfs_provider', e.target.value)}
                  className={fieldClass(errors.mfs_provider)}>
                  <option value="">{tc('select.placeholder')}</option>
                  {MFS_PROVIDERS.map(p => <option key={p} value={p}>{p === 'Other' ? t('payment_accounts.mfs_other') : p}</option>)}
                </select>
              </Field>
              <Field name="account_number" label={t('payment_accounts.field.phone_account')} error={errors.account_number}>
                <input id={fieldId('account_number')} type="tel" inputMode="tel" dir="ltr" value={form.account_number} placeholder="01XXXXXXXXX"
                  onChange={e => set('account_number', e.target.value)} className={fieldClass(errors.account_number)} />
              </Field>
            </FormRow>
          )}

          <Field name="opening_balance" label={t('payment_accounts.field.opening_balance')} error={errors.opening_balance}>
            <NumberInput id={fieldId('opening_balance')} value={form.opening_balance} prefix="৳" error={errors.opening_balance}
              onChange={v => set('opening_balance', v)} />
          </Field>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input type="checkbox" id={fieldId('is_default')} checked={form.is_default}
              onChange={e => set('is_default', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm font-medium text-slate-600">{t('payment_accounts.field.set_default')}</span>
          </label>

          <Field name="notes" label={t('common:field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={form.notes}
              onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
