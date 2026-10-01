'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShowInactiveFilter } from '@/components/ui/ActiveSwitch';
import api from '@/lib/api';
import { Partner, PaginatedResponse, AccountingPaymentAccount } from '@/types';
import { Plus, Check, Trash2, Eye, Phone, TrendingUp, User } from 'lucide-react';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import Modal from '@/components/ui/Modal';
import LoadError from '@/components/ui/LoadError';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtMoney } from '@/lib/format';

const EMPTY_FORM = {
  name: '', notes: '', phone: '', email: '', investment_amount: '',
  payment_account_id: '', share_percentage: '', join_date: '',
};
const FORM_ID = 'create-partner';
const KNOWN = ['name', 'phone', 'email', 'investment_amount', 'payment_account_id', 'share_percentage', 'join_date', 'notes', 'photo'];

export default function PartnersPage() {
  const { t } = useTranslation(['finance', 'common']);
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM) || !!photoFile;
  useScrollToError(errors, formError);

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const { data, isLoading, isError, isFetching, refetch } = useQuery<PaginatedResponse<Partner>>({
    queryKey: ['partners', page, showInactive],
    queryFn: async () => (await api.get('/partners', { params: { page, per_page: 20, status: showInactive ? 'inactive' : 'active' } })).data,
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/partners/${id}`),
    onSuccess: (res) => {
      invalidateMoney(qc, [['partners'], ['partners-trash']]);
      setDeleteTarget(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? trashedMsg());
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const hasInvestment = parseFloat(form.investment_amount || '0') > 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('common:form.v.required');
    if (hasInvestment && !form.payment_account_id) e.payment_account_id = t('partners.error.investment_account_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    setIsSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        const numericKeys = ['investment_amount', 'share_percentage'];
        if (numericKeys.includes(k)) { if (v !== '') fd.append(k, normalizeNumber(String(v))); }
        else if (String(v) !== '') fd.append(k, String(v));
      });
      if (photoFile) fd.append('photo', photoFile);
      const res = await api.post('/partners', fd);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
      invalidateMoney(qc, [['partners'], ['partners-trash']]);
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      setPhotoFile(null);
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally {
      setIsSaving(false);
    }
  };

  const partners = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('partners.title')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('partners.subtitle')}</p>
        </div>
        <ShowInactiveFilter checked={showInactive} onChange={v => { setShowInactive(v); setPage(1); }} />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/partners/trash" />
          )}
          <button onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(''); setErrors({}); setPhotoFile(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('partners.add')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-12 w-12 bg-slate-100 rounded-full mb-3" />
            <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        )) : partners.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {p.photo_url
                  ? <img src={p.photo_url} alt={p.name} loading="lazy" className="w-12 h-12 rounded-full object-cover" />
                  : <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center"><User size={20} className="text-slate-400" /></div>
                }
                <div>
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.status === 'active' ? t('partners.status.active') : t('partners.status.inactive')}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 w-full sm:w-auto">
                <button onClick={() => { window.location.href = `/partners/${p.id}/`; }} aria-label={t('common:btn.view')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Eye size={14} /></button>
                {isSuperAdmin && (
                  <button onClick={() => setDeleteTarget(p)} aria-label={t('common:btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
            {p.phone && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                <Phone size={11} /> {p.phone}
              </div>
            )}
            {parseFloat(p.share_percentage) > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                <TrendingUp size={11} /> {parseFloat(p.share_percentage)}% {t('partners.share_label')}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
              <p className="text-slate-400">{t('partners.net_investment')}</p>
              <p className="font-semibold text-slate-700">{fmtMoney(p.net_investment ?? 0)}</p>
            </div>
          </div>
        ))}
        {!isLoading && partners.length === 0 && (isError
          ? <LoadError onRetry={() => refetch()} retrying={isFetching} className="col-span-full" />
          : <div className="col-span-full py-12 text-center text-slate-400">{t('partners.empty')}</div>)}
      </div>

      {(data?.total ?? 0) > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{t('common:pagination.page_of', { current: page, total: data?.last_page ?? 1 })} &bull; {t('common:pagination.total_count', { count: data?.total ?? 0 })}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
            <button disabled={page >= (data?.last_page ?? 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common:btn.move_to_trash')}
        message={deleteTarget?.name ? t('ui.confirm_trash_named', { name: deleteTarget.name }) : t('common:confirm.trash_restorable')}
        confirmLabel={t('common:btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} dirty={dirty} title={t('partners.add')}
        footer={<>
          <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {t('partners.add')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />
          <Field name="name" label={t('partners.field.full_name')} required error={errors.name}>
            <input id={fieldId('name')} value={form.name} dir="auto" data-autofocus onChange={e => set('name', e.target.value)} className={fieldClass(errors.name)} />
          </Field>
          <FormRow>
            <Field name="phone" label={t('partners.field.phone')} error={errors.phone}>
              <input id={fieldId('phone')} type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={e => set('phone', e.target.value)} className={fieldClass(errors.phone)} />
            </Field>
            <Field name="email" label={t('common:field.email')} error={errors.email}>
              <input id={fieldId('email')} type="email" dir="ltr" value={form.email} onChange={e => set('email', e.target.value)} className={fieldClass(errors.email)} />
            </Field>
            <Field name="investment_amount" label={t('partners.field.initial_investment')} error={errors.investment_amount}>
              <NumberInput id={fieldId('investment_amount')} value={form.investment_amount} prefix="৳" placeholder="0.00" error={errors.investment_amount}
                onChange={v => { setForm(f => ({ ...f, investment_amount: v, payment_account_id: v ? f.payment_account_id : '' })); setErrors(p => ({ ...p, investment_amount: '' })); }} />
            </Field>
            {/* Money comes in, so no overdraft warning */}
            <Field name="payment_account_id" label={t('partners.field.received_into')} required={hasInvestment} error={errors.payment_account_id}>
              <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts} disabled={!hasInvestment}
                value={form.payment_account_id} onChange={v => set('payment_account_id', v)} error={errors.payment_account_id}
                placeholder={hasInvestment ? t('partners.field.select_account_placeholder') : t('partners.field.not_specified')}
                label={t('partners.field.received_into')} />
            </Field>
            <Field name="share_percentage" label={t('partners.field.share_percentage')} error={errors.share_percentage}>
              <NumberInput id={fieldId('share_percentage')} value={form.share_percentage} suffix="%" placeholder="0.00" error={errors.share_percentage}
                onChange={v => set('share_percentage', v)} />
            </Field>
            <Field name="join_date" label={t('partners.field.join_date')} error={errors.join_date}>
              <input id={fieldId('join_date')} type="date" value={form.join_date} onChange={e => set('join_date', e.target.value)} className={fieldClass(errors.join_date)} />
            </Field>
          </FormRow>
          <Field name="notes" label={t('common:field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={form.notes} onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
          <Field name="photo" label={t('common:field.photo')} error={errors.photo}>
            <FileAttachInput file={photoFile} onChange={setPhotoFile} accept="image/*"
              labels={{ upload: t('common:btn.upload_file'), change: t('common:btn.change_file'), remove: t('common:btn.remove_file') }} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
