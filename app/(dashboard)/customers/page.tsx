'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ShowInactiveFilter } from '@/components/ui/ActiveSwitch';
import api from '@/lib/api';
import { Customer, CustomerType, PaginatedResponse } from '@/types';
import { Plus, Check, Trash2, Eye, Phone, Search, User, Building2, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg } from '@/lib/feedback';
import Modal from '@/components/ui/Modal';
import Link from '@/components/ui/AppLink';
import LoadError from '@/components/ui/LoadError';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import SearchSelect from '@/components/ui/SearchSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtNum, fmtMoney } from '@/lib/format';

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '', opening_balance: '0', notes: '',
  customer_type_id: '', company_name: '', contact_person: '', trade_license_no: '',
};
const FORM_ID = 'create-customer';
const KNOWN = ['name', 'customer_type_id', 'company_name', 'phone', 'email', 'photo', 'address', 'notes'];

export default function CustomersPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { t: td } = useTranslation('dairy');
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM) || !!photoFile;
  useScrollToError(errors, formError);

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const { data, isLoading, isError, isFetching, refetch } = useQuery<PaginatedResponse<Customer>>({
    queryKey: ['customers', page, search, typeFilter, showInactive],
    queryFn: async () => (await api.get('/customers', { params: { page, per_page: 20, search: search || undefined, customer_type_id: typeFilter || undefined, is_active: showInactive ? 0 : 1 } })).data,
  });

  const { data: customerTypes } = useQuery({
    queryKey: ['customer-types'],
    queryFn: async () => (await api.get('/customer-types')).data.customer_types as CustomerType[],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      invalidateMoney(qc, [['customers'], ['customers-all'], ['customers-trash']]);
      setDeleteTarget(null);
      toast.success(t('customers.msg.moved_to_trash'));
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('customers.msg.failed_delete'));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('customers.error.name_required');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setIsSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'opening_balance') fd.append(k, normalizeNumber(String(v)));
        else if (String(v) !== '') fd.append(k, String(v));
      });
      if (photoFile) fd.append('photo', photoFile);
      const res = await api.post('/customers', fd);
      invalidateMoney(qc, [['customers'], ['customers-all'], ['customers-trash']]);
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      setPhotoFile(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('customers.msg.created'));
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const customers = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('customers.title')}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/customers/trash" label={t('customers.trash_link')} />
          )}
          {hasPermission('customers.create') && (
            <button onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(''); setErrors({}); setPhotoFile(null); setShowModal(true); }}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
              <Plus size={16} /> {t('customers.add')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('customers.search_placeholder')}
            className="w-full ps-9 pe-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{td('field.all_types')}</option>
          {(customerTypes ?? []).map(ct => <option key={ct.id} value={String(ct.id)}>{ct.name}</option>)}
        </select>
        <ShowInactiveFilter checked={showInactive} onChange={v => { setShowInactive(v); setPage(1); }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-10 w-10 bg-slate-100 rounded-full mb-3" />
            <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        )) : customers.map(c => (
          <div key={c.id} className="relative bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {c.photo_url
                  ? <img src={c.photo_url} alt={c.name} loading="lazy" className="w-10 h-10 shrink-0 rounded-full object-cover" />
                  : <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 flex items-center justify-center"><User size={18} className="text-blue-400" /></div>
                }
                <div className="min-w-0">
                  {/* The name's link stretches over the whole card, so a tap anywhere opens the customer. */}
                  <Link href={`/customers/${c.id}`}
                    className="block font-semibold text-slate-800 text-sm break-words hover:text-blue-600 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue-500">
                    {c.company_name || c.name}
                  </Link>
                  {c.company_name && <p className="text-xs text-slate-500 flex items-center gap-1"><Building2 size={11} /> {c.name}</p>}
                  {c.customer_type && <p className="text-xs text-indigo-600 flex items-center gap-1 mb-1"><Tag size={11} /> {c.customer_type.name}</p>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(c.balance ?? 0) > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {(c.balance ?? 0) > 0 ? `${t('customers.balance_due_label')}${fmtNum(c.balance ?? 0, 2)}` : t('customers.settled')}
                  </span>
                </div>
              </div>
              <div className="relative z-10 flex gap-1 shrink-0">
                <button onClick={() => router.push(`/customers/${c.id}`)} aria-label={t('common:btn.view')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Eye size={14} /></button>
                {isSuperAdmin && (
                  <button onClick={() => setDeleteTarget(c)} aria-label={t('customers.confirm_delete_label')}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
            {c.phone && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Phone size={11} /> {c.phone}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
              <p className="text-slate-400">{t('customers.outstanding_label')}</p>
              <p className={`font-semibold ${(c.balance ?? 0) > 0 ? 'text-orange-600' : 'text-slate-700'}`}>
                {fmtMoney(c.balance ?? 0)}
              </p>
            </div>
          </div>
        ))}
        {!isLoading && customers.length === 0 && (isError
          ? <LoadError onRetry={() => refetch()} retrying={isFetching} className="col-span-full" />
          : <div className="col-span-full py-12 text-center text-slate-400">{search || typeFilter || showInactive ? t('common:table.no_results') : t('customers.empty')}</div>)}
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
        title={t('customers.confirm_delete_title')}
        message={t('customers.confirm_delete_message', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('customers.confirm_delete_label')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} dirty={dirty} title={t('customers.modal_title')}
        footer={<>
          <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {t('common:btn.save')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />
          <Field name="name" label={t('customers.field.name')} required error={errors.name}>
            <input id={fieldId('name')} value={form.name} dir="auto" data-autofocus onChange={e => set('name', e.target.value)} className={fieldClass(errors.name)} />
          </Field>
          <FormRow>
            <Field name="customer_type_id" label={td('field.customer_type')} error={errors.customer_type_id}>
              <SearchSelect id={fieldId('customer_type_id')} value={form.customer_type_id} onChange={v => set('customer_type_id', v)} clearable
                label={td('field.customer_type')} placeholder="—" error={errors.customer_type_id}
                options={(customerTypes ?? []).map(ct => ({ value: String(ct.id), label: ct.name }))} />
            </Field>
            <Field name="company_name" label={td('field.company_name')} error={errors.company_name}>
              <input id={fieldId('company_name')} value={form.company_name} dir="auto" onChange={e => set('company_name', e.target.value)} className={fieldClass(errors.company_name)} />
            </Field>
            <Field name="phone" label={t('customers.field.phone')} error={errors.phone}>
              <input id={fieldId('phone')} type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={e => set('phone', e.target.value)} className={fieldClass(errors.phone)} />
            </Field>
            <Field name="email" label={t('customers.field.email')} error={errors.email}>
              <input id={fieldId('email')} type="email" dir="ltr" value={form.email} onChange={e => set('email', e.target.value)} className={fieldClass(errors.email)} />
            </Field>
          </FormRow>
          <Field name="photo" label={t('customers.field.photo')} error={errors.photo}>
            <FileAttachInput file={photoFile} onChange={setPhotoFile} accept="image/*"
              labels={{ upload: t('common:btn.upload_file'), change: t('common:btn.change_file'), remove: t('common:btn.remove_file') }} />
          </Field>
          <Field name="address" label={t('customers.field.address')} error={errors.address}>
            <textarea id={fieldId('address')} rows={2} dir="auto" value={form.address} onChange={e => set('address', e.target.value)} className={fieldClass(errors.address)} />
          </Field>
          <Field name="notes" label={t('customers.field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={form.notes} onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
